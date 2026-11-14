"""Central configuration for the ServiceMind automation suite.

Every value can be overridden with an environment variable (or a ``.env``
file next to the ``tests`` directory), so the same suite runs against a local
stack, a Docker Compose stack or CI without code changes.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

TESTS_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = TESTS_ROOT.parent

load_dotenv(TESTS_ROOT / ".env")
load_dotenv(PROJECT_ROOT / ".env")


def _env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value not in (None, "") else default


def _env_raw(name: str, default: str) -> str:
    """Like ``_env``, but an explicitly empty value stays empty.

    ``UI_BROWSER_CHANNEL=""`` must mean "use Playwright's bundled Chromium", so
    it cannot fall back to the local default the way other settings do.
    """
    value = os.getenv(name)
    return default if value is None else value


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw in (None, ""):
        return default
    return int(raw)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw in (None, ""):
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    """Immutable runtime settings shared by API and UI tests."""

    base_url: str = field(default_factory=lambda: _env("API_BASE_URL", "http://127.0.0.1:8081"))
    ui_base_url: str = field(default_factory=lambda: _env("UI_BASE_URL", "http://127.0.0.1:8090"))
    # Port for the static server that serves frontend/dist during UI tests.
    # 0 asks the OS for a free port; UI_EXTERNAL_SERVER skips the server entirely.
    ui_port: int = field(default_factory=lambda: _env_int("UI_PORT", 8090))
    ui_external_server: bool = field(default_factory=lambda: _env_bool("UI_EXTERNAL_SERVER", False))
    api_prefix: str = field(default_factory=lambda: _env("API_PREFIX", "/api/v1"))
    frontend_dist: Path = field(
        default_factory=lambda: Path(_env("FRONTEND_DIST", str(PROJECT_ROOT / "frontend" / "dist")))
    )
    ui_headless: bool = field(default_factory=lambda: _env_bool("UI_HEADLESS", True))
    # Empty (the default) uses Playwright's bundled Chromium, which is what the
    # docs and CI install. Set "chrome" or "msedge" to reuse an installed browser.
    ui_browser_channel: str = field(default_factory=lambda: _env_raw("UI_BROWSER_CHANNEL", ""))
    ui_screenshots: bool = field(default_factory=lambda: _env_bool("UI_SCREENSHOTS", True))
    ui_timeout_ms: int = field(default_factory=lambda: _env_int("UI_TIMEOUT_MS", 15000))

    admin_username: str = field(default_factory=lambda: _env("ADMIN_USERNAME", "admin"))
    admin_password: str = field(default_factory=lambda: _env("ADMIN_PASSWORD", "Admin123!"))

    request_timeout: int = field(default_factory=lambda: _env_int("API_TIMEOUT", 20))
    health_timeout: int = field(default_factory=lambda: _env_int("HEALTH_TIMEOUT", 120))

    db_host: str = field(default_factory=lambda: _env("DB_HOST", "127.0.0.1"))
    db_port: int = field(default_factory=lambda: _env_int("DB_PORT", 3307))
    db_name: str = field(default_factory=lambda: _env("DB_NAME", "smart_service"))
    db_user: str = field(default_factory=lambda: _env("DB_USERNAME", "smart_service"))
    db_password: str = field(default_factory=lambda: _env("DB_PASSWORD", "smart_service"))
    db_enabled: bool = field(default_factory=lambda: _env_bool("DB_CHECKS_ENABLED", True))

    ai_enabled: bool = field(default_factory=lambda: _env_bool("AI_CHAT_ENABLED", False))

    # Only used to craft expired/forged tokens; empty means "skip those tests".
    jwt_secret: str = field(default_factory=lambda: _env("JWT_SECRET", ""))
    jwt_ttl_seconds: int = field(default_factory=lambda: _env_int("JWT_TTL_SECONDS", 1800))

    # Every run gets a unique suffix so repeated runs never collide and tests
    # never touch data created by a previous run.
    run_id: str = field(default_factory=lambda: _env("QA_RUN_ID", "local"))

    @property
    def api_root(self) -> str:
        return self.base_url.rstrip("/") + self.api_prefix

    @property
    def health_url(self) -> str:
        return self.base_url.rstrip("/") + "/actuator/health"


settings = Settings()
