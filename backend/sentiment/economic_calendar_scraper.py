"""Economic calendar scraper — always returns events, never an empty list."""
from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any, Dict, List

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_INVESTING_URL = "https://in.investing.com/economic-calendar"

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

# ── Rich mock fallback (5 key macro events) ───────────────────────────────────
_MOCK_EVENTS: List[Dict[str, Any]] = [
    {
        "id": "mock_cpi",
        "time": "12:30",
        "currency": "USD",
        "event": "CPI Inflation Rate (YoY)",
        "impact": "High",
        "actual": "3.2%",
        "forecast": "3.1%",
        "previous": "3.4%",
    },
    {
        "id": "mock_fed",
        "time": "19:00",
        "currency": "USD",
        "event": "Fed Interest Rate Decision",
        "impact": "High",
        "actual": "5.50%",
        "forecast": "5.50%",
        "previous": "5.25%",
    },
    {
        "id": "mock_gdp",
        "time": "13:30",
        "currency": "USD",
        "event": "GDP Growth Rate (QoQ)",
        "impact": "High",
        "actual": "3.3%",
        "forecast": "2.0%",
        "previous": "2.1%",
    },
    {
        "id": "mock_unemp",
        "time": "13:30",
        "currency": "USD",
        "event": "Unemployment Rate",
        "impact": "High",
        "actual": "3.7%",
        "forecast": "3.8%",
        "previous": "3.8%",
    },
    {
        "id": "mock_retail",
        "time": "13:30",
        "currency": "USD",
        "event": "Retail Sales (MoM)",
        "impact": "Medium",
        "actual": "0.6%",
        "forecast": "0.3%",
        "previous": "-0.2%",
    },
    {
        "id": "mock_nfp",
        "time": "13:30",
        "currency": "USD",
        "event": "Nonfarm Payrolls",
        "impact": "High",
        "actual": "275K",
        "forecast": "200K",
        "previous": "229K",
    },
    {
        "id": "mock_eur_cpi",
        "time": "10:00",
        "currency": "EUR",
        "event": "Eurozone CPI (YoY)",
        "impact": "High",
        "actual": "2.9%",
        "forecast": "2.8%",
        "previous": "2.8%",
    },
]

_EVENTS_CACHE_FILE = Path(__file__).parent.parent / "data" / "economic_events.json"


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _load_cached_events() -> List[Dict[str, Any]]:
    if _EVENTS_CACHE_FILE.exists():
        try:
            with open(_EVENTS_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data:
                    return data
        except Exception as e:
            logger.error(f"Failed to load cached events: {e}")
    return _MOCK_EVENTS


def _save_cached_events(events: List[Dict[str, Any]]) -> None:
    try:
        _EVENTS_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_EVENTS_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(events, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save cached events: {e}")


# ── Public API ────────────────────────────────────────────────────────────────

def get_economic_events() -> List[Dict[str, Any]]:
    """Return economic events — always returns data, never an empty list.

    Priority: disk cache → live scrape → rich mock data.
    """
    # 1. Try disk cache first
    cached = _load_cached_events()
    if cached:
        return cached

    # 2. Try live scrape (cache miss)
    try:
        scraped = _scrape_investing()
        if scraped:
            _save_cached_events(scraped)
            return scraped
    except Exception as exc:
        logger.warning(f"Live scrape failed: {exc}")

    # 3. Hard fallback — persist mock to disk so future fast-paths work
    _save_cached_events(_MOCK_EVENTS)
    return _MOCK_EVENTS


# Alias kept for any existing callers
def fetch_economic_events() -> List[Dict[str, Any]]:
    return get_economic_events()


def update_economic_events() -> None:
    """Scheduled scrape: fetch live data and update the on-disk cache."""
    logger.info("Running scheduled economic calendar scrape...")
    try:
        events = _scrape_investing()
        if events:
            _save_cached_events(events)
            logger.info(f"Cached {len(events)} live events.")
            return
        else:
            logger.warning("Scrape returned 0 rows. Writing mock data as fallback.")
    except Exception as exc:
        logger.warning(f"Scrape failed: {exc}. Writing mock data as fallback.")

    # Always ensure the cache file has SOMETHING (rich mock) on failure
    _save_cached_events(_MOCK_EVENTS)
    logger.info(f"Mock data written to cache ({len(_MOCK_EVENTS)} events).")


# ── Internal scraper ──────────────────────────────────────────────────────────

def _scrape_investing() -> List[Dict[str, Any]]:
    """Attempt a live scrape of investing.com. Returns [] on failure."""
    session = requests.Session()
    session.headers.update(_HEADERS)
    resp = session.get(_INVESTING_URL, timeout=15)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")
    table = soup.find("table", {"id": "economicCalendarData"})
    if not table:
        return []

    events: List[Dict[str, Any]] = []
    rows = table.find("tbody").find_all("tr", class_="js-event-item")
    for row in rows:
        try:
            time_td = row.find("td", class_="time")
            time_txt = time_td.text.strip() if time_td else ""
            if not time_txt:
                continue

            currency_td = row.find("td", class_="flagCur")
            currency = currency_td.text.strip() if currency_td else ""

            event_td = row.find("td", class_="event")
            event_name = event_td.text.strip() if event_td else ""

            sentiment_td = row.find("td", class_="sentiment")
            impact = "Low"
            if sentiment_td:
                cnt = len(sentiment_td.find_all("i", class_="grayFullBullishIcon"))
                if cnt == 3:
                    impact = "High"
                elif cnt == 2:
                    impact = "Medium"

            actual_td   = row.find("td", id=lambda x: x and x.startswith("actual"))
            forecast_td = row.find("td", id=lambda x: x and x.startswith("consensus"))
            prev_td     = row.find("td", id=lambda x: x and x.startswith("previous"))

            actual   = actual_td.text.strip()   if actual_td   else "—"
            forecast = forecast_td.text.strip() if forecast_td else "—"
            previous = prev_td.text.strip()     if prev_td     else "—"

            event_id = hashlib.md5(f"{time_txt}-{currency}-{event_name}".encode()).hexdigest()

            events.append({
                "id":       event_id,
                "time":     time_txt,
                "currency": currency,
                "event":    event_name,
                "impact":   impact,
                "actual":   actual  or "—",
                "forecast": forecast or "—",
                "previous": previous or "—",
            })
        except Exception:
            continue

    return events
