/**
 * FirstPromoter API Helper
 *
 * This file handles all communication with the FirstPromoter API.
 * Think of it as the "delivery driver" — it knows how to get to
 * FirstPromoter's kitchen and bring back the food (data).
 */

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

  // Make the actual HTTP request to FirstPromoter
  // fetch() is like sending a letter and waiting for a reply
  const response = await fetch(url, {
    method: options.method || 'GET',
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

  // Check if the request was successful
  // HTTP status codes: 200-299 = success, 400+ = error
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `FirstPromoter API error (${response.status}): ${errorText}`
    );
  }

  // Parse the JSON response and return it
  // .json() converts the text response into a JavaScript object
  return response.json();
}
