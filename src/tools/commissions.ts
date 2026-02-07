/**
 * Commission Tools
 *
 * This file defines all MCP tools related to commissions (rewards earned by promoters).
 * Commissions track what promoters earn from referral sales and custom events.
 *
 * API docs: https://docs.firstpromoter.com/api-reference-v2/api-admin/commissions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callFirstPromoterAPI } from '../api.js';
import { formatCommissions, formatBatchResult, buildToolResponse } from '../formatters.js';

/**
 * Registers all commission-related tools with the MCP server.
 */
export function registerCommissionTools(server: McpServer): void {

  // ==========================================================================
  // Tool: get_commissions
  //
  // Lists commissions with filtering and sorting.
  // API returns a flat array (NOT wrapped in { data: [...] }).
  //
  // API docs: docs/firstpromoter-api/commissions/...get-all-commissions...md
  // ==========================================================================
  server.registerTool(
    "get_commissions",

    {
      title: "Get Commissions",
      description:
        "List all commissions from your FirstPromoter account with filtering, sorting, and search. " +

        "RESPONSE STRUCTURE — returns a flat array of commission objects, each containing: " +
        "id, status (pending/approved/denied), metadata, is_self_referral, " +
        "commission_type (sale/custom), created_by_user_email, created_by_user_at, " +
        "sale_amount (in cents), original_sale_amount, original_sale_currency, " +
        "event_id, plan_id, tier, internal_note, external_note, " +
        "unit (cash/credits/points/free_months/mon_discount/discount_per), " +
        "fraud_check (no_suspicion/same_ip_suspicion/same_promoter_email/ad_source), " +
        "amount (commission amount in cents), is_paid, is_split, " +
        "created_at, status_updated_at, " +
        "promoter_campaign: { id, campaign_id, promoter_id, created_at, " +
        "promoter: { id, email, name }, campaign: { id, name, color } }, " +
        "referral: { id, email, uid }, " +
        "reward: { id, name }. " +

        "NOTE: Amounts (sale_amount, amount) are in cents. Divide by 100 for dollars. " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data.",

      inputSchema: {
        // --- Search ---
        q: z.string()
          .optional()
          .describe("Search by event_id, referral email, or referral uid"),

        ids: z.array(z.number().int())
          .optional()
          .describe("Filter by specific commission IDs (array of integers)"),

        // --- Filters ---
        status: z.enum(['pending', 'approved', 'denied'])
          .optional()
          .describe("Filter commissions by status"),

        campaign_id: z.number().int()
          .optional()
          .describe("Filter by campaign ID"),

        is_paid: z.boolean()
          .optional()
          .describe("Filter by paid status (true = paid, false = unpaid)"),

        is_fulfilled: z.boolean()
          .optional()
          .describe("Filter by fulfilled status (for non-monetary commissions)"),

        fraud_check: z.enum(['no_suspicion', 'same_ip_suspicion', 'same_promoter_email', 'ad_source'])
          .optional()
          .describe("Filter by fraud check result"),

        sale_amount_from: z.number().int().min(0)
          .optional()
          .describe("Minimum sale amount in cents"),

        sale_amount_to: z.number().int().min(0)
          .optional()
          .describe("Maximum sale amount in cents"),

        // --- Sorting ---
        sort_by: z.enum(['amount', 'sale_amount', 'created_at'])
          .optional()
          .describe("Field to sort results by"),

        sort_direction: z.enum(['asc', 'desc'])
          .optional()
          .describe("Sort direction (ascending or descending)"),
      }
    },

    async (args) => {
      try {
        const queryParams: Record<string, string> = {};

        if (args.q) queryParams.q = args.q;

        if (args.ids) {
          args.ids.forEach((id, i) => {
            queryParams[`ids[${i}]`] = id.toString();
          });
        }

        // Filters
        if (args.status) queryParams['filters[status]'] = args.status;
        if (args.campaign_id) queryParams['filters[campaign_id]'] = args.campaign_id.toString();
        if (args.is_paid !== undefined) queryParams['filters[paid]'] = args.is_paid.toString();
        if (args.is_fulfilled !== undefined) queryParams['filters[fulfilled]'] = args.is_fulfilled.toString();
        if (args.fraud_check) queryParams['filters[fraud_check]'] = args.fraud_check;
        if (args.sale_amount_from !== undefined) queryParams['filters[sale_amount][from]'] = args.sale_amount_from.toString();
        if (args.sale_amount_to !== undefined) queryParams['filters[sale_amount][to]'] = args.sale_amount_to.toString();

        // Sorting
        if (args.sort_by && args.sort_direction) {
          queryParams[`sorting[${args.sort_by}]`] = args.sort_direction;
        }

        const result = await callFirstPromoterAPI('/commissions', { queryParams });

        const summary = formatCommissions(result);
        const responseText = buildToolResponse(summary, result);

        return {
          content: [{ type: "text" as const, text: responseText }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [{ type: "text" as const, text: `Error fetching commissions: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: create_commission
  //
  // Creates a new commission. Sends POST to /commissions.
  //
  // API docs: docs/firstpromoter-api/commissions/...create-a-commission...md
  // ==========================================================================
  server.registerTool(
    "create_commission",

    {
      title: "Create Commission",
      description:
        "Create a new commission in FirstPromoter. " +

        "Two commission types are supported: " +
        "1. 'sale' — requires sale_amount and referral_id. " +
        "2. 'custom' — requires amount and promoter_campaign_id. " +

        "BODY PARAMETERS: " +
        "commission_type (required: sale or custom), " +
        "sale_amount (in cents, required for sale type), " +
        "amount (in cents, required for custom type), " +
        "referral_id (required for sale type), " +
        "promoter_campaign_id (required for custom type — the linking ID, NOT promoter or campaign ID), " +
        "plan_id, event_id, event_date (YYYY-MM-DD), internal_note, " +
        "unit (cash/credits/points/free_months/mon_discount/discount_per), " +
        "notify_promoter (boolean), billing_period (monthly/yearly/one_time). " +

        "RESPONSE STRUCTURE — returns an array of commission objects (see get_commissions). " +

        "IMPORTANT: Amounts are in cents. For a $50 sale, use sale_amount: 5000.",

      inputSchema: {
        commission_type: z.enum(['sale', 'custom'])
          .describe("Commission type: 'sale' for sales, 'custom' for manual/custom commissions (required)."),

        sale_amount: z.number().int()
          .optional()
          .describe("Sale amount in cents (required for 'sale' type). E.g., 5000 = $50.00"),

        amount: z.number().int()
          .optional()
          .describe("Commission amount in cents (required for 'custom' type). E.g., 1000 = $10.00"),

        referral_id: z.number().int()
          .optional()
          .describe("Referral ID (required for 'sale' type)"),

        promoter_campaign_id: z.number().int()
          .optional()
          .describe("Promoter campaign ID (required for 'custom' type). This is the linking record ID — NOT the promoter or campaign ID."),

        plan_id: z.number().int()
          .optional()
          .describe("Plan ID from price_ids"),

        event_id: z.string()
          .optional()
          .describe("ID of the event that generated the sale (from billing provider)"),

        event_date: z.string()
          .optional()
          .describe("Date of the event (YYYY-MM-DD format)"),

        internal_note: z.string()
          .optional()
          .describe("Internal note visible only to the team"),

        unit: z.enum(['cash', 'credits', 'points', 'free_months', 'mon_discount', 'discount_per'])
          .optional()
          .describe("Reward unit type"),

        notify_promoter: z.boolean()
          .optional()
          .describe("If true, sends a notification email to the promoter"),

        billing_period: z.enum(['monthly', 'yearly', 'one_time'])
          .optional()
          .describe("Billing period of the event"),
      }
    },

    async (args) => {
      try {
        const body: Record<string, unknown> = {
          commission_type: args.commission_type,
        };

        if (args.sale_amount !== undefined) body.sale_amount = args.sale_amount;
        if (args.amount !== undefined) body.amount = args.amount;
        if (args.referral_id !== undefined) body.referral_id = args.referral_id;
        if (args.promoter_campaign_id !== undefined) body.promoter_campaign_id = args.promoter_campaign_id;
        if (args.plan_id !== undefined) body.plan_id = args.plan_id;
        if (args.event_id !== undefined) body.event_id = args.event_id;
        if (args.event_date !== undefined) body.event_date = args.event_date;
        if (args.internal_note !== undefined) body.internal_note = args.internal_note;
        if (args.unit !== undefined) body.unit = args.unit;
        if (args.notify_promoter !== undefined) body.notify_promoter = args.notify_promoter;
        if (args.billing_period !== undefined) body.billing_period = args.billing_period;

        const result = await callFirstPromoterAPI('/commissions', {
          method: 'POST',
          body
        });

        const summary = `Created commission successfully.\n\n${formatCommissions(result)}`;
        const responseText = buildToolResponse(summary, result);

        return {
          content: [{ type: "text" as const, text: responseText }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [{ type: "text" as const, text: `Error creating commission: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: update_commission
  //
  // Updates a commission's notes. Sends PUT to /commissions/{id}.
  // Only internal_note and external_note can be updated.
  //
  // API docs: docs/firstpromoter-api/commissions/...update-a-commission...md
  // ==========================================================================
  server.registerTool(
    "update_commission",

    {
      title: "Update Commission",
      description:
        "Update a commission in FirstPromoter. Only notes can be changed — " +
        "amounts and status cannot be updated directly (use approve/deny tools instead). " +

        "BODY PARAMETERS — all optional: " +
        "internal_note (visible only to the team), " +
        "external_note (visible to the promoter). " +

        "RESPONSE STRUCTURE — returns the updated commission object (see get_commissions).",

      inputSchema: {
        id: z.number().int()
          .describe("Commission ID to update (required)"),

        internal_note: z.string()
          .optional()
          .describe("Internal note visible only to the team"),

        external_note: z.string()
          .optional()
          .describe("External note visible to the promoter"),
      }
    },

    async (args) => {
      try {
        const body: Record<string, unknown> = {};

        if (args.internal_note !== undefined) body.internal_note = args.internal_note;
        if (args.external_note !== undefined) body.external_note = args.external_note;

        const result = await callFirstPromoterAPI(`/commissions/${args.id}`, {
          method: 'PUT',
          body
        });

        const summary = `Updated commission successfully.\n\n${formatCommissions([result])}`;
        const responseText = buildToolResponse(summary, result);

        return {
          content: [{ type: "text" as const, text: responseText }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [{ type: "text" as const, text: `Error updating commission: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: approve_commissions
  // ==========================================================================
  server.registerTool(
    "approve_commissions",

    {
      title: "Approve Commissions",
      description:
        "Approve one or more pending commissions in FirstPromoter. " +
        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta.",

      inputSchema: {
        ids: z.array(z.number().int())
          .describe("Array of commission IDs to approve. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        const result = await callFirstPromoterAPI('/commissions/approve', {
          method: 'POST',
          body: { ids: args.ids }
        });

        const summary = formatBatchResult(result);
        const responseText = buildToolResponse(summary, result);

        return {
          content: [{ type: "text" as const, text: responseText }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [{ type: "text" as const, text: `Error approving commissions: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: deny_commissions
  // ==========================================================================
  server.registerTool(
    "deny_commissions",

    {
      title: "Deny Commissions",
      description:
        "Deny one or more commissions in FirstPromoter. " +
        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta.",

      inputSchema: {
        ids: z.array(z.number().int())
          .describe("Array of commission IDs to deny. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        const result = await callFirstPromoterAPI('/commissions/deny', {
          method: 'POST',
          body: { ids: args.ids }
        });

        const summary = formatBatchResult(result);
        const responseText = buildToolResponse(summary, result);

        return {
          content: [{ type: "text" as const, text: responseText }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [{ type: "text" as const, text: `Error denying commissions: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: mark_commissions_fulfilled
  // ==========================================================================
  server.registerTool(
    "mark_commissions_fulfilled",

    {
      title: "Mark Commissions Fulfilled",
      description:
        "Mark one or more non-monetary commissions as fulfilled in FirstPromoter. " +
        "This applies to commissions with non-cash units (credits, points, free_months, etc.). " +
        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta.",

      inputSchema: {
        ids: z.array(z.number().int())
          .describe("Array of commission IDs to mark as fulfilled. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        const result = await callFirstPromoterAPI('/commissions/mark_fulfilled', {
          method: 'POST',
          body: { ids: args.ids }
        });

        const summary = formatBatchResult(result);
        const responseText = buildToolResponse(summary, result);

        return {
          content: [{ type: "text" as const, text: responseText }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [{ type: "text" as const, text: `Error marking commissions as fulfilled: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: mark_commissions_unfulfilled
  // ==========================================================================
  server.registerTool(
    "mark_commissions_unfulfilled",

    {
      title: "Mark Commissions Unfulfilled",
      description:
        "Mark one or more non-monetary commissions as unfulfilled in FirstPromoter. " +
        "This reverses a previous 'fulfilled' status for non-cash commissions. " +
        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta.",

      inputSchema: {
        ids: z.array(z.number().int())
          .describe("Array of commission IDs to mark as unfulfilled. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        const result = await callFirstPromoterAPI('/commissions/mark_unfulfilled', {
          method: 'POST',
          body: { ids: args.ids }
        });

        const summary = formatBatchResult(result);
        const responseText = buildToolResponse(summary, result);

        return {
          content: [{ type: "text" as const, text: responseText }]
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [{ type: "text" as const, text: `Error marking commissions as unfulfilled: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );
}
