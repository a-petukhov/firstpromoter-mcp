/**
 * Payout Tools
 *
 * This file defines all MCP tools related to payouts.
 * Payouts represent the money owed to or paid to promoters for their commissions.
 *
 * API docs: https://docs.firstpromoter.com/api-reference-v2/api-admin/payouts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callFirstPromoterAPI } from '../api.js';
import { formatPayouts, formatPayoutsGrouped, formatPayoutStats, formatDuePayoutStats, buildToolResponse } from '../formatters.js';

/**
 * Registers all payout-related tools with the MCP server.
 */
export function registerPayoutTools(server: McpServer): void {

  // ==========================================================================
  // Tool: get_payouts
  //
  // Lists all payouts with filtering, searching, and sorting.
  // API returns a flat array (NOT wrapped in { data: [...] }).
  //
  // API docs: docs/firstpromoter-api/payouts/...get-all-payouts...md
  // ==========================================================================
  server.registerTool(
    "get_payouts",

    {
      title: "Get Payouts",
      description:
        "List all payouts from your FirstPromoter account with filtering, searching, and sorting. " +

        "RESPONSE STRUCTURE — returns a flat array of payout objects, each containing: " +
        "id, status (pending/completed/failed/processing/cancelled), " +
        "amount (float), payments_batch_id, tax_rate (float), unit (e.g. cash), " +
        "period_start (datetime), period_end (datetime), " +
        "paid_at (datetime, null if not yet paid), " +
        "processing_started_at (datetime), failed_at (datetime), " +
        "error (string, error message if failed), " +
        "total_incl_tax (float, total amount including tax), created_at (datetime), " +
        "payout_method: { id, method, date_added, is_disabled, meta, is_selected, details, managed_payouts }, " +
        "promoter: { id, email, name }, " +
        "campaign: { id, name, color }, " +
        "invoice: { id, number }. " +

        "NOTE: The API returns a flat array, NOT wrapped in { data: [...] }. " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data. " +
        "Each payout's fields are independent — do not infer or guess values between records.",

      inputSchema: {
        // --- Search ---
        q: z.string()
          .optional()
          .describe("Search payouts by promoter first name, last name, or email"),

        ids: z.array(z.number().int())
          .optional()
          .describe("Filter by specific payout IDs (array of integers)"),

        // --- Filters ---
        status: z.enum(['pending', 'completed', 'failed', 'processing', 'cancelled'])
          .optional()
          .describe("Filter payouts by status"),

        campaign_id: z.number().int()
          .optional()
          .describe("Filter payouts by campaign ID"),

        payments_batch_id: z.number().int()
          .optional()
          .describe("Filter payouts by payment batch ID"),

        due_period: z.enum(['next', 'overdue', 'custom'])
          .optional()
          .describe("Filter by due period: next (upcoming), overdue, or custom"),

        period_start_from: z.string()
          .optional()
          .describe("Filter payouts where period_start is on or after this date (YYYY-MM-DD)"),

        period_start_to: z.string()
          .optional()
          .describe("Filter payouts where period_start is on or before this date (YYYY-MM-DD)"),

        period_end_from: z.string()
          .optional()
          .describe("Filter payouts where period_end is on or after this date (YYYY-MM-DD)"),

        period_end_to: z.string()
          .optional()
          .describe("Filter payouts where period_end is on or before this date (YYYY-MM-DD)"),

        payout_method: z.enum(['paypal', 'bank', 'wise', 'crypto', 'custom', 'dots', 'not_set'])
          .optional()
          .describe("Filter payouts by payout method"),

        promoter_id: z.number().int()
          .optional()
          .describe("Filter payouts by promoter ID"),

        only_payable: z.boolean()
          .optional()
          .describe("If true, only return payable payouts"),

        group_ref: z.string()
          .optional()
          .describe("Filter payouts by group reference"),

        fraud_suspicions: z.array(
          z.enum(['same_ip_suspicion', 'same_promoter_email', 'ad_source', 'no_suspicion'])
        ).optional()
          .describe("Filter by fraud suspicions. Use ['no_suspicion'] to filter promoters with no fraud suspicions."),

        // --- Sorting ---
        sort_by_amount: z.enum(['asc', 'desc'])
          .optional()
          .describe("Sort payouts by amount (ascending or descending)"),

        sort_by_period_start: z.enum(['asc', 'desc'])
          .optional()
          .describe("Sort payouts by period start date (ascending or descending)"),

        sort_by_period_end: z.enum(['asc', 'desc'])
          .optional()
          .describe("Sort payouts by period end date (ascending or descending)"),
      }
    },

    async (args) => {
      try {
        // Build query parameters, mapping flat params to API bracket notation
        const queryParams: Record<string, string> = {};

        // Search
        if (args.q) {
          queryParams.q = args.q;
        }

        // IDs array: ids[]=1&ids[]=2
        if (args.ids) {
          args.ids.forEach((id, i) => {
            queryParams[`ids[${i}]`] = id.toString();
          });
        }

        // Filters — map to filters[key]=value
        if (args.status) {
          queryParams['filters[status]'] = args.status;
        }
        if (args.campaign_id !== undefined) {
          queryParams['filters[campaign_id]'] = args.campaign_id.toString();
        }
        if (args.payments_batch_id !== undefined) {
          queryParams['filters[payments_batch_id]'] = args.payments_batch_id.toString();
        }
        if (args.due_period) {
          queryParams['filters[due_period]'] = args.due_period;
        }
        if (args.period_start_from) {
          queryParams['filters[period_start][from]'] = args.period_start_from;
        }
        if (args.period_start_to) {
          queryParams['filters[period_start][to]'] = args.period_start_to;
        }
        if (args.period_end_from) {
          queryParams['filters[period_end][from]'] = args.period_end_from;
        }
        if (args.period_end_to) {
          queryParams['filters[period_end][to]'] = args.period_end_to;
        }
        if (args.payout_method) {
          queryParams['filters[payout_method]'] = args.payout_method;
        }
        if (args.promoter_id !== undefined) {
          queryParams['filters[promoter_id]'] = args.promoter_id.toString();
        }
        if (args.only_payable !== undefined) {
          queryParams['filters[only_payable]'] = args.only_payable.toString();
        }
        if (args.group_ref) {
          queryParams['filters[group_ref]'] = args.group_ref;
        }
        if (args.fraud_suspicions) {
          args.fraud_suspicions.forEach((suspicion, i) => {
            queryParams[`filters[fraud_suspicions][${i}]`] = suspicion;
          });
        }

        // Sorting — map to sorting[field]=direction
        if (args.sort_by_amount) {
          queryParams['sorting[amount]'] = args.sort_by_amount;
        }
        if (args.sort_by_period_start) {
          queryParams['sorting[period_start]'] = args.sort_by_period_start;
        }
        if (args.sort_by_period_end) {
          queryParams['sorting[period_end]'] = args.sort_by_period_end;
        }

        // Call the FirstPromoter API
        const result = await callFirstPromoterAPI('/payouts', { queryParams });

        // Format the response: structured summary + raw JSON
        const summary = formatPayouts(result);
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
              text: `Error fetching payouts: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: get_payouts_grouped_by_promoters
  //
  // Lists payouts grouped by promoter. Returns { data: [...], meta: {...} }.
  //
  // API docs: docs/firstpromoter-api/payouts/...get-all-payouts-grouped-by-promoters...md
  // ==========================================================================
  server.registerTool(
    "get_payouts_grouped_by_promoters",

    {
      title: "Get Payouts Grouped by Promoters",
      description:
        "List all payouts grouped by promoter from your FirstPromoter account. " +
        "Each group shows the promoter, their payout method, and all their individual payouts. " +

        "RESPONSE STRUCTURE — returns { data: [...], meta: {...} }. " +
        "Each item in data contains: " +
        "promoter: { id, email, name, invoice_details_status, fraud_suspicions[], " +
        "profile: { invoice_details_validation_errors } }, " +
        "payout_method: { id, method, date_added, is_disabled, meta, is_selected, details, managed_payouts }, " +
        "payouts: [ array of payout objects, each with: id, status, amount, payments_batch_id, " +
        "tax_rate, unit, period_start, period_end, paid_at, processing_started_at, failed_at, error, " +
        "total_incl_tax, created_at, payout_method, promoter: { id, email, name }, " +
        "campaign: { id, name, color }, invoice: { id, number } ], " +
        "is_amount_payable (boolean), payout_ids (array of integers), " +
        "amount (total for this promoter), total_incl_tax (total including tax). " +
        "meta: { total, promoters_count, total_incl_tax, due_date, period_end }. " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data. " +
        "Each promoter group is independent — do not infer or guess values between groups.",

      inputSchema: {
        // --- Search ---
        q: z.string()
          .optional()
          .describe("Search by promoter first name, last name, or email"),

        // --- Filters ---
        status: z.enum(['pending', 'completed', 'failed', 'processing', 'cancelled'])
          .optional()
          .describe("Filter payouts by status"),

        campaign_id: z.number().int()
          .optional()
          .describe("Filter payouts by campaign ID"),

        include_payout_method_details: z.boolean()
          .optional()
          .describe("Set to true to include payout method details in the response"),

        min_payment: z.number().int()
          .optional()
          .describe("Filter payouts by minimum payment amount possible"),

        invoiceable: z.enum(['true', 'false', 'not_set'])
          .optional()
          .describe("Filter payouts by invoiceable status"),
      }
    },

    async (args) => {
      try {
        // Build query parameters, mapping flat params to API bracket notation
        const queryParams: Record<string, string> = {};

        // Search
        if (args.q) {
          queryParams.q = args.q;
        }

        // Filters
        if (args.status) {
          queryParams['filters[status]'] = args.status;
        }
        if (args.campaign_id !== undefined) {
          queryParams['filters[campaign_id]'] = args.campaign_id.toString();
        }
        if (args.include_payout_method_details !== undefined) {
          queryParams.include_payout_method_details = args.include_payout_method_details.toString();
        }
        if (args.min_payment !== undefined) {
          queryParams['filters[min_payment]'] = args.min_payment.toString();
        }
        if (args.invoiceable) {
          queryParams['filters[invoiceable]'] = args.invoiceable;
        }

        // Call the FirstPromoter API
        const result = await callFirstPromoterAPI('/payouts/group_by_promoters', { queryParams });

        // Format the response: structured summary + raw JSON
        const summary = formatPayoutsGrouped(result);
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
              text: `Error fetching payouts grouped by promoters: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: get_payout_stats
  //
  // Returns payout statistics. Returns { meta: {...}, data: {...} }.
  //
  // API docs: docs/firstpromoter-api/payouts/...get-payout-stats...md
  // ==========================================================================
  server.registerTool(
    "get_payout_stats",

    {
      title: "Get Payout Stats",
      description:
        "Get payout statistics from your FirstPromoter account. " +
        "Shows stats broken down by paid period, status, and payout method. " +

        "RESPONSE STRUCTURE — returns { meta: {...}, data: {...} }. " +
        "meta: { net_payout_days, payout_cycle, min_payment, min_paying_customers, " +
        "terms_description, selected_payout_methods[], payout_method_options, managed_payouts }. " +
        "data: { " +
        "by_paid_period: [ { period_start, period_end, promoters_count, amounts (object), total_incl_tax } ], " +
        "by_status: { object with status counts }, " +
        "by_payout_method: { object with method counts } }. " +

        "NOTE: Use stats_by_* params to control which breakdowns are included. " +
        "Filters can narrow the stats to specific statuses or campaigns. " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data.",

      inputSchema: {
        // --- Stats breakdowns ---
        stats_by_paid_period: z.boolean()
          .optional()
          .describe("Set to true to include stats by payout period (only for paid payouts)"),

        stats_by_status: z.boolean()
          .optional()
          .describe("Set to true to include stats by status (pending, failed, processing, completed)"),

        stats_by_payout_method: z.boolean()
          .optional()
          .describe("Set to true to include stats by payout method"),

        // --- Filters ---
        status: z.enum(['pending', 'completed', 'failed', 'processing', 'cancelled'])
          .optional()
          .describe("Filter stats by payout status"),

        campaign_id: z.number().int()
          .optional()
          .describe("Filter stats by campaign ID"),
      }
    },

    async (args) => {
      try {
        // Build query parameters, mapping flat params to API bracket notation
        const queryParams: Record<string, string> = {};

        // Stats breakdowns — map to stats_by[key]=value
        if (args.stats_by_paid_period !== undefined) {
          queryParams['stats_by[paid_period]'] = args.stats_by_paid_period.toString();
        }
        if (args.stats_by_status !== undefined) {
          queryParams['stats_by[status]'] = args.stats_by_status.toString();
        }
        if (args.stats_by_payout_method !== undefined) {
          queryParams['stats_by[payout_method]'] = args.stats_by_payout_method.toString();
        }

        // Filters
        if (args.status) {
          queryParams['filters[status]'] = args.status;
        }
        if (args.campaign_id !== undefined) {
          queryParams['filters[campaign_id]'] = args.campaign_id.toString();
        }

        // Call the FirstPromoter API
        const result = await callFirstPromoterAPI('/payouts/stats', { queryParams });

        // Format the response: structured summary + raw JSON
        const summary = formatPayoutStats(result);
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
              text: `Error fetching payout stats: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: get_due_payout_stats
  //
  // Returns statistics about due payouts. Returns { meta: {...}, data: {...} }.
  //
  // API docs: docs/firstpromoter-api/payouts/...get-due-payout-stats...md
  // ==========================================================================
  server.registerTool(
    "get_due_payout_stats",

    {
      title: "Get Due Payout Stats",
      description:
        "Get statistics about due payouts from your FirstPromoter account. " +
        "Shows upcoming (next), overdue, and custom due payout breakdowns. " +

        "RESPONSE STRUCTURE — returns { meta: {...}, data: {...} }. " +
        "meta: { net_payout_days, payout_cycle, min_payment, min_paying_customers, " +
        "terms_description, selected_payout_methods[], payout_method_options, managed_payouts }. " +
        "data: { " +
        "next: { promoters_count, amounts (object), total_incl_tax, due_date, period_end }, " +
        "overdue: { promoters_count, amounts (object), total_incl_tax, due_date, period_end }, " +
        "custom: { promoters_count, amounts (object), total_incl_tax } }. " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data.",

      inputSchema: {
        // --- Search ---
        q: z.string()
          .optional()
          .describe("Search by promoter first name, last name, or email"),

        // --- Filters ---
        status: z.enum(['pending', 'completed', 'failed', 'processing', 'cancelled'])
          .optional()
          .describe("Filter due payout stats by payout status"),

        campaign_id: z.number().int()
          .optional()
          .describe("Filter due payout stats by campaign ID"),
      }
    },

    async (args) => {
      try {
        // Build query parameters, mapping flat params to API bracket notation
        const queryParams: Record<string, string> = {};

        // Search
        if (args.q) {
          queryParams.q = args.q;
        }

        // Filters
        if (args.status) {
          queryParams['filters[status]'] = args.status;
        }
        if (args.campaign_id !== undefined) {
          queryParams['filters[campaign_id]'] = args.campaign_id.toString();
        }

        // Call the FirstPromoter API
        const result = await callFirstPromoterAPI('/payouts/due_stats', { queryParams });

        // Format the response: structured summary + raw JSON
        const summary = formatDuePayoutStats(result);
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
              text: `Error fetching due payout stats: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
