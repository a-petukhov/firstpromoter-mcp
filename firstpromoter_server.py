#!/usr/bin/env python3
"""FirstPromoter MCP Server - HTTP/SSE transport for remote multi-user access."""
import os
import sys
import json
import logging
import httpx
from mcp.server.fastmcp import FastMCP

# Configure logging to stderr
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger("firstpromoter-mcp")

# Initialize MCP server
mcp = FastMCP("firstpromoter")

# Configuration from environment variables
FP_API_KEY = os.environ.get("FP_API_KEY", "")
FP_ACCOUNT_ID = os.environ.get("FP_ACCOUNT_ID", "")
MCP_AUTH_TOKEN = os.environ.get("MCP_AUTH_TOKEN", "")
BASE_URL = "https://api.firstpromoter.com/api/v2/company"


def get_headers():
    """Build authentication headers for FirstPromoter API."""
    return {
        "Authorization": f"Bearer {FP_API_KEY}",
        "Account-ID": FP_ACCOUNT_ID,
        "Content-Type": "application/json"
    }


def check_config():
    """Verify required configuration is present."""
    if not FP_API_KEY:
        return "❌ FP_API_KEY environment variable not set"
    if not FP_ACCOUNT_ID:
        return "❌ FP_ACCOUNT_ID environment variable not set"
    return None


async def make_request(method: str, endpoint: str, params: dict = None, data: dict = None):
    """Make HTTP request to FirstPromoter API."""
    config_error = check_config()
    if config_error:
        return config_error
    
    url = f"{BASE_URL}/{endpoint}"
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            if method == "GET":
                response = await client.get(url, headers=get_headers(), params=params)
            elif method == "POST":
                response = await client.post(url, headers=get_headers(), json=data)
            elif method == "PUT":
                response = await client.put(url, headers=get_headers(), json=data)
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            return f"❌ API Error {e.response.status_code}: {e.response.text}"
        except Exception as e:
            return f"❌ Request failed: {str(e)}"


def format_promoter(p: dict) -> str:
    """Format a single promoter for display."""
    name = p.get("name", "N/A")
    email = p.get("email", "N/A")
    state = p.get("state", "N/A")
    stats = p.get("stats", {})
    return f"• {name} ({email}) - State: {state}, Referrals: {stats.get('referrals_count', 0)}, Revenue: ${stats.get('revenue_amount', 0)/100:.2f}"


def format_referral(r: dict) -> str:
    """Format a single referral for display."""
    email = r.get("email", "N/A")
    state = r.get("state", "N/A")
    promo_camp = r.get("promoter_campaign", {})
    promoter = promo_camp.get("promoter", {})
    return f"• {email} - State: {state}, Promoter: {promoter.get('name', 'N/A')}"


def format_commission(c: dict) -> str:
    """Format a single commission for display."""
    amount = c.get("amount", 0)
    status = c.get("status", "N/A")
    unit = c.get("unit", "cash")
    promo_camp = c.get("promoter_campaign", {})
    promoter = promo_camp.get("promoter", {})
    return f"• ${amount/100:.2f} ({unit}) - Status: {status}, Promoter: {promoter.get('name', 'N/A')}"


def format_payout(p: dict) -> str:
    """Format a single payout for display."""
    amount = p.get("amount", 0)
    status = p.get("status", "N/A")
    promoter = p.get("promoter", {})
    return f"• ${amount/100:.2f} - Status: {status}, Promoter: {promoter.get('name', 'N/A')}"


# ==================== REFERRAL TOOLS ====================

