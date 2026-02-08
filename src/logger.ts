/**
 * Lightweight Logger for MCP Server
 *
 * Uses stderr (console.error) because stdout is reserved for MCP protocol messages.
 * Configure via LOG_LEVEL env var: debug | info | warn | error (default: info)
 */

// Log levels ordered by severity — lower number = more verbose
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LEVELS;

// Read LOG_LEVEL from env, default to "info"
const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentLevel: number = LEVELS[configuredLevel as LogLevel] ?? LEVELS.info;

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LEVELS[level] < currentLevel) return;

  const timestamp = new Date().toISOString();
  const tag = level.toUpperCase().padEnd(5); // "INFO " or "DEBUG"
  const suffix = data ? ' ' + JSON.stringify(data) : '';

  // stderr only — stdout is the MCP protocol channel
  console.error(`[${timestamp}] ${tag} ${message}${suffix}`);
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log('debug', msg, data),
  info:  (msg: string, data?: Record<string, unknown>) => log('info', msg, data),
  warn:  (msg: string, data?: Record<string, unknown>) => log('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log('error', msg, data),
};
