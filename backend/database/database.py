"""
database.py — SQLAlchemy engine, session factory, and declarative base.

Reads DATABASE_URL from environment. Tables are created via
Base.metadata.create_all() on startup — no dynamic ALTER TABLE migrations.
"""
from __future__ import annotations

import logging
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.core.settings import DATABASE_URL

logger = logging.getLogger(__name__)

_SQLITE_FALLBACK_URL = "sqlite:///./algotradex_local.db"
_requested_url = DATABASE_URL or ""
_effective_url = ""
_schema_initialized = False


def _normalize_database_url(url: str | None) -> str:
    normalized = (url or "").strip()
    if not normalized:
        return _SQLITE_FALLBACK_URL

    if normalized.startswith("postgresql") and "+asyncpg" in normalized:
        return normalized.replace("+asyncpg", "+psycopg2")

    if normalized.startswith("postgresql://") and "+psycopg2" not in normalized:
        return normalized.replace("postgresql://", "postgresql+psycopg2://", 1)

    return normalized


def _make_engine(url: str):
    is_postgres = url.startswith("postgresql")
    connect_args = {"check_same_thread": False} if not is_postgres else {}
    return create_engine(
        url,
        connect_args=connect_args,
        pool_pre_ping=True,
        echo=False,
    )


def configure_database(url: str | None = None) -> None:
    global _requested_url, _effective_url, engine, SessionLocal, _schema_initialized

    _requested_url = (url or "").strip()
    _effective_url = _normalize_database_url(_requested_url)
    engine = _make_engine(_effective_url)
    SessionLocal.configure(bind=engine)
    _schema_initialized = False


engine = _make_engine(_normalize_database_url(_requested_url))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
_effective_url = str(engine.url)

Base = declarative_base()


def get_db() -> Generator:
    _ensure_database_connection()
    _ensure_schema()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables declared in models that don't yet exist. Safe to call
    repeatedly — uses CREATE TABLE IF NOT EXISTS semantics via SQLAlchemy."""
    import backend.database.models  # noqa: F401 — registers models with Base metadata

    _ensure_database_connection()
    _ensure_schema(force=True)


def _ensure_schema(force: bool = False) -> None:
    global _schema_initialized

    import backend.database.models  # noqa: F401 — registers models with Base metadata

    if _schema_initialized and not force:
        return

    Base.metadata.create_all(bind=engine)
    _schema_initialized = True


def _ensure_database_connection() -> None:
    global _effective_url, _schema_initialized

    try:
        with engine.connect():
            return
    except SQLAlchemyError as exc:
        if str(engine.url) == _SQLITE_FALLBACK_URL:
            raise

        logger.warning("Primary database connection failed. Falling back to SQLite.", exc_info=exc)
        configure_database(None)
        _schema_initialized = False

    with engine.connect():
        _effective_url = str(engine.url)


def escape_csv_value(value: str | None) -> str:
    if value is None:
        return ""
    value = str(value)
    escaped = value.replace('"', '""')
    return '"' + escaped + '"'
