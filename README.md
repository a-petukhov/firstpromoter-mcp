# FirstPromoter MCP Server (Local)

A **local** MCP (Model Context Protocol) server that connects AI assistants like Claude to your FirstPromoter affiliate management platform. Runs on your machine via Docker or Node.js — your API credentials never leave your device.

> Looking for the remote/hosted version? That will be a separate project (coming later).

## What is This?

This server acts as a **translator** between AI assistants and FirstPromoter:

| Component | What it Does |
|-----------|--------------|
| **MCP Server** | Receives requests from AI, returns structured data |
| **Tools** | Actions the AI can perform (e.g., "Get Promoters") |
| **Transport** | stdio — runs locally on your machine |
| **FirstPromoter API** | The data source — your affiliate management platform |

## Quick Start

### Prerequisites

- Node.js 20+ installed
- A FirstPromoter account with API access
- Claude Desktop (for testing)

### Step 1: Install Dependencies

```bash
cd firstpromoter-mcp
npm install
```

### Step 2: Configure Credentials

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your FirstPromoter credentials:
   - **FP_BEARER_TOKEN**: Find at Dashboard > Settings > Integrations > Manage API Keys
   - **FP_ACCOUNT_ID**: Find at Dashboard > Settings > Integrations

### Step 3: Build & Test

```bash
# Build TypeScript
npm run build

# Test locally (loads .env automatically)
npm run dev:stdio
```

You should see:
```
FirstPromoter MCP Server running on stdio
```

### Step 4: Connect to Claude Desktop

#### Option A: Docker (recommended)

Build the Docker image:
```bash
docker build -t firstpromoter-mcp .
```

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "firstpromoter": {
      "command": "docker",
      "args": ["run", "-i", "--rm",
        "-e", "FP_BEARER_TOKEN",
        "-e", "FP_ACCOUNT_ID",
        "firstpromoter-mcp"
      ],
      "env": {
        "FP_BEARER_TOKEN": "your_token_here",
        "FP_ACCOUNT_ID": "your_account_id_here"
      }
    }
  }
}
```

#### Option B: Direct Node.js

```json
{
  "mcpServers": {
    "firstpromoter": {
      "command": "node",
      "args": ["/full/path/to/firstpromoter-mcp/dist/index.js"],
      "env": {
        "FP_BEARER_TOKEN": "your_token_here",
        "FP_ACCOUNT_ID": "your_account_id_here"
      }
    }
  }
}
```

Restart Claude Desktop after editing the config.

### Step 5: Try It Out

Ask Claude:
- "List my promoters"
- "Show me promoters sorted by revenue"
- "Find promoters who joined this month"
- "Show accepted promoters with more than 10 customers"
- "Accept promoter ID 12345 into campaign 1"

## Available Tools

### get_promoters

Lists promoters from your FirstPromoter account with full filtering, sorting, and search capabilities.

**Search & Pagination:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search by email, name, or ref_id |
| `ids` | number[] | Filter by specific promoter IDs |
| `page` | number | Page number (starts at 1) |
| `per_page` | number | Results per page (1-100, default 20) |

**Filters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | enum | `pending`, `accepted`, `rejected`, `blocked`, `inactive`, `not_set` |
| `campaign_id` | number | Filter by campaign |
| `parent_promoter_id` | number | Filter by parent promoter (sub-affiliates) |
| `archived` | boolean | Archived status |
| `has_wform` | enum | W-form status: `yes` or `no` |
| `subscribed_to_email` | boolean | Email subscription status |
| `custom_field1` | string | Custom field 1 value |
| `custom_field2` | string | Custom field 2 value |
| `fraud_suspicions` | string[] | `same_ip_suspicion`, `same_promoter_email`, `ad_source`, `no_suspicion` |

**Range Filters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `revenue_amount_from` / `_to` | number | Revenue range (in cents) |
| `customers_count_from` / `_to` | number | Customer count range |
| `referrals_count_from` / `_to` | number | Referral count range |
| `clicks_count_from` / `_to` | number | Click count range |

**Date Filters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `joined_at_from` / `_to` | string | Join date range (YYYY-MM-DD HH:MM:SS) |
| `last_login_at_from` / `_to` | string | Last login date range |

**Sorting:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sort_by` | enum | `clicks_count`, `referrals_count`, `customers_count`, `revenue_amount`, `joined_at` |
| `sort_direction` | enum | `asc` or `desc` |

