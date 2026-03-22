import time
from typing import Any, Dict, List

from backend.sentiment.news_fetcher import fetch_financial_news
from backend.sentiment.vader_model import get_vader_sentiment
from backend.sentiment.finbert_model import get_finbert_sentiment

_CACHE_TTL = 300  # 5 minutes
_cache: Dict[str, Any] = {"ts": 0.0, "data": None}


# ── Signal classification ──────────────────────────────────────────────────────

def _classify_signal(score: float) -> str:
    if score > 0.30:
        return "Bullish"
    elif score < -0.30:
        return "Bearish"
    return "Neutral"


# ── Confidence scoring ─────────────────────────────────────────────────────────

def _classify_confidence(combined_score: float) -> str:
    confidence = abs(combined_score)
    if confidence > 0.70:
        return "High"
    elif confidence > 0.40:
        return "Medium"
    return "Low"


# ── Explanation generator ──────────────────────────────────────────────────────

_KEYWORD_RULES = [
    # Inflation & rates
    (["inflation rise", "inflation surge", "cpi rises", "inflation climbs"],
     "Rising inflation increases the likelihood of tighter monetary policy, which typically pressures equities and risk assets."),
    (["inflation falls", "inflation drops", "cpi eases", "inflation cools"],
     "Cooling inflation reduces rate-hike fears, which is generally supportive of equities and growth assets."),
    (["rate cut", "rate cuts", "interest rate cut", "fed cuts", "easing policy"],
     "Potential rate cuts usually support equities and risk assets by lowering the cost of borrowing."),
    (["rate hike", "rate hikes", "interest rate hike", "fed raises", "tightening policy"],
     "Rate hikes raise borrowing costs, which often weighs on growth stocks and risk assets."),

    # Earnings
    (["strong earnings", "earnings beat", "profit surge", "record earnings", "earnings growth"],
     "Strong earnings indicate positive corporate performance and typically boost investor confidence."),
    (["earnings miss", "profit drop", "weak earnings", "earnings decline", "revenue miss"],
     "Earnings misses signal weaker-than-expected corporate performance, which can dampen market sentiment."),

    # GDP & Economy
    (["gdp growth", "economic growth", "economy expands", "strong gdp"],
     "Strong GDP growth signals a healthy economy, which is broadly positive for equities."),
    (["gdp contraction", "recession", "economic slowdown", "growth slows"],
     "Signs of economic slowdown or recession raise concerns about corporate revenues and consumer spending."),

    # Jobs & Unemployment
    (["jobs report", "strong jobs", "payrolls beat", "unemployment falls", "jobs added"],
     "A strong labor market supports consumer spending and overall economic stability."),
    (["job losses", "layoffs", "unemployment rises", "jobs cut"],
     "Rising unemployment or layoffs signal weakening economic conditions and may weigh on markets."),

    # Markets & Risk
    (["market rally", "stocks surge", "bull market", "risk-on"],
     "A market rally reflects strong investor confidence and positive momentum in risk assets."),
    (["market sell-off", "stocks fall", "bear market", "risk-off", "market crash"],
     "A market sell-off reflects declining investor confidence and heightened risk aversion."),

    # Geopolitics & Trade
    (["trade war", "tariffs", "sanctions", "trade tensions"],
     "Trade tensions or tariffs introduce uncertainty into global supply chains and corporate earnings."),
    (["trade deal", "trade agreement", "tariff removal"],
     "Trade agreements reduce barriers and uncertainty, generally positive for international markets."),

    # Energy & Commodities
    (["oil rise", "crude surge", "oil prices up", "energy prices rise"],
     "Rising energy prices increase costs for consumers and businesses, often acting as an inflation driver."),
    (["oil falls", "crude drops", "oil prices down", "energy prices fall"],
     "Falling energy prices relieve inflationary pressure and reduce costs for energy-intensive industries."),

    # Crypto & Tech
    (["crypto rally", "bitcoin rises", "ethereum surges"],
     "Crypto rallies reflect heightened risk appetite and growing investor interest in digital assets."),
    (["crypto crash", "bitcoin falls", "ethereum drops"],
     "Crypto sell-offs often signal reduced risk appetite and can spill over into broader tech sentiment."),
]


