from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()


def get_vader_sentiment(text: str) -> dict:
    """Return the full VADER polarity structure.

    Returns:
        {
            "compound":  float,   # overall sentiment score in [-1, +1]
            "positive":  float,   # proportion of positive sentiment
            "neutral":   float,   # proportion of neutral sentiment
            "negative":  float,   # proportion of negative sentiment
        }
    """
    fallback = {"compound": 0.0, "positive": 0.0, "neutral": 1.0, "negative": 0.0}
    if not text:
        return fallback
    scores = _analyzer.polarity_scores(text)
    return {
        "compound":  round(scores.get("compound", 0.0), 4),
        "positive":  round(scores.get("pos", 0.0), 4),
        "neutral":   round(scores.get("neu", 0.0), 4),
        "negative":  round(scores.get("neg", 0.0), 4),
    }
