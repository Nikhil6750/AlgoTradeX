from __future__ import annotations

import os
import sys
from pydantic import BaseModel
from fastapi import FastAPI, Request, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

# Ensure repository root is importable
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

app = FastAPI(title="AlgoTradeX API", version="2.0.0")

# ── CORS Middleware ─────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup: initialise DB tables ─────────────────────────────────────────────
from backend.database import database as database_state
from backend.database.database import init_db
from apscheduler.schedulers.background import BackgroundScheduler
from backend.sentiment.calendar_scraper import update_calendar_cache, CACHE_FILE

@app.on_event("startup")
def on_startup():
    init_db()
    database_state.Base.metadata.create_all(bind=database_state.engine)
    print("AlgoTradeX backend started")
    print("Database initialized")

    # Start scraping schedule
    scheduler = BackgroundScheduler()
    scheduler.add_job(update_calendar_cache, "interval", hours=24)
    scheduler.start()

    # Pre-fetch cache immediately by enforcing an update on startup
    import threading
    threading.Thread(target=update_calendar_cache).start()

# ── Routers ───────────────────────────────────────────────────────────────────
from backend.api.replay_routes import router as replay_router
from backend.api.backtest_routes import router as backtest_router
from backend.api.setup_routes import router as setup_router
from backend.api.sentiment_routes import router as sentiment_router

app.include_router(replay_router)
app.include_router(backtest_router)
app.include_router(setup_router)
app.include_router(sentiment_router)

# ── Exception Handlers ────────────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": "Invalid input", "details": exc.errors()},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    detail = exc.detail
    msg = detail if isinstance(detail, str) else str(detail)
    return JSONResponse(status_code=exc.status_code, content={"error": msg})

@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc)})

@app.get("/health")
def health() -> dict:
    return {"status": "running"}

@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    import numpy as np
    try:
        df = pd.read_csv(file.file)
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid CSV. Please upload OHLC trading data."})
    
    if df.empty:
        return JSONResponse(status_code=400, content={"error": "Invalid CSV. Please upload OHLC trading data."})

    df.columns = [str(c).lower().strip() for c in df.columns]

    if "timestamp" in df.columns:
        df.rename(columns={"timestamp": "time"}, inplace=True)
    if "date" in df.columns:
        df.rename(columns={"date": "time"}, inplace=True)
    if "datetime" in df.columns:
        df.rename(columns={"datetime": "time"}, inplace=True)

    if "time" in df.columns:
        def parse_time(v):
            if pd.isna(v): return 0
            if isinstance(v, (int, float)):
                return int(v / 1000) if v > 1e11 else int(v)
            try:
                val = float(v)
                return int(val / 1000) if val > 1e11 else int(val)
            except ValueError:
                dt = pd.to_datetime(v, errors="coerce")
                return int(dt.timestamp()) if pd.notnull(dt) else 0

        df["time"] = df["time"].apply(parse_time)

    required = ["time", "open", "high", "low", "close"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        return JSONResponse(status_code=400, content={"error": "Invalid CSV. Please upload OHLC trading data."})

    for col in required:
        if col != "time":
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop invalid rows for required columns
    df = df.dropna(subset=required)

    if "time" in df.columns:
        df = df.sort_values("time")

    df = df.replace({np.nan: None})
    
    # We slice to 2000 if it's too big to prevent browser OOM, or return all?
    # returning all to be locally stored by the client
    export_cols = [c for c in required if c in df.columns]
    if len(export_cols) == 5:
        candles = df[export_cols].to_dict(orient="records")
    else:
        candles = df.to_dict(orient="records")
    return {
        "rows": len(df),
        "columns": list(df.columns),
        "candles": candles
    }

from backend.api.strategy_routes import router as strategy_router
from backend.api.market_data_routes import router as market_data_router
from backend.api.session_routes import router as session_router
# from backend.api.symbol_routes import router as symbol_router

app.include_router(strategy_router)
app.include_router(market_data_router)
from backend.api.dataset_routes import router as dataset_router
app.include_router(dataset_router)
app.include_router(session_router)
# app.include_router(symbol_router)

# ── Sentiment endpoint ────────────────────────────────────────────────────────
from backend.sentiment.sentiment_service import get_market_sentiment as _get_sentiment

@app.get("/market-sentiment")
def market_sentiment():
    """Return aggregated economic calendar sentiment."""
    return _get_sentiment()

@app.get("/economic-events")
def economic_events():
    """Return latest economic events."""
    from backend.sentiment.economic_calendar_scraper import fetch_economic_events
    from backend.sentiment.macro_sentiment_engine import score_event
    
    events = fetch_economic_events()
    return [score_event(event) for event in events]

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.server:app", host="127.0.0.1", port=8000, reload=True)
