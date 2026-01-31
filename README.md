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

## Project Structure

```
firstpromoter-mcp/
├── src/
│   ├── index.ts          # Entry point: server creation + stdio transport
│   ├── api.ts            # FirstPromoter API helper (auth, fetch, errors)
│   ├── formatters.ts     # Response formatters (structured text + raw JSON)
│   └── tools/
│       ├── index.ts      # Tool registry
│       └── promoters.ts  # get_promoters tool definition
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

- [x] **Phase 1**: Local stdio server with get_promoters (all API params)
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
