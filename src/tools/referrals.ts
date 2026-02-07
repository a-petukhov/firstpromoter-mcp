/**
 * Referral Tools
 *
 * This file defines all MCP tools related to referrals (leads/customers).
 * Referrals are the people that promoters bring in — they can be leads or paying customers.
 *
 * API docs: https://docs.firstpromoter.com/api-reference-v2/api-admin/referrals
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callFirstPromoterAPI } from '../api.js';
import { formatReferrals, formatBatchResult, buildToolResponse } from '../formatters.js';

/**
 * Registers all referral-related tools with the MCP server.
 */
export function registerReferralTools(server: McpServer): void {

  // ==========================================================================
  // Tool: get_referrals
  //
  // Lists referrals with filtering by type, state, promoter, and search.
  // API returns a flat array (NOT wrapped in { data: [...] }).
  //
  // API docs: docs/firstpromoter-api/referrals/...get-referrals...md
  // ==========================================================================
  server.registerTool(
    "get_referrals",

    {
      title: "Get Referrals",
      description:
        "List referrals (leads and customers) from your FirstPromoter account with filtering and search. " +

        "RESPONSE STRUCTURE — returns a flat array of referral objects, each containing: " +
        "id, email, uid, state (subscribed/signup/active/cancelled/refunded/denied/pending/moved), " +
        "metadata (object), entry_source (api/coupon/cookie/manual_admin/manual_affiliate), " +
        "created_at, customer_since (null if still a lead), " +
        "promoter_campaign: { id, campaign_id, promoter_id, created_at, " +
        "promoter: { id, email, name }, campaign: { id, name, color } }, " +
        "fraud_check (no_suspicion/same_ip_suspicion/same_promoter_email/ad_source), " +
        "created_by_user_email. " +

        "NOTE: The API returns a flat array, NOT wrapped in { data: [...] }. " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data. " +
        "Each referral's fields are independent — do not infer or guess values between records.",

      inputSchema: {
        // --- Search ---
        q: z.string()
          .optional()
          .describe("Search referrals by email, uid, username, or website"),

        ids: z.array(z.number().int())
          .optional()
          .describe("Filter by specific referral IDs (array of integers)"),

        // --- Filters ---
        type: z.enum(['lead', 'customer'])
          .optional()
          .describe("Filter referrals by type (lead or customer)"),

        promoter_id: z.string()
          .optional()
          .describe("Filter referrals by a specific promoter ID"),

        state: z.enum([
          'subscribed', 'signup', 'active', 'cancelled',
          'refunded', 'denied', 'pending', 'moved'
        ]).optional().describe("Filter referrals by their state"),
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
        if (args.type) {
          queryParams['filters[type]'] = args.type;
        }
        if (args.promoter_id) {
          queryParams['filters[promoter_id]'] = args.promoter_id;
        }
        if (args.state) {
          queryParams['filters[state]'] = args.state;
        }

        // Call the FirstPromoter API
        const result = await callFirstPromoterAPI('/referrals', { queryParams });

        // Format the response: structured summary + raw JSON
        const summary = formatReferrals(result);
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
              text: `Error fetching referrals: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: get_referral
  //
  // Gets a single referral's details. Sends GET to /referrals/{id}.
  // Supports alternative lookup via find_by query parameter.
  //
  // API docs: docs/firstpromoter-api/referrals/...get-referral...md
  // ==========================================================================
  server.registerTool(
    "get_referral",

    {
      title: "Get Referral Details",
      description:
        "Get details for a single referral from FirstPromoter. " +
        "Identify the referral by numeric ID, or use find_by + find_by_value to look up by email/uid/username. " +

        "RESPONSE STRUCTURE — returns a single referral object: " +
        "id, email, uid, state (subscribed/signup/active/cancelled/refunded/denied/pending/moved), " +
        "metadata (object), entry_source (api/coupon/cookie/manual_admin/manual_affiliate), " +
        "created_at, customer_since (null if still a lead), " +
        "promoter_campaign: { id, campaign_id, promoter_id, created_at, " +
        "promoter: { id, email, name }, campaign: { id, name, color } }, " +
        "fraud_check (no_suspicion/same_ip_suspicion/same_promoter_email/ad_source), " +
        "created_by_user_email. " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data.",

      inputSchema: {
        id: z.number().int()
          .optional()
          .describe("Referral's numeric ID. Required unless using find_by + find_by_value."),

        find_by: z.enum(['email', 'uid', 'username'])
          .optional()
          .describe("Alternative lookup method — use with find_by_value instead of id."),

        find_by_value: z.string()
          .optional()
          .describe("The identifier value when using find_by (e.g. the email, uid, or username)"),
      }
    },

    async (args) => {
      try {
        let pathId: string;
        const queryParams: Record<string, string> = {};

        if (args.find_by && args.find_by_value) {
          pathId = encodeURIComponent(args.find_by_value);
          queryParams.find_by = args.find_by;
        } else if (args.id !== undefined) {
          pathId = args.id.toString();
        } else {
          return {
            content: [{
              type: "text" as const,
              text: "Error: Either 'id' or both 'find_by' and 'find_by_value' must be provided."
            }],
            isError: true
          };
        }

        const result = await callFirstPromoterAPI(`/referrals/${pathId}`, {
          queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined
        });

        // Format response — wrap single referral in array for the list formatter
        const summary = formatReferrals([result]);
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
            text: `Error fetching referral details: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: update_referral
  //
  // Updates a referral. Sends PUT to /referrals/{id}.
  // The {id} can be a numeric ID, email, uid, or username when used with find_by.
  //
  // API docs: docs/firstpromoter-api/referrals/...update-referral...md
  // ==========================================================================
  server.registerTool(
    "update_referral",

    {
      title: "Update Referral",
      description:
        "Update a referral's information in FirstPromoter. Only provided fields are changed. " +
        "Identify the referral by numeric ID, or use find_by + find_by_value. " +

        "BODY PARAMETERS — all optional: " +
        "email (new email, required if uid is null), " +
        "uid (new UID, required if email is null), " +
        "username (needs to be enabled by support first), " +
        "promoter_campaign_id (move referral to a different promoter-campaign link — " +
        "this is the promoter_campaign ID, NOT the campaign ID or promoter ID), " +
        "split_percentage (0-100, needs to be enabled by support), " +
        "split_promoter_campaign_id (promoter campaign ID for split, needs support). " +

        "RESPONSE STRUCTURE — returns the updated referral object: " +
        "id, email, uid, state, metadata, entry_source, created_at, customer_since, " +
        "promoter_campaign: { id, campaign_id, promoter_id, created_at, " +
        "promoter: { id, email, name }, campaign: { id, name, color } }, " +
        "fraud_check, created_by_user_email. " +

        "IMPORTANT: This is a partial update — only send fields you want to change.",

      inputSchema: {
        // --- Referral identification ---
        id: z.number().int()
          .optional()
          .describe("Referral's numeric ID. Required unless using find_by + find_by_value."),

        find_by: z.enum(['email', 'uid', 'username'])
          .optional()
          .describe("Alternative lookup method — use with find_by_value instead of id."),

        find_by_value: z.string()
          .optional()
          .describe("The identifier value when using find_by (e.g. the email, uid, or username)"),

        // --- Updatable fields ---
        email: z.string()
          .optional()
          .describe("New email address for the referral (required if uid is null)"),

        uid: z.string()
          .optional()
          .describe("New UID for the referral (required if email is null)"),

        username: z.string()
          .optional()
          .describe("Username of the referral (needs to be enabled by support first)"),

        promoter_campaign_id: z.number().int()
          .optional()
          .describe("Move referral to a different promoter-campaign. This is the promoter_campaign linking ID, NOT the campaign or promoter ID."),

        split_percentage: z.number().min(0).max(100)
          .optional()
          .describe("Split percentage (0-100). Needs to be enabled by support."),

        split_promoter_campaign_id: z.number().int()
          .optional()
          .describe("Promoter campaign ID for the split. Needs to be enabled by support."),
      }
    },

    async (args) => {
      try {
        let pathId: string;
        if (args.find_by && args.find_by_value) {
          pathId = encodeURIComponent(args.find_by_value);
        } else if (args.id !== undefined) {
          pathId = args.id.toString();
        } else {
          return {
            content: [{
              type: "text" as const,
              text: "Error: Either 'id' or both 'find_by' and 'find_by_value' must be provided."
            }],
            isError: true
          };
        }

        // Build the JSON request body
        const body: Record<string, unknown> = {};

        if (args.find_by !== undefined) body.find_by = args.find_by;
        if (args.email !== undefined) body.email = args.email;
        if (args.uid !== undefined) body.uid = args.uid;
        if (args.username !== undefined) body.username = args.username;
        if (args.promoter_campaign_id !== undefined) body.promoter_campaign_id = args.promoter_campaign_id;

        // Split details use bracket notation in the API
        if (args.split_percentage !== undefined) {
          body['split_details[percentage]'] = args.split_percentage;
        }
        if (args.split_promoter_campaign_id !== undefined) {
          body['split_details[promoter_campaign_id]'] = args.split_promoter_campaign_id;
        }

        const result = await callFirstPromoterAPI(`/referrals/${pathId}`, {
          method: 'PUT',
          body
        });

        const summary = `Updated referral successfully.\n\n${formatReferrals([result])}`;
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
            text: `Error updating referral: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: move_referrals_to_promoter
  //
  // Moves referrals to a different promoter. Sends POST to /referrals/move_to_promoter.
  // Async if >5 IDs.
  //
  // API docs: docs/firstpromoter-api/referrals/...move-referrals-to-promoter...md
  // ==========================================================================
  server.registerTool(
    "move_referrals_to_promoter",

    {
      title: "Move Referrals to Promoter",
      description:
        "Move one or more referrals to a different promoter in FirstPromoter. " +
        "You must provide the destination promoter_campaign_id (the promoter-campaign link ID, " +
        "NOT the promoter ID or campaign ID). " +

        "OPTIONS: " +
        "move_associated_commissions — if true, also moves the commissions associated with the referrals. " +

        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta. " +

        "IMPORTANT: When presenting results, cite the exact status and counts from the response.",

      inputSchema: {
        promoter_campaign_id: z.number().int()
          .describe("Destination promoter campaign ID (the promoter-campaign link, NOT the promoter or campaign ID). Required."),

        move_associated_commissions: z.boolean()
          .optional()
          .describe("If true, also moves the commissions associated with the referrals."),

        ids: z.array(z.number().int())
          .optional()
          .describe("Array of referral IDs to move. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        const body: Record<string, unknown> = {
          promoter_campaign_id: args.promoter_campaign_id,
        };

        if (args.move_associated_commissions !== undefined) {
          body.move_associated_commissions = args.move_associated_commissions;
        }
        if (args.ids) {
          body.ids = args.ids;
        }

        const result = await callFirstPromoterAPI('/referrals/move_to_promoter', {
          method: 'POST',
          body
        });

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
            text: `Error moving referrals: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: delete_referrals
  //
  // Deletes referrals. Sends DELETE to /referrals.
  // Async if >5 IDs.
  //
  // API docs: docs/firstpromoter-api/referrals/...delete-referrals...md
  // ==========================================================================
  server.registerTool(
    "delete_referrals",

    {
      title: "Delete Referrals",
      description:
        "Delete one or more referrals from FirstPromoter. " +
        "WARNING: This is a destructive operation — deleted referrals cannot be recovered. " +

        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta. " +

        "IMPORTANT: When presenting results, cite the exact status and counts from the response.",

      inputSchema: {
        ids: z.array(z.number().int())
          .describe("Array of referral IDs to delete. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        const body: Record<string, unknown> = {
          ids: args.ids,
        };

        const result = await callFirstPromoterAPI('/referrals', {
          method: 'DELETE',
          body
        });

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
            text: `Error deleting referrals: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
}
