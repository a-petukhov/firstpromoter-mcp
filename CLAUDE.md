# CLAUDE.md - FirstPromoter MCP Server

## Project Overview

This is an MCP (Model Context Protocol) server that connects AI assistants (Claude, ChatGPT, Gemini, n8n) to the FirstPromoter affiliate management platform.

**Repository:** https://github.com/a-petukhov/firstpromoter-mcp
**Domain:** mcp.claritynodes.com (Hetzner server, Dokploy/Docker, Traefik)

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Local stdio server with `get_promoters` tool (full API params) |
| Phase 2 | 🔲 Next | Remote deployment (Streamable HTTP transport) |
| Phase 3 | 🔲 Planned | OAuth authentication (Google) |
| Phase 4 | 🔲 Planned | Production polish (error handling, logging, rate limiting) |
| Phase 5 | 🔲 Planned | Smart caching (SQLite for historical reports) |

## Tech Stack

- **Language:** TypeScript (ESM modules, `"type": "module"`)
- **Runtime:** Node.js 20+ (uses built-in `--env-file=.env` for local dev)
- **MCP SDK:** @modelcontextprotocol/sdk v1.12+
- **Web Framework:** Express (for HTTP transport in Phase 2)
- **Database:** SQLite (planned for Phase 5)
- **Deployment:** Docker multi-stage build (node:20-alpine) → Dokploy → Hetzner server
- **SSL:** Let's Encrypt via Traefik

## Project Structure

```
firstpromoter-mcp/
├── src/
│   ├── index.ts          # Entry point: server creation + stdio transport
│   ├── api.ts            # FirstPromoter API helper (auth, fetch, error handling)
│   ├── formatters.ts     # Response formatters (structured text + raw JSON)
│   └── tools/
│       ├── index.ts      # Tool registry — registers all tools with the server
│       └── promoters.ts  # get_promoters tool (26 params, full response docs)
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

The handler maps flat Zod params to the API's bracket notation:
- `state` → `filters[state]=...`
- `revenue_amount_from` → `filters[revenue_amount][from]=...`
- `sort_by` + `sort_direction` → `sorting[field]=direction`

### API Docs Source

FirstPromoter publishes an LLM-friendly endpoint index:
- **Index:** `https://docs.firstpromoter.com/llms.txt` — lists all API endpoints
- **Per-endpoint pages:** accessible via WebFetch (e.g., `/api-reference-v2/api-admin/promoters`)

When adding a new endpoint, fetch its doc page to get full parameter specs and response schemas.

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
- GET /promoters — List promoters (✅ implemented with all 26 params)
- GET /promoters/:id — Get promoter details
- POST /promoters — Create promoter
- PUT /promoters/:id — Update promoter
- POST /promoters/accept — Accept promoters
- POST /promoters/reject — Reject promoters
- POST /promoters/block — Block promoters
- POST /promoters/archive — Archive promoters
- POST /promoters/restore — Restore promoters
- POST /promoters/add_to_campaign — Add to campaign
- POST /promoters/move_to_campaign — Move to campaign
- POST /promoters/assign_parent — Assign parent promoter

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

1. **Fetch API docs:** Use WebFetch on the endpoint's doc page (find URL via `https://docs.firstpromoter.com/llms.txt`)
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

## Phase 2 Requirements (Next)

1. Add Streamable HTTP transport alongside stdio
2. Create proper Dockerfile for production
3. Set up docker-compose for local testing
4. Deploy to Hetzner via Dokploy
5. Configure Traefik for HTTPS at mcp.claritynodes.com
6. Test with Claude Desktop using remote URL

## Notes for Claude

- Always explain code changes in simple terms
- Use analogies when introducing new concepts
- Confirm before making significant changes
- Keep the educational comments in code
- Test Docker builds locally before suggesting deployment
- Do NOT read .env file without asking — it contains secrets
- When adding new API endpoints, fetch the doc page from FirstPromoter docs site to get full param specs