@mcp.tool()
async def get_referrals(search: str = "", state: str = "", promoter_id: str = "", page: str = "1", per_page: str = "20") -> str:
    """List all referrals with optional filters for search, state, and promoter_id."""
    logger.info(f"Getting referrals: search={search}, state={state}")
    
    params = {"page": page, "per_page": per_page}
    if search.strip():
        params["q"] = search
    if state.strip():
        params["filters[state]"] = state
    if promoter_id.strip():
        params["filters[promoter_id]"] = promoter_id
    
    result = await make_request("GET", "referrals", params=params)
    if isinstance(result, str):
        return result
    
    if not result:
        return "📋 No referrals found"
    
    output = [f"📋 Found {len(result)} referrals:"]
    for r in result[:20]:
        output.append(format_referral(r))
    
    if len(result) > 20:
        output.append(f"... and {len(result) - 20} more")
    
    return "\n".join(output)


@mcp.tool()
async def get_referral(referral_id: str) -> str:
    """Get details of a specific referral by ID."""
    logger.info(f"Getting referral: {referral_id}")
    
    if not referral_id.strip():
        return "❌ referral_id is required"
    
    result = await make_request("GET", f"referrals/{referral_id}")
    if isinstance(result, str):
        return result
    
    email = result.get("email", "N/A")
    state = result.get("state", "N/A")
    uid = result.get("uid", "N/A")
    fraud = result.get("fraud_check", "N/A")
    created = result.get("created_at", "N/A")
    
    promo_camp = result.get("promoter_campaign", {})
    promoter = promo_camp.get("promoter", {})
    campaign = promo_camp.get("campaign", {})
    
    return f"""📋 Referral Details:
- ID: {result.get('id')}
- Email: {email}
- UID: {uid}
- State: {state}
- Fraud Check: {fraud}
- Created: {created}
- Promoter: {promoter.get('name', 'N/A')} ({promoter.get('email', 'N/A')})
- Campaign: {campaign.get('name', 'N/A')}"""


# ==================== PROMOTER TOOLS ====================

@mcp.tool()
async def get_promoters(search: str = "", state: str = "", campaign_id: str = "", page: str = "1", per_page: str = "20") -> str:
    """List all promoters with optional filters for search, state, and campaign_id."""
    logger.info(f"Getting promoters: search={search}, state={state}")
    
    params = {"page": page, "per_page": per_page}
    if search.strip():
        params["q"] = search
    if state.strip():
        params["filters[state]"] = state
    if campaign_id.strip():
        params["filters[campaign_id]"] = campaign_id
    
    result = await make_request("GET", "promoters", params=params)
    if isinstance(result, str):
        return result
    
    data = result.get("data", []) if isinstance(result, dict) else result
    meta = result.get("meta", {}) if isinstance(result, dict) else {}
    
    if not data:
        return "👥 No promoters found"
    
    output = [f"👥 Found {len(data)} promoters (Pending: {meta.get('pending_count', 0)}):"]
    for p in data[:20]:
        output.append(format_promoter(p))
    
    if len(data) > 20:
        output.append(f"... and {len(data) - 20} more")
    
    return "\n".join(output)


@mcp.tool()
async def create_promoter(email: str, first_name: str = "", last_name: str = "", campaign_id: str = "", cust_id: str = "", skip_email: str = "false") -> str:
    """Create a new promoter with email (required), optional name, campaign_id, and cust_id."""
    logger.info(f"Creating promoter: {email}")
    
    if not email.strip():
        return "❌ email is required"
    
    data = {"email": email}
    if first_name.strip():
        data["first_name"] = first_name
    if last_name.strip():
        data["last_name"] = last_name
    if campaign_id.strip():
        data["campaign_id"] = int(campaign_id)
    if cust_id.strip():
        data["cust_id"] = cust_id
    if skip_email.lower() == "true":
        data["skip_email_notification"] = True
    
    result = await make_request("POST", "promoters", data=data)
    if isinstance(result, str):
        return result
    
    return f"""✅ Promoter created successfully:
- ID: {result.get('id')}
- Email: {result.get('email')}
- State: {result.get('state')}
- Ref Link: {result.get('promoter_campaigns', [{}])[0].get('ref_link', 'N/A') if result.get('promoter_campaigns') else 'N/A'}"""


