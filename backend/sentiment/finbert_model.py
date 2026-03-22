from transformers import pipeline

try:
    _finbert = pipeline(
        "sentiment-analysis",
        model="ProsusAI/finbert",
        device=-1,
    )
    print("FinBERT model loaded successfully.")
except Exception as _e:
    print(f"Failed to load FinBERT: {_e}")
    _finbert = None


def get_finbert_sentiment(text: str) -> dict:
    """Return a structured FinBERT result.

    Returns:
        {
            "label": "positive" | "neutral" | "negative",
            "score": float,          # raw confidence in [0, 1]
            "numeric": float         # signed score for weighting:
                                     #   positive → +score
                                     #   negative → -score
                                     #   neutral  →  0.0
        }
    """
    fallback = {"label": "neutral", "score": 0.0, "numeric": 0.0}

    if not text or _finbert is None:
        return fallback

    try:
        # BERT has a 512-token limit; ~4 chars per token means ~2000 chars is safe
        truncated = text[:2000]
        result = _finbert(truncated, truncation=True)[0]
        label = result["label"].lower()
        score = round(float(result["score"]), 4)   # confidence in [0, 1]

        if label == "positive":
            numeric = score
        elif label == "negative":
            numeric = -score
        else:
            numeric = 0.0

        return {"label": label, "score": score, "numeric": round(numeric, 4)}

    except Exception as exc:
        print(f"FinBERT inference error: {exc}")
        return fallback
