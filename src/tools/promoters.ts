/**
 * Promoter Tools
 *
 * This file defines all MCP tools related to promoters (affiliates).
 * Each tool is like a menu item — the AI can "order" it to get data.
 *
 * API docs: https://docs.firstpromoter.com/api-reference-v2/api-admin/promoters
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
   * Lists promoters (affiliates) with full filtering, sorting, and search.
   * Supports all FirstPromoter API v2 query parameters.
   */
  server.registerTool(
    "get_promoters",

    {
      title: "Get Promoters",
      description:
        "List promoters (affiliates) from your FirstPromoter account with full filtering and sorting. " +

        "RESPONSE STRUCTURE — each promoter object contains: " +
        "id, email, name, cust_id, state (pending/accepted/rejected/blocked/inactive/not_set), note, " +
        "joined_at, last_login_at, created_at, updated_at, archived_at, " +
        "is_confirmed, is_customized, first_event_at, password_setup_url, " +
        "fraud_suspicions[] (same_ip_suspicion/same_promoter_email/ad_source), " +
        "invoice_details_status (pending/approved/denied), " +
        "custom_fields: { key: value }, " +
        "stats: { clicks_count, referrals_count, sales_count, customers_count, " +
        "revenue_amount (in cents), active_customers_count }, " +
        "profile: { website, company, phone, vat_id, country, address, avatar_url, " +
        "instagram, youtube, linkedin, facebook, twitter, twitch, tiktok }, " +
        "promoter_campaigns[]: { campaign: { id, name, color }, state, coupon, ref_token, ref_link }. " +

        "Pagination: response wraps data in { data: [...], meta: { pending_count } }. " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data. " +
        "Each promoter's fields are independent — do not infer or guess values between records.",

      inputSchema: {
        // --- Search ---
        q: z.string()
          .optional()
          .describe("Search promoters by email, name, or ref_id"),

        ids: z.array(z.number().int())
          .optional()
          .describe("Filter by specific promoter IDs (array of integers)"),

        // --- Pagination ---
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
          .describe("Number of promoters per page (1–100, default 20)"),

        // --- Filters ---
        state: z.enum([
          'pending',     // Waiting for approval
          'accepted',    // Active promoters
          'rejected',    // Rejected promoters
          'blocked',     // Blocked promoters
          'inactive',    // Inactive promoters
          'not_set'      // No state set
        ]).optional().describe("Filter promoters by their state"),

        campaign_id: z.number()
          .int()
          .optional()
          .describe("Filter by campaign ID"),

        parent_promoter_id: z.number()
          .int()
          .optional()
          .describe("Filter by parent promoter ID (for sub-affiliates)"),

        archived: z.boolean()
          .optional()
          .describe("Filter by archived status (true = archived only, false = active only)"),

        has_wform: z.enum(['yes', 'no'])
          .optional()
          .describe("Filter by W-form submission status"),

        subscribed_to_email: z.boolean()
          .optional()
          .describe("Filter by email subscription status"),

        custom_field1: z.string()
          .optional()
          .describe("Filter by custom field 1 value"),

        custom_field2: z.string()
          .optional()
          .describe("Filter by custom field 2 value"),

        fraud_suspicions: z.array(
          z.enum(['same_ip_suspicion', 'same_promoter_email', 'ad_source', 'no_suspicion'])
        ).optional().describe("Filter by fraud suspicion types"),

        // --- Range filters ---
        revenue_amount_from: z.number()
          .int()
          .min(0)
          .optional()
          .describe("Minimum revenue amount in cents"),

        revenue_amount_to: z.number()
          .int()
          .min(0)
          .optional()
          .describe("Maximum revenue amount in cents"),

        customers_count_from: z.number()
          .int()
          .min(0)
          .optional()
          .describe("Minimum number of customers"),

        customers_count_to: z.number()
          .int()
          .min(0)
          .optional()
          .describe("Maximum number of customers"),

        referrals_count_from: z.number()
          .int()
          .min(0)
          .optional()
          .describe("Minimum number of referrals"),

        referrals_count_to: z.number()
          .int()
          .min(0)
          .optional()
          .describe("Maximum number of referrals"),

        clicks_count_from: z.number()
          .int()
          .min(0)
          .optional()
          .describe("Minimum number of clicks"),

        clicks_count_to: z.number()
          .int()
          .min(0)
          .optional()
          .describe("Maximum number of clicks"),

        // --- Date filters (ISO format: YYYY-MM-DD HH:MM:SS) ---
        joined_at_from: z.string()
          .optional()
          .describe("Filter: joined after this date (YYYY-MM-DD HH:MM:SS)"),

        joined_at_to: z.string()
          .optional()
          .describe("Filter: joined before this date (YYYY-MM-DD HH:MM:SS)"),

        last_login_at_from: z.string()
          .optional()
          .describe("Filter: last login after this date (YYYY-MM-DD HH:MM:SS)"),

        last_login_at_to: z.string()
          .optional()
          .describe("Filter: last login before this date (YYYY-MM-DD HH:MM:SS)"),

        // --- Sorting ---
        sort_by: z.enum([
          'clicks_count',
          'referrals_count',
          'customers_count',
          'revenue_amount',
          'joined_at'
        ]).optional().describe("Field to sort results by"),

        sort_direction: z.enum(['asc', 'desc'])
          .optional()
          .describe("Sort direction (ascending or descending)"),
      }
    },

    async (args) => {
      try {
        // Build query parameters, mapping flat params to the API's nested format
        // API uses bracket notation: filters[state]=..., sorting[field]=...
        const queryParams: Record<string, string> = {};

        // Simple params
        if (args.q) {
          queryParams.q = args.q;
        }
        if (args.page) {
          queryParams.page = args.page.toString();
        }
        if (args.per_page) {
          queryParams.per_page = args.per_page.toString();
        }

        // IDs array: ids[]=1&ids[]=2
        if (args.ids) {
          args.ids.forEach((id, i) => {
            queryParams[`ids[${i}]`] = id.toString();
          });
        }

        // Filters — map to filters[key]=value
        if (args.state) {
          queryParams['filters[state]'] = args.state;
        }
        if (args.campaign_id) {
          queryParams['filters[campaign_id]'] = args.campaign_id.toString();
        }
        if (args.parent_promoter_id) {
          queryParams['filters[parent_promoter_id]'] = args.parent_promoter_id.toString();
        }
        if (args.archived !== undefined) {
          queryParams['filters[archived]'] = args.archived.toString();
        }
        if (args.has_wform) {
          queryParams['filters[has_wform]'] = args.has_wform;
        }
        if (args.subscribed_to_email !== undefined) {
          queryParams['filters[subscribed_to_email]'] = args.subscribed_to_email.toString();
        }
        if (args.custom_field1) {
          queryParams['filters[custom_field1]'] = args.custom_field1;
        }
        if (args.custom_field2) {
          queryParams['filters[custom_field2]'] = args.custom_field2;
        }
        if (args.fraud_suspicions) {
          args.fraud_suspicions.forEach((s, i) => {
            queryParams[`filters[fraud_suspicions][${i}]`] = s;
          });
        }

        // Range filters — map to filters[field][from/to]=value
        if (args.revenue_amount_from !== undefined) {
          queryParams['filters[revenue_amount][from]'] = args.revenue_amount_from.toString();
        }
        if (args.revenue_amount_to !== undefined) {
          queryParams['filters[revenue_amount][to]'] = args.revenue_amount_to.toString();
        }
        if (args.customers_count_from !== undefined) {
          queryParams['filters[customers_count][from]'] = args.customers_count_from.toString();
        }
        if (args.customers_count_to !== undefined) {
          queryParams['filters[customers_count][to]'] = args.customers_count_to.toString();
        }
        if (args.referrals_count_from !== undefined) {
          queryParams['filters[referrals_count][from]'] = args.referrals_count_from.toString();
        }
        if (args.referrals_count_to !== undefined) {
          queryParams['filters[referrals_count][to]'] = args.referrals_count_to.toString();
        }
        if (args.clicks_count_from !== undefined) {
          queryParams['filters[clicks_count][from]'] = args.clicks_count_from.toString();
        }
        if (args.clicks_count_to !== undefined) {
          queryParams['filters[clicks_count][to]'] = args.clicks_count_to.toString();
        }

        // Date filters — map to filters[field][from/to]=value
        if (args.joined_at_from) {
          queryParams['filters[joined_at][from]'] = args.joined_at_from;
        }
        if (args.joined_at_to) {
          queryParams['filters[joined_at][to]'] = args.joined_at_to;
        }
        if (args.last_login_at_from) {
          queryParams['filters[last_login_at][from]'] = args.last_login_at_from;
        }
        if (args.last_login_at_to) {
          queryParams['filters[last_login_at][to]'] = args.last_login_at_to;
        }

        // Sorting — map to sorting[field]=direction
        if (args.sort_by && args.sort_direction) {
          queryParams[`sorting[${args.sort_by}]`] = args.sort_direction;
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