@mcp.tool()
async def get_promoter(promoter_id: str) -> str:
    """Get detailed information about a specific promoter by ID."""
    logger.info(f"Getting promoter: {promoter_id}")
    
    if not promoter_id.strip():
        return "❌ promoter_id is required"
    
    result = await make_request("GET", f"promoters/{promoter_id}")
    if isinstance(result, str):
        return result
    
    stats = result.get("stats", {})
    profile = result.get("profile", {})
    
    output = f"""👤 Promoter Details:
- ID: {result.get('id')}
- Name: {result.get('name', 'N/A')}
- Email: {result.get('email')}
- State: {result.get('state')}
- Customer ID: {result.get('cust_id', 'N/A')}
- Joined: {result.get('joined_at', 'N/A')}
- Last Login: {result.get('last_login_at', 'N/A')}

📊 Stats:
- Clicks: {stats.get('clicks_count', 0)}
- Referrals: {stats.get('referrals_count', 0)}
- Sales: {stats.get('sales_count', 0)}
- Revenue: ${stats.get('revenue_amount', 0)/100:.2f}
- Active Customers: {stats.get('active_customers_count', 0)}"""
    
    campaigns = result.get("promoter_campaigns", [])
    if campaigns:
        output += "\n\n🎯 Campaigns:"
        for c in campaigns:
            camp = c.get("campaign", {})
            output += f"\n- {camp.get('name', 'N/A')} (Ref: {c.get('ref_token', 'N/A')})"
    
    return output


@mcp.tool()
async def update_promoter(promoter_id: str, first_name: str = "", last_name: str = "", note: str = "", cust_id: str = "") -> str:
    """Update a promoter's information including name, note, or customer ID."""
    logger.info(f"Updating promoter: {promoter_id}")
    
    if not promoter_id.strip():
        return "❌ promoter_id is required"
    
    data = {}
    if first_name.strip():
        data["first_name"] = first_name
    if last_name.strip():
        data["last_name"] = last_name
    if note.strip():
        data["note"] = note
    if cust_id.strip():
        data["cust_id"] = cust_id
    
    if not data:
        return "❌ At least one field to update is required"
    
    result = await make_request("PUT", f"promoters/{promoter_id}", data=data)
    if isinstance(result, str):
        return result
    
    return f"✅ Promoter {promoter_id} updated successfully"


@mcp.tool()
async def add_promoters_to_campaign(campaign_id: str, promoter_ids: str) -> str:
    """Add promoters to a campaign. Provide campaign_id and comma-separated promoter_ids."""
    logger.info(f"Adding promoters to campaign: {campaign_id}")
    
    if not campaign_id.strip() or not promoter_ids.strip():
        return "❌ campaign_id and promoter_ids are required"
    
    ids = [int(x.strip()) for x in promoter_ids.split(",") if x.strip().isdigit()]
    if not ids:
        return "❌ No valid promoter IDs provided"
    
    data = {"campaign_id": int(campaign_id), "ids": ids}
    result = await make_request("POST", "promoters/add_to_campaign", data=data)
    if isinstance(result, str):
        return result
    
    return f"✅ Added {len(ids)} promoter(s) to campaign {campaign_id}"


@mcp.tool()
async def move_promoters_to_campaign(campaign_id: str, promoter_ids: str) -> str:
    """Move promoters to a different campaign. Provide campaign_id and comma-separated promoter_ids."""
    logger.info(f"Moving promoters to campaign: {campaign_id}")
    
    if not campaign_id.strip() or not promoter_ids.strip():
        return "❌ campaign_id and promoter_ids are required"
    
    ids = [int(x.strip()) for x in promoter_ids.split(",") if x.strip().isdigit()]
    if not ids:
        return "❌ No valid promoter IDs provided"
    
    data = {"campaign_id": int(campaign_id), "ids": ids}
    result = await make_request("POST", "promoters/move_to_campaign", data=data)
    if isinstance(result, str):
        return result
    
    return f"✅ Moved {len(ids)} promoter(s) to campaign {campaign_id}"


