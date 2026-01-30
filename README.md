# FirstPromoter MCP Server

An MCP (Model Context Protocol) server that connects AI assistants like Claude to your FirstPromoter affiliate management platform.

## 🍽️ What is This? (The Restaurant Analogy)

Think of this server as a **translator** between Claude (or other AI assistants) and FirstPromoter:

| Component | Restaurant Analogy | What it Does |
|-----------|-------------------|--------------|
| **MCP Server** | The restaurant | Receives orders, processes them, returns results |
| **Tools** | Menu items | Actions Claude can perform (e.g., "Get Promoters") |
| **Transport** | How you order | stdio (in person) or HTTP (phone order) |
| **FirstPromoter API** | The kitchen | Where the actual work happens |

## 🚀 Quick Start

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
   - **FP_BEARER_TOKEN**: Find at Dashboard → Settings → Integrations → Manage API Keys
   - **FP_ACCOUNT_ID**: Find at Dashboard → Settings → Integrations

### Step 3: Test the Server

Run the server directly:
```bash
npm run dev:stdio
```

You should see:
```
FirstPromoter MCP Server running on stdio
Credentials configured: Yes
```

### Step 4: Connect to Claude Desktop

1. Open Claude Desktop
2. Go to Settings → Developer → Edit Config
3. Add this configuration:

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

**Or using tsx (for development):**

```json
{
  "mcpServers": {
    "firstpromoter": {
      "command": "npx",
      "args": ["tsx", "/full/path/to/firstpromoter-mcp/src/index.ts", "--stdio"],
      "env": {
        "FP_BEARER_TOKEN": "your_token_here",
        "FP_ACCOUNT_ID": "your_account_id_here"
      }
    }
  }
}
```

4. Restart Claude Desktop
5. You should see "firstpromoter" in the MCP tools list

### Step 5: Try It Out!

Ask Claude:
- "List my promoters"
- "Show me pending promoters"
- "Get the first 10 accepted promoters"

## 📚 Available Tools

### get_promoters

Lists all promoters from your FirstPromoter account.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | string (optional) | Filter by state: `pending`, `accepted`, `blocked`, `archived` |
| `page` | number (optional) | Page number for pagination (starts at 1) |
| `per_page` | number (optional) | Items per page (1-100) |

**Example usage in Claude:**
> "Show me all accepted promoters, page 2 with 20 per page"

## 🗺️ Project Roadmap

- [x] **Phase 1**: Local development (stdio transport)
- [ ] **Phase 2**: Remote deployment (Streamable HTTP)
- [ ] **Phase 3**: OAuth authentication (Google)
- [ ] **Phase 4**: Production polish

## 📁 Project Structure

```
firstpromoter-mcp/
├── src/
│   └── index.ts        # Main server file
├── dist/               # Compiled JavaScript (after build)
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── .env.example        # Environment variables template
└── README.md           # This file
```

## 🔧 Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run server in development mode |
| `npm run dev:stdio` | Run server with stdio transport |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run compiled server |

## 🐛 Troubleshooting

### "Credentials not configured" error

Make sure your `.env` file exists and contains valid credentials:
```bash
cat .env
```

### Server doesn't appear in Claude Desktop

1. Check the Claude Desktop logs
2. Verify the path in your config is correct
3. Make sure you've restarted Claude Desktop

### API errors from FirstPromoter

- Check your API token hasn't expired
- Verify your account has API access enabled
- Check the FirstPromoter status page

## 📄 License

MIT
