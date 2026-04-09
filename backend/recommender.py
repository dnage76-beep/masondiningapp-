"""
recommender.py — dining hall recommendation + daily email generation.

Uses Gemini 1.5 Flash when GEMINI_API_KEY is set, falls back to a simple
rule-based pick (hall with the most total items across all periods).
"""
import os

try:
    from google import genai
    _GENAI_AVAILABLE = True
except ImportError:
    _GENAI_AVAILABLE = False

# Items to filter out of emails (condiments, garnishes, filler)
_BORING = {
    'lettuce leaf', 'sliced tomatoes', 'dill pickle slices', 'sliced red onion',
    'carved entree', 'sour cream', 'shredded cheddar cheese', 'mild picante salsa',
    'ketchup', 'mustard', 'mayonnaise', 'hot sauce', 'yellow mustard',
    'sweet thai chili sauce', 'sriracha', 'soy sauce', 'hoisin sauce',
    'ranch dressing', 'blue cheese dressing', 'italian dressing',
    'butter', 'margarine', 'cream cheese', 'jelly',
    'salt', 'pepper', 'lemon wedge', 'tartar sauce',
    'crackers, saltine, 2 ct, zesta', 'crushed red pepper', 'dried oregano',
    'grated parmesan cheese', 'whole grain mustard',
    'sliced jalapeno', 'chopped spinach', 'chopped tomatoes', 'diced onions',
    'sliced mushrooms', 'chopped green bell pepper', 'shredded sharp cheddar cheese',
    'diced smoked ham', 'diced turkey breast', 'chicken sausage patty',
    'pork bacon', 'chipotle salsa', 'eggs', 'egg whites',
    'gluten free soy sauce', 'mr. bing chili crisp mild', 'sesame oil',
    'chopped green onions', 'garlic ginger aromatics',
    'julienne yellow onions', 'shredded green cabbage',
    'red and green bell peppers', 'shredded carrots',
    'fresh cilantro', '6" flour tortilla', 'pico de gallo',
    'guacamole', 'salsa verde', 'salsa fresca',
    'white pita bread', 'dinner roll', 'bread sticks', 'breadsticks',
    'barbecue sauce', 'cole slaw', 'vinegar coleslaw',
    'shredded iceberg lettuce', 'tomato salsa',
}

_STATION_RENAMES = {
    'cultural crossroads-performance circle': 'Cultural Crossroads',
    'the soup bowl': 'Soup',
    'heart of the house': 'Entrees',
    'united table': 'Stir-Fry Bar',
    'mason manor': 'Entrees',
    'patriot pit': 'Grill',
    'soup': 'Soup',
}


def _clean_station_name(name: str):
    lower = name.lower().strip()
    if lower.startswith('rooted'):
        return None
    return _STATION_RENAMES.get(lower, name)


def _filter_foods(items: list) -> list:
    """Return non-boring food names from a station's item list."""
    return [
        i.get("name", "").strip()
        for i in items
        if i.get("name", "").strip()
        and i["name"].strip().lower() not in _BORING
        and i["name"].strip().lower().lstrip() not in _BORING
    ]


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

    best = max(counts, key=lambda k: counts[k]) if counts else list(menus.keys())[0]
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
    """Generate a full HTML email body for the daily digest."""
    api_key = os.environ.get("GEMINI_API_KEY", "")

    if not api_key or not _GENAI_AVAILABLE:
        return _build_email_html(menus, recommendation, date)

    try:
        client = genai.Client(api_key=api_key)

        # Build a cleaned summary (no condiments) for the AI
        lines = []
        for hall, periods in menus.items():
            lines.append(f"\n{hall}:")
            for period, cats in periods.items():
                lines.append(f"  {period}:")
                for cat in cats:
                    sname = _clean_station_name(cat.get("name", ""))
                    if sname is None:
                        continue
                    foods = _filter_foods(cat.get("items", []))
                    if foods:
                        lines.append(f"    {sname}: {', '.join(foods)}")
        menu_text = "\n".join(lines)

        rec_hall = recommendation.get("hall", "")
        rec_reason = recommendation.get("reason", "")

        prompt = f"""Write a short daily dining email for George Mason University students.
Today is {date}.

Today's menus (condiments already filtered out):
{menu_text}

The Move Today (best hall): {rec_hall}
Why: {rec_reason}

Rules:
- Casual college student tone, not corporate or athlete-focused
- Keep it short -- just the highlights, not every single item
- Write as clean HTML (body content only, no <html>/<head>/<body> tags)
- Use inline styles, dark background (#111) with white/light text
- Include a highlighted "The Move Today" box at the end
- Add an unsubscribe link at the bottom: <a href="https://masondiningapp.vercel.app">Manage preferences</a>
- Under 200 words total"""

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
        )
        return response.text.strip()

    except Exception as e:
        print(f"[recommender] Email generation error: {e} — using fallback.")
        return _build_email_html(menus, recommendation, date)


