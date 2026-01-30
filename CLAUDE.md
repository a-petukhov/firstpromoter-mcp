# CLAUDE.md - FirstPromoter MCP Server

## Project Overview

This is an MCP (Model Context Protocol) server that connects AI assistants (Claude, ChatGPT, Gemini, n8n) to the FirstPromoter affiliate management platform.

**Repository:** https://github.com/a-petukhov/firstpromoter-mcp
**Domain:** mcp.claritynodes.com (Hetzner server, Dokploy/Docker, Traefik)

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Local stdio server with `get_promoters` tool |
| Phase 2 | 🔲 Next | Remote deployment (Streamable HTTP transport) |
| Phase 3 | 🔲 Planned | OAuth authentication (Google) |
| Phase 4 | 🔲 Planned | Production polish (error handling, logging, rate limiting) |
| Phase 5 | 🔲 Planned | Smart caching (SQLite for historical reports) |

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js 20+
- **MCP SDK:** @modelcontextprotocol/sdk v1.12+
- **Web Framework:** Express (for HTTP transport in Phase 2)
- **Database:** SQLite (planned for Phase 5)
- **Deployment:** Docker → Dokploy → Hetzner server
- **SSL:** Let's Encrypt via Traefik

## Project Structure

```
firstpromoter-mcp/
├── src/
│   └── index.ts          # Main server entry point
├── dist/                  # Compiled JavaScript
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── CLAUDE.md             # This file
└── README.md
```

## Key Decisions Made

1. **TypeScript over Python** - Better MCP SDK docs, community support, Cloudflare compatibility
2. **SQLite for caching** - Simple, zero-config, sufficient for 2-5 users
3. **Client-side credential storage first** - User's FP tokens stay in their Claude Desktop config (zero-knowledge)
4. **Streamable HTTP transport** - Modern MCP standard (replaces deprecated SSE)
5. **Google OAuth** - User already has experience with it

## FirstPromoter API Details

- **Base URL:** `https://api.firstpromoter.com/api/v2/company`
- **Auth Headers Required:**
  - `Authorization: Bearer <token>`
  - `Account-ID: <account_id>`
- **Rate Limit:** 400 requests/minute per account

### API Endpoints to Implement

**Phase 1 (Done):**
- ✅ GET /promoters - List all promoters

**Phase 2+ (Planned):**
- GET /promoters/:id - Get promoter details
- POST /promoters - Create promoter
- GET /referrals - List referrals
- GET /reports/promoters - Promoter reports
- GET /commissions - List commissions
- GET /payouts - List payouts

## Development Commands

```bash
# Install dependencies
npm install

# Development (with hot reload)
npm run dev:stdio

# Build for production
npm run build

# Run production build
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

Add to `~/.config/Claude/claude_desktop_config.json` (Linux) or equivalent:

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
