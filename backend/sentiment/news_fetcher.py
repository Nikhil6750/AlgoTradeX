import os
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load .env so NEWS_API_KEY is available when running via uvicorn
load_dotenv()

_MOCK_NEWS = [
    {
        "time": "2026-03-17T06:00:00Z",
        "source": "Financial Times",
        "headline": "US inflation rises unexpectedly, Federal Reserve under pressure",
        "description": "Consumer prices climbed more than expected in February, complicating the Federal Reserve's path toward interest rate cuts.",
        "url": "https://ft.com"
    },
    {
        "time": "2026-03-17T07:00:00Z",
        "source": "WSJ",
        "headline": "Federal Reserve signals possible rate cuts later in 2024",
        "description": "Fed officials project three rate cuts this year but warn inflation progress must continue before easing begins.",
        "url": "https://wsj.com"
    },
    {
        "time": "2026-03-17T08:00:00Z",
        "source": "Bloomberg",
        "headline": "Tech stocks rally after strong earnings season",
        "description": "Major technology companies beat earnings estimates, driving the Nasdaq to its highest level since early 2022.",
        "url": "https://bloomberg.com"
    },
]

def fetch_financial_news() -> List[Dict[str, Any]]:
    """Fetch 30-50 real financial news articles from NewsAPI.
    Returns mock data only if the API call completely fails.
    """
    api_key = os.environ.get("NEWS_API_KEY", "").strip()

    if not api_key or api_key == "your_api_key_here":
        print("NEWS_API_KEY not set — returning mock news. Set a real key in backend/.env")
        return _MOCK_NEWS

    try:
        params = {
            "q": "forex OR inflation OR interest rates OR stock market OR federal reserve",
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 50,
            "apiKey": api_key,
        }
        resp = requests.get(
            "https://newsapi.org/v2/everything",
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        raw_articles = resp.json().get("articles", [])

        results: List[Dict[str, Any]] = []
        for a in raw_articles:
            headline = (a.get("title") or "").strip()
            # Skip removed/deleted articles that NewsAPI sometimes returns
            if not headline or headline.lower() == "[removed]":
                continue
            results.append({
                "time": a.get("publishedAt") or "",
                "source": (a.get("source") or {}).get("name") or "Unknown",
                "headline": headline,
                "description": (a.get("description") or "").strip(),
                "url": a.get("url") or "",
            })

        if not results:
            print("NewsAPI returned 0 valid articles — using mock fallback.")
            return _MOCK_NEWS

        print(f"NewsAPI: fetched {len(results)} articles successfully.")
        return results

    except Exception as exc:
        print(f"NewsAPI error: {exc} — returning mock fallback.")
        return _MOCK_NEWS

def fetch_economic_calendar() -> List[Dict[str, Any]]:
    """Fetch economic calendar from Investing data API. Falls back to mock data."""
    import datetime
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    
    mock_events = [
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

    try:
        url = "https://sslecal2.investing.com/api/financialdata/calendar"
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
        }
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        events = data.get("data", []) if isinstance(data, dict) else data
        if not events or not isinstance(events, list):
            return mock_events
            
        results = []
        for item in events[:20]: # Limit to 20 events
            results.append({
                "date": str(item.get("date", today)).split(" ")[0],
                "time": str(item.get("time", "00:00")),
                "currency": str(item.get("country", item.get("currency", "USD"))),
                "event": str(item.get("event", "")),
                "impact": str(item.get("importance", item.get("impact", "Low"))).capitalize(),
                "actual": str(item.get("actual", "-")),
                "forecast": str(item.get("forecast", "-")),
                "previous": str(item.get("previous", "-"))
            })
            
        return results if results else mock_events
    except Exception as e:
        print(f"Investing API error: {e}")
        return mock_events
