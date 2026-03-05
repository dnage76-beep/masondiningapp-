"""
recommender.py — AI-powered dining hall recommendation for student-athletes.

Uses Gemini 1.5 Flash when GEMINI_API_KEY is set, falls back to a simple
rule-based pick (hall with the most total items across all periods).
"""
import os

try:
    from google import genai
    _GENAI_AVAILABLE = True
except ImportError:
    _GENAI_AVAILABLE = False


def _summarise_menus(menus: dict) -> str:
    """Build a compact plain-text summary of the menus for the AI prompt."""
    lines = []
    for hall, periods in menus.items():
        lines.append(f"\n{hall}:")
        for period, categories in periods.items():
            lines.append(f"  {period}:")
            for cat in categories:
                items = [i.get("name", "") for i in cat.get("items", []) if i.get("name")]
                if items:
                    lines.append(f"    {cat['name']}: {', '.join(items)}")
    return "\n".join(lines)


def _fallback_recommendation(menus: dict) -> dict:
    """Pick the hall with the most total food items as a simple heuristic."""
    counts = {}
    for hall, periods in menus.items():
        total = sum(
            len(cat.get("items", []))
            for cats in periods.values()
            for cat in cats
        )
        counts[hall] = total

    best = max(counts, key=counts.get) if counts else list(menus.keys())[0]
    highlight_dishes = _pick_highlights(menus)
    return {
        "hall": best,
        "reason": (
            f"{best} has the most variety on the menu today — it's looking like the move."
        ),
        "highlight_dishes": highlight_dishes,
    }


def _pick_highlights(menus: dict) -> dict:
    """
    Per-hall highlight for the summary banner.
    Southside: last item from the Mason Manor station.
    All other halls: first item from their first available station.
    """
    highlights = {}
    for hall, periods in menus.items():
        # Collect all items from all periods' stations
        found = None
        for cats in periods.values():
            for cat in cats:
                items = [i.get("name", "").strip() for i in cat.get("items", []) if i.get("name", "").strip()]
                if not items:
                    continue
                if hall == "Southside" and cat.get("name", "").strip().lower().startswith("mason manor"):
                    # Use the last item in Mason Manor
                    found = items[-1]
                    break
                if hall != "Southside" and found is None:
                    # Use the first item from the first station
                    found = items[0]
            if found and hall == "Southside":
                break
        highlights[hall] = [found] if found else []
    return highlights


def generate_recommendation(menus: dict) -> dict:
    """
    Returns {"hall": str, "reason": str, "highlight_dishes": {hall: [dish, ...]}}
    Uses Gemini when GEMINI_API_KEY is set, otherwise falls back to rule-based.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    highlight_dishes = _pick_highlights(menus)

    if not api_key or not _GENAI_AVAILABLE:
        print("[recommender] No GEMINI_API_KEY set — using rule-based fallback.")
        result = _fallback_recommendation(menus)
        result["highlight_dishes"] = highlight_dishes
        return result

    try:
        client = genai.Client(api_key=api_key)

        menu_text = _summarise_menus(menus)
        halls = list(menus.keys())

        prompt = f"""You are a food critic and dining advisor for George Mason University students.
Below are today's menu highlights at three on-campus dining halls.
Pick the ONE dining hall that sounds the tastiest and most appealing TODAY based on
the specific dishes being served — think flavor, variety, and what you'd actually
want to eat right now.

Today's Menus:
{menu_text}

