"""
mailer.py — sends the daily dining digest via Gmail SMTP.

Required environment variables:
    GMAIL_USER        — your Gmail address (e.g. yourname@gmail.com)
    GMAIL_APP_PASSWORD — 16-char Google App Password (NOT your regular password)
                         Get one at: myaccount.google.com/apppasswords

Optional:
    FROM_EMAIL        — display name/address (defaults to GMAIL_USER)
"""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from scraper import fetch_menus


GMAIL_USER = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")


def send_daily_email(emails: list, data: dict | None = None) -> None:
    """Fetch menus (if not provided) and send to every address in `emails`."""
    if not emails:
        print("[mailer] No recipients — skipping.")
        return

    if data is None:
        print("[mailer] Fetching menus...")
        data = fetch_menus()

    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("[mailer] GMAIL_USER / GMAIL_APP_PASSWORD not set — cannot send.")
        return

    from recommender import generate_recommendation, generate_email_body
    recommendation = generate_recommendation(data["menus"])
    html_body = generate_email_body(data["menus"], recommendation, data["date"])

    subject = f"⭐ GMU Dining Pick — {data['date']}"
    full_html = f"<html><body>{html_body}</body></html>"

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            for address in emails:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = GMAIL_USER
                msg["To"] = address
                msg.attach(MIMEText(full_html, "html"))
                smtp.sendmail(GMAIL_USER, address, msg.as_string())
                print(f"[mailer] Sent to {address}")
    except Exception as e:
        print(f"[mailer] Failed to send email: {e}")
        raise