**Response fields per promoter:**
- Identity: id, email, name, state, note, custom_fields
- Profile: website, company, country, phone, social links (instagram, youtube, linkedin, etc.)
- Stats: clicks, referrals, sales, customers, active customers, revenue (in cents)
- Campaigns: campaign name, ref link, coupon code
- Dates: joined_at, last_login_at, created_at, archived_at
- Fraud: fraud_suspicions array

### get_promoter

Gets details for a single promoter by numeric ID or alternative lookup (email, auth_token, ref_token, promo_code).

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Promoter's numeric ID (required unless using find_by) |
| `find_by` | enum | Alternative lookup: `email`, `auth_token`, `ref_token`, `promo_code` |
| `find_by_value` | string | The value to look up (e.g. the email address) |

### update_promoter

Updates a promoter's information. Only provided fields are changed.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Promoter's numeric ID (required unless using find_by) |
| `find_by` / `find_by_value` | enum / string | Alternative lookup |
| `email` | string | New email address |
| `first_name`, `last_name` | string | Name fields |
| `website`, `company_name`, `phone_number` | string | Profile fields |
| `country` | string | 2-char code (e.g. `US`) |
| `instagram_url`, `linkedin_url`, ... | string | Social URLs |
| `custom_fields` | object | Key-value pairs |

**Read-only fields** (returned but not updatable): `note`, `description`

### accept_promoters

Accepts one or more pending promoters into a campaign. This is a batch operation — if more than 5 IDs are provided, the operation runs asynchronously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `campaign_id` | number | Yes | Campaign to accept promoters into |
| `ids` | number[] | No | Promoter IDs to accept (async if >5) |

**Response:** Batch result with status (`completed` / `in_progress`), processed/failed counts, and any processing errors.

### reject_promoters

Rejects one or more promoters from a campaign. This is a batch operation — if more than 5 IDs are provided, the operation runs asynchronously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `campaign_id` | number | Yes | Campaign to reject promoters from |
| `ids` | number[] | No | Promoter IDs to reject (async if >5) |

**Response:** Batch result with status (`completed` / `in_progress`), processed/failed counts, and any processing errors.

### block_promoters

Blocks one or more promoters from a campaign. This is a batch operation — if more than 5 IDs are provided, the operation runs asynchronously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `campaign_id` | number | Yes | Campaign to block promoters from |
| `ids` | number[] | No | Promoter IDs to block (async if >5) |

**Response:** Batch result with status (`completed` / `in_progress`), processed/failed counts, and any processing errors.

### archive_promoters

Archives one or more promoters. Unlike accept/reject/block, no campaign_id is needed — archiving is global. This is a batch operation — if more than 5 IDs are provided, the operation runs asynchronously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ids` | number[] | No | Promoter IDs to archive (async if >5) |

**Response:** Batch result with status (`completed` / `in_progress`), processed/failed counts, and any processing errors.

### restore_promoters

Restores (unarchives) one or more archived promoters. Like archive, no campaign_id is needed. This is a batch operation — if more than 5 IDs are provided, the operation runs asynchronously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ids` | number[] | No | Promoter IDs to restore (async if >5) |

**Response:** Batch result with status (`completed` / `in_progress`), processed/failed counts, and any processing errors.

### move_promoters_to_campaign

