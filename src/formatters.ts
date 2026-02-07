/**
 * Response Formatters
 *
 * This file converts raw API JSON into structured, human-readable text.
 * Why? When an AI client receives a huge JSON blob (e.g., 79KB of promoters),
 * it can mix up fields between similar-looking records. A clear text summary
 * makes each record's fields unambiguous.
 *
 * Every tool response includes:
 * 1. A formatted text summary (easy to read, hard to misinterpret)
 * 2. The raw JSON data appended below (for detailed analysis if needed)
 */

// ============================================================================
// SHARED UTILITY
// ============================================================================

/**
 * Wraps a formatted summary + raw JSON into a single response string.
 * Every tool should use this to ensure consistent output format.
 *
 * @param summary - Human-readable text summary of the data
 * @param rawData - The original API response (will be JSON-stringified)
 * @returns Combined string: summary + separator + raw JSON
 */
export function buildToolResponse(summary: string, rawData: unknown): string {
  return `${summary}\n\n---\nRaw JSON data:\n${JSON.stringify(rawData, null, 2)}`;
}

// ============================================================================
// PROMOTER FORMATTER
// ============================================================================

/**
 * Formats promoter data into a clear, labeled text summary.
 *
 * API response shape: { data: [...promoters], meta: { pending_count } }
 * Each promoter has nested objects: profile, stats, promoter_campaigns[], custom_fields
 */
