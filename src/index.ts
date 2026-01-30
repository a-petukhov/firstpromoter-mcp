/**
 * FirstPromoter MCP Server
 * 
 * This is the main entry point of your MCP server.
 * Think of it as the "front door" of your restaurant - it:
 * 1. Opens the door (starts the server)
 * 2. Greets customers (handles connections)
 * 3. Takes orders (receives tool calls)
 * 4. Delivers food (returns results)
 */

// ============================================================================
// IMPORTS
// ============================================================================
// Think of imports like inviting helpers to your party.
// Each import brings in tools/functions we need.

// McpServer: The main MCP server class - this IS our server
// ResourceTemplate: For creating dynamic resources (we'll use this later)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// StdioServerTransport: Allows communication through standard input/output
// This is for LOCAL testing with Claude Desktop
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// z (Zod): A library for validating data
// Like a bouncer checking IDs at a club - makes sure data is the right "shape"
import { z } from "zod";

// ============================================================================
// CONFIGURATION
// ============================================================================
// These are the settings for connecting to FirstPromoter's API.
// For Phase 1, we read them from environment variables (like a secure note).

// Get FirstPromoter credentials from environment variables
// The "|| ''" part means "if not found, use empty string" (prevents errors)
const FP_BEARER_TOKEN = process.env.FP_BEARER_TOKEN || '';
const FP_ACCOUNT_ID = process.env.FP_ACCOUNT_ID || '';

// Base URL for FirstPromoter API v2
const FP_API_BASE = 'https://api.firstpromoter.com/api/v2/company';

// ============================================================================
// HELPER FUNCTIONS
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
async function callFirstPromoterAPI(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
    queryParams?: Record<string, string>;
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

// ============================================================================
// CREATE THE MCP SERVER
// ============================================================================

// Create a new MCP server instance
// Think of this as building the actual restaurant building
const server = new McpServer({
  name: "firstpromoter-mcp",           // The name clients will see
  version: "1.0.0",                     // Version number
});

// Note: Capabilities are automatically determined based on what we register
// (tools, resources, prompts). The SDK handles this for us!

// ============================================================================
// REGISTER TOOLS
// ============================================================================
// Tools are actions the AI can perform. Like items on a menu.

/**
 * Tool: get_promoters
 * 
 * Lists all promoters (affiliates) from your FirstPromoter account.
 * This is like asking "show me all my sales partners"
 */
server.registerTool(
  // Tool name - this is what the AI calls to use this tool
  "get_promoters",
  
  // Tool metadata - description and parameters
  {
    title: "Get Promoters",
    description: "List all promoters (affiliates) from your FirstPromoter account. " +
                 "You can filter by state (pending, accepted, blocked, etc.) and paginate results.",
    
    // inputSchema: What parameters this tool accepts
    // Using Zod to define and validate the expected inputs
    inputSchema: {
      // State filter - optional, can be one of several values
      state: z.enum([
        'pending',      // Waiting for approval
        'accepted',     // Active promoters
        'blocked',      // Blocked promoters
        'archived'      // Archived promoters
      ]).optional().describe("Filter promoters by their state"),
      
      // Page number for pagination - optional, defaults to page 1
      page: z.number()
        .int()          // Must be a whole number
        .positive()     // Must be positive (1, 2, 3, etc.)
        .optional()
        .describe("Page number for pagination (starts at 1)"),
      
      // Items per page - optional
      per_page: z.number()
        .int()
        .min(1)
        .max(100)       // FirstPromoter's limit
        .optional()
        .describe("Number of promoters per page (max 100)"),
    }
  },
  
  // The actual function that runs when this tool is called
  // This is like the recipe the chef follows
  async (args) => {
    try {
      // Build query parameters from the provided arguments
      const queryParams: Record<string, string> = {};
      
      if (args.state) {
        queryParams.state = args.state;
      }
      if (args.page) {
        queryParams.page = args.page.toString();
      }
      if (args.per_page) {
        queryParams.per_page = args.per_page.toString();
      }

      // Call the FirstPromoter API
      const result = await callFirstPromoterAPI('/promoters', { queryParams });
      
      // Return the result in MCP's expected format
      // "content" is an array of content blocks
      return {
        content: [
          {
            type: "text" as const,
            // Convert the result to a nicely formatted JSON string
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
      
    } catch (error) {
      // If something goes wrong, return the error message
      // This helps the AI understand what went wrong
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
        
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching promoters: ${errorMessage}`
          }
        ],
        isError: true  // Mark this as an error response
      };
    }
  }
);

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
    console.error('FirstPromoter MCP Server running on stdio');
    console.error('Credentials configured:', FP_BEARER_TOKEN ? 'Yes' : 'No');
  } else {
    console.error('Usage: tsx src/index.ts [--stdio]');
    console.error('');
    console.error('For Phase 1, only stdio transport is supported.');
    console.error('HTTP transport will be added in Phase 2.');
    process.exit(1);
  }
}

// Run the main function
// .catch() handles any errors that occur during startup
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
