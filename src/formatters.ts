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

    // Profile fields
    lines.push(`   Website: ${profile?.website || 'N/A'}`);
    lines.push(`   Company: ${profile?.company || 'N/A'}`);
    lines.push(`   Country: ${profile?.country || 'N/A'}`);

    // Social links (only show those that have values)
    const socialFields = ['instagram', 'youtube', 'linkedin', 'facebook', 'twitter', 'twitch', 'tiktok'];
    const socials = socialFields
      .filter(field => profile?.[field])
      .map(field => `${field}: ${profile![field]}`);
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
// FUTURE FORMATTERS
// ============================================================================
// Add new formatters here as more API endpoints are implemented:
//
// export function formatReferrals(data: unknown): string { ... }
// export function formatCommissions(data: unknown): string { ... }
// export function formatPayouts(data: unknown): string { ... }
// export function formatReports(data: unknown): string { ... }
