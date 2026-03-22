"""Macro sentiment scoring engine.

score_event(event_name: str) -> float  — keyword-based [-1, +1]
aggregate_sentiment(scores: list)      — mean of a list of floats
"""
from __future__ import annotations

from typing import Any, Dict, List

# ── Keyword tables ─────────────────────────────────────────────────────────────
_POSITIVE = {
    "growth", "increase", "expansion", "strong", "bullish",
    "surplus", "rise", "gain", "recovery", "beat", "better",
    "higher", "above", "improve", "positive",
}

_NEGATIVE = {
    "inflation", "recession", "decline", "drop", "crisis",
    "deficit", "fall", "loss", "slowdown", "miss", "worse",
    "lower", "below", "worsen", "negative", "weak",
}

_IMPACT_WEIGHT: Dict[str, float] = {
    "high": 1.0,
    "medium": 0.6,
    "low": 0.3,
}


# ── Public functions ───────────────────────────────────────────────────────────

def score_event(event: Any) -> Any:
    """Accept either a plain event-name string or the full event dict.

    Returns:
        - float if given a string (simple keyword score in [-1, +1])
        - dict  if given a dict  (original dict enriched with 'sentiment' and 'score')
    """
    if isinstance(event, str):
        return _keyword_score(event)

    # Dict path — matches sentiment_service.py usage
    if isinstance(event, dict):
        event_name = event.get("event", "")
        score = _keyword_score(event_name)

        # Impact-weighted label
        w_val = str(event.get("impact", "low")).lower()
        w = _IMPACT_WEIGHT.get(w_val, 0.3)
        weighted = round(score * w, 4)

        currency = str(event.get("currency", "USD")).upper()
        if score > 0.05:
            sentiment = f"Bullish {currency}"
            reason = "Positive economic indicator — likely currency strength."
        elif score < -0.05:
            sentiment = f"Bearish {currency}"
            reason = "Negative economic indicator — likely currency weakness."
        else:
            sentiment = f"Neutral {currency}"
            reason = "Neutral economic indicator with limited market impact."

        return {
            **event,
            "score":      weighted,
            "sentiment":  sentiment,
            "reason":     reason,
            "trade_recommendation": [],
        }

    return event  # passthrough for unknown types


def aggregate_sentiment(scored_events: Any) -> Any:
    """Accept either a list of floats or a list of scored event dicts.

    Returns:
        - float if given a list of floats
        - dict  if given a list of dicts (matches sentiment_service.py usage)
    """
    if not scored_events:
        return {"sentiment_score": 0.0, "total_events": 0}

    # List-of-floats path
    if isinstance(scored_events[0], (int, float)):
        avg = sum(scored_events) / len(scored_events)
        return round(max(-1.0, min(1.0, avg)), 4)

    # List-of-dicts path
    raw_score = sum(e.get("score", 0.0) for e in scored_events)
    total_w   = sum(_IMPACT_WEIGHT.get(str(e.get("impact", "low")).lower(), 0.3)
                    for e in scored_events) or 1.0
    sentiment_score = round(max(-1.0, min(1.0, raw_score / total_w)), 4)

    return {
        "positive_count":  sum(1 for e in scored_events if "Bullish" in e.get("sentiment", "")),
        "neutral_count":   sum(1 for e in scored_events if "Neutral" in e.get("sentiment", "")),
        "negative_count":  sum(1 for e in scored_events if "Bearish" in e.get("sentiment", "")),
        "total_events":    len(scored_events),
        "sentiment_score": sentiment_score,
        "events":          scored_events,
    }


# ── Internal ───────────────────────────────────────────────────────────────────

def _keyword_score(text: str) -> float:
    """Simple keyword scorer: +1 per positive hit, -1 per negative hit, clamped."""
    words = set(text.lower().replace(",", " ").split())
    pos   = len(words & _POSITIVE)
    neg   = len(words & _NEGATIVE)
    raw   = pos - neg
    return round(max(-1.0, min(1.0, raw * 0.5)), 4)
