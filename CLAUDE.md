# CLAUDE.md - FirstPromoter MCP Server

## Project Overview

This is an MCP (Model Context Protocol) server that connects AI assistants (Claude, ChatGPT, Gemini, n8n) to the FirstPromoter affiliate management platform.

**Repository:** https://github.com/a-petukhov/firstpromoter-mcp
**Type:** Local MCP server (stdio transport, runs via Docker on user's machine)

## Current Status

**Scope:** This repo is the **local MCP server** (stdio transport, runs via Docker on the user's machine). A separate repo will be created later for the remote HTTP server with OAuth.

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Local stdio server with all promoter tools (12 tools) |
| Phase 2 | ✅ Complete | All remaining API tools — referrals (5), commissions (7), payouts (4), reports (5), promo codes (5), promoter campaigns (2), batch processes (3) |
| Phase 3 | ✅ Complete | Production polish (error handling, logging, rate limiting) |

## Tech Stack

- **Language:** TypeScript (ESM modules, `"type": "module"`)
- **Runtime:** Node.js 20+ (uses built-in `--env-file=.env` for local dev)
- **MCP SDK:** @modelcontextprotocol/sdk v1.12+
- **Deployment:** Docker multi-stage build (node:20-alpine), runs locally on user's machine

## Project Structure

```
firstpromoter-mcp/
├── src/
│   ├── index.ts          # Entry point: server creation + stdio transport
│   ├── api.ts            # FirstPromoter API helper (auth, fetch, error handling, rate limiting, retry)
│   ├── logger.ts         # Lightweight stderr logger (debug/info/warn/error, LOG_LEVEL env var)
│   ├── formatters.ts     # Response formatters (structured text + raw JSON)
│   └── tools/
│       ├── index.ts              # Tool registry — registers all tools with the server
│       ├── promoters.ts          # 12 promoter tools (list, get, create, update, accept, reject, block, archive, restore, move/add to campaign, assign parent)
│       ├── referrals.ts          # 5 referral tools (list, get, update, move to promoter, delete)
│       ├── commissions.ts        # 7 commission tools (list, create, update, approve, deny, mark fulfilled/unfulfilled)
│       ├── payouts.ts            # 4 payout tools (list, grouped by promoters, stats, due stats)
│       ├── reports.ts            # 5 report tools (campaigns, overview, promoters, traffic sources, URLs)
│       ├── promo-codes.ts        # 5 promo code tools (list, get, create, update, archive)
│       ├── promoter-campaigns.ts # 2 promoter campaign tools (list, update)
│       └── batch-processes.ts    # 3 batch process tools (list, get, progress)
├── docs/                  # Local copies of reference documentation
│   ├── anthropic-mcp/               # MCP specification docs
│   │   └── llms-full.txt
│   └── firstpromoter-api/           # Full API docs per endpoint (scraped via Firecrawl)
│       ├── firstpromoter-llms.txt   # LLM-friendly API endpoint index
│       ├── introduction.md          # API introduction doc
│       ├── authentication.md        # API authentication doc
│       ├── promoters/               # 12 endpoint docs (list, get, create, update, accept, reject, block, archive, restore, add/move to campaign, assign parent)
│       ├── referrals/               # 5 endpoint docs (list, get, update, move, delete)
│       ├── commissions/             # 7 endpoint docs (list, create, update, approve, deny, mark fulfilled/unfulfilled)
│       ├── payouts/                 # 4 endpoint docs (list, grouped, due stats, stats)
│       ├── reports/                 # 5 endpoint docs (campaigns, overview, promoters, traffic sources, URLs)
│       ├── promo-codes/             # 5 endpoint docs (list, create, get, update, archive)
│       ├── promoter-campaigns/      # 2 endpoint docs (list, update)
│       ├── batch-processes/         # 3 endpoint docs (list, show, progress)
│       └── tracking-api/            # 4 endpoint docs (leads/signups, sales, refund, cancellation)
├── dist/                  # Compiled JavaScript (after npm run build)
├── package.json
├── tsconfig.json
├── Dockerfile             # Multi-stage: builder + production (node:20-alpine)
├── docker-compose.yml
├── .env.example
├── .gitignore
├── CLAUDE.md              # This file
└── README.md
```

## Architecture & Patterns

### File Separation

Code is split for scalability — each new API endpoint gets:
1. A tool file in `src/tools/{name}.ts` with full inputSchema and response docs
2. A formatter function in `src/formatters.ts`
3. A registration call in `src/tools/index.ts`

### Response Formatting

Every tool returns: **structured text summary + raw JSON appended**.
This prevents AI clients from mixing up fields between records in large responses.

```
Found 15 promoter(s).

1. Name: John Smith
   ID: 123
   Email: john@example.com
   Website: example.com
   ...

---
Raw JSON data:
{ "data": [...], "meta": {...} }
```

The `buildToolResponse(summary, rawData)` helper in `formatters.ts` wraps this consistently.

### Comprehensive Tool Descriptions

Each tool's MCP description includes:
1. **All query parameters** as flat Zod schemas with `.describe()` on every field
2. **Full response structure** listing every field and nested object the API returns
3. **Data accuracy instructions** telling the AI client not to guess or infer values

The handler maps flat Zod params to the API's expected format:
- **GET query filters:** `state` → `filters[state]=...`, `revenue_amount_from` → `filters[revenue_amount][from]=...`
- **GET sorting:** `sort_by` + `sort_direction` → `sorting[field]=direction`
- **PUT/POST body:** flat profile fields (`first_name`, `website`, etc.) → nested `{ profile: { first_name, website } }` object

### API Docs Source

**Local docs (preferred):** Full API docs are saved locally in `docs/firstpromoter-api/` as Markdown files, scraped via Firecrawl. **All API endpoints are covered locally** — organized by category:
- `promoters/` — 12 endpoint docs (list, get, create, update, accept, reject, block, archive, restore, add/move to campaign, assign parent)
- `referrals/` — 5 endpoint docs (list, get, update, move, delete)
- `commissions/` — 7 endpoint docs (list, create, update, approve, deny, mark fulfilled/unfulfilled)
- `payouts/` — 4 endpoint docs (list, grouped, due stats, stats)
- `reports/` — 5 endpoint docs (campaigns, overview, promoters, traffic sources, URLs)
- `promo-codes/` — 5 endpoint docs (list, create, get, update, archive)
- `promoter-campaigns/` — 2 endpoint docs (list, update)
- `batch-processes/` — 3 endpoint docs (list in-progress, show, progress)
- `tracking-api/` — 4 endpoint docs (leads/signups, sales, refund, cancellation)
- Root: `introduction.md`, `authentication.md`, `firstpromoter-llms.txt`

**Always read local docs first** (`docs/firstpromoter-api/{category}/`) before fetching from the internet.

**Online fallback:** If a local doc is missing for an endpoint:
- **Index:** `https://docs.firstpromoter.com/llms.txt` (also saved locally at `docs/firstpromoter-api/firstpromoter-llms.txt`)
- **Per-endpoint pages:** accessible via WebFetch (e.g., `/api-reference-v2/api-admin/promoters`)

## Key Decisions Made

1. **TypeScript over Python** — Better MCP SDK docs, community support, Cloudflare compatibility
2. **SQLite for caching** — Simple, zero-config, sufficient for 2-5 users
3. **Client-side credential storage first** — User's FP tokens stay in their Claude Desktop config (zero-knowledge)
4. **Streamable HTTP transport** — Modern MCP standard (replaces deprecated SSE)
5. **Google OAuth** — User already has experience with it
6. **Modular file structure** — Separate files for API helper, formatters, and each tool group for easier reading/debugging as more endpoints are added
7. **Structured text + raw JSON responses** — Prevents AI from mixing up fields between records in large JSON responses (e.g., attributing one promoter's website to another)
8. **Flat Zod inputSchema** — All API params exposed as flat fields (not nested objects) so AI clients can easily discover and use them. Handler maps to API's bracket notation.
9. **Full response structure in tool description** — AI clients know what fields to expect before calling the tool
10. **Node.js --env-file=.env** — Built-in flag (since Node 20.6) for loading .env in development, no dotenv dependency needed
11. **Two separate repos** — Local stdio server (this repo) and remote HTTP server (future repo) are separate products with different auth models, deployment targets, and release cycles. Shared code (tools, API helper, formatters) will be copied when forking.

## FirstPromoter API Details

- **Base URL:** `https://api.firstpromoter.com/api/v2/company`
- **Auth Headers Required:**
  - `Authorization: Bearer <token>`
  - `Account-ID: <account_id>`
- **Rate Limit:** 400 requests/minute per account
- **Pagination:** `page` (default 1), `per_page` (default 20, max 100)
- **Filters:** bracket notation — `filters[state]=accepted`, `filters[revenue_amount][from]=1000`
- **Sorting:** bracket notation — `sorting[revenue_amount]=desc`

### API Endpoints — Full List

**Promoters:**
- GET /promoters — List promoters (✅ implemented — 26 query params, full response docs)
- GET /promoters/:id — Get promoter details (✅ implemented — find_by support)
- POST /promoters — Create promoter (✅ implemented — 21 body params, profile fields + initial_campaign_id + drip_emails)
- PUT /promoters/:id — Update promoter (✅ implemented — 24 body params, find_by support)
- POST /promoters/accept — Accept promoters (✅ implemented — batch operation, async if >5 IDs)
- POST /promoters/reject — Reject promoters (✅ implemented — batch operation, async if >5 IDs)
- POST /promoters/block — Block promoters (✅ implemented — batch operation, async if >5 IDs)
- POST /promoters/archive — Archive promoters (✅ implemented — batch operation, no campaign_id, async if >5 IDs)
- POST /promoters/restore — Restore promoters (✅ implemented — batch operation, no campaign_id, async if >5 IDs)
- POST /promoters/add_to_campaign — Add to campaign (✅ implemented — batch operation, campaign_id + drip_emails, async if >5 IDs)
- POST /promoters/move_to_campaign — Move to campaign (✅ implemented — batch operation, from/to campaign IDs + drip_emails + soft_move_referrals, async if >5 IDs)
- POST /promoters/assign_parent — Assign parent promoter (✅ implemented — batch operation, parent_promoter_id + ids, async if >5 IDs)

**Referrals:**
- GET /referrals — List referrals (✅ implemented — filters: type, promoter_id, state, search by email/uid)
- GET /referrals/:id — Get referral (✅ implemented — find_by support)
- PUT /referrals/:id — Update referral (✅ implemented — email, uid, username, promoter_campaign_id, split_details)
- POST /referrals/move_to_promoter — Move to promoter (✅ implemented — batch operation)
- DELETE /referrals — Delete referrals (✅ implemented — batch operation)

**Commissions:**
- GET /commissions — List commissions (✅ implemented — filters: status, paid, fulfilled, sale_amount, campaign_id, fraud_check)
- POST /commissions — Create commission (✅ implemented — sale or custom type)
- PUT /commissions/:id — Update commission (✅ implemented — internal_note, external_note)
- POST /commissions/approve — Approve commissions (✅ implemented — batch operation)
- POST /commissions/deny — Deny commissions (✅ implemented — batch operation)
- POST /commissions/mark_fulfilled — Mark fulfilled (✅ implemented — batch operation)
- POST /commissions/mark_unfulfilled — Mark unfulfilled (✅ implemented — batch operation)

**Payouts:**
- GET /payouts — List payouts (✅ implemented — 18 query params with filters)
- GET /payouts/group_by_promoters — Grouped by promoters (✅ implemented)
- GET /payouts/due_stats — Due payout statistics (✅ implemented)
- GET /payouts/stats — Payout statistics (✅ implemented — stats_by breakdowns)

**Reports:**
- GET /reports/campaigns — Campaign reports (✅ implemented — columns, group_by, date range)
- GET /reports/overview — Overview reports (✅ implemented)
- GET /reports/promoters — Promoter reports (✅ implemented)
- GET /reports/traffic_sources — Traffic source reports (✅ implemented)
- GET /reports/urls — URL reports (✅ implemented)

**Promo Codes:**
- GET /promo_codes — List promo codes (✅ implemented)
- POST /promo_codes — Create promo code (✅ implemented — Stripe only)
- GET /promo_codes/:id — Get promo code (✅ implemented)
- PUT /promo_codes/:id — Update promo code (✅ implemented)
- DELETE /promo_codes/:id — Archive promo code (✅ implemented)

**Promoter Campaigns:**
- GET /promoter_campaigns — List promoter campaigns (✅ implemented)
- PUT /promoter_campaigns/:id — Update promoter campaign (✅ implemented — ref_token, state, coupon, rewards, etc.)

**Batch Processes:**
- GET /batch_processes — List batch processes (✅ implemented — optional status filter)
- GET /batch_processes/:id — Show batch process (✅ implemented)
- GET /batch_processes/progress — Show batch progress (✅ implemented — returns ID-to-percentage map)

**Tracking API (intentionally excluded — write operations that create/modify tracking data; risk of accidental commission changes):**
- POST /tracking/leads — Leads and signups
- POST /tracking/sales — Sales
- POST /tracking/refund — Refunds
- POST /tracking/cancellation — Cancellations

## Development Commands

```bash
# Install dependencies
npm install

# Development with hot reload (loads .env automatically)
npm run dev:stdio

# Build for production
npm run build

# Run production build (loads .env automatically)
npm start

# Docker build
docker build -t firstpromoter-mcp .

# Docker run (local testing)
docker run -it --rm \
  -e FP_BEARER_TOKEN=your_token \
  -e FP_ACCOUNT_ID=your_account_id \
  firstpromoter-mcp
```

## Testing with Claude Desktop

Config location: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

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
        "FP_BEARER_TOKEN": "your_token",
        "FP_ACCOUNT_ID": "your_account_id"
      }
    }
  }
}
```

After changing tool code: rebuild Docker image (`docker build -t firstpromoter-mcp .`) and restart Claude Desktop.

## Adding a New Endpoint (Pattern)

1. **Read API docs:** Check `docs/firstpromoter-api/{category}/` for the endpoint's doc file first. If not available locally, use WebFetch on the endpoint's doc page (find URL via `docs/firstpromoter-api/firstpromoter-llms.txt` or `https://docs.firstpromoter.com/llms.txt`)
2. **Create tool file:** `src/tools/{name}.ts` — register tool with:
   - All query params as flat Zod fields with `.describe()` on each
   - Full response structure documented in the tool description
   - Handler that maps flat params to API bracket notation
