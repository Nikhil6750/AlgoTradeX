from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from backend.database.models import Backtest, Dataset, Signal, Strategy, Trade
from backend.market_data.csv_dataset_loader import load_dataset_summary


DATASETS_DIR = Path(__file__).resolve().parent.parent / "datasets"
STRATEGY_LABELS = {
    "ma_crossover": "Moving Average Crossover",
    "mean_reversion": "Mean Reversion",
    "rsi_reversal": "RSI Reversal",
    "breakout": "Breakout",
    "rules": "Rule Builder",
    "code": "Code Strategy",
    "pine": "Pine Script Strategy",
    "manual_replay": "Manual Replay",
}


def _normalize_timestamp(value: Any) -> float | None:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return numeric if numeric > 0 else None


def _coerce_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _build_curves(trades: list[dict], initial_balance: float = 10_000.0) -> tuple[list[dict], list[dict]]:
    ordered_trades = sorted(
        trades,
        key=lambda trade: (
            _normalize_timestamp(trade.get("exit_time"))
            or _normalize_timestamp(trade.get("entry_time"))
            or 0
        ),
    )

    balance = float(initial_balance)
    peak = balance
    equity_curve: list[dict] = []
    drawdown_curve: list[dict] = []

    for index, trade in enumerate(ordered_trades, start=1):
        pnl = float(trade.get("pnl") or 0.0)
        time_value = (
            _normalize_timestamp(trade.get("exit_time"))
            or _normalize_timestamp(trade.get("entry_time"))
            or float(index)
        )

        balance *= 1 + pnl
        peak = max(peak, balance)

        equity_curve.append({"time": time_value, "value": round(balance, 4)})
        drawdown_curve.append({
            "time": time_value,
            "value": round((balance / peak - 1) * 100 if peak else 0.0, 4),
        })

    return equity_curve, drawdown_curve


def _build_signal_rows(result: dict[str, Any], trade_setups: list[dict] | None = None) -> list[dict[str, Any]]:
    grouped_setups = {"BUY": [], "SELL": []}

    for setup in trade_setups or []:
        signal_type = str(setup.get("type") or "").upper()
        if signal_type in grouped_setups:
            grouped_setups[signal_type].append(setup)

    rows: list[dict[str, Any]] = []
    for signal_type, result_key in (("BUY", "buy_signals"), ("SELL", "sell_signals")):
        setups = grouped_setups[signal_type]
        for index, signal in enumerate(result.get(result_key) or []):
            setup = setups[index] if index < len(setups) else {}
            rows.append({
                "signal_type": signal_type,
                "timestamp": _normalize_timestamp(signal.get("time") or signal.get("timestamp")),
                "price": _coerce_float(signal.get("price") if signal.get("price") is not None else setup.get("price")),
                "candle_index": int(setup["index"]) if setup.get("index") is not None else None,
            })

    return rows


def sync_dataset_record(db: Session, dataset_id: str, filename: str | None = None) -> Dataset:
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        dataset = Dataset(
            id=dataset_id,
            filename=filename or f"{dataset_id}.csv",
            symbol=(Path(filename).stem if filename else dataset_id).upper(),
        )

    if filename:
        dataset.filename = filename
        dataset.symbol = Path(filename).stem.upper()
    elif not dataset.filename:
        dataset.filename = f"{dataset_id}.csv"

    if not dataset.symbol:
        dataset.symbol = Path(dataset.filename).stem.upper()

    # Always stage the dataset row BEFORE reading from disk so the FK constraint
    # on Backtest.dataset_id is satisfied even if the summary load fails.
    db.add(dataset)
    db.flush()

    try:
        summary = load_dataset_summary(dataset_id, DATASETS_DIR)
        dataset.rows = int(summary.get("rows") or 0)
        dataset.start = _parse_datetime(summary.get("start"))
        dataset.end = _parse_datetime(summary.get("end"))
        db.flush()
    except Exception:
        pass

    return dataset


def sync_datasets_from_disk(db: Session) -> list[Dataset]:
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)

    for path in sorted(DATASETS_DIR.iterdir()):
        if path.suffix.lower() not in {".csv", ".parquet"}:
            continue
        sync_dataset_record(db, path.stem, filename=path.name)

    db.commit()
    return db.query(Dataset).order_by(Dataset.created_at.desc()).all()


