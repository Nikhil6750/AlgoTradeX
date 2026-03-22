import os
import json
import datetime
import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Any

from backend.sentiment.vader_model import get_vader_sentiment
from backend.sentiment.finbert_model import get_finbert_sentiment

CACHE_FILE = os.path.join(os.path.dirname(__file__), "calendar_cache.json")

def scrape_investing_calendar() -> List[Dict[str, Any]]:
    """Scrapes today's economic calendar from Investing.com."""
    url = "https://in.investing.com/economic-calendar"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Language": "en-US,en;q=0.9"
    }

    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200:
            print("Skipping calendar fetch due to block")
            return []
        resp.raise_for_status()
    except Exception as e:
        print(f"Failed to fetch Investing.com calendar: {e}")
        return _get_mock_events()

    soup = BeautifulSoup(resp.text, 'html.parser')
    table = soup.find('table', id='economicCalendarData')
    
    if not table:
        print("Could not find economicCalendarData table.")
        return _get_mock_events()

    events = []
    tbody = table.find('tbody')
    if not tbody:
        return _get_mock_events()

    today_str = datetime.datetime.now().strftime("%Y-%m-%d")

    for row in tbody.find_all('tr', class_='js-event-item'):
        try:
            time_td = row.find('td', class_='time')
            time_str = time_td.text.strip() if time_td else "00:00"

            currency_td = row.find('td', class_='flagCur')
            currency_str = currency_td.text.strip() if currency_td else "USD"

            event_td = row.find('td', class_='event')
            event_str = event_td.text.strip() if event_td else ""

            sentiment_td = row.find('td', class_='sentiment')
            impact_str = "Low"
            if sentiment_td:
                bulls = sentiment_td.find_all('i', class_='grayFullBullishIcon')
                if len(bulls) == 3:
                    impact_str = "High"
                elif len(bulls) == 2:
                    impact_str = "Medium"

            actual_td = row.find('td', class_='act')
            actual_str = actual_td.text.strip() if actual_td and actual_td.text.strip() else "-"

            forecast_td = row.find('td', class_='fore')
            forecast_str = forecast_td.text.strip() if forecast_td and forecast_td.text.strip() else "-"

            prev_td = row.find('td', class_='prev')
            prev_str = prev_td.text.strip() if prev_td and prev_td.text.strip() else "-"

            events.append({
                "date": today_str,
                "time": time_str,
                "currency": currency_str,
                "event": event_str,
                "impact": impact_str,
                "actual": actual_str,
                "forecast": forecast_str,
                "previous": prev_str
            })
        except Exception as e:
            print(f"Error parsing row: {e}")
            continue

    if not events:
        return _get_mock_events()

    return events

def _get_mock_events() -> List[Dict[str, Any]]:
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    return [
        {
            "date": today,
            "time": "12:30",
            "currency": "USD",
            "event": "CPI Inflation Rate",
            "impact": "High",
            "actual": "3.4%",
            "forecast": "3.2%",
            "previous": "3.1%"
        },
        {
            "date": today,
            "time": "14:00",
            "currency": "USD",
            "event": "Federal Reserve Interest Rate Decision",
            "impact": "High",
            "actual": "5.50%",
            "forecast": "5.50%",
            "previous": "5.50%"
        },
        {
            "date": today,
            "time": "15:30",
            "currency": "USD",
            "event": "GDP Growth Rate",
            "impact": "Medium",
            "actual": "2.1%",
            "forecast": "2.1%",
            "previous": "2.0%"
        }
    ]

def update_calendar_cache():
    """Checks date and updates cache if necessary, scoring sentiment once."""
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                data = json.load(f)
                if data.get("date") == today_str and data.get("events"):
                    print("Calendar cache is up to date.")
                    return
        except Exception as e:
            print(f"Error reading cache: {e}")

    print("Scraping new economic events for today...")
    events = scrape_investing_calendar()
    
    # Calculate sentiment once
    for event in events:
        text = event.get("event", "")
        vader_score = get_vader_sentiment(text)
        finbert_score = get_finbert_sentiment(text)
        
        vader_val = vader_score["compound"] if isinstance(vader_score, dict) else vader_score
        finbert_val = finbert_score["score"] if isinstance(finbert_score, dict) else finbert_score
        
        event["sentiment"] = round((vader_val + finbert_val) / 2, 4)
        
    cache_data = {
        "date": today_str,
        "events": events
    }
    
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(cache_data, f, indent=2)
        print("Calendar cache updated successfully.")
    except Exception as e:
        print(f"Failed to write calendar cache: {e}")

