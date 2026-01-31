# CLAUDE.md - FirstPromoter MCP Server

## Project Overview

This is an MCP (Model Context Protocol) server that connects AI assistants (Claude, ChatGPT, Gemini, n8n) to the FirstPromoter affiliate management platform.

**Repository:** https://github.com/a-petukhov/firstpromoter-mcp
**Type:** Local MCP server (stdio transport, runs via Docker on user's machine)

## Current Status

**Scope:** This repo is the **local MCP server** (stdio transport, runs via Docker on the user's machine). A separate repo will be created later for the remote HTTP server with OAuth.

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Local stdio server with `get_promoters` + `get_promoter` + `update_promoter` tools (full API params) |
| Phase 2 | 🔲 Next | Add remaining API tools (commissions, referrals, payouts, reports, promo codes) |
| Phase 3 | 🔲 Planned | Production polish (error handling, logging, rate limiting) |

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
│   ├── api.ts            # FirstPromoter API helper (auth, fetch, error handling)
│   ├── formatters.ts     # Response formatters (structured text + raw JSON)
│   └── tools/
│       ├── index.ts      # Tool registry — registers all tools with the server
│       └── promoters.ts  # get_promoters (26 params) + get_promoter (3 params) + create_promoter (21 params) + update_promoter (24 params) + accept_promoters (2 params) + reject_promoters (2 params) + block_promoters (2 params) + archive_promoters (1 param) + restore_promoters (1 param) + move_promoters_to_campaign (5 params) + add_promoters_to_campaign (3 params) + assign_parent_promoter (2 params)
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
- GET /referrals — List referrals (filters: type, promoter_id, state, search by email/uid)
- GET /referrals/:id — Get referral
- PUT /referrals/:id — Update referral
- POST /referrals/move_to_promoter — Move to promoter
- DELETE /referrals — Delete referrals

**Commissions:**
- GET /commissions — List commissions (filters: status, paid, fulfilled, sale_amount, campaign_id, fraud_check)
- POST /commissions — Create commission
- PUT /commissions/:id — Update commission
- POST /commissions/approve — Approve commissions
- POST /commissions/deny — Deny commissions
- POST /commissions/mark_fulfilled — Mark fulfilled
- POST /commissions/mark_unfulfilled — Mark unfulfilled

**Payouts:**
- GET /payouts — List payouts (filters: status, campaign_id, due_period, payout_method, promoter_id)
- GET /payouts/group_by_promoters — Grouped by promoters
- GET /payouts/due_stats — Due payout statistics
- GET /payouts/stats — Payout statistics

**Reports:**
- GET /reports/campaigns — Campaign reports (columns, group_by day/week/month/year, date range)
- GET /reports/overview — Overview reports
- GET /reports/promoters — Promoter reports
- GET /reports/traffic_sources — Traffic source reports
- GET /reports/urls — URL reports

**Promo Codes:**
- GET /promo_codes — List promo codes
- POST /promo_codes — Create promo code
- GET /promo_codes/:id — Get promo code
- PUT /promo_codes/:id — Update promo code
- DELETE /promo_codes/:id — Archive promo code

**Promoter Campaigns:**
- GET /promoter_campaigns — List promoter campaigns
- PUT /promoter_campaigns/:id — Update promoter campaign

**Batch Processes:**
- GET /batches — List in-progress batch processes
- GET /batches/:id — Show batch process
- GET /batches/:id/progress — Show batch progress

**Tracking API:**
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

## Phase 2 Requirements (Next) — Add Remaining API Tools

1. Implement commissions tools (list, create, approve, deny, mark fulfilled/unfulfilled)
2. Implement referrals tools (list, get, update, move, delete)
3. Implement payouts tools (list, grouped, due stats, stats)
4. Implement reports tools (campaigns, overview, promoters, traffic sources, URLs)
5. Implement promo codes tools (list, create, get, update, archive)
6. Implement promoter campaigns tools (list, update)
7. Implement remaining promoter tools (create, reject, block, archive, restore, campaign management)

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
