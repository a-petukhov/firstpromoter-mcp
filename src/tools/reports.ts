/**
 * Report Tools
 *
 * This file defines all MCP tools related to reports.
 * Reports let you pull aggregated analytics data from FirstPromoter —
 * grouped by campaigns, promoters, traffic sources, URLs, or as an overview.
 *
 * All report endpoints share a similar pattern:
 * - columns[] — which metrics to include (e.g., revenue_amount, clicks_count)
 * - group_by — time period grouping (day/week/month/year)
 * - start_date / end_date — date range for the report
 * - q — optional search query
 * - sorting — optional sort field and direction
 *
 * API docs: https://docs.firstpromoter.com/api-reference-v2/api-admin/reports
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callFirstPromoterAPI } from '../api.js';
import { formatCampaignReport, formatOverviewReport, formatPromoterReport, formatTrafficSourceReport, formatUrlReport, buildToolResponse } from '../formatters.js';

// ============================================================================
// SHARED HELPER
// ============================================================================

/**
 * Builds the query params that all report endpoints share.
 *
 * Maps flat Zod args to the API's expected query string format:
 * - columns array  -> columns[]=value1&columns[]=value2
 * - group_by       -> group_by=month
 * - start_date     -> start_date=2024-01-01
 * - end_date       -> end_date=2024-12-31
 * - q              -> q=search_term
 * - sort_by + sort_direction -> sorting[field]=direction
 */
function buildReportQueryParams(args: {
  columns: string[];
  group_by: string;
  start_date: string;
  end_date: string;
  q?: string;
  sort_by?: string;
  sort_direction?: string;
}): URLSearchParams {
  const params = new URLSearchParams();

  // Columns array: columns[]=value1&columns[]=value2
  // Rails-style APIs require non-indexed brackets for arrays.
  // Using .append() allows duplicate keys which URLSearchParams handles correctly.
  for (const col of args.columns) {
    params.append('columns[]', col);
  }

  // Required params
  params.set('group_by', args.group_by);
  params.set('start_date', args.start_date);
  params.set('end_date', args.end_date);

  // Optional search
  if (args.q) {
    params.set('q', args.q);
  }

  // Optional sorting: sorting[field]=direction
  if (args.sort_by && args.sort_direction) {
    params.set(`sorting[${args.sort_by}]`, args.sort_direction);
  }

  return params;
}

// ============================================================================
// COLUMN ENUMS
// ============================================================================

// Campaigns, Overview, and Promoters share the same set of available columns
const STANDARD_COLUMNS = [
  'active_customers',
  'monthly_churn',
  'clicks_count',
  'net_revenue_amount',
  'revenue_amount',
  'referrals_count',
  'customers_count',
  'sales_count',
  'refunds_count',
  'cancelled_customers_count',
  'promoter_earnings_amount',
  'non_link_customers',
  'referrals_to_customers_cr',
  '3m_epc',
  '6m_epc',
  'clicks_to_customers_cr',
  'clicks_to_referrals_cr',
  'promoter_paid_amount',
  'signups_count',
] as const;

// Traffic Sources have a smaller set of columns
const TRAFFIC_SOURCE_COLUMNS = [
  'clicks_count',
  'revenue_amount',
  'promoter_earnings_amount',
  'referrals_count',
  'customers_count',
  'sales_count',
  'refunds_count',
  'cancelled_customers_count',
  'referrals_to_customers_cr',
  'clicks_to_customers_cr',
  'clicks_to_referrals_cr',
] as const;

// URLs have the same as traffic sources + "url"
const URL_COLUMNS = [
  'clicks_count',
  'revenue_amount',
  'promoter_earnings_amount',
  'referrals_count',
  'customers_count',
  'sales_count',
  'refunds_count',
  'cancelled_customers_count',
  'referrals_to_customers_cr',
  'clicks_to_customers_cr',
  'clicks_to_referrals_cr',
  'url',
] as const;

