from __future__ import annotations

from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from fastapi import Query as QParam
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from backend.database.database import get_db
from backend.database.models import Backtest, Strategy
from backend.market_data.csv_dataset_loader import load_dataset_candles
from backend.services.backtest_service import (
    persist_backtest_run,
    serialize_signal,
    serialize_backtest_summary,
    serialize_trade,
)
from backend.setups.trade_setup_store import build_trade_setups, store_trade_setups
from backend.strategy_engine import run_strategy
from backend.utils.helpers import clean_data


router = APIRouter(tags=["backtesting"])


class BacktestRequest(BaseModel):
    symbol: str
    timeframe: str = "raw"
    config: dict
    candles: list[dict] | None = None


def _load_dataset_candles(dataset_id: str, timeframe: str) -> list[dict]:
    datasets_dir = Path(__file__).resolve().parent.parent / "datasets"
    candles = load_dataset_candles(dataset_id, datasets_dir, timeframe=timeframe or "1m")
    if not candles:
        raise ValueError(f"No market data available for dataset {dataset_id}")
    return candles


@router.post("/run-strategy")
@router.post("/run-backtest")
async def run_backtest(payload: BacktestRequest, db: Session = Depends(get_db)):
    try:
        if payload.candles:
            candles = payload.candles
        else:
            candles = _load_dataset_candles(payload.symbol, payload.timeframe)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        raise HTTPException(400, f"Data fetch error: {str(exc)}")

    try:
        import numpy as np
        df = pd.DataFrame(candles)

        print("CSV rows loaded:", len(df))

        # STEP 2 — FIX CSV NORMALIZATION
        df.columns = [str(c).lower().strip() for c in df.columns]

        if "timestamp" in df.columns:
            df.rename(columns={"timestamp": "time"}, inplace=True)
        if "date" in df.columns:
            df.rename(columns={"date": "time"}, inplace=True)
        if "datetime" in df.columns:
            df.rename(columns={"datetime": "time"}, inplace=True)

        # STEP 3 — FIX TIMESTAMP PARSING
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

        # STEP 4 — HANDLE PRICE COLUMNS
        for col in ["open", "high", "low", "close"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        # STEP 5 — PREVENT DATA LOSS
        df = df.dropna(subset=["time", "open", "high", "low", "close"])
        
        # Sort dataset
        df = df.sort_values("time")

        print("Rows after cleaning:", len(df))

        # Feed to strategy engine
        candles = df[["time", "open", "high", "low", "close"]].to_dict(orient="records")

        # STEP 6 — VERIFY DATASET SIZE
        config_params = payload.config.get("parameters", {})
        slow_period = int(config_params.get("slow_period", 30))
        if len(candles) < slow_period + 10:
            raise ValueError(
                f"Dataset too small. Need at least {slow_period+10} candles but received {len(candles)}"
            )

        # Feed to strategy engine
        candles = df[["time", "open", "high", "low", "close"]].to_dict(orient="records")

        if not candles:
            raise ValueError("Candle list is empty. Dataset invalid.")
            
        print("Candles passed to strategy:", len(candles))
        print("First candle:", candles[0])

        try:
            result = clean_data(run_strategy(df, payload.config))
        except Exception as e:
            raise e
            
    except Exception as exc:
        print("STRATEGY ENGINE ERROR:", str(exc))
        raise HTTPException(status_code=500, detail=str(exc))

    trade_setups = build_trade_setups(
        candles,
        result.get("buy_signals", []),
        result.get("sell_signals", []),
    )
    store_trade_setups(payload.symbol, payload.timeframe or "1m", trade_setups)

    # Let any DB/FK errors propagate — the global exception handler in server.py
    # will return a proper HTTP 500 that the frontend toast will display.
    try:
        backtest = persist_backtest_run(
            db,
            dataset_id=payload.symbol,
            timeframe=payload.timeframe or "1m",
            config=payload.config,
            result=result,
            trade_setups=trade_setups,
        )
    except Exception as exc:
        import traceback
        traceback.print_exc()
        print("CRITICAL DB PERSIST EXCEPTION:", str(exc))
        raise HTTPException(status_code=500, detail=f"DB Error: {str(exc)}")

    buy_signals = result.get("buy_signals", [])
    sell_signals = result.get("sell_signals", [])

    unified_signals = []
    for s in buy_signals:
        unified_signals.append({"timestamp": s.get("time") or s.get("timestamp"), "type": "BUY"})
    for s in sell_signals:
        unified_signals.append({"timestamp": s.get("time") or s.get("timestamp"), "type": "SELL"})

    metrics = result.get("metrics", {})
    # Ensure all required metrics are present for the frontend
    metrics.setdefault("total_trades", len(result.get("trades", [])))
    metrics.setdefault("buy_signals", len(buy_signals))
    metrics.setdefault("sell_signals", len(sell_signals))
    metrics.setdefault("win_rate", metrics.get("win_rate", 0))
    metrics.setdefault("total_return", metrics.get("total_return", 0))

    # ── Sentiment layer ──────────────────────────────────────────────────────
    try:
        from backend.sentiment.sentiment_service import (
            get_market_sentiment,
            compute_confidence,
        )
        sentiment_data   = get_market_sentiment()
        sentiment_score  = sentiment_data.get("sentiment_score", 0.0)

        # Annotate each setup with its sentiment-adjusted confidence
        win_rate = float(metrics.get("win_rate") or 0)
        overall_verdict = sentiment_data.get("overall_sentiment", "Neutral")
        for setup in trade_setups:
            setup["confidence"]    = compute_confidence(win_rate, sentiment_score)
            setup["sentiment"]     = overall_verdict
    except Exception:
        sentiment_data  = {}
        sentiment_score = 0.0
    # ────────────────────────────────────────────────────────────────────────

    return {
        "backtest_id":    backtest.id,
        "candles":        candles,
        "signals":        unified_signals,
        "metrics":        metrics,
        "indicators":     result.get("indicators", {}),
        "trade_setups":   trade_setups,
        "sentiment":      sentiment_data,
        "sentiment_score": sentiment_score,
    }



@router.get("/backtests")
def list_backtests(limit: int = QParam(100, ge=1, le=500), db: Session = Depends(get_db)):
    backtests = (
        db.query(Backtest)
        .options(joinedload(Backtest.dataset))
        .order_by(Backtest.created_at.desc())
        .limit(limit)
        .all()
    )
    return [serialize_backtest_summary(backtest) for backtest in backtests]


@router.get("/backtests/{backtest_id}")
def get_backtest(backtest_id: int, db: Session = Depends(get_db)):
    backtest = (
        db.query(Backtest)
        .options(joinedload(Backtest.dataset), joinedload(Backtest.trades), joinedload(Backtest.signals))
        .filter(Backtest.id == backtest_id)
        .first()
    )
    if not backtest:
        raise HTTPException(404, "Backtest not found")

    candles: list[dict] = []
    try:
        candles = _load_dataset_candles(backtest.dataset_id, backtest.timeframe or "1m")
    except Exception:
        candles = []

    buy_signals = [serialize_signal(signal) for signal in backtest.signals if signal.signal_type == "BUY"]
    sell_signals = [serialize_signal(signal) for signal in backtest.signals if signal.signal_type == "SELL"]

    buy_list = buy_signals or result_signals_from_setups(backtest.trade_setups, candles, "BUY")
    sell_list = sell_signals or result_signals_from_setups(backtest.trade_setups, candles, "SELL")

    unified_signals = []
    for s in buy_list:
        unified_signals.append({"timestamp": s.get("time") or s.get("timestamp"), "type": "BUY"})
    for s in sell_list:
        unified_signals.append({"timestamp": s.get("time") or s.get("timestamp"), "type": "SELL"})

    metrics = backtest.metrics or {}
    metrics.setdefault("total_trades", len(backtest.trades))
    metrics.setdefault("buy_signals", len(buy_list))
    metrics.setdefault("sell_signals", len(sell_list))

    return {
        **serialize_backtest_summary(backtest),
        "dataset": {
            "id": backtest.dataset.id if backtest.dataset else backtest.dataset_id,
            "filename": backtest.dataset.filename if backtest.dataset else None,
            "symbol": backtest.dataset.symbol if backtest.dataset else None,
            "rows": backtest.dataset.rows if backtest.dataset else None,
            "start": backtest.dataset.start.isoformat() if backtest.dataset and backtest.dataset.start else None,
            "end": backtest.dataset.end.isoformat() if backtest.dataset and backtest.dataset.end else None,
        },
        "metrics": metrics,
        "trade_setups": backtest.trade_setups,
        "equity_curve": backtest.equity_curve,
        "drawdown_curve": backtest.drawdown_curve,
        "candles": candles,
        "signals": unified_signals,
    }


def result_signals_from_setups(trade_setups: list[dict], candles: list[dict], signal_type: str) -> list[dict]:
    normalized_type = signal_type.upper()
    signals: list[dict] = []

    for setup in trade_setups or []:
        if str(setup.get("type") or "").upper() != normalized_type:
            continue
        index = int(setup.get("index") or 0)
        candle = candles[index] if 0 <= index < len(candles) else {}
        signals.append({
            "time": setup.get("timestamp") or candle.get("time"),
            "price": setup.get("price") or candle.get("close"),
            "type": normalized_type,
        })

    return signals


@router.get("/dashboard/overview")
def get_dashboard_overview(db: Session = Depends(get_db)):
    backtests = (
        db.query(Backtest)
        .options(joinedload(Backtest.dataset))
        .order_by(Backtest.created_at.desc())
        .all()
    )

    total_backtests = len(backtests)
    total_strategies = db.query(Strategy).count()
    total_trades = sum(backtest.total_trades or 0 for backtest in backtests)
    weighted_win_rate = (
        sum((backtest.win_rate or 0.0) * (backtest.total_trades or 0) for backtest in backtests) / total_trades
        if total_trades
        else 0.0
    )

    best_strategy = "No strategies yet"
    if backtests:
        grouped: dict[str, list[float]] = {}
        for backtest in backtests:
            grouped.setdefault(backtest.strategy_name, []).append(backtest.profit or 0.0)
        best_strategy = max(grouped.items(), key=lambda item: sum(item[1]) / len(item[1]))[0]

    equity_preview = backtests[0].equity_curve if backtests else []

    return {
        "total_backtests": total_backtests,
        "total_strategies": total_strategies,
        "best_strategy": best_strategy,
        "win_rate": weighted_win_rate,
        "recent_backtests": [serialize_backtest_summary(backtest) for backtest in backtests[:6]],
        "equity_curve_preview": equity_preview,
    }
