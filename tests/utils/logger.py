"""Structured test logging: console + per-run file with request/response traces.

The file handler is best-effort: on a locked-down workspace the log directory
may not be writable, and losing the log file must never fail a test.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from config.settings import TESTS_ROOT

LOG_DIR = Path(os.getenv("QA_LOG_DIR") or (TESTS_ROOT / "reports" / "logs"))
_configured = False


def configure_logging(level: int = logging.INFO) -> None:
    """Configure the logger once per process (pytest-xdist friendly)."""
    global _configured
    if _configured:
        return
    fmt = logging.Formatter(
        "%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    root = logging.getLogger("qa")
    root.setLevel(level)
    root.propagate = False

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    root.addHandler(console)

    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(LOG_DIR / "automation.log", encoding="utf-8")
        file_handler.setFormatter(fmt)
        root.addHandler(file_handler)
    except OSError as exc:  # read-only workspace: console logging is enough
        root.warning("file logging disabled (%s)", exc)

    _configured = True


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    return logging.getLogger(f"qa.{name}")


def truncate(payload: object, limit: int = 600) -> str:
    text = repr(payload)
    return text if len(text) <= limit else text[:limit] + f"... ({len(text)} chars)"
