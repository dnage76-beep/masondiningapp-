"""
app.py — GMU Patriot Dining Tracker backend.

Environment variables (loaded from .env):
    GMAIL_USER          — Gmail address to send from
    GMAIL_APP_PASSWORD  — 16-char Google App Password
    GEMINI_API_KEY      — (optional) Enables AI recommendation & email copy
    ALLOWED_ORIGIN      — (optional) Production frontend URL for CORS
                          e.g. https://your-app.vercel.app
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import time
from dotenv import load_dotenv

load_dotenv()

from scraper import fetch_menus
from recommender import generate_recommendation

# ── Menu cache (scrape once per day) ─────────────────────────────────────────
_menu_cache = {"data": None, "date": None}

def get_menus_cached():
    from datetime import date
    today = date.today().isoformat()
    if _menu_cache["data"] and _menu_cache["date"] == today:
        return _menu_cache["data"]
    data = fetch_menus()
    _menu_cache["data"] = data
    _menu_cache["date"] = today
    return data

# ── App setup ────────────────────────────────────────────────────────────────

app = Flask(__name__)

# Allow both local dev and the deployed Vercel frontend
_allowed_origins = ["http://localhost:5173", "http://localhost:4173"]
_prod_origin = os.environ.get("ALLOWED_ORIGIN", "")
if _prod_origin:
    _allowed_origins.append(_prod_origin)

CORS(app, origins=_allowed_origins)

EMAILS_FILE = os.environ.get(
    "EMAILS_FILE", os.path.join(os.path.dirname(__file__), "emails.json")
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_emails() -> list:
    if not os.path.exists(EMAILS_FILE):
        return []
    try:
        with open(EMAILS_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def save_emails(emails: list) -> None:
    with open(EMAILS_FILE, "w") as f:
        json.dump(emails, f, indent=2)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/menus", methods=["GET"])
def api_menus():
    try:
        data = get_menus_cached()
        response_data = {
            "date": data.get("date"),
            "menus": data.get("menus", {}),
            "errors": data.get("errors", []),
        }
        response_data["recommendation"] = generate_recommendation(data.get("menus", {}))
        return jsonify(response_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mailing-list", methods=["GET"])
def api_get_emails():
    return jsonify({"emails": get_emails()})


@app.route("/api/mailing-list", methods=["POST"])
def api_add_email():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return jsonify({"error": "Invalid email address"}), 400

    emails = get_emails()
    if email not in emails:
        emails.append(email)
        save_emails(emails)

    return jsonify({"success": True, "emails": emails})


@app.route("/api/mailing-list/<path:email>", methods=["DELETE"])
def api_remove_email(email: str):
    emails = get_emails()
    email = email.lower()
    if email in emails:
        emails.remove(email)
        save_emails(emails)
    return jsonify({"success": True, "emails": emails})


@app.route("/api/send-test-email", methods=["POST"])
def api_send_test_email():
    """Fetch today's menus, generate an AI email, and deliver to the mailing list."""
    import mailer as m_module

    gmail_user = os.environ.get("GMAIL_USER", "")
    gmail_pass = os.environ.get("GMAIL_APP_PASSWORD", "")

    if not gmail_user or not gmail_pass:
        return jsonify({
            "error": (
                "Gmail credentials not configured. "
                "Add GMAIL_USER and GMAIL_APP_PASSWORD to your .env file."
            )
        }), 400

    emails = get_emails()
    if not emails:
        return jsonify({"error": "Mailing list is empty — add emails first."}), 400

    try:
        data = get_menus_cached()
        recommendation = generate_recommendation(data["menus"])
        m_module.send_daily_email(emails, data)
        return jsonify({
            "success": True,
            "sent_to": emails,
            "recommendation": recommendation,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    """Health-check endpoint for Railway/Render uptime monitoring."""
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    app.run(port=5001, debug=True)