export function formatPromoters(data: unknown): string {
  // Handle both array and { data: [...] } response shapes
  const raw = data as Record<string, unknown>;
  const promoters: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray(raw?.data)
      ? raw.data as Record<string, unknown>[]
      : [];

  const lines: string[] = [`Found ${promoters.length} promoter(s).\n`];

  promoters.forEach((p, i) => {
    const profile = p.profile as Record<string, unknown> | undefined;
    const stats = p.stats as Record<string, unknown> | undefined;
    const campaigns = p.promoter_campaigns as Record<string, unknown>[] | undefined;
    const customFields = p.custom_fields as Record<string, unknown> | undefined;
    const fraudSuspicions = p.fraud_suspicions as string[] | undefined;

    // Identity
    lines.push(`${i + 1}. Name: ${p.name || 'N/A'}`);
    lines.push(`   ID: ${p.id ?? 'N/A'}`);
    lines.push(`   Email: ${p.email || 'N/A'}`);
    lines.push(`   State: ${p.state || 'N/A'}`);

    // Profile fields (API may return company_name or company, phone_number or phone)
    lines.push(`   Website: ${profile?.website || 'N/A'}`);
    lines.push(`   Company: ${profile?.company_name || profile?.company || 'N/A'}`);
    lines.push(`   Country: ${profile?.country || 'N/A'}`);

    // Social links (API may return instagram_url or instagram — handle both)
    const socialFields = ['instagram', 'youtube', 'linkedin', 'facebook', 'twitter', 'twitch', 'tiktok'];
    const socials = socialFields
      .filter(field => profile?.[`${field}_url`] || profile?.[field])
      .map(field => `${field}: ${profile![`${field}_url`] || profile![field]}`);
    if (socials.length > 0) {
      lines.push(`   Social: ${socials.join(', ')}`);
    }

    // Campaign info (all campaigns)
    if (campaigns && campaigns.length > 0) {
      campaigns.forEach((pc) => {
        const camp = pc.campaign as Record<string, unknown> | undefined;
        const refLink = pc.ref_link || 'N/A';
        const coupon = pc.coupon || 'none';
        lines.push(`   Campaign: ${camp?.name || 'N/A'} | Ref link: ${refLink} | Coupon: ${coupon}`);
      });
    }

    // Performance stats
    if (stats) {
      const revenue = stats.revenue_amount;
      const revenueStr = typeof revenue === 'number'
        ? `$${(revenue / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        : 'N/A';

      lines.push(
        `   Stats: Revenue: ${revenueStr} | Sales: ${stats.sales_count ?? 'N/A'} | ` +
        `Customers: ${stats.customers_count ?? 'N/A'} | Active: ${stats.active_customers_count ?? 'N/A'} | ` +
        `Clicks: ${stats.clicks_count ?? 'N/A'} | Referrals: ${stats.referrals_count ?? 'N/A'}`
      );
    }

    // Dates
    lines.push(`   Joined: ${p.joined_at || 'N/A'} | Last login: ${p.last_login_at || 'N/A'}`);

    // Fraud suspicions (only if present)
    if (fraudSuspicions && fraudSuspicions.length > 0) {
      lines.push(`   Fraud suspicions: ${fraudSuspicions.join(', ')}`);
    }

    // Custom fields (only if present and non-empty)
    if (customFields && Object.keys(customFields).length > 0) {
      const cfEntries = Object.entries(customFields)
        .filter(([, v]) => v !== null && v !== '')
        .map(([k, v]) => `${k}: ${v}`);
      if (cfEntries.length > 0) {
        lines.push(`   Custom fields: ${cfEntries.join(', ')}`);
      }
    }

    lines.push(''); // blank line between promoters
  });

  // Add pagination/meta info if present
  if (raw?.meta) {
    const meta = raw.meta as Record<string, unknown>;
    if (meta.current_page || meta.total_pages) {
      lines.push(`Page ${meta.current_page || '?'} of ${meta.total_pages || '?'}`);
    }
    if (meta.pending_count !== undefined) {
      lines.push(`Pending promoters: ${meta.pending_count}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// BATCH RESULT FORMATTER
// ============================================================================

/**
 * Formats a batch operation result (accept, reject, block, archive, etc.).
 *
 * Batch endpoints return an object describing the operation outcome:
 * { id, status, total, selected_total, processed_count, failed_count,
 *   action_label, progress, processing_errors[], created_at, updated_at }
 *
 * If >5 promoter IDs are sent, the operation runs asynchronously and
 * the status will be "in_progress" instead of "completed".
 */
export function formatBatchResult(data: unknown): string {
  const batch = data as Record<string, unknown>;
  const lines: string[] = [];

  lines.push(`Batch operation: ${batch.action_label || 'N/A'}`);
  lines.push(`Status: ${batch.status || 'N/A'}`);
  lines.push(`Batch ID: ${batch.id ?? 'N/A'}`);
  lines.push(`Total: ${batch.total ?? 'N/A'} | Selected: ${batch.selected_total ?? 'N/A'}`);
  lines.push(`Processed: ${batch.processed_count ?? 0} | Failed: ${batch.failed_count ?? 0}`);
  lines.push(`Progress: ${batch.progress ?? 'N/A'}%`);

  // Show processing errors if any
  const errors = batch.processing_errors as string[] | undefined;
  if (errors && errors.length > 0) {
    lines.push(`Errors: ${errors.join(', ')}`);
  }

  lines.push(`Created: ${batch.created_at || 'N/A'}`);

  return lines.join('\n');
}

// ============================================================================
// BATCH PROGRESS FORMATTER
// ============================================================================

/**
 * Formats the batch progress map response.
 * The API returns { "batch_id": progress_percentage, ... }
 * E.g., { "30": 0, "31": 100, "32": 50 }
 */
export function formatBatchProgress(data: unknown): string {
  const progressMap = data as Record<string, number>;
  const entries = Object.entries(progressMap);

  if (entries.length === 0) {
    return 'No batch processes found.';
  }

  const lines: string[] = [`Found ${entries.length} batch process(es).\n`];

  for (const [batchId, progress] of entries) {
    const status = progress >= 100 ? 'done' : 'running';
    lines.push(`  Batch #${batchId}: ${progress}% (${status})`);
  }

  return lines.join('\n');
}

// ============================================================================
// SHARED AMOUNT HELPER
// ============================================================================

/**
 * Converts cents to a formatted dollar string.
 * E.g., 5000 → "$50.00", null/undefined → "N/A"
 */
function centsToUsd(cents: unknown): string {
  if (typeof cents === 'number') {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
  return 'N/A';
}

// ============================================================================
// REFERRAL FORMATTER
// ============================================================================

/**
 * Formats referral data into a clear, labeled text summary.
 * API returns a flat array of referral objects.
 */
export function formatReferrals(data: unknown): string {
  const referrals: Record<string, unknown>[] = Array.isArray(data) ? data : [];

  const lines: string[] = [`Found ${referrals.length} referral(s).\n`];

  referrals.forEach((r, i) => {
    const pc = r.promoter_campaign as Record<string, unknown> | undefined;
    const promoter = pc?.promoter as Record<string, unknown> | undefined;
    const campaign = pc?.campaign as Record<string, unknown> | undefined;

    lines.push(`${i + 1}. Email: ${r.email || 'N/A'}`);
    lines.push(`   ID: ${r.id ?? 'N/A'}`);
    lines.push(`   UID: ${r.uid || 'N/A'}`);
    lines.push(`   State: ${r.state || 'N/A'}`);
    lines.push(`   Entry source: ${r.entry_source || 'N/A'}`);
    lines.push(`   Fraud check: ${r.fraud_check || 'N/A'}`);
    lines.push(`   Created: ${r.created_at || 'N/A'} | Customer since: ${r.customer_since || 'N/A'}`);

    if (promoter) {
      lines.push(`   Promoter: ${promoter.name || promoter.email || 'N/A'} (ID: ${promoter.id ?? 'N/A'})`);
    }
    if (campaign) {
      lines.push(`   Campaign: ${campaign.name || 'N/A'} (ID: ${campaign.id ?? 'N/A'})`);
    }

    lines.push('');
  });

  return lines.join('\n');
}

// ============================================================================
// COMMISSION FORMATTER
// ============================================================================

/**
 * Formats commission data into a clear, labeled text summary.
 * API returns a flat array of commission objects.
 */
export function formatCommissions(data: unknown): string {
  const commissions: Record<string, unknown>[] = Array.isArray(data) ? data : [];

  const lines: string[] = [`Found ${commissions.length} commission(s).\n`];

  commissions.forEach((c, i) => {
    const pc = c.promoter_campaign as Record<string, unknown> | undefined;
    const promoter = pc?.promoter as Record<string, unknown> | undefined;
    const campaign = pc?.campaign as Record<string, unknown> | undefined;
    const referral = c.referral as Record<string, unknown> | undefined;
    const reward = c.reward as Record<string, unknown> | undefined;

    lines.push(`${i + 1}. Commission ID: ${c.id ?? 'N/A'}`);
    lines.push(`   Status: ${c.status || 'N/A'} | Type: ${c.commission_type || 'N/A'}`);
    lines.push(`   Amount: ${centsToUsd(c.amount)} | Sale amount: ${centsToUsd(c.sale_amount)}`);
    lines.push(`   Unit: ${c.unit || 'N/A'} | Tier: ${c.tier ?? 'N/A'}`);
    lines.push(`   Paid: ${c.is_paid ?? 'N/A'} | Split: ${c.is_split ?? 'N/A'}`);
    lines.push(`   Fraud check: ${c.fraud_check || 'N/A'}`);

    if (promoter) {
      lines.push(`   Promoter: ${promoter.name || promoter.email || 'N/A'} (ID: ${promoter.id ?? 'N/A'})`);
    }
    if (campaign) {
      lines.push(`   Campaign: ${campaign.name || 'N/A'}`);
    }
    if (referral) {
      lines.push(`   Referral: ${referral.email || referral.uid || 'N/A'} (ID: ${referral.id ?? 'N/A'})`);
    }
    if (reward) {
      lines.push(`   Reward: ${reward.name || 'N/A'} (ID: ${reward.id ?? 'N/A'})`);
    }

    if (c.internal_note) lines.push(`   Internal note: ${c.internal_note}`);
    if (c.external_note) lines.push(`   External note: ${c.external_note}`);

    lines.push(`   Created: ${c.created_at || 'N/A'}`);
    lines.push('');
  });

  return lines.join('\n');
}

// ============================================================================
// PAYOUT FORMATTERS
// ============================================================================

/**
 * Formats payout list data.
 * API returns a flat array of payout objects.
 */
export function formatPayouts(data: unknown): string {
  const payouts: Record<string, unknown>[] = Array.isArray(data) ? data : [];

  const lines: string[] = [`Found ${payouts.length} payout(s).\n`];

  payouts.forEach((p, i) => {
    const promoter = p.promoter as Record<string, unknown> | undefined;

    lines.push(`${i + 1}. Payout ID: ${p.id ?? 'N/A'}`);
    lines.push(`   Status: ${p.status || 'N/A'}`);
    lines.push(`   Amount: ${centsToUsd(p.amount)}`);
    lines.push(`   Method: ${p.payout_method || 'N/A'}`);

    if (promoter) {
      lines.push(`   Promoter: ${promoter.name || promoter.email || 'N/A'} (ID: ${promoter.id ?? 'N/A'})`);
    }

    lines.push(`   Period: ${p.period_start || 'N/A'} to ${p.period_end || 'N/A'}`);
    lines.push(`   Created: ${p.created_at || 'N/A'}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Formats payouts grouped by promoter.
 * API returns { data: [...], meta: {...} }
 */
export function formatPayoutsGrouped(data: unknown): string {
  const raw = data as Record<string, unknown>;
  const groups: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray(raw?.data)
      ? raw.data as Record<string, unknown>[]
      : [];

  const lines: string[] = [`Found ${groups.length} promoter group(s).\n`];

  groups.forEach((g, i) => {
    const promoter = g.promoter as Record<string, unknown> | undefined;
    lines.push(`${i + 1}. Promoter: ${promoter?.name || promoter?.email || 'N/A'} (ID: ${promoter?.id ?? 'N/A'})`);
    lines.push(`   Total amount: ${centsToUsd(g.total_amount)}`);
    lines.push(`   Payouts count: ${g.payouts_count ?? 'N/A'}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Formats payout statistics.
 */
export function formatPayoutStats(data: unknown): string {
  const stats = data as Record<string, unknown>;
  const lines: string[] = ['Payout Statistics:\n'];

  // Format top-level stats
  for (const [key, value] of Object.entries(stats)) {
    if (typeof value === 'number') {
      lines.push(`  ${key}: ${key.includes('amount') ? centsToUsd(value) : value}`);
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`  ${key}:`);
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        lines.push(`    ${k}: ${typeof v === 'number' && k.includes('amount') ? centsToUsd(v) : v}`);
      }
    } else {
      lines.push(`  ${key}: ${value ?? 'N/A'}`);
    }
  }

  return lines.join('\n');
}

/**
 * Formats due payout statistics.
 */
export function formatDuePayoutStats(data: unknown): string {
  const stats = data as Record<string, unknown>;
  const lines: string[] = ['Due Payout Statistics:\n'];

  for (const [key, value] of Object.entries(stats)) {
    if (typeof value === 'number') {
      lines.push(`  ${key}: ${key.includes('amount') ? centsToUsd(value) : value}`);
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`  ${key}:`);
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        lines.push(`    ${k}: ${typeof v === 'number' && k.includes('amount') ? centsToUsd(v) : v}`);
      }
    } else {
      lines.push(`  ${key}: ${value ?? 'N/A'}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// REPORT FORMATTERS
// ============================================================================

/**
 * Formats campaign report data.
 * Each item: { campaign: { id, name, color }, id, data: {...}, sub_data: [...] }
 */
export function formatCampaignReport(data: unknown): string {
  const items: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  const lines: string[] = [`Campaign report: ${items.length} row(s).\n`];

  items.forEach((item, i) => {
    const campaign = item.campaign as Record<string, unknown> | undefined;
    const reportData = item.data as Record<string, unknown> | undefined;

    lines.push(`${i + 1}. Campaign: ${campaign?.name || 'N/A'} (ID: ${campaign?.id ?? 'N/A'})`);
    if (reportData) {
      const entries = Object.entries(reportData)
        .map(([k, v]) => `${k}: ${typeof v === 'number' && k.includes('amount') ? centsToUsd(v) : v}`);
      lines.push(`   Data: ${entries.join(', ')}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Formats overview report data.
 * Each item: { period, id, data: {...} } — flat time-series, no sub_data.
 */
export function formatOverviewReport(data: unknown): string {
  const items: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  const lines: string[] = [`Overview report: ${items.length} period(s).\n`];

  items.forEach((item, i) => {
    const reportData = item.data as Record<string, unknown> | undefined;
    lines.push(`${i + 1}. Period: ${item.period || 'N/A'}`);
    if (reportData) {
      const entries = Object.entries(reportData)
        .map(([k, v]) => `${k}: ${typeof v === 'number' && k.includes('amount') ? centsToUsd(v) : v}`);
      lines.push(`   Data: ${entries.join(', ')}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Formats promoter report data.
 * Each item: { promoter: { id, email, name }, id, data: {...}, sub_data: [...] }
 */
export function formatPromoterReport(data: unknown): string {
  const items: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  const lines: string[] = [`Promoter report: ${items.length} row(s).\n`];

  items.forEach((item, i) => {
    const promoter = item.promoter as Record<string, unknown> | undefined;
    const reportData = item.data as Record<string, unknown> | undefined;

    lines.push(`${i + 1}. Promoter: ${promoter?.name || promoter?.email || 'N/A'} (ID: ${promoter?.id ?? 'N/A'})`);
    if (reportData) {
      const entries = Object.entries(reportData)
        .map(([k, v]) => `${k}: ${typeof v === 'number' && k.includes('amount') ? centsToUsd(v) : v}`);
      lines.push(`   Data: ${entries.join(', ')}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Formats traffic source report data.
 * Each item: { source, id, data: {...}, sub_data: [...] }
 */
export function formatTrafficSourceReport(data: unknown): string {
  const items: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  const lines: string[] = [`Traffic source report: ${items.length} row(s).\n`];

  items.forEach((item, i) => {
    const reportData = item.data as Record<string, unknown> | undefined;
    lines.push(`${i + 1}. Source: ${item.source || 'N/A'}`);
    if (reportData) {
      const entries = Object.entries(reportData)
        .map(([k, v]) => `${k}: ${typeof v === 'number' && k.includes('amount') ? centsToUsd(v) : v}`);
      lines.push(`   Data: ${entries.join(', ')}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Formats URL report data.
 * Each item: { url, id, data: {...} } — no sub_data.
 */
export function formatUrlReport(data: unknown): string {
  const items: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  const lines: string[] = [`URL report: ${items.length} row(s).\n`];

  items.forEach((item, i) => {
    const reportData = item.data as Record<string, unknown> | undefined;
    lines.push(`${i + 1}. URL: ${item.url || 'N/A'}`);
    if (reportData) {
      const entries = Object.entries(reportData)
        .map(([k, v]) => `${k}: ${typeof v === 'number' && k.includes('amount') ? centsToUsd(v) : v}`);
      lines.push(`   Data: ${entries.join(', ')}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

// ============================================================================
// PROMO CODE FORMATTER
// ============================================================================

/**
 * Formats promo code data.
 * API returns a flat array of promo code objects.
 */
export function formatPromoCodes(data: unknown): string {
  const codes: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  const lines: string[] = [`Found ${codes.length} promo code(s).\n`];

  codes.forEach((c, i) => {
    const pc = c.promoter_campaign as Record<string, unknown> | undefined;
    const promoter = pc?.promoter as Record<string, unknown> | undefined;
    const campaign = pc?.campaign as Record<string, unknown> | undefined;

    lines.push(`${i + 1}. Code: ${c.code || 'N/A'}`);
    lines.push(`   ID: ${c.id ?? 'N/A'}`);
    lines.push(`   Description: ${c.description || 'N/A'}`);
    lines.push(`   State: ${c.state || 'N/A'}`);

    if (promoter) {
      lines.push(`   Promoter: ${promoter.name || promoter.email || 'N/A'} (ID: ${promoter.id ?? 'N/A'})`);
    }
    if (campaign) {
      lines.push(`   Campaign: ${campaign.name || 'N/A'}`);
    }

    lines.push(`   Created: ${c.created_at || 'N/A'}`);
    lines.push('');
  });

  return lines.join('\n');
}

// ============================================================================
// PROMOTER CAMPAIGN FORMATTER
// ============================================================================

/**
 * Formats promoter campaign data.
 * API returns a flat array of promoter campaign objects.
 * These are the linking records between promoters and campaigns.
 */
export function formatPromoterCampaigns(data: unknown): string {
  const pcs: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  const lines: string[] = [`Found ${pcs.length} promoter campaign(s).\n`];

  pcs.forEach((pc, i) => {
    const promoter = pc.promoter as Record<string, unknown> | undefined;
    const campaign = pc.campaign as Record<string, unknown> | undefined;
    const stats = pc.stats as Record<string, unknown> | undefined;

    lines.push(`${i + 1}. Promoter Campaign ID: ${pc.id ?? 'N/A'}`);
    lines.push(`   State: ${pc.state || 'N/A'}`);

    if (promoter) {
      lines.push(`   Promoter: ${promoter.name || promoter.email || 'N/A'} (ID: ${promoter.id ?? 'N/A'})`);
    }
    if (campaign) {
      lines.push(`   Campaign: ${campaign.name || 'N/A'} (ID: ${campaign.id ?? 'N/A'})`);
    }

    lines.push(`   Ref token: ${pc.ref_token || 'N/A'} | Ref link: ${pc.ref_link || 'N/A'}`);
    lines.push(`   Coupon: ${pc.coupon || 'none'} | Display coupon: ${pc.display_coupon || 'none'}`);

    if (stats) {
      lines.push(
        `   Stats: Revenue: ${centsToUsd(stats.revenue_amount)} | Sales: ${stats.sales_count ?? 'N/A'} | ` +
        `Customers: ${stats.customers_count ?? 'N/A'} | Clicks: ${stats.clicks_count ?? 'N/A'} | ` +
        `Referrals: ${stats.referrals_count ?? 'N/A'}`
      );
    }

    lines.push(`   Customized: ${pc.is_customized ?? 'N/A'}`);
    lines.push(`   Created: ${pc.created_at || 'N/A'}`);
    lines.push('');
  });

  return lines.join('\n');
}
