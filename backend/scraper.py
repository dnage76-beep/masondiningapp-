import cloudscraper
import datetime
import traceback

LOCATION_IDS = {
    "Southside": "686ff8fb72f475652f1c0bd2",
    "Ike's": "6830a91fe001e1435750226c",
    "The Globe": "6830aa6ae001e14357502486",
}

ALLOWED_MEALS = {"Lunch", "Dinner"}

# Per-hall whitelist — only stations whose name contains one of these keywords
# (case-insensitive) will be included in the results.
HALL_STATION_WHITELIST: dict[str, set[str]] = {
    "Ike's":     {"heart of the house", "flips"},
    "Southside": {"mason manor"},
    "The Globe": {"cultural crossroads"},
}


def is_allowed_station(hall_name: str, station_name: str) -> bool:
    """Return True only if this station is on the whitelist for this hall."""
    keywords = HALL_STATION_WHITELIST.get(hall_name, set())
    lower = station_name.lower()
    return any(kw in lower for kw in keywords)


def fetch_menus() -> dict:
    """
    Fetch Lunch and Dinner menus for all three dining halls,
    returning only the highlighted protein stations per hall.
    Returns {"date": "YYYY-MM-DD", "menus": {hall: {period: [categories]}}}
    """
    scraper = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "darwin", "mobile": False}
    )
    today = datetime.date.today().strftime("%Y-%m-%d")
    results: dict = {}

    for name, loc_id in LOCATION_IDS.items():
        results[name] = {}
        try:
            periods_url = (
                f"https://apiv4.dineoncampus.com/locations/{loc_id}/periods/?date={today}"
            )
            res = scraper.get(periods_url, timeout=10)
            if res.status_code != 200:
                print(f"[scraper] Failed to get periods for {name}: HTTP {res.status_code}")
                continue

            periods = res.json().get("periods", [])

            for period in periods:
                period_name = period.get("name")
                period_id = period.get("id")

                if period_name not in ALLOWED_MEALS:
                    continue

                menu_url = (
                    f"https://apiv4.dineoncampus.com/locations/{loc_id}/menu"
                    f"?date={today}&period={period_id}"
                )
                m_res = scraper.get(menu_url, timeout=10)
                if m_res.status_code != 200:
                    continue

                # API returns: {period: {id, name, categories: [...]}}
                categories = m_res.json().get("period", {}).get("categories", [])

                kept = [
                    cat for cat in categories
                    if is_allowed_station(name, cat.get("name", ""))
                ]
                print(f"[scraper] {name}/{period_name}: {len(categories)} stations → kept {len(kept)}")
                results[name][period_name] = kept

        except Exception:
            print(f"[scraper] Error fetching {name}:")
            traceback.print_exc()

    return {"date": today, "menus": results}
