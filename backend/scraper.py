from curl_cffi import requests
import datetime
import traceback
from zoneinfo import ZoneInfo

LOCATION_IDS = {
    "Southside": "686ff8fb72f475652f1c0bd2",
    "Ike's": "6830a91fe001e1435750226c",
    "The Globe": "6830aa6ae001e14357502486",
}

ALLOWED_MEALS = {"Breakfast", "Brunch", "Lunch", "Dinner", "Late Night"}
# The Oracle host is blocked by DineOnCampus. This endpoint runs on Vercel Edge, which is not.
FALLBACK_MENU_URL = "https://masondiningapp.vercel.app/api/menus"

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
    today = datetime.datetime.now(ZoneInfo("America/New_York")).date().isoformat()
    results = {}
    errors = []

    for name, loc_id in LOCATION_IDS.items():
        results[name] = {}
        try:
            periods_url = (
                f"https://apiv4.dineoncampus.com/locations/{loc_id}/periods"
                f"?platform=0&date={today}"
            )
            res = requests.get(periods_url, impersonate="chrome110", timeout=15)
            if res.status_code != 200:
                errors.append(f"{name} periods HTTP {res.status_code}")
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
                    errors.append(f"{name} {period_name} HTTP {m_res.status_code}")
                    continue

                # API returns: {period: {id, name, categories: [...]}}
                categories = m_res.json().get("period", {}).get("categories", [])

                kept = [
                    cat for cat in categories
                    if is_allowed_station(name, cat.get("name", ""))
                    and cat.get("items")
                ]
                print(f"[scraper] {name}/{period_name}: {len(categories)} stations → kept {len(kept)}")
                results[name].update({period_name: kept})

        except Exception as exc:
            errors.append(f"{name}: {exc.__class__.__name__}")
            print(f"[scraper] Error fetching {name}:")
            traceback.print_exc()

    # curl_cffi from a residential IP currently gets a decoy menu (national-brand
    # items filed under dining-hall stations). Datacenter IPs get HTTP 403.
    # The Vercel Edge function receives the real menu.
    if _item_count(results) == 0 or _looks_decoy(results):
        fallback = _fetch_fallback(today)
        if fallback:
            print("[scraper] used Vercel edge menu fallback")
            return fallback

    return {"date": today, "menus": results, "errors": errors}


_DECOY_MARKERS = (
    "chick-fil-a",
    "frappuccino",
    "pike place",
    "starbucks",
    "icedream",
    "grande",
    "macchiato",
    "waffle potato",
)


def _looks_decoy(results: dict) -> bool:
    names = []
    for periods in results.values():
        for stations in periods.values():
            for station in stations:
                for item in station.get("items") or []:
                    names.append((item.get("name") or "").lower())
    if len(names) < 8:
        return False
    hits = sum(any(marker in name for marker in _DECOY_MARKERS) for name in names)
    return hits / len(names) > 0.25


def _item_count(results: dict) -> int:
    total = 0
    for periods in results.values():
        for stations in periods.values():
            for station in stations:
                total += len(station.get("items") or [])
    return total


def _fetch_fallback(today: str) -> dict | None:
    try:
        res = requests.get(FALLBACK_MENU_URL, timeout=25)
    except Exception:
        print("[scraper] Vercel fallback request failed")
        traceback.print_exc()
        return None
    if res.status_code != 200:
        print(f"[scraper] Vercel fallback HTTP {res.status_code}")
        return None
    data = res.json()
    menus = data.get("menus") or {}
    if _item_count(menus) == 0:
        return None
    return {"date": data.get("date") or today, "menus": menus, "errors": []}
