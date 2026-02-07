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
- "Show all commissions for this month"
- "Get a campaign performance report for Q1"
- "List all promo codes"

## Available Tools (43 total)

### Promoters (12 tools)

| Tool | Description |
|------|-------------|
| `get_promoters` | List promoters with 26 filter/sort/search params |
| `get_promoter` | Get single promoter by ID or lookup (email, auth_token, ref_token, promo_code) |
| `create_promoter` | Create a new promoter (21 params) |
| `update_promoter` | Update promoter info (24 params, find_by support) |
| `accept_promoters` | Accept pending promoters into a campaign (batch) |
| `reject_promoters` | Reject promoters from a campaign (batch) |
| `block_promoters` | Block promoters from a campaign (batch) |
| `archive_promoters` | Archive promoters globally (batch) |
| `restore_promoters` | Restore archived promoters (batch) |
| `move_promoters_to_campaign` | Move promoters between campaigns (batch) |
| `add_promoters_to_campaign` | Add promoters to a campaign (batch) |
| `assign_parent_promoter` | Set parent promoter for sub-affiliate relationship (batch) |

### Referrals (5 tools)

| Tool | Description |
|------|-------------|
| `get_referrals` | List referrals with filters (type, promoter_id, state, search) |
| `get_referral` | Get single referral by ID or lookup (email, uid, username) |
| `update_referral` | Update referral (email, uid, username, promoter_campaign_id, split_details) |
| `move_referrals_to_promoter` | Move referrals to a different promoter (batch) |
| `delete_referrals` | Delete referrals (batch) |

### Commissions (7 tools)

| Tool | Description |
|------|-------------|
| `get_commissions` | List commissions with filters (status, paid, fulfilled, sale_amount, campaign_id, fraud_check) |
| `create_commission` | Create a commission (sale type or custom type) |
| `update_commission` | Update commission notes (internal_note, external_note) |
| `approve_commissions` | Approve commissions (batch) |
| `deny_commissions` | Deny commissions (batch) |
| `mark_commissions_fulfilled` | Mark non-monetary commissions as fulfilled (batch) |
| `mark_commissions_unfulfilled` | Mark non-monetary commissions as unfulfilled (batch) |

### Payouts (4 tools)

| Tool | Description |
|------|-------------|
| `get_payouts` | List payouts with 18 filter params (status, campaign, dates, method, promoter) |
| `get_payouts_grouped_by_promoters` | Payouts aggregated by promoter |
| `get_payout_stats` | Payout statistics with breakdowns (stats_by) |
| `get_due_payout_stats` | Due payout statistics |

### Reports (5 tools)

| Tool | Description |
|------|-------------|
| `get_reports_campaigns` | Campaign performance reports (19 available columns, time-period breakdowns) |
| `get_reports_overview` | Overview time-series reports |
| `get_reports_promoters` | Promoter performance reports |
| `get_reports_traffic_sources` | Traffic source reports (11 columns) |
| `get_reports_urls` | URL performance reports (12 columns) |

### Promo Codes (5 tools)

| Tool | Description |
|------|-------------|
| `get_promo_codes` | List promo codes (optional filter by promoter_campaign_id) |
| `get_promo_code` | Get single promo code by ID |
| `create_promo_code` | Create a promo code (Stripe only — requires code, reward_id, promoter_campaign_id) |
| `update_promo_code` | Update promo code |
| `archive_promo_code` | Archive (soft-delete) a promo code |

### Promoter Campaigns (2 tools)

| Tool | Description |
|------|-------------|
| `get_promoter_campaigns` | List all promoter-campaign links with stats |
| `update_promoter_campaign` | Update promoter campaign (ref_token, state, coupon, rewards, customization) |

### Batch Processes (3 tools)

| Tool | Description |
|------|-------------|
| `get_batch_processes` | List batch processes with optional status filter |
| `get_batch_process` | Get details of a specific batch process by ID |
| `get_batch_progress` | Quick progress overview — map of batch IDs to completion percentage |

All batch operations run asynchronously when more than 5 IDs are provided. Monetary amounts are in cents (divide by 100 for dollars).

## Project Structure

```
firstpromoter-mcp/
├── src/
│   ├── index.ts              # Entry point: server creation + stdio transport
│   ├── api.ts                # FirstPromoter API helper (auth, fetch, errors)
│   ├── formatters.ts         # Response formatters (structured text + raw JSON)
│   └── tools/
│       ├── index.ts              # Tool registry — registers all 40 tools
│       ├── promoters.ts          # 12 promoter tools
│       ├── referrals.ts          # 5 referral tools
│       ├── commissions.ts        # 7 commission tools
│       ├── payouts.ts            # 4 payout tools
│       ├── reports.ts            # 5 report tools
│       ├── promo-codes.ts        # 5 promo code tools
│       ├── promoter-campaigns.ts # 2 promoter campaign tools
│       └── batch-processes.ts    # 3 batch process tools
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

- [x] **Phase 1**: Local stdio server with all promoter tools (12 tools)
- [x] **Phase 2**: All remaining API tools — referrals, commissions, payouts, reports, promo codes, promoter campaigns, batch processes (31 tools)
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
