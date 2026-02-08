/**
 * FirstPromoter MCP Server — Entry Point
 *
 * This is the main entry point of your MCP server.
 * Think of it as the "front door" of your restaurant — it:
 * 1. Opens the door (starts the server)
 * 2. Greets customers (handles connections)
 * 3. Delegates to the kitchen (tools handle the actual work)
 *
 * The actual tools, API logic, and formatters live in separate files:
 * - src/api.ts          — API communication helper
 * - src/formatters.ts   — Response formatting for AI clients
 * - src/tools/          — Tool definitions (one file per resource)
 */

// ============================================================================
// IMPORTS
// ============================================================================

// McpServer: The main MCP server class — this IS our server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// StdioServerTransport: Allows communication through standard input/output
// This is for LOCAL testing with Claude Desktop
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Tool registry — registers all tools with the server
import { registerAllTools } from './tools/index.js';

// Logger — outputs to stderr (stdout is reserved for MCP protocol)
import { logger } from './logger.js';

// ============================================================================
// CREATE THE MCP SERVER
// ============================================================================

// Create a new MCP server instance
// Think of this as building the actual restaurant building
const server = new McpServer({
  name: "firstpromoter-mcp",           // The name clients will see
  version: "1.0.0",                     // Version number
});

// Register all tools (promoters, and future: referrals, commissions, etc.)
registerAllTools(server);

// ============================================================================
// START THE SERVER
// ============================================================================

/**
 * Main function to start the server
 *
 * We use an async function because starting servers involves waiting
 * (like waiting for the oven to preheat before cooking)
 */
async function main() {
  // Check for command line arguments
  // process.argv contains: [node, script.js, ...other args]
  const args = process.argv.slice(2);

  // For Phase 1, we only support stdio transport (local testing)
  // In Phase 2, we'll add HTTP transport for remote access
  if (args.includes('--stdio') || args.length === 0) {
    // Create a stdio transport (communicates through standard input/output)
    const transport = new StdioServerTransport();

    // Connect the server to the transport
    // This is like plugging in the phone line
    await server.connect(transport);

    // Log to stderr (not stdout, which is used for MCP messages)
    logger.info('FirstPromoter MCP Server running on stdio');
  } else {
    logger.error('Usage: tsx src/index.ts [--stdio]');
    logger.error('For Phase 1, only stdio transport is supported.');
    logger.error('HTTP transport will be added in Phase 2.');
    process.exit(1);
  }
}

// Run the main function
// .catch() handles any errors that occur during startup
main().catch((error) => {
  logger.error('Failed to start server', { error: String(error) });
  process.exit(1);
});
