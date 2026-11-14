"""Read-only MySQL helper for assertions the HTTP API cannot express.

Used sparingly: audit rows, optimistic-lock counters and computed columns.
Every query is a SELECT - the suite never mutates data behind the API's back.
"""

from __future__ import annotations

from typing import Any, Sequence

from config.settings import Settings, settings as default_settings
from utils.logger import get_logger

logger = get_logger("db")


class DbHelper:
    def __init__(self, settings: Settings = default_settings) -> None:
        self.settings = settings
        self._conn: Any | None = None
        self._error: str | None = None

    # -- lifecycle -----------------------------------------------------------
    def _connect(self) -> Any:
        if self._conn is not None:
            return self._conn
        if self._error:
            return None
        try:
            import pymysql

            self._conn = pymysql.connect(
                host=self.settings.db_host,
                port=self.settings.db_port,
                user=self.settings.db_user,
                password=self.settings.db_password,
                database=self.settings.db_name,
                charset="utf8mb4",
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=True,
                connect_timeout=5,
            )
            logger.info("connected to MySQL at %s:%s", self.settings.db_host, self.settings.db_port)
        except Exception as exc:  # pragma: no cover - environment dependent
            self._error = str(exc)
            logger.warning("database checks unavailable: %s", exc)
        return self._conn

    @property
    def available(self) -> bool:
        if not self.settings.db_enabled:
            return False
        return self._connect() is not None

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    # -- queries -------------------------------------------------------------
    def query(self, sql: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
        conn = self._connect()
        assert conn is not None, f"database not reachable: {self._error}"
        with conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            return list(cursor.fetchall())

    def one(self, sql: str, params: Sequence[Any] | None = None) -> dict[str, Any] | None:
        rows = self.query(sql, params)
        return rows[0] if rows else None

    def scalar(self, sql: str, params: Sequence[Any] | None = None) -> Any:
        row = self.one(sql, params)
        if row is None:
            return None
        return next(iter(row.values()))

    # -- domain helpers ------------------------------------------------------
    def ticket_version(self, ticket_id: int) -> int | None:
        return self.scalar("SELECT version FROM tickets WHERE id = %s", (ticket_id,))

    def audit_event_types(self, ticket_id: int) -> list[str]:
        rows = self.query(
            "SELECT event_type FROM ticket_audit_events WHERE ticket_id = %s ORDER BY created_at ASC, id ASC",
            (ticket_id,),
        )
        return [row["event_type"] for row in rows]

    def audit_rows(self, ticket_id: int) -> list[dict[str, Any]]:
        return self.query(
            "SELECT id, event_type, actor_username, details, created_at "
            "FROM ticket_audit_events WHERE ticket_id = %s ORDER BY created_at ASC, id ASC",
            (ticket_id,),
        )

    def comment_count(self, ticket_id: int) -> int:
        return int(self.scalar("SELECT COUNT(*) FROM ticket_comments WHERE ticket_id = %s", (ticket_id,)) or 0)
