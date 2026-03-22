from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database.database import get_db
from backend.market_data.loaders import load_candles_from_csv_path
from backend.backtesting.metrics import compute_metrics
from backend.replay.replay_engine import evaluate_replay
from backend.services.backtest_service import persist_backtest_run

router = APIRouter(prefix="/replay", tags=["replay"])

@router.get("/dataset/{name}")
def get_replay_dataset(name: str):
    try:
        candles = load_candles_from_csv_path(name)
        return {"candles": candles}
    except Exception as e:
        raise HTTPException(404, str(e))


class ReplayEvaluatePayload(BaseModel):
    symbol: str
    timeframe: str = "1h"
    config: dict[str, Any] = {}
    cursor: Optional[int] = None
    persist: bool = True


@router.post("/evaluate")
def evaluate_replay_strategy(payload: ReplayEvaluatePayload, db: Session = Depends(get_db)):
    try:
        result = evaluate_replay(
            dataset_id=payload.symbol,
            timeframe=payload.timeframe,
            config=payload.config,
            cursor=payload.cursor,
        )
        trade_setups = [
            {
                "index": index,
                "type": signal_type,
                "price": signal.get("price"),
                "timestamp": signal.get("time"),
            }
            for signal_type, signals in (
                ("BUY", result.get("buy_signals", [])),
                ("SELL", result.get("sell_signals", [])),
            )
            for signal in signals
            for index in [next((
                candle_index
                for candle_index, candle in enumerate(result.get("candles", []))
                if candle.get("time") == signal.get("time")
            ), 0)]
        ]

        if payload.persist:
            backtest = persist_backtest_run(
                db,
                dataset_id=payload.symbol,
                timeframe=payload.timeframe or "1m",
                config=payload.config,
                result=result,
                trade_setups=trade_setups,
            )
            result["backtest_id"] = backtest.id

        result["trade_setups"] = trade_setups
        return result
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))

class ManualTradePayload(BaseModel):
    symbol: str
    initial_capital: float = 10000.0
    trades: list[dict]

@router.post("/save_session")
def save_replay_session(payload: ManualTradePayload, db: Session = Depends(get_db)):
    formatted_trades = []
    for t in payload.trades:
         formatted_trades.append({
             "entry_time": t.get("entry_time"),
             "exit_time": t.get("exit_time"),
             "entry_price": t.get("entry_price"),
             "exit_price": t.get("exit_price"),
             "type": t.get("type", "BUY"),
             "pnl": t.get("pnl", 0.0),
         })
         
    metrics_dict = compute_metrics(formatted_trades)
    result = {
        "trades": formatted_trades,
        "metrics": metrics_dict,
        "buy_signals": [],
        "sell_signals": [],
        "indicators": {},
    }

    backtest = persist_backtest_run(
        db,
        dataset_id=payload.symbol,
        timeframe="1m",
        config={"mode": "template", "strategy": "manual_replay", "parameters": {}},
        result=result,
        trade_setups=[],
        initial_balance=payload.initial_capital,
    )
    return {"backtest_id": backtest.id}
