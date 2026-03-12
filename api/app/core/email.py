"""Transactional email service using Resend HTTP API."""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send a transactional email via Resend. Returns True on success."""
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured — email to %s not sent", to)
        return False

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.FROM_EMAIL,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
                timeout=10.0,
            )
            if resp.status_code >= 400:
                logger.error("Resend API error %d: %s", resp.status_code, resp.text)
                return False
            return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False


async def send_cli_verify_email(email: str, device_code: str, token: str) -> bool:
    """Send the CLI verification email with a one-click link."""
    verify_url = f"{settings.DASHBOARD_URL}/auth/cli-verify?device_code={device_code}&token={token}"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #e4e4e7; margin-bottom: 8px;">Vibariant CLI Login</h2>
      <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6;">
        Click the button below to authenticate the Vibariant CLI on your machine.
        This link expires in 2 hours.
      </p>
      <a href="{verify_url}"
         style="display: inline-block; margin: 24px 0; padding: 12px 32px;
                background: #7c3aed; color: #fff; text-decoration: none;
                border-radius: 8px; font-weight: 600; font-size: 14px;">
        Verify CLI Login
      </a>
      <p style="color: #71717a; font-size: 12px; line-height: 1.5;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    """

    return await send_email(email, "Verify your Vibariant CLI login", html)


async def send_magic_link_email(email: str, token: str) -> bool:
    """Send a magic link email for dashboard login."""
    verify_url = f"{settings.DASHBOARD_URL}/auth/verify?token={token}"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #e4e4e7; margin-bottom: 8px;">Sign in to Vibariant</h2>
      <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6;">
        Click the button below to sign in. This link expires in 15 minutes.
      </p>
      <a href="{verify_url}"
         style="display: inline-block; margin: 24px 0; padding: 12px 32px;
                background: #7c3aed; color: #fff; text-decoration: none;
                border-radius: 8px; font-weight: 600; font-size: 14px;">
        Sign In
      </a>
      <p style="color: #71717a; font-size: 12px; line-height: 1.5;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    """

    return await send_email(email, "Sign in to Vibariant", html)
