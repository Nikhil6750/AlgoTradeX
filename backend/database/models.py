"""
SQLAlchemy ORM models for AlgoTradeX.

Primary research entities:
  User, Dataset, Strategy, Backtest, Trade

Legacy replay entities are kept for the separate manual trading session flow:
  TradingSession, SessionTrade
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.database.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    google_id = Column(String(255), nullable=True, unique=True)
    auth_provider = Column(String(50), default="email")
    password_hash = Column(String(255), nullable=False)
    experience_level = Column(String(50), default="intermediate")
    preferred_market = Column(String(50), default="forex")
    created_at = Column(DateTime, default=_now, nullable=False)

    strategies = relationship("Strategy", back_populates="user", cascade="all, delete-orphan")


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String(128), primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    symbol = Column(String(128), nullable=True)
    rows = Column(Integer, nullable=False, default=0)
    start = Column(DateTime, nullable=True)
    end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    backtests = relationship("Backtest", back_populates="dataset", cascade="all, delete-orphan")


class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    strategy_name = Column(String(255), nullable=False)
    strategy_type = Column(String(50), nullable=False)
    strategy_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, default=_now, nullable=False)

    user = relationship("User", back_populates="strategies")
    backtests = relationship("Backtest", back_populates="strategy")

    @property
    def config(self) -> dict:
        return json.loads(self.strategy_json or "{}")

    @config.setter
    def config(self, value: dict) -> None:
        self.strategy_json = json.dumps(value or {}, sort_keys=True)


class Backtest(Base):
    __tablename__ = "backtests"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(String(128), ForeignKey("datasets.id"), nullable=False, index=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=True, index=True)
    strategy_name = Column(String(255), nullable=False)
    timeframe = Column(String(20), nullable=True, default="1m")
    parameters = Column(Text, nullable=False, default="{}")
    profit = Column(Float, nullable=False, default=0.0)
    win_rate = Column(Float, nullable=False, default=0.0)
    total_trades = Column(Integer, nullable=False, default=0)
    max_drawdown = Column(Float, nullable=False, default=0.0)
    profit_factor = Column(Float, nullable=True)
    sharpe_ratio = Column(Float, nullable=True)
    metrics_json = Column(Text, nullable=False, default="{}")
    trade_setups_json = Column(Text, nullable=False, default="[]")
    equity_curve_json = Column(Text, nullable=False, default="[]")
    drawdown_curve_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, default=_now, nullable=False)

    dataset = relationship("Dataset", back_populates="backtests")
    strategy = relationship("Strategy", back_populates="backtests")
    trades = relationship("Trade", back_populates="backtest", cascade="all, delete-orphan")
    signals = relationship("Signal", back_populates="backtest", cascade="all, delete-orphan")

    @property
    def params(self) -> dict:
        return json.loads(self.parameters or "{}")

    @params.setter
    def params(self, value: dict) -> None:
        self.parameters = json.dumps(value or {}, sort_keys=True)

    @property
    def metrics(self) -> dict:
        return json.loads(self.metrics_json or "{}")

    @metrics.setter
    def metrics(self, value: dict) -> None:
        self.metrics_json = json.dumps(value or {}, sort_keys=True)

    @property
    def trade_setups(self) -> list[dict]:
        return json.loads(self.trade_setups_json or "[]")

    @trade_setups.setter
    def trade_setups(self, value: list[dict]) -> None:
        self.trade_setups_json = json.dumps(value or [])

    @property
    def equity_curve(self) -> list[dict]:
        return json.loads(self.equity_curve_json or "[]")

    @equity_curve.setter
    def equity_curve(self, value: list[dict]) -> None:
        self.equity_curve_json = json.dumps(value or [])

    @property
    def drawdown_curve(self) -> list[dict]:
        return json.loads(self.drawdown_curve_json or "[]")

    @drawdown_curve.setter
    def drawdown_curve(self, value: list[dict]) -> None:
        self.drawdown_curve_json = json.dumps(value or [])


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    backtest_id = Column(Integer, ForeignKey("backtests.id"), nullable=False, index=True)
    entry_time = Column(Float, nullable=True)
    exit_time = Column(Float, nullable=True)
    entry_price = Column(Float, nullable=True)
    exit_price = Column(Float, nullable=True)
    position = Column(String(10), nullable=False, default="BUY")
    pnl = Column(Float, nullable=False, default=0.0)
    duration = Column(Float, nullable=True)
    trade_score = Column(Float, nullable=True)
    risk_level = Column(String(32), nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    backtest = relationship("Backtest", back_populates="trades")


class Signal(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, index=True)
    backtest_id = Column(Integer, ForeignKey("backtests.id"), nullable=False, index=True)
    signal_type = Column(String(10), nullable=False)
    timestamp = Column(Float, nullable=True)
    price = Column(Float, nullable=True)
    candle_index = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    backtest = relationship("Backtest", back_populates="signals")


class TradingSession(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_name = Column(String(255), nullable=False)
    broker = Column(String(50), nullable=False, default="oanda")
    symbol = Column(String(50), nullable=False)
    balance = Column(Float, nullable=False, default=10000.0)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    session_trades = relationship("SessionTrade", back_populates="session", cascade="all, delete-orphan")


class SessionTrade(Base):
    __tablename__ = "session_trades"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    symbol = Column(String(50), nullable=False)
    side = Column(String(10), nullable=False)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    quantity = Column(Float, nullable=False)
    pnl = Column(Float, nullable=True)
    timestamp = Column(Float, nullable=True)

    session = relationship("TradingSession", back_populates="session_trades")
