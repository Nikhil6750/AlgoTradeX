"""FinBERT sentiment engine for financial text classification.

Loads the model exactly once at module import (server startup) to ensure
fast API responses, as requested by the user. Falls back to a keyword
heuristic if torch/transformers are not available.
"""
from __future__ import annotations
from typing import Dict
import logging

logger = logging.getLogger(__name__)

_pipeline = None
_available = False

try:
    from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
    logger.info("Loading FinBERT once at startup...")
    tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
    model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
    _pipeline = pipeline("text-classification", model=model, tokenizer=tokenizer, top_k=None)
    _available = True
    logger.info("FinBERT loaded successfully.")
except Exception as exc:
    logger.warning(f"Failed to load FinBERT: {exc}. Using keyword fallback.")

# ── Keyword heuristic fallback ─────────────────────────────────────────────────
_POSITIVE = {"surge", "gains", "record", "rise", "rally", "strong", "growth",
             "buyback", "profit", "earnings", "beat", "highest", "recovery",
             "cuts", "stimulus", "boost"}
_NEGATIVE = {"fall", "drop", "recession", "fear", "decline", "contract",
             "loss", "concern", "unexpected", "risk", "crash", "warning",
             "contraction", "downturn", "layoff"}

def _keyword_heuristic(text: str) -> Dict[str, object]:
    words    = set(text.lower().split())
    pos      = len(words & _POSITIVE)
    neg      = len(words & _NEGATIVE)
    if pos > neg:
        label, conf = "positive", round(0.5 + 0.1 * pos, 2)
    elif neg > pos:
        label, conf = "negative", round(0.5 + 0.1 * neg, 2)
    else:
        label, conf = "neutral", 0.60
    return {"sentiment": label, "confidence": min(conf, 0.95)}

def analyze_finbert(text: str) -> Dict[str, object]:
    """Return FinBERT sentiment + confidence for the given text."""
    if not _available or _pipeline is None:
        return _keyword_heuristic(text)

    try:
        truncated = text[:512]
        results   = _pipeline(truncated)[0]
        best      = max(results, key=lambda x: x["score"])
        return {
            "sentiment":  best["label"].lower(),
            "confidence": round(float(best["score"]), 4),
        }
    except Exception:
        return _keyword_heuristic(text)

def finbert_score_to_float(result: Dict[str, object]) -> float:
    """Convert a FinBERT result dict to a float in [-1, 1]."""
    sentiment  = str(result.get("sentiment", "neutral")).lower()
    confidence = float(result.get("confidence", 0.5))
    if sentiment == "positive":
        return confidence
    if sentiment == "negative":
        return -confidence
    return 0.0
