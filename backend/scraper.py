from curl_cffi import requests
import datetime
import traceback

LOCATION_IDS = {
    "Southside": "686ff8fb72f475652f1c0bd2",
    "Ike's": "6830a91fe001e1435750226c",
    "The Globe": "6830aa6ae001e14357502486",
}

ALLOWED_MEALS = {"Lunch", "Dinner"}

# Per-hall whitelist -- only stations whose name contains one of these keywords
# (case-insensitive) will be included in the results.
HALL_STATION_WHITELIST: dict[str, set[str]] = {
    "Ike's":     {"heart of the house", "flips", "soup bowl", "united table"},
    "Southside": {"mason manor", "patriot pit", "soup bowl"},
    "The Globe": {"cultural crossroads", "soup"},
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
    Returns {"date": "YYYY-MM-DD", "menus": {hall: {period: [categories]}}, "errors": []}
    """
    today = datetime.date.today().strftime("%Y-%m-%d")
    results = {}
    errors = []

    for name, loc_id in LOCATION_IDS.items():
        results[name] = {}
        try:
            periods_url = (
                f"https://apiv4.dineoncampus.com/locations/{loc_id}/periods/?date={today}"
            )
            res = requests.get(periods_url, impersonate="chrome110", timeout=15)
            if res.status_code != 200:
                errors.append(f"{name} periods HTTP {res.status_code}: {res.text[:100]}")
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
                m_res = requests.get(menu_url, impersonate="chrome110", timeout=15)
                if m_res.status_code != 200:
                    continue

                # API returns: {period: {id, name, categories: [...]}}
                categories = m_res.json().get("period", {}).get("categories", [])

                kept = [
                    cat for cat in categories
                    if is_allowed_station(name, cat.get("name", ""))
                ]
                print(f"[scraper] {name}/{period_name}: {len(categories)} stations → kept {len(kept)}")
                results[name].update({period_name: kept})

        except Exception:
            print(f"[scraper] Error fetching {name}:")
            traceback.print_exc()

    return {"date": today, "menus": results}