Respond with ONLY a JSON object in this exact format (no markdown, no extra text):
{{"hall": "<one of: {', '.join(halls)}>", "reason": "<1-2 punchy sentences about what sounds delicious there and why it's the move today>"}}"""

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
        )
        text = response.text.strip()

        # Strip any accidental markdown code fences
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        import json
        result = json.loads(text)
        if result.get("hall") not in halls:
            result["hall"] = halls[0]
        result["highlight_dishes"] = highlight_dishes
        return result

    except Exception as e:
        print(f"[recommender] Gemini error: {e} — falling back to rule-based.")
        result = _fallback_recommendation(menus)
        result["highlight_dishes"] = highlight_dishes
        return result


def generate_email_body(menus: dict, recommendation: dict, date: str) -> str:
    """Generate a full AI-written HTML email body for the daily digest."""
    api_key = os.environ.get("GEMINI_API_KEY", "")

    if not api_key or not _GENAI_AVAILABLE:
        return _fallback_email_html(menus, recommendation, date)

    try:
        client = genai.Client(api_key=api_key)

        menu_text = _summarise_menus(menus)
        rec_hall = recommendation.get("hall", "")
        rec_reason = recommendation.get("reason", "")

        prompt = f"""Write a short, energetic daily dining email for a George Mason University student-athlete.
Today is {date}.

Highlighted dining options (protein stations only):
{menu_text}

The Move Today (best hall): {rec_hall}
Why: {rec_reason}

Rules:
- Use relevant food/sports emojis throughout (e.g. 🍗 🍽️ 💪 🔥 ⚡ ✅)
- Call the recommendation '🔥 The Move Today' not 'recommended'
- Write the email as clean HTML (body content only — no <html>/<head>/<body> tags)
- Use inline styles. Keep it under 280 words.
- Be hype, motivating, and athlete-focused
- End with The Move Today prominently highlighted in a styled box"""

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
        )
        return response.text.strip()

    except Exception as e:
        print(f"[recommender] Email generation error: {e} — using fallback.")
        return _fallback_email_html(menus, recommendation, date)


def _fallback_email_html(menus: dict, recommendation: dict, date: str) -> str:
    """Simple formatted HTML email body when Gemini is unavailable."""
    rec_hall = recommendation.get("hall", "")
    rec_reason = recommendation.get("reason", "")

    parts = [
        f"<h2 style='font-family:sans-serif;color:#1e293b'>🍽️ GMU Dining Highlights — {date}</h2>",
        "<p style='font-family:sans-serif;color:#475569'>Here are today's protein highlights. Fuel up, Patriot! 💪</p>",
    ]
    for hall, periods in menus.items():
        is_rec = hall == rec_hall
        border = "2px solid #eab308" if is_rec else "1px solid #e2e8f0"
        parts.append(
            f"<div style='font-family:sans-serif;margin:16px 0;padding:14px;border:{border};border-radius:10px'>"
        )
        hall_label = f"🔥 {hall} — The Move Today!" if is_rec else f"🏛️ {hall}"
        parts.append(f"<h3 style='margin:0 0 10px;color:#1e293b'>{hall_label}</h3>")
        for period_name, categories in periods.items():
            icon = "☀️" if period_name == "Lunch" else "🌙"
            items_html = []
            for cat in categories:
                foods = [i.get("name", "") for i in cat.get("items", []) if i.get("name")]
                if foods:
                    items_html.append(
                        f"<li><b>{cat['name']}:</b> {', '.join(foods)}</li>"
                    )
            if items_html:
                parts.append(
                    f"<h4 style='margin:8px 0 4px;color:#475569'>{icon} {period_name}</h4>"
                    f"<ul style='margin:0;padding-left:20px;color:#1e293b'>{''.join(items_html)}</ul>"
                )
        parts.append("</div>")

    if rec_hall and rec_reason:
        parts.append(
            f"<div style='font-family:sans-serif;background:#fef9c3;border:2px solid #eab308;"
            f"padding:16px;border-radius:10px;margin-top:20px'>"
            f"<h3 style='margin:0 0 8px;color:#92400e'>🔥 The Move Today: {rec_hall}</h3>"
            f"<p style='margin:0;color:#78350f'>{rec_reason}</p>"
            f"</div>"
        )

    parts.append("<p style='font-family:sans-serif;color:#94a3b8;font-size:12px;margin-top:20px'>")
    parts.append("Sent by your GMU Patriot Dining Tracker ⚡</p>")
    return "\n".join(parts)