def describe_strategy(config: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    mode = str(config.get("mode") or "template")
    strategy_key = str(config.get("strategy") or mode)
    strategy_name = STRATEGY_LABELS.get(strategy_key, strategy_key.replace("_", " ").title())

    if mode == "template":
        parameters = dict(config.get("parameters") or {})
    elif mode == "rules":
        parameters = {
            "buy_rules": list(config.get("buy_rules") or []),
            "sell_rules": list(config.get("sell_rules") or []),
        }
    elif mode == "code":
        parameters = {"code": config.get("code") or config.get("codeString") or ""}
    elif mode == "pine":
        parameters = {"pine_script": config.get("pine_script") or ""}
    else:
        parameters = dict(config.get("parameters") or {})

    if "stop_loss" in config:
        parameters["stop_loss"] = config["stop_loss"]
    if "take_profit" in config:
        parameters["take_profit"] = config["take_profit"]

    return strategy_name, mode, parameters


def get_or_create_strategy(db: Session, config: dict[str, Any]) -> Strategy:
    strategy_name, strategy_type, parameters = describe_strategy(config)
    strategy_json = json.dumps(
        {
            "mode": config.get("mode"),
            "strategy": config.get("strategy"),
            "parameters": parameters,
        },
        sort_keys=True,
    )

    strategy = (
        db.query(Strategy)
        .filter(
            Strategy.strategy_name == strategy_name,
            Strategy.strategy_type == strategy_type,
            Strategy.strategy_json == strategy_json,
        )
        .first()
    )
    if strategy is not None:
        return strategy

    strategy = Strategy(
        strategy_name=strategy_name,
        strategy_type=strategy_type,
        strategy_json=strategy_json,
    )
    db.add(strategy)
    db.flush()
    return strategy


def persist_backtest_run(
    db: Session,
    *,
    dataset_id: str,
    timeframe: str,
    config: dict[str, Any],
    result: dict[str, Any],
    trade_setups: list[dict] | None = None,
    dataset_filename: str | None = None,
    initial_balance: float = 10_000.0,
) -> Backtest:
    dataset = sync_dataset_record(db, dataset_id, filename=dataset_filename)
    strategy = get_or_create_strategy(db, config)
    strategy_name, _strategy_type, parameters = describe_strategy(config)

    trades = list(result.get("trades") or [])
    metrics = dict(result.get("metrics") or {})
    equity_curve, drawdown_curve = _build_curves(trades, initial_balance=initial_balance)
    signal_rows = _build_signal_rows(result, trade_setups)

    backtest = Backtest(
        dataset_id=dataset.id,
        strategy_id=strategy.id,
        strategy_name=strategy_name,
        timeframe=timeframe or "1m",
        profit=float(metrics.get("total_return") or 0.0),
        win_rate=float(metrics.get("win_rate") or 0.0),
        total_trades=int(metrics.get("total_trades") or len(trades)),
        max_drawdown=float(metrics.get("max_drawdown") or 0.0),
        profit_factor=metrics.get("profit_factor"),
        sharpe_ratio=metrics.get("sharpe_ratio"),
    )
    backtest.params = parameters
    backtest.metrics = metrics
    backtest.trade_setups = list(trade_setups or [])
    backtest.equity_curve = equity_curve
    backtest.drawdown_curve = drawdown_curve
    db.add(backtest)
    db.flush()

    for trade in trades:
        entry_time = _normalize_timestamp(trade.get("entry_time"))
        exit_time = _normalize_timestamp(trade.get("exit_time"))
        duration = trade.get("duration")
        if duration is None and entry_time and exit_time:
            duration = exit_time - entry_time

        db.add(Trade(
            backtest_id=backtest.id,
            entry_time=entry_time,
            exit_time=exit_time,
            entry_price=trade.get("entry_price"),
            exit_price=trade.get("exit_price"),
            position=str(trade.get("type") or trade.get("position") or "BUY").upper(),
            pnl=float(trade.get("pnl") or 0.0),
            duration=duration,
            trade_score=trade.get("trade_score"),
            risk_level=trade.get("risk_level"),
        ))

    for signal in signal_rows:
        db.add(Signal(
            backtest_id=backtest.id,
            signal_type=signal["signal_type"],
            timestamp=signal["timestamp"],
            price=signal["price"],
            candle_index=signal["candle_index"],
        ))

    db.commit()
    db.refresh(backtest)
    return backtest


def serialize_backtest_summary(backtest: Backtest) -> dict[str, Any]:
    return {
        "id": backtest.id,
        "dataset_id": backtest.dataset_id,
        "dataset_name": backtest.dataset.filename if backtest.dataset else backtest.dataset_id,
        "strategy_name": backtest.strategy_name,
        "timeframe": backtest.timeframe,
        "parameters": backtest.params,
        "profit": backtest.profit,
        "win_rate": backtest.win_rate,
        "total_trades": backtest.total_trades,
        "max_drawdown": backtest.max_drawdown,
        "profit_factor": backtest.profit_factor,
        "sharpe_ratio": backtest.sharpe_ratio,
        "created_at": backtest.created_at.isoformat() if backtest.created_at else None,
    }


def serialize_trade(trade: Trade) -> dict[str, Any]:
    return {
        "id": trade.id,
        "entry_time": trade.entry_time,
        "exit_time": trade.exit_time,
        "entry_price": trade.entry_price,
        "exit_price": trade.exit_price,
        "type": trade.position,
        "pnl": trade.pnl,
        "duration": trade.duration,
        "trade_score": trade.trade_score,
        "risk_level": trade.risk_level,
    }


def serialize_signal(signal: Signal) -> dict[str, Any]:
    return {
        "id": signal.id,
        "time": signal.timestamp,
        "price": signal.price,
        "type": signal.signal_type,
        "index": signal.candle_index,
    }