Moves one or more promoters from one campaign to another. This is a batch operation — if more than 5 IDs are provided, the operation runs asynchronously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from_campaign_id` | number | Yes | Campaign to move promoters FROM |
| `to_campaign_id` | number | Yes | Campaign to move promoters TO |
| `ids` | number[] | No | Promoter IDs to move (async if >5) |
| `drip_emails` | boolean | No | Send email notification to promoter |
| `soft_move_referrals` | boolean | No | If true, move referrals to new campaign; if false, keep in old |

**Response:** Batch result with status (`completed` / `in_progress`), processed/failed counts, and any processing errors.

### add_promoters_to_campaign

Adds one or more promoters to a campaign (without removing them from their current campaign). This is a batch operation — if more than 5 IDs are provided, the operation runs asynchronously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `campaign_id` | number | Yes | Campaign to add promoters to |
| `ids` | number[] | No | Promoter IDs to add (async if >5) |
| `drip_emails` | boolean | No | Send email notification to promoter |

**Response:** Batch result with status (`completed` / `in_progress`), processed/failed counts, and any processing errors.

### create_promoter

Creates a new promoter. Only email is required — all other fields are optional.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | Promoter's email address |
| `cust_id` | string | No | Custom customer identifier |
| `initial_campaign_id` | number | No | Campaign to add the promoter to initially |
| `drip_emails` | boolean | No | Send welcome email to promoter |
| `first_name`, `last_name` | string | No | Name fields |
| `website`, `company_name`, `phone_number` | string | No | Profile fields |
| `country` | string | No | 2-char code (e.g. `US`) |
| `description` | string | No | Promoter description / bio |
| `instagram_url`, `linkedin_url`, ... | string | No | Social URLs |
| `custom_fields` | object | No | Key-value pairs |

**Response:** Full promoter object with profile, stats, campaigns, and dates.

### assign_parent_promoter

Assigns a parent promoter to one or more promoters (creates a sub-affiliate relationship). This is a batch operation — if more than 5 IDs are provided, the operation runs asynchronously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parent_promoter_id` | number | Yes | ID of the parent promoter to assign |
| `ids` | number[] | No | Promoter IDs to become children of the parent (async if >5) |

**Response:** Batch result with status (`completed` / `in_progress`), processed/failed counts, and any processing errors.

## Project Structure

```
firstpromoter-mcp/
├── src/
│   ├── index.ts          # Entry point: server creation + stdio transport
│   ├── api.ts            # FirstPromoter API helper (auth, fetch, errors)
│   ├── formatters.ts     # Response formatters (structured text + raw JSON)
│   └── tools/
│       ├── index.ts      # Tool registry
│       └── promoters.ts  # Promoter tools (get, list, update, accept)
├── dist/                  # Compiled JavaScript
├── Dockerfile             # Multi-stage Docker build
├── package.json
├── tsconfig.json
└── .env.example
```

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:stdio` | Run server in development mode (auto-loads .env) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run compiled server (auto-loads .env) |
| `docker build -t firstpromoter-mcp .` | Build Docker image |

## Roadmap

- [x] **Phase 1**: Local stdio server with all promoter tools (get_promoters, get_promoter, create_promoter, update_promoter, accept_promoters, reject_promoters, block_promoters, archive_promoters, restore_promoters, move_promoters_to_campaign, add_promoters_to_campaign, assign_parent_promoter)
- [ ] **Phase 2**: Add remaining API tools (commissions, referrals, payouts, reports, promo codes)
- [ ] **Phase 3**: Production polish (error handling, logging, rate limiting)

A remote HTTP server with OAuth authentication will be developed as a separate project.

## Troubleshooting

### "Credentials not configured" error
Make sure your `.env` file (local dev) or Claude Desktop config `env` section contains valid `FP_BEARER_TOKEN` and `FP_ACCOUNT_ID`.

### Server doesn't appear in Claude Desktop
1. Check Claude Desktop logs for errors
2. Verify the Docker image built successfully: `docker images | grep firstpromoter`
3. Restart Claude Desktop after config changes

### API errors from FirstPromoter
- `401 Unauthorized` — check your Bearer token and Account-ID
- `404 invalid_route` — verify Account-ID is correct (not a token)
- `429 Too Many Requests` — rate limit is 400 requests/minute

## License

MIT
