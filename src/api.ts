/**
 * FirstPromoter API Helper
 *
 * This file handles all communication with the FirstPromoter API.
 * Think of it as the "delivery driver" — it knows how to get to
 * FirstPromoter's kitchen and bring back the food (data).
 *
 * Includes:
 * - Error parsing with actionable messages per status code
 * - Sliding-window rate limiter (stays under 400 req/min)
 * - Automatic retry with exponential backoff on 429 / 5xx
 * - Request/response logging to stderr
 */

import { logger } from './logger.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Get FirstPromoter credentials from environment variables
// The "|| ''" part means "if not found, use empty string" (prevents errors)
const FP_BEARER_TOKEN = process.env.FP_BEARER_TOKEN || '';
const FP_ACCOUNT_ID = process.env.FP_ACCOUNT_ID || '';

// Base URL for FirstPromoter API v2
const FP_API_BASE = 'https://api.firstpromoter.com/api/v2/company';

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom error class for FirstPromoter API errors.
 * Carries the HTTP status code so callers can inspect it if needed.
 */
export class FirstPromoterAPIError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'FirstPromoterAPIError';
  }
}

/**
 * Parse the API error body to extract a human-readable detail string.
 * FirstPromoter may return JSON with "error", "message", or "errors" fields,
 * or plain text. We try JSON first, then fall back to truncated raw text.
 */
function parseErrorDetail(raw: string): string {
  try {
    const json = JSON.parse(raw);
    if (typeof json.error === 'string') return json.error;
    if (typeof json.message === 'string') return json.message;
    if (Array.isArray(json.errors)) return json.errors.join('; ');
    // If it's a JSON object but none of the expected fields, stringify compactly
    return JSON.stringify(json).slice(0, 200);
  } catch {
    // Not JSON — return truncated raw text
    return raw.slice(0, 200);
  }
}

/**
 * Build an actionable error message based on the HTTP status code.
 */
function buildErrorMessage(status: number, raw: string): string {
  const detail = parseErrorDetail(raw);
  const suffix = detail ? ` — ${detail}` : '';

  switch (status) {
    case 401:
      return 'Authentication failed — check your FP_BEARER_TOKEN and FP_ACCOUNT_ID';
    case 403:
      return `Access denied — your API token does not have permission${suffix}`;
    case 404:
      return `Not found — the requested resource does not exist${suffix}`;
    case 422:
      return `Validation error — the request data is invalid${suffix}`;
    case 429:
      return 'Rate limit exceeded — too many requests to FirstPromoter API';
    default:
      if (status >= 500 && status <= 504) {
        return `FirstPromoter server error (${status}) — service may be temporarily unavailable${suffix}`;
      }
      return `FirstPromoter API error (${status})${suffix}`;
  }
}

// ============================================================================
// RATE LIMITER — sliding window, 400 req/min with 380 safe buffer
// ============================================================================

const RATE_WINDOW_MS = 60_000;  // 60 seconds
const RATE_LIMIT = 380;         // safe buffer below 400/min
const requestTimestamps: number[] = [];

/**
 * Wait if we're approaching the rate limit.
 * Cleans old timestamps, then delays if at the limit.
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();

  // Remove timestamps older than the window
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_WINDOW_MS) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= RATE_LIMIT) {
    // Calculate how long until the oldest request exits the window
    const waitMs = requestTimestamps[0] + RATE_WINDOW_MS - now + 50; // +50ms buffer
    logger.warn(`Rate limiter: pausing ${waitMs}ms`, { queued: requestTimestamps.length });
    await sleep(waitMs);
  }

  requestTimestamps.push(Date.now());
}

// ============================================================================
// RETRY LOGIC — exponential backoff on 429 / 5xx
// ============================================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate how long to wait before retrying.
 * Uses Retry-After header if present, otherwise exponential backoff.
 */
function getRetryDelay(attempt: number, response: Response): number {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds * 1000;
  }
  // Exponential backoff: 1s, 2s, 4s
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 504);
}

// ============================================================================
// API HELPER
// ============================================================================

/**
 * Makes a request to the FirstPromoter API
 *
 * This is like a waiter going to the kitchen (FirstPromoter) to get food (data).
 *
 * @param endpoint - The specific API endpoint (e.g., "/promoters")
 * @param options - Additional options for the request
 * @returns The data from FirstPromoter
 */
export async function callFirstPromoterAPI(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
    queryParams?: Record<string, string> | URLSearchParams;
  } = {}
): Promise<unknown> {
  // Check if credentials are configured
  if (!FP_BEARER_TOKEN || !FP_ACCOUNT_ID) {
    throw new Error(
      'FirstPromoter credentials not configured. ' +
      'Please set FP_BEARER_TOKEN and FP_ACCOUNT_ID environment variables.'
    );
  }

  // Build the URL with query parameters if any
  let url = `${FP_API_BASE}${endpoint}`;

  if (options.queryParams) {
    // URLSearchParams converts an object like {page: "1"} into "?page=1"
    const params = new URLSearchParams(options.queryParams);
    url += `?${params.toString()}`;
  }

  const method = options.method || 'GET';

  // Retry loop
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Wait if we're near the rate limit
    await waitForRateLimit();

    const startMs = Date.now();
    logger.debug(`API request: ${method} ${endpoint}`);

    let response: Response;
    try {
      // Make the actual HTTP request to FirstPromoter
      response = await fetch(url, {
        method,
        headers: {
          // Authorization: Like showing your ID card
          'Authorization': `Bearer ${FP_BEARER_TOKEN}`,
          // Account-ID: Like saying which office you're visiting
          'Account-ID': FP_ACCOUNT_ID,
          // Content-Type: Like saying "I'm speaking English"
          'Content-Type': 'application/json',
        },
        // body: The actual data we're sending (if any)
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (err) {
      // Network-level error (DNS, timeout, connection refused)
      const durationMs = Date.now() - startMs;
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`API network error: ${method} ${endpoint}`, { durationMs, error: errMsg });

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        logger.warn(`Retrying (${attempt + 1}/${MAX_RETRIES}) in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw new Error(`Network error calling FirstPromoter API: ${errMsg}`);
    }

    const durationMs = Date.now() - startMs;

    // Check if the request was successful
    if (response.ok) {
      logger.debug(`API response: ${response.status} ${method} ${endpoint}`, { durationMs });
      // Parse the JSON response and return it
      return response.json();
    }

    // Error path — read the body once
    const errorText = await response.text();

    // Retry on 429 or 5xx (if we have attempts left)
    if (isRetryable(response.status) && attempt < MAX_RETRIES) {
      const delay = getRetryDelay(attempt, response);
      logger.warn(
        `API error ${response.status} on ${method} ${endpoint} — retrying (${attempt + 1}/${MAX_RETRIES}) in ${delay}ms`,
        { durationMs },
      );
      await sleep(delay);
      continue;
    }

    // Non-retryable error or retries exhausted — throw with actionable message
    const message = buildErrorMessage(response.status, errorText);
    logger.error(`API error: ${method} ${endpoint} → ${response.status}`, { durationMs, message });
    throw new FirstPromoterAPIError(message, response.status, parseErrorDetail(errorText));
  }

  // This should never be reached, but TypeScript needs it
  throw new Error('Unexpected: retry loop exited without returning or throwing');
}
