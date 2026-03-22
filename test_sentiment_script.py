from backend.sentiment.sentiment_service import get_market_sentiment
import json

print("Starting test...")
try:
    res = get_market_sentiment()
    print("Result:", json.dumps(res, indent=2))
except Exception as e:
    print("Error:", e)