3. **Add formatter:** In `src/formatters.ts` — `export function format{Name}(data: unknown): string`
4. **Register:** In `src/tools/index.ts` — import and call `register{Name}Tools(server)`
5. **Verify:** `npm run build` + `docker build -t firstpromoter-mcp .`

## User Context

- **Developer:** Oleksii (marketer learning to code)
- **Experience Level:** Limited JS/Node.js, understands basics
- **Preferred Learning Style:** Analogies, detailed comments, step-by-step guidance
- **Infrastructure:** Hetzner server with Dokploy, Traefik for SSL
- **Target Users:** 2-5 people initially

## Important Links

- [MCP Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [FirstPromoter API v2 Docs](https://docs.firstpromoter.com/api-reference-v2/api-admin/introduction)
- [FirstPromoter LLM-friendly API Index](https://docs.firstpromoter.com/llms.txt)
- [Streamable HTTP Transport Guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)

## Phase 2 (Complete) — All Remaining API Tools

All 31 tools implemented across 7 new tool files:
1. ✅ Referrals (5 tools) — list, get, update, move to promoter, delete
2. ✅ Commissions (7 tools) — list, create, update, approve, deny, mark fulfilled/unfulfilled
3. ✅ Payouts (4 tools) — list, grouped by promoters, stats, due stats
4. ✅ Reports (5 tools) — campaigns, overview, promoters, traffic sources, URLs
5. ✅ Promo Codes (5 tools) — list, get, create, update, archive
6. ✅ Promoter Campaigns (2 tools) — list, update
7. ✅ Batch Processes (3 tools) — list, get, progress

## Phase 3 (Complete) — Production Polish

Centralized improvements in `src/api.ts` and new `src/logger.ts` — zero changes to tool files:

1. **Logger** (`src/logger.ts`) — stderr-only logger with 4 levels (debug/info/warn/error), configurable via `LOG_LEVEL` env var
2. **Error parsing** — `FirstPromoterAPIError` class with status-code-specific messages (401, 403, 404, 422, 429, 5xx), JSON body parsing for detail extraction
3. **Rate limiter** — sliding-window (60s) with 380-request safe buffer below the 400/min API limit, auto-pauses when near limit
4. **Retry logic** — up to 3 retries with exponential backoff (1s/2s/4s) on 429 and 5xx errors, respects `Retry-After` header
5. **Request logging** — method + endpoint on request, status + duration on response (debug level), errors at error level

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FP_BEARER_TOKEN` | — | FirstPromoter API token (required) |
| `FP_ACCOUNT_ID` | — | FirstPromoter account ID (required) |
| `LOG_LEVEL` | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |

## Future: Remote Server (Separate Repo)

A separate repository will be created for the remote MCP server:
- Streamable HTTP transport (replaces stdio)
- OAuth authentication (Google)
- Deployed to Hetzner via Dokploy/Docker/Traefik
- Domain: mcp.claritynodes.com
- Multi-user support with session management

## Notes for Claude

- Always explain code changes in simple terms
- Use analogies when introducing new concepts
- Confirm before making significant changes
- Keep the educational comments in code
- Test Docker builds locally before suggesting deployment
- Do NOT read .env file without asking — it contains secrets
- When adding new API endpoints, read the local doc from `docs/firstpromoter-api/` first. Only fetch from online docs if the local file is missing.