def _build_email_html(menus: dict, recommendation: dict, date: str) -> str:
    """Clean HTML email with filtered items and renamed stations."""
    rec_hall = recommendation.get("hall", "")
    rec_reason = recommendation.get("reason", "")

    # Format date nicely
    try:
        from datetime import datetime
        d = datetime.strptime(date, "%Y-%m-%d")
        nice_date = d.strftime("%A, %B %-d")
    except Exception:
        nice_date = date

    s = "font-family: -apple-system, 'Segoe UI', sans-serif;"

    parts = [
        f"<div style='{s} max-width:560px; margin:0 auto; background:#111; color:#e5e5e5; padding:24px; border-radius:12px'>",
        f"<h2 style='margin:0 0 4px; font-size:18px; color:#fff'>GMU Dining -- {nice_date}</h2>",
        f"<p style='margin:0 0 16px; font-size:13px; color:#999'>Today's menu highlights</p>",
    ]

    for hall, periods in menus.items():
        is_rec = hall == rec_hall
        border = "1px solid #3a3a3a"
        bg = "#1a1a1a"
        if is_rec:
            border = "1px solid #eab308"
            bg = "#1c1a10"

        parts.append(f"<div style='background:{bg}; border:{border}; border-radius:8px; padding:12px 14px; margin-bottom:10px'>")

        label = f"{hall}" if not is_rec else f"{hall} -- The Move Today"
        color = "#fff" if not is_rec else "#eab308"
        parts.append(f"<h3 style='margin:0 0 8px; font-size:15px; color:{color}'>{label}</h3>")

        for period_name, categories in periods.items():
            station_blocks = []
            for cat in categories:
                sname = _clean_station_name(cat.get("name", ""))
                if sname is None:
                    continue
                foods = _filter_foods(cat.get("items", []))
                if not foods:
                    continue
                food_str = ", ".join(foods)
                station_blocks.append(
                    f"<div style='margin-bottom:6px'>"
                    f"<span style='font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#666'>{sname}</span><br>"
                    f"<span style='font-size:13px; color:#ccc'>{food_str}</span>"
                    f"</div>"
                )

            if station_blocks:
                period_icon = "Lunch" if period_name == "Lunch" else "Dinner"
                if period_name == "Breakfast":
                    period_icon = "Breakfast"
                parts.append(
                    f"<div style='margin-bottom:8px'>"
                    f"<div style='font-size:11px; color:#666; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px'>{period_icon}</div>"
                    f"{''.join(station_blocks)}"
                    f"</div>"
                )

        parts.append("</div>")

    # Recommendation box
    if rec_hall and rec_reason:
        parts.append(
            f"<div style='background:#1c1a10; border:1px solid #eab308; border-radius:8px; padding:12px 14px; margin-top:6px'>"
            f"<div style='font-size:13px; font-weight:700; color:#eab308; margin-bottom:4px'>The Move Today: {rec_hall}</div>"
            f"<div style='font-size:13px; color:#ccc'>{rec_reason}</div>"
            f"</div>"
        )

    # Footer with unsubscribe
    parts.append(
        f"<div style='margin-top:20px; padding-top:12px; border-top:1px solid #2a2a2a; font-size:11px; color:#555'>"
        f"Sent by <a href='https://masondiningapp.vercel.app' style='color:#666; text-decoration:none'>GMU Dining App</a>"
        f" &middot; <a href='https://masondiningapp.vercel.app' style='color:#666; text-decoration:none'>Unsubscribe</a>"
        f"</div>"
    )

    parts.append("</div>")
    return "\n".join(parts)
