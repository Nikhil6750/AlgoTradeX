from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter(prefix="/sentiment", tags=["sentiment"])


from backend.sentiment.sentiment_service import get_macro_sentiment, get_market_sentiment

@router.get("/calendar")
def get_calendar():
    """Return economic events enriched with per-event sentiment scores."""
    return get_macro_sentiment()

@router.get("/news")
def get_news():
    """Return AI-scored financial news and overall market sentiment."""
    return get_market_sentiment()