@mcp.tool()
async def accept_promoters(promoter_ids: str, campaign_id: str = "") -> str:
    """Accept pending promoters. Provide comma-separated promoter_ids and optional campaign_id."""
    logger.info(f"Accepting promoters: {promoter_ids}")
    
    if not promoter_ids.strip():
        return "❌ promoter_ids is required"
    
    ids = [int(x.strip()) for x in promoter_ids.split(",") if x.strip().isdigit()]
    if not ids:
        return "❌ No valid promoter IDs provided"
    
    data = {"ids": ids}
    if campaign_id.strip():
        data["campaign_id"] = int(campaign_id)
    
    result = await make_request("POST", "promoters/accept", data=data)
    if isinstance(result, str):
        return result
    
    status = result.get("status", "unknown")
    return f"✅ Accept request submitted - Status: {status}, Total: {result.get('total', len(ids))}"


@mcp.tool()
async def reject_promoters(promoter_ids: str) -> str:
    """Reject pending promoters. Provide comma-separated promoter_ids."""
    logger.info(f"Rejecting promoters: {promoter_ids}")
    
    if not promoter_ids.strip():
        return "❌ promoter_ids is required"
    
    ids = [int(x.strip()) for x in promoter_ids.split(",") if x.strip().isdigit()]
    if not ids:
        return "❌ No valid promoter IDs provided"
    
    data = {"ids": ids}
    result = await make_request("POST", "promoters/reject", data=data)
    if isinstance(result, str):
        return result
    
    return f"✅ Rejected {len(ids)} promoter(s)"


@mcp.tool()
async def block_promoters(promoter_ids: str) -> str:
    """Block promoters. Provide comma-separated promoter_ids."""
    logger.info(f"Blocking promoters: {promoter_ids}")
    
    if not promoter_ids.strip():
        return "❌ promoter_ids is required"
    
    ids = [int(x.strip()) for x in promoter_ids.split(",") if x.strip().isdigit()]
    if not ids:
        return "❌ No valid promoter IDs provided"
    
    data = {"ids": ids}
    result = await make_request("POST", "promoters/block", data=data)
    if isinstance(result, str):
        return result
    
    return f"✅ Blocked {len(ids)} promoter(s)"


@mcp.tool()
async def archive_promoters(promoter_ids: str) -> str:
    """Archive promoters. Provide comma-separated promoter_ids."""
    logger.info(f"Archiving promoters: {promoter_ids}")
    
    if not promoter_ids.strip():
        return "❌ promoter_ids is required"
    
    ids = [int(x.strip()) for x in promoter_ids.split(",") if x.strip().isdigit()]
    if not ids:
        return "❌ No valid promoter IDs provided"
    
    data = {"ids": ids}
    result = await make_request("POST", "promoters/archive", data=data)
    if isinstance(result, str):
        return result
    
    return f"✅ Archived {len(ids)} promoter(s)"


@mcp.tool()
async def restore_promoters(promoter_ids: str) -> str:
    """Restore archived promoters. Provide comma-separated promoter_ids."""
    logger.info(f"Restoring promoters: {promoter_ids}")
    
    if not promoter_ids.strip():
        return "❌ promoter_ids is required"
    
    ids = [int(x.strip()) for x in promoter_ids.split(",") if x.strip().isdigit()]
    if not ids:
        return "❌ No valid promoter IDs provided"
    
    data = {"ids": ids}
    result = await make_request("POST", "promoters/restore", data=data)
    if isinstance(result, str):
        return result
    
    return f"✅ Restored {len(ids)} promoter(s)"


# ==================== PROMOTER CAMPAIGN TOOLS ====================

