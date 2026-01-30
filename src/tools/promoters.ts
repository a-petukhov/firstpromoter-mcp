/**
 * Promoter Tools
 *
 * This file defines all MCP tools related to promoters (affiliates).
 * Each tool is like a menu item — the AI can "order" it to get data.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callFirstPromoterAPI } from '../api.js';
import { formatPromoters, buildToolResponse } from '../formatters.js';

/**
 * Registers all promoter-related tools with the MCP server.
 */
export function registerPromoterTools(server: McpServer): void {

  /**
   * Tool: get_promoters
   *
   * Lists all promoters (affiliates) from your FirstPromoter account.
   * This is like asking "show me all my sales partners"
   */
  server.registerTool(
    "get_promoters",

    {
      title: "Get Promoters",
      description:
        "List all promoters (affiliates) from your FirstPromoter account. " +
        "You can filter by state (pending, accepted, blocked, etc.) and paginate results. " +
        "IMPORTANT: When presenting results, always cite exact field values " +
        "(website, email, name) directly from the returned data. " +
        "Each promoter's fields are independent — do not infer or guess.",

      inputSchema: {
        state: z.enum([
          'pending',      // Waiting for approval
          'accepted',     // Active promoters
          'blocked',      // Blocked promoters
          'archived'      // Archived promoters
        ]).optional().describe("Filter promoters by their state"),

        page: z.number()
          .int()
          .positive()
          .optional()
          .describe("Page number for pagination (starts at 1)"),

        per_page: z.number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Number of promoters per page (max 100)"),
      }
    },

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

        // Format the response: structured summary + raw JSON
        const summary = formatPromoters(result);
        const responseText = buildToolResponse(summary, result);

        return {
          content: [
            {
              type: "text" as const,
              text: responseText
            }
          ]
        };

      } catch (error) {
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
          isError: true
        };
      }
    }
  );
}
