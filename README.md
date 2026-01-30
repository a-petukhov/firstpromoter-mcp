# FirstPromoter MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with access to the FirstPromoter affiliate management platform. Designed for **remote multi-user deployment** using HTTP/SSE transport.

## 🎯 Features

### Referral Management
- `get_referrals` - List all referrals with search, state, and promoter filters
- `get_referral` - Get detailed information about a specific referral

### Promoter Management  
- `get_promoters` - List all promoters with filters
- `create_promoter` - Create a new promoter
- `get_promoter` - Get detailed promoter information
- `update_promoter` - Update promoter details
- `add_promoters_to_campaign` - Add promoters to a campaign
- `move_promoters_to_campaign` - Move promoters between campaigns
- `accept_promoters` - Accept pending promoters
- `reject_promoters` - Reject pending promoters
- `block_promoters` - Block promoters
- `archive_promoters` - Archive promoters
- `restore_promoters` - Restore archived promoters

### Campaign Management
- `get_promoter_campaigns` - List promoter-campaign relationships
- `update_promoter_campaign` - Update campaign settings

### Commission Management
- `get_commissions` - List all commissions with filters
- `approve_commissions` - Approve pending commissions
- `deny_commissions` - Deny commissions

### Payout Management
- `get_payouts` - List all payouts
- `get_payout_stats` - Get payout statistics
- `get_due_payout_stats` - Get due payout statistics
- `get_payouts_by_promoter` - Get payouts grouped by promoter

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Desktop │     │   Claude Code   │     │       n8n       │
│    (Client)     │     │    (Client)     │     │    (Client)     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │    HTTP/SSE           │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Hetzner CPX22 Server  │
                    │   (Dokploy/Docker)      │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │ FirstPromoter MCP │  │
                    │  │      Server       │  │
                    │  │    (Port 8000)    │  │
                    │  └─────────┬─────────┘  │
                    └────────────┼────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   FirstPromoter API     │
                    │ api.firstpromoter.com   │
                    └─────────────────────────┘
```

---

## 🚀 Deployment to Dokploy

### Prerequisites
- Dokploy v0.26.6+ installed on your Hetzner server
- FirstPromoter API Key and Account ID
- (Optional) Domain name for HTTPS

### Step 1: Create the Project in Dokploy

1. Log into your Dokploy dashboard
2. Click **"Create Project"**
3. Name it `firstpromoter-mcp`

### Step 2: Create the Application

1. Inside the project, click **"Create Application"**
2. Select **"Docker Compose"** as the source type
3. Choose **"Git"** or **"Upload"** based on your preference

**Option A: Git Repository**
- Push this code to a Git repository
- Connect the repository in Dokploy

**Option B: Direct Upload**
- Upload all files to Dokploy

### Step 3: Configure Environment Variables

In Dokploy's application settings, add these environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `FP_API_KEY` | FirstPromoter API Key | ✅ Yes |
| `FP_ACCOUNT_ID` | FirstPromoter Account ID | ✅ Yes |
| `MCP_AUTH_TOKEN` | Token for MCP client auth | 🔐 Recommended |
| `MCP_PORT` | Server port (default: 8000) | ❌ Optional |

### Step 4: Configure Domain (HTTPS)

1. In Dokploy, go to **Domains**
2. Add your domain (e.g., `mcp.yourdomain.com`)
3. Enable **HTTPS** (Let's Encrypt)
4. Set the target port to `8000`

### Step 5: Deploy

Click **Deploy** in Dokploy. The server will build and start.

---

## 🔌 Client Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "firstpromoter": {
      "transport": {
        "type": "sse",
        "url": "https://mcp.yourdomain.com/sse"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add firstpromoter --transport sse --url "https://mcp.yourdomain.com/sse"
```

### n8n Integration

#### Option 1: Using MCP Node (if available)
Configure the MCP node with:
- **Transport**: SSE
- **URL**: `https://mcp.yourdomain.com/sse`

#### Option 2: Direct HTTP Requests
Use the HTTP Request node to call FirstPromoter API directly. The MCP server exposes the same endpoints.

---

## 🔐 Security Recommendations

### 1. Enable HTTPS
Always use HTTPS in production. Dokploy handles this automatically with Let's Encrypt.

### 2. IP Allowlisting
In Dokploy, you can configure firewall rules to only allow specific IPs:
- Your office IP
- Your colleagues' IPs
- n8n server IP

### 3. Authentication Token
Set `MCP_AUTH_TOKEN` to require clients to authenticate. Clients must include this token in their requests.

### 4. Rate Limiting
FirstPromoter has a rate limit of 400 requests/minute. The MCP server doesn't add additional rate limiting, but you can add a reverse proxy (like Nginx) in front if needed.

---

## 🧪 Testing

### Health Check
```bash
curl https://mcp.yourdomain.com/health
```

### List Tools
```bash
curl https://mcp.yourdomain.com/sse \
  -H "Accept: text/event-stream"
```

### Local Testing (Docker)
```bash
# Build
docker build -t firstpromoter-mcp .

# Run
docker run -d \
  -e FP_API_KEY=your_key \
  -e FP_ACCOUNT_ID=your_account_id \
  -p 8000:8000 \
  firstpromoter-mcp

# Test
curl http://localhost:8000/health
```

---

## 📝 Example Usage

Once connected, you can ask Claude:

**Promoter Management:**
- "Show me all pending promoters"
- "Create a new promoter with email john@example.com"
- "Accept promoter ID 12345"
- "Move promoters 100, 101, 102 to campaign 5"

**Commission Management:**
- "List all pending commissions"
- "Approve commission IDs 500, 501, 502"
- "Show commission stats"

**Payout Management:**
- "What are the payout statistics?"
- "Show me all pending payouts"
- "Get due payout stats"

**Referral Management:**
- "List all referrals from promoter 123"
- "Get details for referral ID 456"

---

## 🔧 Troubleshooting

### Server won't start
Check logs in Dokploy or run:
```bash
docker logs firstpromoter-mcp
```

Common issues:
- Missing `FP_API_KEY` or `FP_ACCOUNT_ID`
- Port 8000 already in use

### API errors
Verify your FirstPromoter credentials:
1. Log into FirstPromoter
2. Go to Settings → Integrations → Manage API Keys
3. Ensure the API key has appropriate permissions

### Connection refused
- Check if the container is running
- Verify Dokploy domain configuration
- Check firewall rules

---

## 📄 License

MIT License

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

## 📚 Resources

- [FirstPromoter API Documentation](https://docs.firstpromoter.com/api-reference-v2/api-admin/introduction)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Dokploy Documentation](https://docs.dokploy.com/)