@mcp.tool()
async def get_promoter_campaigns(promoter_id: str = "", campaign_id: str = "", page: str = "1", per_page: str = "20") -> str:
    """List promoter campaigns with optional filters for promoter_id and campaign_id."""
    logger.info(f"Getting promoter campaigns")
    
    params = {"page": page, "per_page": per_page}
    if promoter_id.strip():
        params["filters[promoter_id]"] = promoter_id
    if campaign_id.strip():
        params["filters[campaign_id]"] = campaign_id
    
    result = await make_request("GET", "promoter_campaigns", params=params)
    if isinstance(result, str):
        return result
    
    data = result.get("data", []) if isinstance(result, dict) else result
    
    if not data:
        return "🎯 No promoter campaigns found"
    
    output = [f"🎯 Found {len(data)} promoter campaigns:"]
    for pc in data[:20]:
        promoter = pc.get("promoter", {})
        campaign = pc.get("campaign", {})
        output.append(f"• {promoter.get('name', 'N/A')} in {campaign.get('name', 'N/A')} - Ref: {pc.get('ref_token', 'N/A')}")
    
    return "\n".join(output)


@mcp.tool()
async def update_promoter_campaign(promoter_campaign_id: str, ref_token: str = "", coupon: str = "") -> str:
    """Update a promoter campaign's ref_token or coupon code."""
    logger.info(f"Updating promoter campaign: {promoter_campaign_id}")
    
    if not promoter_campaign_id.strip():
        return "❌ promoter_campaign_id is required"
    
    data = {}
    if ref_token.strip():
        data["ref_token"] = ref_token
    if coupon.strip():
        data["coupon"] = coupon
    
    if not data:
        return "❌ At least one field to update is required (ref_token or coupon)"
    
    result = await make_request("PUT", f"promoter_campaigns/{promoter_campaign_id}", data=data)
    if isinstance(result, str):
        return result
    
    return f"✅ Promoter campaign {promoter_campaign_id} updated successfully"


# ==================== COMMISSION TOOLS ====================

@mcp.tool()
async def get_commissions(search: str = "", status: str = "", promoter_id: str = "", page: str = "1", per_page: str = "20") -> str:
    """List all commissions with optional filters for search, status, and promoter_id."""
    logger.info(f"Getting commissions: status={status}")
    
    params = {"page": page, "per_page": per_page}
    if search.strip():
        params["q"] = search
    if status.strip():
        params["filters[status]"] = status
    if promoter_id.strip():
        params["filters[promoter_id]"] = promoter_id
    
    result = await make_request("GET", "commissions", params=params)
    if isinstance(result, str):
        return result
    
    if not result:
        return "💰 No commissions found"
    
    output = [f"💰 Found {len(result)} commissions:"]
    for c in result[:20]:
        output.append(format_commission(c))
    
    if len(result) > 20:
        output.append(f"... and {len(result) - 20} more")
    
    return "\n".join(output)


@mcp.tool()
async def approve_commissions(commission_ids: str) -> str:
    """Approve pending commissions. Provide comma-separated commission_ids."""
    logger.info(f"Approving commissions: {commission_ids}")
    
    if not commission_ids.strip():
        return "❌ commission_ids is required"
    
    ids = [int(x.strip()) for x in commission_ids.split(",") if x.strip().isdigit()]
    if not ids:
        return "❌ No valid commission IDs provided"
    
    data = {"ids": ids}
    result = await make_request("POST", "commissions/approve", data=data)
    if isinstance(result, str):
        return result
    
    return f"✅ Approved {len(ids)} commission(s)"


@mcp.tool()
async def deny_commissions(commission_ids: str) -> str:
    """Deny commissions. Provide comma-separated commission_ids."""
    logger.info(f"Denying commissions: {commission_ids}")
    
    if not commission_ids.strip():
        return "❌ commission_ids is required"
    
    ids = [int(x.strip()) for x in commission_ids.split(",") if x.strip().isdigit()]
    if not ids:
        return "❌ No valid commission IDs provided"
    
    data = {"ids": ids}
    result = await make_request("POST", "commissions/deny", data=data)
    if isinstance(result, str):
        return result
    
    return f"✅ Denied {len(ids)} commission(s)"


# ==================== PAYOUT TOOLS ====================

