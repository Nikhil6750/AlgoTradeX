from pathlib import Path
import sys

from sqlalchemy import inspect, text

sys.path.append(str(Path(__file__).resolve().parents[1]))

import backend.database.database as database


def test_init_db_archives_legacy_trades_and_creates_research_tables(tmp_path):
    db_path = tmp_path / "schema_regression.sqlite"
    original_url = str(database.engine.url)

    try:
        database.configure_database(f"sqlite:///{db_path}")

        with database.engine.begin() as connection:
            connection.exec_driver_sql(
                "CREATE TABLE trades (id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL, position TEXT NOT NULL, pnl FLOAT NOT NULL)"
            )
            connection.exec_driver_sql("CREATE INDEX ix_trades_id ON trades (id)")

        database.init_db()

        inspector = inspect(database.engine)
        table_names = set(inspector.get_table_names())
        assert {"datasets", "strategies", "backtests", "trades", "signals", "trades_legacy"}.issubset(table_names)

        with database.engine.connect() as connection:
            indexes = {
                (row[0], row[1])
                for row in connection.execute(text("""
                    SELECT name, tbl_name
                    FROM sqlite_master
                    WHERE type = 'index'
                """)).fetchall()
            }

        assert ("ix_trades_id", "trades") in indexes
    finally:
        database.configure_database(original_url)
