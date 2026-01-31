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
import { formatPromoters, formatBatchResult, buildToolResponse } from '../formatters.js';

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

  // ==========================================================================
  // Tool: get_promoter
  //
  // Gets a single promoter's details. Sends GET to /promoters/{id}.
  // Supports alternative lookup via find_by query parameter.
  //
  // API docs: docs/firstpromoter-api/promoters/...get-promoter-details...md
  // ==========================================================================
  server.registerTool(
    "get_promoter",

    {
      title: "Get Promoter Details",
      description:
        "Get details for a single promoter (affiliate) from FirstPromoter. " +
        "Identify the promoter by numeric ID, or use find_by + find_by_value to look up by email/auth_token/ref_token/promo_code. " +

        "RESPONSE STRUCTURE — returns a single promoter object: " +
        "id, email, name, cust_id, state (pending/accepted/rejected/blocked/inactive/not_set), note, " +
        "joined_at, last_login_at, created_at, updated_at, archived_at, " +
        "is_confirmed, is_customized, first_event_at, password_setup_url, " +
        "fraud_suspicions[] (same_ip_suspicion/same_promoter_email/ad_source), " +
        "invoice_details_status (pending/approved/denied), " +
        "custom_fields: { key: value }, " +
        "stats: { clicks_count, referrals_count, sales_count, customers_count, " +
        "revenue_amount (in cents), active_customers_count }, " +
        "profile: { first_name, last_name, website, company_name, company_number, phone_number, " +
        "vat_id, country, address, description, avatar, w8_form_url, w9_form_url, " +
        "instagram_url, youtube_url, linkedin_url, facebook_url, twitter_url, twitch_url, tiktok_url, " +
        "invoice_details_validation_errors, should_validate_invoice_details }, " +
        "promoter_campaigns[]: { campaign: { id, name, color }, state, coupon, ref_token, ref_link }. " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data.",

      inputSchema: {
        // --- Promoter identification ---
        id: z.number().int()
          .optional()
          .describe("Promoter's numeric ID. Required unless using find_by + find_by_value."),

        find_by: z.enum(['email', 'auth_token', 'ref_token', 'promo_code'])
          .optional()
          .describe("Alternative lookup method — use with find_by_value instead of id. " +
            "When used, the find_by_value replaces the ID in the URL path."),

        find_by_value: z.string()
          .optional()
          .describe("The identifier value when using find_by (e.g. the email address, auth_token, ref_token, or promo_code)"),
      }
    },

    async (args) => {
      try {
        // Determine the URL path — by numeric ID or alternative identifier
        let pathId: string;
        const queryParams: Record<string, string> = {};

        if (args.find_by && args.find_by_value) {
          // Alternative lookup: GET /promoters/{email|token|code}?find_by=email
          pathId = encodeURIComponent(args.find_by_value);
          queryParams.find_by = args.find_by;
        } else if (args.id !== undefined) {
          // Standard lookup: GET /promoters/{numeric_id}
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

        // Call GET /promoters/{id}
        const result = await callFirstPromoterAPI(`/promoters/${pathId}`, {
          queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined
        });

        // Format response — wrap single promoter in array for the list formatter
        const summary = formatPromoters([result]);
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
            text: `Error fetching promoter details: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: update_promoter
  //
  // Updates a promoter's information. Sends PUT to /promoters/{id}.
  // Only provided fields are changed — omitted fields stay unchanged.
  //
  // API docs: docs/firstpromoter-api/promoters/...update-promoter...md
  // ==========================================================================
  server.registerTool(
    "update_promoter",

    {
      title: "Update Promoter",
      description:
        "Update a promoter's information in FirstPromoter. Only provided fields are changed — omitted fields remain unchanged. " +
        "Identify the promoter by numeric ID, or use find_by + find_by_value to look up by email/auth_token/ref_token/promo_code. " +

        "BODY PARAMETERS — all optional: " +
        "email (new email), cust_id (custom customer ID, nullable). " +
        "Profile fields: first_name, last_name, website, company_name, company_number, phone_number, " +
        "vat_id, country (2-char code e.g. 'US'), address. " +
        "Social URLs: instagram_url, youtube_url, linkedin_url, facebook_url, twitter_url, twitch_url, tiktok_url. " +
        "Tax forms: destroy_w8form / destroy_w9form (boolean — removes the form). " +
        "Custom fields: pass as key-value object matching your company's custom field configuration. " +

        "RESPONSE STRUCTURE — returns the updated promoter object: " +
        "id, email, name, cust_id, state (pending/accepted/rejected/blocked/inactive/not_set), note, " +
        "joined_at, last_login_at, created_at, updated_at, archived_at, " +
        "is_confirmed, is_customized, first_event_at, password_setup_url, " +
        "fraud_suspicions[] (same_ip_suspicion/same_promoter_email/ad_source), " +
        "invoice_details_status (pending/approved/denied), " +
        "custom_fields: { key: value }, " +
        "stats: { clicks_count, referrals_count, sales_count, customers_count, " +
        "revenue_amount (in cents), active_customers_count }, " +
        "profile: { first_name, last_name, website, company_name, company_number, phone_number, " +
        "vat_id, country, address, description, avatar, w8_form_url, w9_form_url, " +
        "instagram_url, youtube_url, linkedin_url, facebook_url, twitter_url, twitch_url, tiktok_url, " +
        "invoice_details_validation_errors, should_validate_invoice_details }, " +
        "promoter_campaigns[]: { campaign: { id, name, color }, state, coupon, ref_token, ref_link }. " +

        "READ-ONLY fields (returned in response but CANNOT be updated here): note, description. " +
        "Use the FirstPromoter dashboard to edit these. " +

        "IMPORTANT: This is a partial update — only send fields you want to change. " +
        "When presenting results, cite exact field values from the returned data.",

      inputSchema: {
        // --- Promoter identification ---
        id: z.number().int()
          .optional()
          .describe("Promoter's numeric ID. Required unless using find_by + find_by_value."),

        find_by: z.enum(['email', 'auth_token', 'ref_token', 'promo_code'])
          .optional()
          .describe("Alternative lookup method — use with find_by_value instead of id. " +
            "The find_by_value replaces the ID in the API URL path."),

        find_by_value: z.string()
          .optional()
          .describe("The identifier value when using find_by (e.g. the email, auth_token, ref_token, or promo_code)"),

        // --- Updatable top-level fields ---
        email: z.string()
          .optional()
          .describe("New email address for the promoter"),

        cust_id: z.string()
          .nullable()
          .optional()
          .describe("Custom customer identifier (set to null to clear)"),

        // --- Profile fields (mapped to nested profile object in the body) ---
        first_name: z.string().optional()
          .describe("Promoter's first name"),

        last_name: z.string().optional()
          .describe("Promoter's last name"),

        website: z.string().optional()
          .describe("Promoter's website URL"),

        company_name: z.string().optional()
          .describe("Business / company name"),

        company_number: z.string().optional()
          .describe("Company registration number"),

        phone_number: z.string().optional()
          .describe("Contact phone number"),

        vat_id: z.string().optional()
          .describe("VAT identifier"),

        country: z.string().optional()
          .describe("2-character country code (e.g. 'US', 'GB', 'DE')"),

        address: z.string().optional()
          .describe("Physical / mailing address"),

        // --- Social URLs (mapped to profile object) ---
        instagram_url: z.string().optional()
          .describe("Instagram profile URL"),

        youtube_url: z.string().optional()
          .describe("YouTube channel URL"),

        linkedin_url: z.string().optional()
          .describe("LinkedIn profile URL"),

        facebook_url: z.string().optional()
          .describe("Facebook profile URL"),

        twitter_url: z.string().optional()
          .describe("Twitter / X profile URL"),

        twitch_url: z.string().optional()
          .describe("Twitch channel URL"),

        tiktok_url: z.string().optional()
          .describe("TikTok profile URL"),

        // --- Tax form destruction flags ---
        destroy_w8form: z.boolean().optional()
          .describe("Set to true to remove the W8 tax form"),

        destroy_w9form: z.boolean().optional()
          .describe("Set to true to remove the W9 tax form"),

        // --- Custom fields ---
        custom_fields: z.record(z.string()).optional()
          .describe("Custom fields as key-value pairs matching your company's custom field config " +
            "(e.g. { \"my_field\": \"value\" }). Keys must match fields set in Settings > Affiliate portal > Custom fields."),
      }
    },

    async (args) => {
      try {
        // Determine the URL path — by numeric ID or alternative identifier
        let pathId: string;
        if (args.find_by && args.find_by_value) {
          // Alternative lookup: PUT /promoters/{email|token|code}
          pathId = encodeURIComponent(args.find_by_value);
        } else if (args.id !== undefined) {
          // Standard lookup: PUT /promoters/{numeric_id}
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

        // Top-level body fields
        if (args.email !== undefined) body.email = args.email;
        if (args.find_by !== undefined) body.find_by = args.find_by;
        if (args.cust_id !== undefined) body.cust_id = args.cust_id;

        // Profile fields — collect into nested profile object
        // The API expects: { "profile": { "first_name": "...", ... } }
        const profileFields = [
          'first_name', 'last_name', 'website', 'company_name', 'company_number',
          'phone_number', 'vat_id', 'country', 'address',
          'instagram_url', 'youtube_url', 'linkedin_url', 'facebook_url',
          'twitter_url', 'twitch_url', 'tiktok_url'
        ];

        const profile: Record<string, unknown> = {};
        for (const field of profileFields) {
          const value = (args as Record<string, unknown>)[field];
          if (value !== undefined) {
            profile[field] = value;
          }
        }

        if (Object.keys(profile).length > 0) {
          body.profile = profile;
        }

        // Tax form destruction flags — these use bracket notation in the API
        if (args.destroy_w8form !== undefined) {
          body['profile[_destroy_w8form]'] = args.destroy_w8form;
        }
        if (args.destroy_w9form !== undefined) {
          body['profile[_destroy_w9form]'] = args.destroy_w9form;
        }

        // Custom fields — pass as-is (key-value object)
        if (args.custom_fields) {
          body.custom_fields = args.custom_fields;
        }

        // Call PUT /promoters/{id}
        const result = await callFirstPromoterAPI(`/promoters/${pathId}`, {
          method: 'PUT',
          body
        });

        // Format response — wrap single promoter in array for the list formatter
        const summary = `Updated promoter successfully.\n\n${formatPromoters([result])}`;
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
            text: `Error updating promoter: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: accept_promoters
  //
  // Accepts one or more pending promoters into a campaign.
  // Sends POST to /promoters/accept.
  //
  // If >5 IDs are passed, FirstPromoter processes the operation
  // asynchronously (response status will be "in_progress").
  //
  // API docs: docs/firstpromoter-api/promoters/...accept-promoters...md
  // ==========================================================================
  server.registerTool(
    "accept_promoters",

    {
      title: "Accept Promoters",
      description:
        "Accept one or more pending promoters into a specific campaign in FirstPromoter. " +
        "This is a batch operation — you must provide the campaign_id to accept promoters into, " +
        "and optionally an array of promoter ids. " +

        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +
        "The response status will be 'in_progress' instead of 'completed'. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta. " +

        "IMPORTANT: When presenting results, cite the exact status and counts from the response.",

      inputSchema: {
        campaign_id: z.number().int()
          .describe("The ID of the campaign to accept promoters into (required)."),

        ids: z.array(z.number().int())
          .optional()
          .describe("Array of promoter IDs to accept. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body
        const body: Record<string, unknown> = {
          campaign_id: args.campaign_id,
        };

        if (args.ids) {
          body.ids = args.ids;
        }

        // Call POST /promoters/accept
        const result = await callFirstPromoterAPI('/promoters/accept', {
          method: 'POST',
          body
        });

        // Format response using the batch result formatter
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
            text: `Error accepting promoters: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: reject_promoters
  //
  // Rejects one or more promoters from a campaign.
  // Sends POST to /promoters/reject.
  //
  // If >5 IDs are passed, FirstPromoter processes the operation
  // asynchronously (response status will be "in_progress").
  //
  // API docs: docs/firstpromoter-api/promoters/...reject-promoters...md
  // ==========================================================================
  server.registerTool(
    "reject_promoters",

    {
      title: "Reject Promoters",
      description:
        "Reject one or more promoters from a specific campaign in FirstPromoter. " +
        "This is a batch operation — you must provide the campaign_id to reject promoters from, " +
        "and optionally an array of promoter ids. " +

        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +
        "The response status will be 'in_progress' instead of 'completed'. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta. " +

        "IMPORTANT: When presenting results, cite the exact status and counts from the response.",

      inputSchema: {
        campaign_id: z.number().int()
          .describe("The ID of the campaign to reject promoters from (required)."),

        ids: z.array(z.number().int())
          .optional()
          .describe("Array of promoter IDs to reject. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body
        const body: Record<string, unknown> = {
          campaign_id: args.campaign_id,
        };

        if (args.ids) {
          body.ids = args.ids;
        }

        // Call POST /promoters/reject
        const result = await callFirstPromoterAPI('/promoters/reject', {
          method: 'POST',
          body
        });

        // Format response using the batch result formatter
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
            text: `Error rejecting promoters: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: block_promoters
  //
  // Blocks one or more promoters from a campaign.
  // Sends POST to /promoters/block.
  //
  // If >5 IDs are passed, FirstPromoter processes the operation
  // asynchronously (response status will be "in_progress").
  //
  // API docs: docs/firstpromoter-api/promoters/...block-promoters...md
  // ==========================================================================
  server.registerTool(
    "block_promoters",

    {
      title: "Block Promoters",
      description:
        "Block one or more promoters from a specific campaign in FirstPromoter. " +
        "This is a batch operation — you must provide the campaign_id to block promoters from, " +
        "and optionally an array of promoter ids. " +

        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +
        "The response status will be 'in_progress' instead of 'completed'. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta. " +

        "IMPORTANT: When presenting results, cite the exact status and counts from the response.",

      inputSchema: {
        campaign_id: z.number().int()
          .describe("The ID of the campaign to block promoters from (required)."),

        ids: z.array(z.number().int())
          .optional()
          .describe("Array of promoter IDs to block. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body
        const body: Record<string, unknown> = {
          campaign_id: args.campaign_id,
        };

        if (args.ids) {
          body.ids = args.ids;
        }

        // Call POST /promoters/block
        const result = await callFirstPromoterAPI('/promoters/block', {
          method: 'POST',
          body
        });

        // Format response using the batch result formatter
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
            text: `Error blocking promoters: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: archive_promoters
  //
  // Archives one or more promoters.
  // Sends POST to /promoters/archive.
  //
  // Unlike accept/reject/block, this endpoint does NOT require a campaign_id —
  // archiving applies to the promoter globally, not per-campaign.
  //
  // If >5 IDs are passed, FirstPromoter processes the operation
  // asynchronously (response status will be "in_progress").
  //
  // API docs: docs/firstpromoter-api/promoters/...archive-promoters...md
  // ==========================================================================
  server.registerTool(
    "archive_promoters",

    {
      title: "Archive Promoters",
      description:
        "Archive one or more promoters in FirstPromoter. " +
        "This is a batch operation — provide an array of promoter ids to archive. " +
        "Unlike accept/reject/block, no campaign_id is needed — archiving is global. " +

        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +
        "The response status will be 'in_progress' instead of 'completed'. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta. " +

        "IMPORTANT: When presenting results, cite the exact status and counts from the response.",

      inputSchema: {
        ids: z.array(z.number().int())
          .optional()
          .describe("Array of promoter IDs to archive. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body
        const body: Record<string, unknown> = {};

        if (args.ids) {
          body.ids = args.ids;
        }

        // Call POST /promoters/archive
        const result = await callFirstPromoterAPI('/promoters/archive', {
          method: 'POST',
          body
        });

        // Format response using the batch result formatter
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
            text: `Error archiving promoters: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: restore_promoters
  //
  // Restores (unarchives) one or more archived promoters.
  // Sends POST to /promoters/restore.
  //
  // Like archive, this endpoint does NOT require a campaign_id —
  // restoring applies to the promoter globally.
  //
  // If >5 IDs are passed, FirstPromoter processes the operation
  // asynchronously (response status will be "in_progress").
  //
  // API docs: docs/firstpromoter-api/promoters/...restore-unarchived-promoters...md
  // ==========================================================================
  server.registerTool(
    "restore_promoters",

    {
      title: "Restore Promoters",
      description:
        "Restore (unarchive) one or more archived promoters in FirstPromoter. " +
        "This is a batch operation — provide an array of promoter ids to restore. " +
        "Like archive, no campaign_id is needed — restoring is global. " +

        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +
        "The response status will be 'in_progress' instead of 'completed'. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta. " +

        "IMPORTANT: When presenting results, cite the exact status and counts from the response.",

      inputSchema: {
        ids: z.array(z.number().int())
          .optional()
          .describe("Array of promoter IDs to restore. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body
        const body: Record<string, unknown> = {};

        if (args.ids) {
          body.ids = args.ids;
        }

        // Call POST /promoters/restore
        const result = await callFirstPromoterAPI('/promoters/restore', {
          method: 'POST',
          body
        });

        // Format response using the batch result formatter
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
            text: `Error restoring promoters: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: move_promoters_to_campaign
  //
  // Moves one or more promoters from one campaign to another.
  // Sends POST to /promoters/move_to_campaign.
  //
  // Has two required campaign IDs (from + to) plus optional ids,
  // drip_emails, and soft_move_referrals flags.
  //
  // If >5 IDs are passed, FirstPromoter processes the operation
  // asynchronously (response status will be "in_progress").
  //
  // API docs: docs/firstpromoter-api/promoters/...move-promoter-to-campaign...md
  // ==========================================================================
  server.registerTool(
    "move_promoters_to_campaign",

    {
      title: "Move Promoters to Campaign",
      description:
        "Move one or more promoters from one campaign to another in FirstPromoter. " +
        "This is a batch operation — you must provide from_campaign_id (source) and " +
        "to_campaign_id (destination), and optionally an array of promoter ids. " +

        "OPTIONS: " +
        "drip_emails — if true, sends an email to the promoter for this action. " +
        "soft_move_referrals — if true, move referrals to the NEW campaign and future " +
        "commissions from existing referrals will be tracked in the NEW campaign. " +
        "If false, keep referrals in the OLD campaign and future commissions from " +
        "existing referrals will be tracked in the OLD campaign. " +

        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +
        "The response status will be 'in_progress' instead of 'completed'. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta. " +

        "IMPORTANT: When presenting results, cite the exact status and counts from the response.",

      inputSchema: {
        from_campaign_id: z.number().int()
          .describe("The ID of the campaign to move promoters FROM (required)."),

        to_campaign_id: z.number().int()
          .describe("The ID of the campaign to move promoters TO (required)."),

        ids: z.array(z.number().int())
          .optional()
          .describe("Array of promoter IDs to move. If >5 IDs, the operation runs asynchronously."),

        drip_emails: z.boolean()
          .optional()
          .describe("If true, sends an email notification to the promoter for this action."),

        soft_move_referrals: z.boolean()
          .optional()
          .describe(
            "If true, move referrals to the NEW campaign — future commissions from existing " +
            "referrals will be tracked in the NEW campaign. If false, keep referrals in the OLD " +
            "campaign — future commissions from existing referrals stay in the OLD campaign."
          ),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body
        const body: Record<string, unknown> = {
          from_campaign_id: args.from_campaign_id,
          to_campaign_id: args.to_campaign_id,
        };

        if (args.ids) {
          body.ids = args.ids;
        }
        if (args.drip_emails !== undefined) {
          body.drip_emails = args.drip_emails;
        }
        if (args.soft_move_referrals !== undefined) {
          body.soft_move_referrals = args.soft_move_referrals;
        }

        // Call POST /promoters/move_to_campaign
        const result = await callFirstPromoterAPI('/promoters/move_to_campaign', {
          method: 'POST',
          body
        });

        // Format response using the batch result formatter
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
            text: `Error moving promoters to campaign: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: add_promoters_to_campaign
  //
  // Adds one or more promoters to a campaign (they can be in multiple campaigns).
  // Sends POST to /promoters/add_to_campaign.
  //
  // Unlike move_to_campaign, this doesn't remove promoters from their current
  // campaign — it adds them to an additional campaign.
  //
  // If >5 IDs are passed, FirstPromoter processes the operation
  // asynchronously (response status will be "in_progress").
  //
  // API docs: docs/firstpromoter-api/promoters/...add-promoter-to-campaign...md
  // ==========================================================================
  server.registerTool(
    "add_promoters_to_campaign",

    {
      title: "Add Promoters to Campaign",
      description:
        "Add one or more promoters to a campaign in FirstPromoter. " +
        "Unlike move_promoters_to_campaign, this does NOT remove promoters from their " +
        "current campaign — it adds them to an additional campaign. " +
        "This is a batch operation — you must provide the campaign_id to add promoters to, " +
        "and optionally an array of promoter ids. " +

        "OPTIONS: " +
        "drip_emails — if true, sends an email to the promoter for this action. " +

        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +
        "The response status will be 'in_progress' instead of 'completed'. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta. " +

        "IMPORTANT: When presenting results, cite the exact status and counts from the response.",

      inputSchema: {
        campaign_id: z.number().int()
          .describe("The ID of the campaign to add promoters to (required)."),

        ids: z.array(z.number().int())
          .optional()
          .describe("Array of promoter IDs to add. If >5 IDs, the operation runs asynchronously."),

        drip_emails: z.boolean()
          .optional()
          .describe("If true, sends an email notification to the promoter for this action."),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body
        const body: Record<string, unknown> = {
          campaign_id: args.campaign_id,
        };

        if (args.ids) {
          body.ids = args.ids;
        }
        if (args.drip_emails !== undefined) {
          body.drip_emails = args.drip_emails;
        }

        // Call POST /promoters/add_to_campaign
        const result = await callFirstPromoterAPI('/promoters/add_to_campaign', {
          method: 'POST',
          body
        });

        // Format response using the batch result formatter
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
            text: `Error adding promoters to campaign: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: create_promoter
  //
  // Creates a new promoter in FirstPromoter.
  // Sends POST to /promoters.
  //
  // The body accepts an email (required), optional profile fields (nested),
  // cust_id, initial_campaign_id, and drip_emails flag.
  //
  // Returns the full promoter object (same as get_promoter).
  //
  // API docs: docs/firstpromoter-api/promoters/...create-promoter...md
  // ==========================================================================
  server.registerTool(
    "create_promoter",

    {
      title: "Create Promoter",
      description:
        "Create a new promoter in FirstPromoter. " +
        "Only email is required — all other fields are optional. " +

        "BODY PARAMETERS: " +
        "email (required) — promoter's email address. " +
        "cust_id — custom customer identifier. " +
        "initial_campaign_id — campaign ID to add the promoter to initially. " +
        "drip_emails — if true, sends a welcome email to the promoter. " +
        "Profile fields (all optional): first_name, last_name, website, company_name, " +
        "company_number, phone_number, vat_id, country (2-char code), address, description. " +
        "Social URLs (all optional): instagram_url, youtube_url, linkedin_url, " +
        "facebook_url, twitter_url, twitch_url, tiktok_url. " +
        "custom_fields — key-value pairs matching your company's custom field config. " +

        "RESPONSE STRUCTURE — returns the full promoter object: " +
        "id, email, name, cust_id, note, state (pending/accepted/rejected/blocked/inactive/not_set), " +
        "stats { clicks_count, referrals_count, sales_count, customers_count, revenue_amount, active_customers_count }, " +
        "is_customized, fraud_suspicions[], is_confirmed, invoice_details_status, " +
        "profile { first_name, last_name, website, company_name, company_number, phone_number, " +
        "vat_id, country, address, avatar, w8_form_url, w9_form_url, description, " +
        "instagram_url, youtube_url, linkedin_url, facebook_url, twitter_url, twitch_url, tiktok_url }, " +
        "joined_at, last_login_at, archived_at, custom_fields, password_setup_url, " +
        "first_event_at, created_at, updated_at, " +
        "promoter_campaigns[] { id, campaign_id, promoter_id, state, campaign { id, name, color }, " +
        "coupon, ref_token, ref_link }. " +

        "IMPORTANT: When presenting results, cite exact values from the response. " +
        "Do NOT guess or infer any fields.",

      inputSchema: {
        // --- Required field ---
        email: z.string()
          .describe("Email address of the promoter (required)."),

        // --- Optional top-level fields ---
        cust_id: z.string()
          .nullable()
          .optional()
          .describe("Custom customer identifier"),

        initial_campaign_id: z.number().int()
          .optional()
          .describe("The ID of the campaign to add the promoter to initially."),

        drip_emails: z.boolean()
          .optional()
          .describe("If true, sends a welcome email to the promoter."),

        // --- Profile fields (mapped to nested profile object in the body) ---
        first_name: z.string().optional()
          .describe("Promoter's first name"),

        last_name: z.string().optional()
          .describe("Promoter's last name"),

        website: z.string().optional()
          .describe("Promoter's website URL"),

        company_name: z.string().optional()
          .describe("Business / company name"),

        company_number: z.string().optional()
          .describe("Company registration number"),

        phone_number: z.string().optional()
          .describe("Contact phone number"),

        vat_id: z.string().optional()
          .describe("VAT identifier"),

        country: z.string().optional()
          .describe("2-character country code (e.g. 'US', 'GB', 'DE')"),

        address: z.string().optional()
          .describe("Physical / mailing address"),

        description: z.string().optional()
          .describe("Description / bio of the promoter"),

        // --- Social URLs (mapped to profile object) ---
        instagram_url: z.string().optional()
          .describe("Instagram profile URL"),

        youtube_url: z.string().optional()
          .describe("YouTube channel URL"),

        linkedin_url: z.string().optional()
          .describe("LinkedIn profile URL"),

        facebook_url: z.string().optional()
          .describe("Facebook profile URL"),

        twitter_url: z.string().optional()
          .describe("Twitter / X profile URL"),

        twitch_url: z.string().optional()
          .describe("Twitch channel URL"),

        tiktok_url: z.string().optional()
          .describe("TikTok profile URL"),

        // --- Custom fields ---
        custom_fields: z.record(z.string()).optional()
          .describe("Custom fields as key-value pairs matching your company's custom field config " +
            "(e.g. { \"my_field\": \"value\" }). Keys must match fields set in Settings > Affiliate portal > Custom fields."),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body
        const body: Record<string, unknown> = {
          email: args.email,
        };

        // Optional top-level fields
        if (args.cust_id !== undefined) body.cust_id = args.cust_id;
        if (args.initial_campaign_id !== undefined) body.initial_campaign_id = args.initial_campaign_id;
        if (args.drip_emails !== undefined) body.drip_emails = args.drip_emails;

        // Profile fields — collect into nested profile object
        // The API expects: { "profile": { "first_name": "...", ... } }
        const profileFields = [
          'first_name', 'last_name', 'website', 'company_name', 'company_number',
          'phone_number', 'vat_id', 'country', 'address', 'description',
          'instagram_url', 'youtube_url', 'linkedin_url', 'facebook_url',
          'twitter_url', 'twitch_url', 'tiktok_url'
        ];

        const profile: Record<string, unknown> = {};
        for (const field of profileFields) {
          const value = (args as Record<string, unknown>)[field];
          if (value !== undefined) {
            profile[field] = value;
          }
        }

        if (Object.keys(profile).length > 0) {
          body.profile = profile;
        }

        // Custom fields — pass as-is (key-value object)
        if (args.custom_fields) {
          body.custom_fields = args.custom_fields;
        }

        // Call POST /promoters
        const result = await callFirstPromoterAPI('/promoters', {
          method: 'POST',
          body
        });

        // Format response — wrap single promoter in array for the list formatter
        const summary = `Created promoter successfully.\n\n${formatPromoters([result])}`;
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
            text: `Error creating promoter: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: assign_parent_promoter
  //
  // Assigns a parent promoter to one or more promoters (sub-affiliate relationship).
  // Sends POST to /promoters/assign_parent.
  //
  // If >5 IDs are passed, FirstPromoter processes the operation
  // asynchronously (response status will be "in_progress").
  //
  // API docs: docs/firstpromoter-api/promoters/...assign-parent-promoter...md
  // ==========================================================================
  server.registerTool(
    "assign_parent_promoter",

    {
      title: "Assign Parent Promoter",
      description:
        "Assign a parent promoter to one or more promoters in FirstPromoter (creates a sub-affiliate relationship). " +
        "This is a batch operation — you must provide the parent_promoter_id to assign as the parent, " +
        "and optionally an array of promoter ids that will become children of that parent. " +

        "ASYNC NOTE: If more than 5 ids are provided, the operation runs asynchronously. " +
        "The response status will be 'in_progress' instead of 'completed'. " +

        "RESPONSE STRUCTURE — returns a batch result object: " +
        "id (batch ID), status (pending/in_progress/completed/failed/stopped), " +
        "total, selected_total, processed_count, failed_count, " +
        "action_label, progress (0-100), processing_errors[], " +
        "created_at, updated_at, meta. " +

        "IMPORTANT: When presenting results, cite the exact status and counts from the response.",

      inputSchema: {
        parent_promoter_id: z.number().int()
          .describe("The ID of the parent promoter to assign the promoters to (required)."),

        ids: z.array(z.number().int())
          .optional()
          .describe("Array of promoter IDs that will become children of the parent. If >5 IDs, the operation runs asynchronously."),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body
        const body: Record<string, unknown> = {
          parent_promoter_id: args.parent_promoter_id,
        };

        if (args.ids) {
          body.ids = args.ids;
        }

        // Call POST /promoters/assign_parent
        const result = await callFirstPromoterAPI('/promoters/assign_parent', {
          method: 'POST',
          body
        });

        // Format response using the batch result formatter
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
            text: `Error assigning parent promoter: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
}
