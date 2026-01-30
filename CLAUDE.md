# CLAUDE.md - FirstPromoter MCP Server

## Project Overview

This is an MCP (Model Context Protocol) server that provides AI assistants with access to the FirstPromoter affiliate management platform.

## Key Implementation Details

### Transport Mode
- Uses **HTTP/SSE transport** (not stdio like local MCP servers)
- Designed for remote multi-user access
- Runs on port 8000 by default

### Authentication
- **FirstPromoter API**: Uses Bearer token + Account-ID headers
- **MCP Server**: Optional token-based auth via `MCP_AUTH_TOKEN`

### API Base URL
```
https://api.firstpromoter.com/api/v2/company
```

### Required Headers for FirstPromoter API
```python
{
    "Authorization": "Bearer {FP_API_KEY}",
    "Account-ID": "{FP_ACCOUNT_ID}",
    "Content-Type": "application/json"
}
```

## Tool Naming Conventions

All tools follow these patterns:
- `get_*` - Read/list operations (GET requests)
- `create_*` - Create new resources (POST requests)
- `update_*` - Modify existing resources (PUT requests)
- `*_promoters` - Bulk operations on promoters (POST requests)

## Error Handling

All tools return strings with these prefixes:
- `✅` - Success
- `❌` - Error
- `📋`, `👥`, `💰`, `💸`, `🎯`, `📊` - Data displays

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `FP_API_KEY` | FirstPromoter API authentication |
| `FP_ACCOUNT_ID` | FirstPromoter account identifier |
| `MCP_AUTH_TOKEN` | MCP server access control |
| `MCP_TRANSPORT` | Transport mode (sse/stdio) |
| `MCP_HOST` | Server bind address |
| `MCP_PORT` | Server port |

## Rate Limits

FirstPromoter API: 400 requests/minute per account

## Batch Operations

Operations with >5 IDs are processed asynchronously by FirstPromoter. The response will include:
- `status`: "in_progress", "completed", "failed"
- `total`: Total items to process
- `processed_count`: Items processed so far

## Data Formatting

- Amounts are stored in cents (divide by 100 for display)
- Dates are ISO 8601 format
- IDs are integers

## Common Filters

### Promoter States
- `pending`, `approved`, `blocked`, `archived`

### Referral States  
- `signup`, `subscribed`, `active`, `cancelled`, `refunded`, `denied`

### Commission Statuses
- `pending`, `approved`, `denied`

### Payout Statuses
- `pending`, `completed`, `failed`, `processing`, `cancelled`

## Development Notes

1. All parameters use empty string defaults (`param: str = ""`)
2. Single-line docstrings only
3. No Optional/Union type hints
4. Always return formatted strings
5. Check for empty strings with `.strip()`
