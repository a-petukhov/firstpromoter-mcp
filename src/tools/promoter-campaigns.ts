/**
 * Promoter Campaign Tools
 *
 * This file defines all MCP tools related to promoter campaigns.
 * A "promoter campaign" is the linking record between a promoter and a campaign —
 * it defines the promoter's participation in that campaign, including their
 * ref link, coupon, rewards, and stats for that specific campaign.
 *
 * IMPORTANT: The promoter_campaign ID is NOT the same as a promoter ID or campaign ID.
 * It is the unique ID of the linking record that connects a promoter to a campaign.
 *
 * API docs: https://docs.firstpromoter.com/api-reference-v2/api-admin/promoter-campaigns
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callFirstPromoterAPI } from '../api.js';
import { formatPromoterCampaigns, buildToolResponse } from '../formatters.js';

/**
 * Registers all promoter-campaign-related tools with the MCP server.
 */
export function registerPromoterCampaignTools(server: McpServer): void {

  // ==========================================================================
  // Tool: get_promoter_campaigns
  //
  // Lists all promoter campaigns (the linking records between promoters and campaigns).
  // API returns a flat array (NOT wrapped in { data: [...] }).
  //
  // API docs: docs/firstpromoter-api/promoter-campaigns/...get-available-promoter-campaigns...md
  // ==========================================================================
  server.registerTool(
    "get_promoter_campaigns",

    {
      title: "Get Promoter Campaigns",
      description:
        "List all promoter campaigns from your FirstPromoter account. " +
        "A 'promoter campaign' is the linking record between a promoter and a campaign — " +
        "it defines the promoter's participation in that specific campaign. " +
        "The promoter_campaign ID is NOT the same as a promoter_id or campaign_id. " +

        "RESPONSE STRUCTURE — returns a flat array of promoter campaign objects, each containing: " +
        "id (the promoter_campaign ID — NOT the promoter ID or campaign ID), " +
        "campaign_id, promoter_id, created_at, " +
        "promoter: { id, email, name }, " +
        "campaign: { id, name, color }, " +
        "state (pending/accepted/rejected/blocked/inactive), " +
        "stats: { clicks_count, referrals_count, sales_count, customers_count, revenue_amount }, " +
        "coupon, display_coupon, ref_token, ref_link, " +
        "is_customized (boolean), direct_url, " +
        "referral_rewards_customized (boolean), promoter_rewards_customized (boolean), " +
        "rewards_for_promoters: array of { apply_on, product_ids[], reward_id, " +
        "reward: { name, promoter_reward_type, hide_reward, tier_level, coupon }, " +
        "products: [{ id, name }] }, " +
        "rewards_for_referrals: array of { apply_on, product_ids[], reward_id, " +
        "reward: { name, promoter_reward_type, hide_reward, tier_level, coupon }, " +
        "products: [{ id, name }] }, " +
        "promo_codes (string[]). " +

        "NOTE: The API returns a flat array, NOT wrapped in { data: [...] }. " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data. " +
        "Each promoter campaign's fields are independent — do not infer or guess values between records.",

      inputSchema: {
        // This endpoint has no query parameters — it returns all promoter campaigns
      }
    },

    async () => {
      try {
        // Call the FirstPromoter API — no query params for this endpoint
        const result = await callFirstPromoterAPI('/promoter_campaigns');

        // Format the response: structured summary + raw JSON
        const summary = formatPromoterCampaigns(result);
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
              text: `Error fetching promoter campaigns: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: update_promoter_campaign
  //
  // Updates a promoter campaign. Sends PUT to /promoter_campaigns/{id}.
  // The {id} is the promoter_campaign ID (the linking record),
  // NOT the promoter ID or campaign ID.
  //
  // API docs: docs/firstpromoter-api/promoter-campaigns/...update-promoter-campaign...md
  // ==========================================================================
  server.registerTool(
    "update_promoter_campaign",

    {
      title: "Update Promoter Campaign",
      description:
        "Update a promoter campaign in FirstPromoter. Only provided fields are changed. " +
        "CRITICAL: The 'id' parameter is the promoter_campaign ID — the linking record " +
        "that defines a promoter's participation in a campaign. It is NOT the promoter's ID " +
        "and NOT the campaign's ID. You can find this ID in the promoter_campaigns array " +
        "when you get promoter details, or by calling get_promoter_campaigns. " +

        "BODY PARAMETERS — all optional: " +
        "ref_token (the promoter's referral token for this campaign), " +
        "state (pending/accepted/rejected/blocked/inactive), " +
        "coupon (coupon code assigned to this promoter for this campaign), " +
        "display_coupon (display version of the coupon), " +
        "direct_url (custom direct URL for this promoter-campaign link), " +
        "promoter_rewards_customized (boolean — whether promoter rewards are customized for this link), " +
        "referral_rewards_customized (boolean — whether referral rewards are customized for this link), " +
        "rewards_for_promoters (array of reward objects: { apply_on, product_ids[], reward_id }), " +
        "rewards_for_referrals (array of reward objects: { apply_on, product_ids[], reward_id }). " +

        "RESPONSE STRUCTURE — returns the updated promoter campaign object: " +
        "id (the promoter_campaign ID — NOT the promoter ID or campaign ID), " +
        "campaign_id, promoter_id, created_at, " +
        "promoter: { id, email, name }, " +
        "campaign: { id, name, color }, " +
        "state (pending/accepted/rejected/blocked/inactive), " +
        "stats: { clicks_count, referrals_count, sales_count, customers_count, revenue_amount }, " +
        "coupon, display_coupon, ref_token, ref_link, " +
        "is_customized (boolean), direct_url, " +
        "referral_rewards_customized (boolean), promoter_rewards_customized (boolean), " +
        "rewards_for_promoters: array of { apply_on, product_ids[], reward_id, " +
        "reward: { name, promoter_reward_type, hide_reward, tier_level, coupon }, " +
        "products: [{ id, name }] }, " +
        "rewards_for_referrals: array of { apply_on, product_ids[], reward_id, " +
        "reward: { name, promoter_reward_type, hide_reward, tier_level, coupon }, " +
        "products: [{ id, name }] }, " +
        "promo_codes (string[]). " +

        "IMPORTANT: This is a partial update — only send fields you want to change.",

      inputSchema: {
        // --- Identification (required) ---
        id: z.number().int()
          .describe("Promoter campaign ID (required). This is the linking record ID — NOT the promoter's ID and NOT the campaign's ID. Find it via get_promoter_campaigns or in the promoter_campaigns array of promoter details."),

        // --- Updatable fields ---
        ref_token: z.string()
          .optional()
          .describe("The promoter's referral token for this campaign"),

        state: z.enum(['pending', 'accepted', 'rejected', 'blocked', 'inactive'])
          .optional()
          .describe("New state for this promoter-campaign link"),

        coupon: z.string()
          .optional()
          .describe("Coupon code assigned to this promoter for this campaign"),

        display_coupon: z.string()
          .optional()
          .describe("Display version of the coupon (what the promoter sees/shares)"),

        direct_url: z.string()
          .optional()
          .describe("Custom direct URL for this promoter-campaign link"),

        promoter_rewards_customized: z.boolean()
          .optional()
          .describe("Whether promoter rewards are customized for this specific promoter-campaign link"),

        referral_rewards_customized: z.boolean()
          .optional()
          .describe("Whether referral rewards are customized for this specific promoter-campaign link"),

        rewards_for_promoters: z.array(z.object({
          apply_on: z.string().describe("When the reward applies (e.g. 'monthly')"),
          product_ids: z.array(z.number().int()).optional().describe("Array of product IDs this reward applies to"),
          reward_id: z.number().int().describe("The reward ID to assign"),
        }))
          .optional()
          .describe("Custom promoter rewards for this promoter-campaign link. Each object: { apply_on, product_ids[], reward_id }"),

        rewards_for_referrals: z.array(z.object({
          apply_on: z.string().describe("When the reward applies (e.g. 'monthly')"),
          product_ids: z.array(z.number().int()).optional().describe("Array of product IDs this reward applies to"),
          reward_id: z.number().int().describe("The reward ID to assign"),
        }))
          .optional()
          .describe("Custom referral rewards for this promoter-campaign link. Each object: { apply_on, product_ids[], reward_id }"),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body — only include fields that were provided
        const body: Record<string, unknown> = {};

        if (args.ref_token !== undefined) body.ref_token = args.ref_token;
        if (args.state !== undefined) body.state = args.state;
        if (args.coupon !== undefined) body.coupon = args.coupon;
        if (args.display_coupon !== undefined) body.display_coupon = args.display_coupon;
        if (args.direct_url !== undefined) body.direct_url = args.direct_url;
        if (args.promoter_rewards_customized !== undefined) body.promoter_rewards_customized = args.promoter_rewards_customized;
        if (args.referral_rewards_customized !== undefined) body.referral_rewards_customized = args.referral_rewards_customized;
        if (args.rewards_for_promoters !== undefined) body.rewards_for_promoters = args.rewards_for_promoters;
        if (args.rewards_for_referrals !== undefined) body.rewards_for_referrals = args.rewards_for_referrals;

        const result = await callFirstPromoterAPI(`/promoter_campaigns/${args.id}`, {
          method: 'PUT',
          body
        });

        // Format response — wrap single promoter campaign in array for the list formatter
        const summary = `Updated promoter campaign successfully.\n\n${formatPromoterCampaigns([result])}`;
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
            text: `Error updating promoter campaign: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
}