@mcp.tool()
async def get_payouts(status: str = "", promoter_id: str = "", payout_method: str = "", page: str = "1", per_page: str = "20") -> str:
    """List all payouts with optional filters for status, promoter_id, and payout_method."""
    logger.info(f"Getting payouts: status={status}")
    
    params = {"page": page, "per_page": per_page}
    if status.strip():
        params["filters[status]"] = status
    if promoter_id.strip():
        params["filters[promoter_id]"] = promoter_id
    if payout_method.strip():
        params["filters[payout_method]"] = payout_method
    
    result = await make_request("GET", "payouts", params=params)
    if isinstance(result, str):
        return result
    
    if not result:
        return "💸 No payouts found"
    
    output = [f"💸 Found {len(result)} payouts:"]
    for p in result[:20]:
        output.append(format_payout(p))
    
    if len(result) > 20:
        output.append(f"... and {len(result) - 20} more")
    
    return "\n".join(output)


@mcp.tool()
async def get_payout_stats() -> str:
    """Get overall payout statistics."""
    logger.info("Getting payout stats")
    
    result = await make_request("GET", "payouts/stats")
    if isinstance(result, str):
        return result
    
    return f"""📊 Payout Statistics:
- Total Pending: ${result.get('pending_amount', 0)/100:.2f}
- Total Completed: ${result.get('completed_amount', 0)/100:.2f}
- Total Processing: ${result.get('processing_amount', 0)/100:.2f}
- Pending Count: {result.get('pending_count', 0)}
- Completed Count: {result.get('completed_count', 0)}"""


@mcp.tool()
async def get_due_payout_stats() -> str:
    """Get statistics for payouts that are due."""
    logger.info("Getting due payout stats")
    
    result = await make_request("GET", "payouts/due_stats")
    if isinstance(result, str):
        return result
    
    return f"""📊 Due Payout Statistics:
- Total Due: ${result.get('total_amount', 0)/100:.2f}
- Due Count: {result.get('total_count', 0)}
- Next Period Due: ${result.get('next_period_amount', 0)/100:.2f}
- Overdue Amount: ${result.get('overdue_amount', 0)/100:.2f}"""


@mcp.tool()
async def get_payouts_by_promoter(status: str = "", page: str = "1", per_page: str = "20") -> str:
    """Get payouts grouped by promoter with optional status filter."""
    logger.info("Getting payouts grouped by promoter")
    
    params = {"page": page, "per_page": per_page}
    if status.strip():
        params["filters[status]"] = status
    
    result = await make_request("GET", "payouts/grouped_by_promoters", params=params)
    if isinstance(result, str):
        return result
    
    if not result:
        return "💸 No grouped payouts found"
    
    output = ["💸 Payouts by Promoter:"]
    for item in result[:20]:
        promoter = item.get("promoter", {})
        output.append(f"• {promoter.get('name', 'N/A')} ({promoter.get('email', 'N/A')}): ${item.get('total_amount', 0)/100:.2f}")
    
    return "\n".join(output)


# ==================== SERVER STARTUP ====================

if __name__ == "__main__":
    logger.info("Starting FirstPromoter MCP server...")
    
    # Check configuration
    if not FP_API_KEY:
        logger.warning("FP_API_KEY not set - API calls will fail")
    if not FP_ACCOUNT_ID:
        logger.warning("FP_ACCOUNT_ID not set - API calls will fail")
    if not MCP_AUTH_TOKEN:
        logger.warning("MCP_AUTH_TOKEN not set - server may be accessible without authentication")
    
    # Get transport mode from environment
    transport_mode = os.environ.get("MCP_TRANSPORT", "sse")
    host = os.environ.get("MCP_HOST", "0.0.0.0")
    port = int(os.environ.get("MCP_PORT", "8000"))
    
    try:
        if transport_mode == "sse":
            logger.info(f"Starting HTTP/SSE server on {host}:{port}")
            mcp.run(transport='sse', host=host, port=port)
        else:
            logger.info("Starting stdio server")
            mcp.run(transport='stdio')
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)