def _generate_explanation(headline: str) -> str:
    """Match headline against keyword rules; return generic fallback if no match."""
    h_lower = headline.lower()
    for keywords, explanation in _KEYWORD_RULES:
        if any(kw in h_lower for kw in keywords):
            return explanation
    return "Sentiment derived from financial news tone using FinBERT (finance-tuned) and VADER (lexicon-based) models."


# ── Main service ───────────────────────────────────────────────────────────────

def get_market_sentiment() -> Dict[str, Any]:
    """Fetch news, score with VADER + FinBERT, attach signal/confidence/explanation."""
    now = time.monotonic()
    if _cache["data"] is not None and now - _cache["ts"] < _CACHE_TTL:
        return _cache["data"]

    news_list = fetch_financial_news()

    processed: List[Dict[str, Any]] = []
    total_score = 0.0

    for item in news_list:
        # Combine headline + description for richer NLP input
        headline    = (item.get("headline") or "").strip()
        description = (item.get("description") or "").strip()
        text        = f"{headline} {description}".strip()

        # --- Model inference ---
        finbert = get_finbert_sentiment(text)
        vader   = get_vader_sentiment(text)

        finbert_numeric = finbert["numeric"]
        vader_compound  = vader["compound"]

        # FinBERT weighted higher (0.65) — it's finance-domain specific
        combined_score = round((0.65 * finbert_numeric) + (0.35 * vader_compound), 4)

        signal      = _classify_signal(combined_score)
        confidence  = _classify_confidence(combined_score)
        explanation = _generate_explanation(headline)

        processed.append({
            "time":           item.get("time", ""),
            "source":         item.get("source", ""),
            "headline":       headline,
            "url":            item.get("url", ""),

            # FinBERT structured output
            "finbert_label":  finbert["label"],
            "finbert_score":  finbert["score"],

            # VADER compound score
            "vader_compound": vader_compound,

            # Derived fields
            "combined_score": combined_score,
            "signal":         signal,
            "confidence":     confidence,
            "explanation":    explanation,
        })

        total_score += combined_score

    market_sentiment = (
        round(total_score / len(processed), 4) if processed else 0.0
    )

    result = {
        "market_sentiment": market_sentiment,
        "articles": processed,
    }

    _cache["ts"]   = now
    _cache["data"] = result
    return result


def get_macro_sentiment() -> Dict[str, Any]:
    """Load cached economic events and calculate average sentiment."""
    import os
    import json

    cache_file = os.path.join(os.path.dirname(__file__), "calendar_cache.json")
    events = []

    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                data = json.load(f)
                events = data.get("events", [])
        except Exception as e:
            print(f"Error reading calendar cache: {e}")

    # Fallback to mock events if cache empty or missing
    if not events:
        import datetime
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        events = [
            {
                "date": today, "time": "12:30", "currency": "USD",
                "event": "CPI Inflation Rate", "impact": "High",
                "actual": "3.4%", "forecast": "3.2%", "previous": "3.1%",
                "sentiment": 0.0,
            },
            {
                "date": today, "time": "14:00", "currency": "USD",
                "event": "Federal Reserve Interest Rate Decision", "impact": "High",
                "actual": "5.50%", "forecast": "5.50%", "previous": "5.50%",
                "sentiment": 0.0,
            },
            {
                "date": today, "time": "15:30", "currency": "USD",
                "event": "GDP Growth Rate", "impact": "Medium",
                "actual": "2.1%", "forecast": "2.1%", "previous": "2.0%",
                "sentiment": 0.0,
            },
        ]

    total_score  = 0.0
    scored_items = 0

    for event in events:
        if "sentiment" in event:
            total_score  += event["sentiment"]
            scored_items += 1

    market_sentiment = (
        round(total_score / scored_items, 4) if scored_items > 0 else 0.0
    )

    return {"market_sentiment": market_sentiment, "events": events}
