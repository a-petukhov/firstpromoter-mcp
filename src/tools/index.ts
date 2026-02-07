/**
 * Tool Registry
 *
 * This file is like a "menu" that lists all available tools.
 * Each tool is defined in its own file, and this file imports
 * and registers them all with the MCP server.
 *
 * When you add a new tool:
 * 1. Create a new file in this folder (e.g., referrals.ts)
 * 2. Import and call its register function here
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPromoterTools } from './promoters.js';
import { registerReferralTools } from './referrals.js';
import { registerCommissionTools } from './commissions.js';
import { registerPayoutTools } from './payouts.js';
import { registerReportTools } from './reports.js';
import { registerPromoCodeTools } from './promo-codes.js';
import { registerPromoterCampaignTools } from './promoter-campaigns.js';

/**
 * Registers all tools with the MCP server.
 * Call this once during server startup.
 */
export function registerAllTools(server: McpServer): void {
  registerPromoterTools(server);
  registerReferralTools(server);
  registerCommissionTools(server);
  registerPayoutTools(server);
  registerReportTools(server);
  registerPromoCodeTools(server);
  registerPromoterCampaignTools(server);
}
