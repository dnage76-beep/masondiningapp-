"""
cron_job.py — run this once to schedule the 7 AM EST daily digest indefinitely.
It loads credentials from backend/.env automatically.

Usage:
    cd backend && python cron_job.py
"""
import os
import sys
import time
import schedule
from dotenv import load_dotenv

# Load .env so GMAIL_USER / GMAIL_APP_PASSWORD are available
load_dotenv()

from app import get_emails
from mailer import send_daily_email


def job() -> None:
    print("[cron] ⏰ Running daily email job...")
    emails = get_emails()
    if not emails:
        print("[cron] Mailing list is empty — skipping.")
        return
    send_daily_email(emails)
    print(f"[cron] ✅ Done — sent to {len(emails)} recipient(s).")


# Schedule at 07:00 Eastern time.
# The launchd plist sets TZ=America/New_York before launching this script,
# so "07:00" here always means 7 AM ET regardless of the machine's local timezone.
schedule.every().day.at("07:00").do(job)
print("[cron] ✅ Scheduled daily digest at 07:00 ET. Press Ctrl-C to stop.")

if __name__ == "__main__":
    while True:
        schedule.run_pending()
        time.sleep(30)
