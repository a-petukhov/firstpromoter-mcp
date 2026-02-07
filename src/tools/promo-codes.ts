/**
 * Promo Code Tools
 *
 * This file defines all MCP tools related to promo codes.
 * Promo codes are discount/coupon codes linked to promoter campaigns.
 * They can be listed, retrieved, created (Stripe only), updated, and archived.
 *
 * API docs: https://docs.firstpromoter.com/api-reference-v2/api-admin/promo-codes
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callFirstPromoterAPI } from '../api.js';
import { formatPromoCodes, buildToolResponse } from '../formatters.js';

/**
 * Registers all promo-code-related tools with the MCP server.
 */
export function registerPromoCodeTools(server: McpServer): void {

  // ==========================================================================
  // Tool: get_promo_codes
  //
  // Lists all promo codes, optionally filtered by promoter campaign.
  // API returns a flat array (NOT wrapped in { data: [...] }).
  //
  // API docs: docs/firstpromoter-api/promo-codes/...get-promo-codes...md
  // ==========================================================================
  server.registerTool(
    "get_promo_codes",

    {
      title: "Get Promo Codes",
      description:
        "List all promo codes from your FirstPromoter account, optionally filtered by promoter campaign. " +

        "RESPONSE STRUCTURE — returns a flat array of promo code objects, each containing: " +
        "id (integer, promo code entry ID), " +
        "code (string, the actual promo/coupon code), " +
        "reward: { id (integer), name (string) }, " +
        "ext_id (string, external ID e.g. from Stripe), " +
        "description (string), " +
        "company_id (integer), " +
        "promoter_campaign_id (integer, the promoter-campaign link this code belongs to), " +
        "metadata (object), " +
        "details (object), " +
        "archived_at (datetime string or null). " +

        "NOTE: The API returns a flat array, NOT wrapped in { data: [...] }. " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data. " +
        "Each promo code's fields are independent — do not infer or guess values between records.",

      inputSchema: {
        promoter_campaign_id: z.number().int()
          .optional()
          .describe("Filter promo codes by a specific promoter campaign ID"),
      }
    },

    async (args) => {
      try {
        // Build query parameters
        const queryParams: Record<string, string> = {};

        if (args.promoter_campaign_id !== undefined) {
          queryParams.promoter_campaign_id = args.promoter_campaign_id.toString();
        }

        // Call the FirstPromoter API
        const result = await callFirstPromoterAPI('/promo_codes', {
          queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined
        });

        // Format the response: structured summary + raw JSON
        const summary = formatPromoCodes(result);
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
              text: `Error fetching promo codes: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: get_promo_code
  //
  // Gets a single promo code's details. Sends GET to /promo_codes/{id}.
  //
  // API docs: docs/firstpromoter-api/promo-codes/...get-promo-code-by-id...md
  // ==========================================================================
  server.registerTool(
    "get_promo_code",

    {
      title: "Get Promo Code Details",
      description:
        "Get details for a single promo code from FirstPromoter by its numeric ID. " +

        "RESPONSE STRUCTURE — returns a single promo code object: " +
        "id (integer, promo code entry ID), " +
        "code (string, the actual promo/coupon code), " +
        "reward: { id (integer), name (string) }, " +
        "ext_id (string, external ID e.g. from Stripe), " +
        "description (string), " +
        "company_id (integer), " +
        "promoter_campaign_id (integer, the promoter-campaign link this code belongs to), " +
        "metadata (object), " +
        "details (object), " +
        "archived_at (datetime string or null). " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data.",

      inputSchema: {
        id: z.number().int()
          .describe("The promo code's numeric ID. Required."),
      }
    },

    async (args) => {
      try {
        const result = await callFirstPromoterAPI(`/promo_codes/${args.id}`);

        // Format response — wrap single promo code in array for the list formatter
        const summary = formatPromoCodes([result]);
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
            text: `Error fetching promo code details: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: create_promo_code
  //
  // Creates a new promo code. Sends POST to /promo_codes.
  // IMPORTANT: This endpoint only works with Stripe integration.
  //
  // API docs: docs/firstpromoter-api/promo-codes/...create-promo-code...md
  // ==========================================================================
  server.registerTool(
    "create_promo_code",

    {
      title: "Create Promo Code (Stripe Only)",
      description:
        "Create a new promo code in FirstPromoter. " +
        "IMPORTANT: This endpoint only works if your FirstPromoter account is integrated with Stripe. " +
        "It will fail for accounts using other payment processors. " +

        "REQUIRED FIELDS: code (the promo code string), reward_id (which reward to associate), " +
        "promoter_campaign_id (which promoter-campaign link to assign the code to). " +

        "OPTIONAL FIELDS: description, metadata (arbitrary key-value pairs), " +
        "details (arbitrary key-value pairs). " +

        "RESPONSE STRUCTURE — returns the created promo code object: " +
        "id (integer, promo code entry ID), " +
        "code (string, the actual promo/coupon code), " +
        "reward: { id (integer), name (string) }, " +
        "ext_id (string, external ID e.g. from Stripe), " +
        "description (string), " +
        "company_id (integer), " +
        "promoter_campaign_id (integer), " +
        "metadata (object), " +
        "details (object), " +
        "archived_at (datetime string or null). " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data.",

      inputSchema: {
        // --- Required fields ---
        code: z.string()
          .describe("The promo/coupon code string. Required."),

        reward_id: z.number().int()
          .describe("ID of the reward to associate with this promo code. Required."),

        promoter_campaign_id: z.number().int()
          .describe("ID of the promoter campaign to assign this promo code to. Required."),

        // --- Optional fields ---
        description: z.string()
          .optional()
          .describe("Description of the promo code"),

        metadata: z.record(z.unknown())
          .optional()
          .describe("Arbitrary metadata key-value pairs for the promo code"),

        details: z.record(z.unknown())
          .optional()
          .describe("Arbitrary details key-value pairs for the promo code"),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body
        const body: Record<string, unknown> = {
          code: args.code,
          reward_id: args.reward_id,
          promoter_campaign_id: args.promoter_campaign_id,
        };

        if (args.description !== undefined) body.description = args.description;
        if (args.metadata !== undefined) body.metadata = args.metadata;
        if (args.details !== undefined) body.details = args.details;

        const result = await callFirstPromoterAPI('/promo_codes', {
          method: 'POST',
          body
        });

        const summary = `Created promo code successfully.\n\n${formatPromoCodes([result])}`;
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
            text: `Error creating promo code: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: update_promo_code
  //
  // Updates a promo code. Sends PUT to /promo_codes/{id}.
  // Cannot be updated if archived and ext_id is present.
  //
  // API docs: docs/firstpromoter-api/promo-codes/...update-promo-code-by-id...md
  // ==========================================================================
  server.registerTool(
    "update_promo_code",

    {
      title: "Update Promo Code",
      description:
        "Update a promo code's information in FirstPromoter. Only provided fields are changed. " +
        "NOTE: A promo code cannot be updated if it is archived and has an ext_id (external ID from Stripe). " +

        "BODY PARAMETERS — all optional: " +
        "code (new promo code string), " +
        "description (new description), " +
        "promoter_campaign_id (move to a different promoter-campaign link), " +
        "metadata (arbitrary key-value pairs), " +
        "details (arbitrary key-value pairs). " +

        "RESPONSE STRUCTURE — returns the updated promo code object: " +
        "id (integer, promo code entry ID), " +
        "code (string, the actual promo/coupon code), " +
        "reward: { id (integer), name (string) }, " +
        "ext_id (string, external ID e.g. from Stripe), " +
        "description (string), " +
        "company_id (integer), " +
        "promoter_campaign_id (integer), " +
        "metadata (object), " +
        "details (object), " +
        "archived_at (datetime string or null). " +

        "IMPORTANT: This is a partial update — only send fields you want to change.",

      inputSchema: {
        // --- Promo code identification ---
        id: z.number().int()
          .describe("The promo code's numeric ID. Required."),

        // --- Updatable fields ---
        code: z.string()
          .optional()
          .describe("New promo/coupon code string"),

        description: z.string()
          .optional()
          .describe("New description for the promo code"),

        promoter_campaign_id: z.number().int()
          .optional()
          .describe("Move promo code to a different promoter-campaign link by its ID"),

        metadata: z.record(z.unknown())
          .optional()
          .describe("Arbitrary metadata key-value pairs for the promo code"),

        details: z.record(z.unknown())
          .optional()
          .describe("Arbitrary details key-value pairs for the promo code"),
      }
    },

    async (args) => {
      try {
        // Build the JSON request body (only include provided fields)
        const body: Record<string, unknown> = {};

        if (args.code !== undefined) body.code = args.code;
        if (args.description !== undefined) body.description = args.description;
        if (args.promoter_campaign_id !== undefined) body.promoter_campaign_id = args.promoter_campaign_id;
        if (args.metadata !== undefined) body.metadata = args.metadata;
        if (args.details !== undefined) body.details = args.details;

        const result = await callFirstPromoterAPI(`/promo_codes/${args.id}`, {
          method: 'PUT',
          body
        });

        const summary = `Updated promo code successfully.\n\n${formatPromoCodes([result])}`;
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
            text: `Error updating promo code: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: archive_promo_code
  //
  // Archives (soft-deletes) a promo code. Sends DELETE to /promo_codes/{id}.
  // The API may return an empty body on success (HTTP 200 with no JSON).
  //
  // API docs: docs/firstpromoter-api/promo-codes/...archive-promo-code-by-id...md
  // ==========================================================================
  server.registerTool(
    "archive_promo_code",

    {
      title: "Archive Promo Code",
      description:
        "Archive (soft-delete) a promo code in FirstPromoter by its numeric ID. " +
        "This does NOT permanently delete the promo code — it sets archived_at to the current timestamp. " +
        "Archived promo codes with an ext_id (Stripe) cannot be updated afterward. " +

        "RESPONSE: The API returns HTTP 200 on success, potentially with an empty body. " +
        "A confirmation message will be shown if the operation succeeds. " +

        "IMPORTANT: This operation cannot be easily undone. Confirm with the user before archiving.",

      inputSchema: {
        id: z.number().int()
          .describe("The promo code's numeric ID to archive. Required."),
      }
    },

    async (args) => {
      try {
        // The DELETE endpoint may return an empty body on success.
        // callFirstPromoterAPI calls response.json(), which will throw on empty body.
        // We need to handle this gracefully.
        let result: unknown;
        try {
          result = await callFirstPromoterAPI(`/promo_codes/${args.id}`, {
            method: 'DELETE'
          });
        } catch (innerError) {
          // If the error is a JSON parse error from an empty 200 response, that's actually success.
          // The API helper throws on non-ok status codes before trying to parse JSON,
          // so if we get a JSON parse error it means the HTTP status was 200 (ok) but body was empty.
          const innerMsg = innerError instanceof Error ? innerError.message : '';
          if (innerMsg.includes('JSON') || innerMsg.includes('Unexpected end')) {
            // Empty body on success — this is expected for DELETE
            return {
              content: [{
                type: "text" as const,
                text: `Promo code ${args.id} archived successfully.`
              }]
            };
          }
          // If it's a different error (e.g., 403, 404), re-throw it
          throw innerError;
        }

        // If we got JSON back, format it normally
        const summary = `Promo code ${args.id} archived successfully.\n\n${formatPromoCodes([result])}`;
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
            text: `Error archiving promo code: ${errorMessage}`
          }],
          isError: true
        };
      }
    }
  );
}
