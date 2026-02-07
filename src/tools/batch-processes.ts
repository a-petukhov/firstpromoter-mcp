/**
 * Batch Process Tools
 *
 * These tools let you check the status of asynchronous batch operations.
 * When you perform a batch action (accept promoters, approve commissions, etc.)
 * with more than 5 IDs, it runs asynchronously and returns a batch process ID.
 * Use these tools to check if the batch finished and whether it succeeded.
 *
 * All 3 endpoints are read-only (GET).
 *
 * API base: GET /batch_processes
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callFirstPromoterAPI } from '../api.js';
import { formatBatchResult, formatBatchProgress, buildToolResponse } from '../formatters.js';

// ============================================================================
// REGISTER FUNCTION
// ============================================================================

/**
 * Registers all batch process tools with the MCP server.
 */
export function registerBatchProcessTools(server: McpServer): void {

  // ==========================================================================
  // Tool: get_batch_processes
  //
  // List batch processes, optionally filtered by status.
  // Useful for seeing all in-progress or recently completed batch operations.
  //
  // API: GET /batch_processes
  // ==========================================================================
  server.registerTool(
    "get_batch_processes",

    {
      title: "List Batch Processes",
      description:
        "List batch processes from FirstPromoter. " +
        "Batch processes are created when a batch operation (accept promoters, approve commissions, etc.) " +
        "is run with more than 5 IDs. Use this to check on running or completed batches. " +

        "QUERY PARAMETERS — status (optional filter: pending, in_progress, completed, failed, stopped). " +

        "RESPONSE STRUCTURE — returns a flat array of batch process objects, each containing: " +
        "id (integer — batch process ID), " +
        "status (pending/in_progress/completed/failed/stopped), " +
        "total (total items to process), " +
        "selected_total (items selected for processing), " +
        "processed_count (items successfully processed), " +
        "failed_count (items that failed), " +
        "action_label (string — the batch action, e.g. 'referral/delete', 'promoter/accept'), " +
        "progress (integer 0-100 — completion percentage), " +
        "processing_errors (string array — error messages if any), " +
        "meta (object — additional metadata), " +
        "created_at (datetime), updated_at (datetime). " +

        "IMPORTANT: Only cite exact values from the response. Never guess or infer data.",

      inputSchema: {
        status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'stopped'])
          .optional()
          .describe("Filter by batch status (pending, in_progress, completed, failed, stopped)."),
      }
    },

    async (args) => {
      try {
        const queryParams: Record<string, string> = {};

        if (args.status) {
          queryParams['filters[status]'] = args.status;
        }

        const result = await callFirstPromoterAPI('/batch_processes', { queryParams });

        // Result is a flat array of batch objects
        const items = Array.isArray(result) ? result : [];
        let summary = `Found ${items.length} batch process(es).\n`;

        for (let i = 0; i < items.length; i++) {
          const batch = items[i] as Record<string, unknown>;
          summary += `\n${i + 1}. Batch #${batch.id ?? 'N/A'}`;
          summary += `\n   Action: ${batch.action_label ?? 'N/A'}`;
          summary += `\n   Status: ${batch.status ?? 'N/A'}`;
          summary += `\n   Progress: ${batch.progress ?? 0}%`;
          summary += `\n   Processed: ${batch.processed_count ?? 0} / ${batch.total ?? 0}`;
          summary += `\n   Failed: ${batch.failed_count ?? 0}`;
          if (batch.created_at) summary += `\n   Created: ${batch.created_at}`;
          const errors = batch.processing_errors as string[] | undefined;
          if (errors && errors.length > 0) {
            summary += `\n   Errors: ${errors.join(', ')}`;
          }
          summary += '\n';
        }

        const responseText = buildToolResponse(summary, result);

        return {
          content: [{
            type: "text" as const,
            text: responseText
          }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown error occurred';

        return {
          content: [{
            type: "text" as const,
            text: `Error fetching batch processes: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: get_batch_process
  //
  // Show details of a specific batch process by ID.
  // Use the batch ID returned from any async batch operation.
  //
  // API: GET /batch_processes/{id}
  // ==========================================================================
  server.registerTool(
    "get_batch_process",

    {
      title: "Get Batch Process",
      description:
        "Get details of a specific batch process from FirstPromoter. " +
        "Use the batch ID returned from any async batch operation (accept promoters, " +
        "approve commissions, etc. with >5 IDs). " +

        "RESPONSE STRUCTURE — returns a single batch process object: " +
        "id (integer — batch process ID), " +
        "status (pending/in_progress/completed/failed/stopped), " +
        "total (total items to process), " +
        "selected_total (items selected for processing), " +
        "processed_count (items successfully processed), " +
        "failed_count (items that failed), " +
        "action_label (string — the batch action, e.g. 'referral/delete', 'promoter/accept'), " +
        "progress (integer 0-100 — completion percentage), " +
        "processing_errors (string array — error messages if any), " +
        "meta (object — additional metadata), " +
        "created_at (datetime), updated_at (datetime). " +

        "IMPORTANT: Only cite exact values from the response. Never guess or infer data.",

      inputSchema: {
        id: z.number().int()
          .describe("The numeric ID of the batch process to retrieve."),
      }
    },

    async (args) => {
      try {
        const result = await callFirstPromoterAPI(`/batch_processes/${args.id}`);

        const summary = formatBatchResult(result);
        const responseText = buildToolResponse(summary, result);

        return {
          content: [{
            type: "text" as const,
            text: responseText
          }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown error occurred';

        return {
          content: [{
            type: "text" as const,
            text: `Error fetching batch process: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: get_batch_progress
  //
  // Show progress of all batch processes as a simple map.
  // Returns { "batch_id": progress_percentage, ... }
  // Useful for a quick overview of all running batches.
  //
  // API: GET /batch_processes/progress
  // ==========================================================================
  server.registerTool(
    "get_batch_progress",

    {
      title: "Get Batch Progress",
      description:
        "Get a quick progress overview of all batch processes from FirstPromoter. " +
        "Returns a map of batch process IDs to their progress percentage (0-100). " +
        "This is a lightweight alternative to listing all batch processes — " +
        "use it when you just need to know if batches are done. " +

        "QUERY PARAMETERS — status (optional filter: pending, in_progress, completed, failed, stopped). " +

        "RESPONSE STRUCTURE — returns an object where keys are batch process IDs (as strings) " +
        "and values are progress percentages (integers 0-100). " +
        "Example: { \"30\": 0, \"31\": 100, \"32\": 50 } " +

        "IMPORTANT: Only cite exact values from the response. Never guess or infer data.",

      inputSchema: {
        status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'stopped'])
          .optional()
          .describe("Filter by batch status (pending, in_progress, completed, failed, stopped)."),
      }
    },

    async (args) => {
      try {
        const queryParams: Record<string, string> = {};

        if (args.status) {
          queryParams['filters[status]'] = args.status;
        }

        const result = await callFirstPromoterAPI('/batch_processes/progress', { queryParams });

        const summary = formatBatchProgress(result);
        const responseText = buildToolResponse(summary, result);

        return {
          content: [{
            type: "text" as const,
            text: responseText
          }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown error occurred';

        return {
          content: [{
            type: "text" as const,
            text: `Error fetching batch progress: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
}
