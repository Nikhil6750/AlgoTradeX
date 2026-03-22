"""VADER sentiment engine for short financial headlines.

vaderSentiment is a lightweight rule-based model — no GPU needed.
Falls back to a polarity heuristic if the package isn't installed.
"""
from __future__ import annotations

from typing import Dict

def _vader_score(text: str) -> Dict[str, float]:
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer  # type: ignore
        sia = SentimentIntensityAnalyzer()
        return sia.polarity_scores(text)
    except ImportError:
        return _keyword_fallback(text)


# ── Keyword-based fallback ─────────────────────────────────────────────────────
_POS_WORDS = {"surge", "gains", "record", "rise", "rally", "strong", "growth",
              "buyback", "profit", "earnings", "beat", "highest", "recovery"}
_NEG_WORDS = {"fall", "drop", "recession", "fears", "decline", "contract",
              "loss", "cut", "concern", "unexpected", "risk", "worst", "crash"}

def _keyword_fallback(text: str) -> Dict[str, float]:
    words = set(text.lower().split())
    pos   = len(words & _POS_WORDS)
    neg   = len(words & _NEG_WORDS)
    total = pos + neg or 1
    compound = round((pos - neg) / max(total, 1), 3)
    pos_s    = round(pos / max(total, 1), 3)
    neg_s    = round(neg / max(total, 1), 3)
    neu_s    = round(max(0.0, 1.0 - pos_s - neg_s), 3)
    return {"neg": neg_s, "neu": neu_s, "pos": pos_s, "compound": compound}


def analyze_vader(text: str) -> Dict[str, float]:
    """Return VADER sentiment scores for the given text."""
    return _vader_score(text)


def classify_mood(compound: float) -> str:
    if compound >= 0.05:
        return "Bullish"
    if compound <= -0.05:
        return "Bearish"
    return "Neutral"