// Group by options shared by all report endpoints
const GROUP_BY_OPTIONS = ['day', 'week', 'month', 'year'] as const;

// ============================================================================
// REGISTER FUNCTION
// ============================================================================

/**
 * Registers all report-related tools with the MCP server.
 */
export function registerReportTools(server: McpServer): void {

  // ==========================================================================
  // Tool: get_reports_campaigns
  //
  // Get report data grouped by campaigns.
  // Each item in the array represents a campaign with its aggregated data
  // and time-period sub_data breakdown.
  //
  // API docs: docs/firstpromoter-api/reports/...get-reports-for-campaigns...md
  // ==========================================================================
  server.registerTool(
    "get_reports_campaigns",

    {
      title: "Get Campaign Reports",
      description:
        "Get report data grouped by campaigns from FirstPromoter. " +
        "Returns aggregated metrics for each campaign, with optional time-period breakdowns. " +

        "QUERY PARAMETERS — columns (required, array of column names to include), " +
        "group_by (required, day/week/month/year), start_date (required), end_date (required), " +
        "q (optional search), sort_by + sort_direction (optional sorting). " +

        "AVAILABLE COLUMNS: active_customers, monthly_churn, clicks_count, net_revenue_amount, " +
        "revenue_amount, referrals_count, customers_count, sales_count, refunds_count, " +
        "cancelled_customers_count, promoter_earnings_amount, non_link_customers, " +
        "referrals_to_customers_cr, 3m_epc, 6m_epc, clicks_to_customers_cr, " +
        "clicks_to_referrals_cr, promoter_paid_amount, signups_count. " +

        "RESPONSE STRUCTURE — returns a flat array of objects, each containing: " +
        "campaign: { id, name, color }, " +
        "id (integer — the campaign ID), " +
        "data: { <requested columns as key-value pairs, e.g. revenue_amount: 12300> }, " +
        "sub_data: [ { period (string, e.g. '2024-01'), id (string), " +
        "data: { <same columns as above for that time period> } } ]. " +

        "NOTE: The API returns a flat array, NOT wrapped in { data: [...] }. " +
        "Monetary amounts are in cents (divide by 100 for dollars). " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data. " +
        "Each campaign's fields are independent — do not infer or guess values between records.",

      inputSchema: {
        columns: z.array(z.enum(STANDARD_COLUMNS))
          .describe("Columns (metrics) to include in the report. Pass one or more from the available options."),

        group_by: z.enum(GROUP_BY_OPTIONS)
          .describe("Time period grouping for sub_data breakdown (day, week, month, or year)."),

        start_date: z.string()
          .describe("Start date for the report period (ISO 8601 format, e.g. '2024-01-01')."),

        end_date: z.string()
          .describe("End date for the report period (ISO 8601 format, e.g. '2024-12-31')."),

        q: z.string()
          .optional()
          .describe("Search query string to filter campaigns."),

        sort_by: z.string()
          .optional()
          .describe("Column name to sort by (must be one of the requested columns)."),

        sort_direction: z.enum(['asc', 'desc'])
          .optional()
          .describe("Sort direction: 'asc' for ascending, 'desc' for descending. Used with sort_by."),
      }
    },

    async (args) => {
      try {
        const queryParams = buildReportQueryParams(args);

        const result = await callFirstPromoterAPI('/reports/campaigns', { queryParams });

        const summary = formatCampaignReport(result);
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
              text: `Error fetching campaign reports: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: get_reports_overview
  //
  // Get overview report data — a single time-series without entity grouping.
  // Unlike campaigns/promoters, each item IS a time-period entry directly
  // (no nested sub_data).
  //
  // API docs: docs/firstpromoter-api/reports/...get-reports-for-overview...md
  // ==========================================================================
  server.registerTool(
    "get_reports_overview",

    {
      title: "Get Overview Reports",
      description:
        "Get overview report data from FirstPromoter. " +
        "Returns aggregated metrics as a time-series, grouped by the specified period. " +

        "QUERY PARAMETERS — columns (required, array of column names to include), " +
        "group_by (required, day/week/month/year), start_date (required), end_date (required), " +
        "q (optional search), sort_by + sort_direction (optional sorting). " +

        "AVAILABLE COLUMNS: active_customers, monthly_churn, clicks_count, net_revenue_amount, " +
        "revenue_amount, referrals_count, customers_count, sales_count, refunds_count, " +
        "cancelled_customers_count, promoter_earnings_amount, non_link_customers, " +
        "referrals_to_customers_cr, 3m_epc, 6m_epc, clicks_to_customers_cr, " +
        "clicks_to_referrals_cr, promoter_paid_amount, signups_count. " +

        "RESPONSE STRUCTURE — returns a flat array of time-period objects, each containing: " +
        "period (string, e.g. '2024-01'), " +
        "id (string), " +
        "data: { <requested columns as key-value pairs, e.g. revenue_amount: 12300> }. " +

        "NOTE: The API returns a flat array, NOT wrapped in { data: [...] }. " +
        "Unlike campaign/promoter reports, overview does NOT have sub_data — " +
        "each array item IS a time period entry directly. " +
        "Monetary amounts are in cents (divide by 100 for dollars). " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data. " +
        "Each period's fields are independent — do not infer or guess values between records.",

      inputSchema: {
        columns: z.array(z.enum(STANDARD_COLUMNS))
          .describe("Columns (metrics) to include in the report. Pass one or more from the available options."),

        group_by: z.enum(GROUP_BY_OPTIONS)
          .describe("Time period grouping (day, week, month, or year)."),

        start_date: z.string()
          .describe("Start date for the report period (ISO 8601 format, e.g. '2024-01-01')."),

        end_date: z.string()
          .describe("End date for the report period (ISO 8601 format, e.g. '2024-12-31')."),

        q: z.string()
          .optional()
          .describe("Search query string."),

        sort_by: z.string()
          .optional()
          .describe("Column name to sort by (must be one of the requested columns)."),

        sort_direction: z.enum(['asc', 'desc'])
          .optional()
          .describe("Sort direction: 'asc' for ascending, 'desc' for descending. Used with sort_by."),
      }
    },

    async (args) => {
      try {
        const queryParams = buildReportQueryParams(args);

        const result = await callFirstPromoterAPI('/reports/overview', { queryParams });

        const summary = formatOverviewReport(result);
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
              text: `Error fetching overview reports: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: get_reports_promoters
  //
  // Get report data grouped by promoters.
  // Each item represents a promoter with aggregated data and time-period
  // sub_data breakdown.
  //
  // API docs: docs/firstpromoter-api/reports/...get-reports-for-promoters...md
  // ==========================================================================
  server.registerTool(
    "get_reports_promoters",

    {
      title: "Get Promoter Reports",
      description:
        "Get report data grouped by promoters from FirstPromoter. " +
        "Returns aggregated metrics for each promoter, with optional time-period breakdowns. " +

        "QUERY PARAMETERS — columns (required, array of column names to include), " +
        "group_by (required, day/week/month/year), start_date (required), end_date (required), " +
        "q (optional search by promoter name/email), sort_by + sort_direction (optional sorting). " +

        "AVAILABLE COLUMNS: active_customers, monthly_churn, clicks_count, net_revenue_amount, " +
        "revenue_amount, referrals_count, customers_count, sales_count, refunds_count, " +
        "cancelled_customers_count, promoter_earnings_amount, non_link_customers, " +
        "referrals_to_customers_cr, 3m_epc, 6m_epc, clicks_to_customers_cr, " +
        "clicks_to_referrals_cr, promoter_paid_amount, signups_count. " +

        "RESPONSE STRUCTURE — returns a flat array of objects, each containing: " +
        "promoter: { id, email, name }, " +
        "id (integer — the promoter ID), " +
        "data: { <requested columns as key-value pairs, e.g. revenue_amount: 12300> }, " +
        "sub_data: [ { period (string, e.g. '2024-01'), id (string), " +
        "data: { <same columns as above for that time period> } } ]. " +

        "NOTE: The API returns a flat array, NOT wrapped in { data: [...] }. " +
        "Monetary amounts are in cents (divide by 100 for dollars). " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data. " +
        "Each promoter's fields are independent — do not infer or guess values between records.",

      inputSchema: {
        columns: z.array(z.enum(STANDARD_COLUMNS))
          .describe("Columns (metrics) to include in the report. Pass one or more from the available options."),

        group_by: z.enum(GROUP_BY_OPTIONS)
          .describe("Time period grouping for sub_data breakdown (day, week, month, or year)."),

        start_date: z.string()
          .describe("Start date for the report period (ISO 8601 format, e.g. '2024-01-01')."),

        end_date: z.string()
          .describe("End date for the report period (ISO 8601 format, e.g. '2024-12-31')."),

        q: z.string()
          .optional()
          .describe("Search query string to filter promoters by name or email."),

        sort_by: z.string()
          .optional()
          .describe("Column name to sort by (must be one of the requested columns)."),

        sort_direction: z.enum(['asc', 'desc'])
          .optional()
          .describe("Sort direction: 'asc' for ascending, 'desc' for descending. Used with sort_by."),
      }
    },

    async (args) => {
      try {
        const queryParams = buildReportQueryParams(args);

        const result = await callFirstPromoterAPI('/reports/promoters', { queryParams });

        const summary = formatPromoterReport(result);
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
              text: `Error fetching promoter reports: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: get_reports_traffic_sources
  //
  // Get report data grouped by traffic sources.
  // Each item represents a traffic source (e.g. "google", "facebook") with
  // aggregated data and time-period sub_data breakdown.
  //
  // Has a DIFFERENT set of available columns than campaigns/promoters/overview.
  //
  // API docs: docs/firstpromoter-api/reports/...get-reports-for-traffic-sources...md
  // ==========================================================================
  server.registerTool(
    "get_reports_traffic_sources",

    {
      title: "Get Traffic Source Reports",
      description:
        "Get report data grouped by traffic sources from FirstPromoter. " +
        "Returns aggregated metrics for each traffic source (e.g. google, facebook, direct), " +
        "with optional time-period breakdowns. " +

        "QUERY PARAMETERS — columns (required, array of column names to include), " +
        "group_by (required, day/week/month/year), start_date (required), end_date (required), " +
        "q (optional search), sort_by + sort_direction (optional sorting). " +

        "AVAILABLE COLUMNS (different from campaign/promoter reports): " +
        "clicks_count, revenue_amount, promoter_earnings_amount, referrals_count, " +
        "customers_count, sales_count, refunds_count, cancelled_customers_count, " +
        "referrals_to_customers_cr, clicks_to_customers_cr, clicks_to_referrals_cr. " +

        "RESPONSE STRUCTURE — returns a flat array of objects, each containing: " +
        "source (string — the traffic source name, e.g. 'google'), " +
        "id (string), " +
        "data: { <requested columns as key-value pairs, e.g. clicks_count: 150> }, " +
        "sub_data: [ { period (string, e.g. '2024-01'), id (string), " +
        "data: { <same columns as above for that time period> } } ]. " +

        "NOTE: The API returns a flat array, NOT wrapped in { data: [...] }. " +
        "Monetary amounts are in cents (divide by 100 for dollars). " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data. " +
        "Each traffic source's fields are independent — do not infer or guess values between records.",

      inputSchema: {
        columns: z.array(z.enum(TRAFFIC_SOURCE_COLUMNS))
          .describe("Columns (metrics) to include in the report. Pass one or more from the available options."),

        group_by: z.enum(GROUP_BY_OPTIONS)
          .describe("Time period grouping for sub_data breakdown (day, week, month, or year)."),

        start_date: z.string()
          .describe("Start date for the report period (ISO 8601 format, e.g. '2024-01-01')."),

        end_date: z.string()
          .describe("End date for the report period (ISO 8601 format, e.g. '2024-12-31')."),

        q: z.string()
          .optional()
          .describe("Search query string to filter traffic sources."),

        sort_by: z.string()
          .optional()
          .describe("Column name to sort by (must be one of the requested columns)."),

        sort_direction: z.enum(['asc', 'desc'])
          .optional()
          .describe("Sort direction: 'asc' for ascending, 'desc' for descending. Used with sort_by."),
      }
    },

    async (args) => {
      try {
        const queryParams = buildReportQueryParams(args);

        const result = await callFirstPromoterAPI('/reports/traffic_sources', { queryParams });

        const summary = formatTrafficSourceReport(result);
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
              text: `Error fetching traffic source reports: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ==========================================================================
  // Tool: get_reports_urls
  //
  // Get report data grouped by URLs.
  // Each item represents a URL with its aggregated data.
  // NOTE: Unlike other reports, URLs do NOT have sub_data in the response.
  //
  // Has a slightly different column set (includes "url" as a column option).
  //
  // API docs: docs/firstpromoter-api/reports/...get-reports-for-urls...md
  // ==========================================================================
  server.registerTool(
    "get_reports_urls",

    {
      title: "Get URL Reports",
      description:
        "Get report data grouped by URLs from FirstPromoter. " +
        "Returns aggregated metrics for each URL that promoters are sharing. " +

        "QUERY PARAMETERS — columns (required, array of column names to include), " +
        "group_by (required, day/week/month/year), start_date (required), end_date (required), " +
        "q (optional search), sort_by + sort_direction (optional sorting). " +

        "AVAILABLE COLUMNS (includes 'url' column unique to this report): " +
        "clicks_count, revenue_amount, promoter_earnings_amount, referrals_count, " +
        "customers_count, sales_count, refunds_count, cancelled_customers_count, " +
        "referrals_to_customers_cr, clicks_to_customers_cr, clicks_to_referrals_cr, url. " +

        "RESPONSE STRUCTURE — returns a flat array of objects, each containing: " +
        "url (string — the URL), " +
        "id (string), " +
        "data: { <requested columns as key-value pairs, e.g. clicks_count: 150> }. " +

        "NOTE: Unlike campaign/promoter/traffic source reports, URL reports do NOT " +
        "include sub_data with time-period breakdowns. " +
        "The API returns a flat array, NOT wrapped in { data: [...] }. " +
        "Monetary amounts are in cents (divide by 100 for dollars). " +

        "IMPORTANT: When presenting results, cite exact field values from the returned data. " +
        "Each URL's fields are independent — do not infer or guess values between records.",

      inputSchema: {
        columns: z.array(z.enum(URL_COLUMNS))
          .describe("Columns (metrics) to include in the report. Pass one or more from the available options."),

        group_by: z.enum(GROUP_BY_OPTIONS)
          .describe("Time period grouping (day, week, month, or year)."),

        start_date: z.string()
          .describe("Start date for the report period (ISO 8601 format, e.g. '2024-01-01')."),

        end_date: z.string()
          .describe("End date for the report period (ISO 8601 format, e.g. '2024-12-31')."),

        q: z.string()
          .optional()
          .describe("Search query string to filter URLs."),

        sort_by: z.string()
          .optional()
          .describe("Column name to sort by (must be one of the requested columns)."),

        sort_direction: z.enum(['asc', 'desc'])
          .optional()
          .describe("Sort direction: 'asc' for ascending, 'desc' for descending. Used with sort_by."),
      }
    },

    async (args) => {
      try {
        const queryParams = buildReportQueryParams(args);

        const result = await callFirstPromoterAPI('/reports/urls', { queryParams });

        const summary = formatUrlReport(result);
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
              text: `Error fetching URL reports: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
