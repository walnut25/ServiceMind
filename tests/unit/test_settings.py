"""Unit tests for the configuration module: defaults, overrides, isolation."""

from __future__ import annotations

import dataclasses

import pytest

from config.settings import Settings

pytestmark = pytest.mark.unit

ENV_KEYS = [
    "API_BASE_URL",
    "API_PREFIX",
    "API_TIMEOUT",
    "HEALTH_TIMEOUT",
    "UI_BASE_URL",
    "UI_PORT",
    "UI_EXTERNAL_SERVER",
    "UI_BROWSER_CHANNEL",
    "UI_HEADLESS",
    "UI_SCREENSHOTS",
    "UI_TIMEOUT_MS",
    "FRONTEND_DIST",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USERNAME",
    "DB_PASSWORD",
    "DB_CHECKS_ENABLED",
    "AI_CHAT_ENABLED",
    "JWT_SECRET",
    "JWT_TTL_SECONDS",
    "QA_RUN_ID",
]


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Hermetic settings: ignore whatever the developer or CI exported."""
    for key in ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


class TestDefaults:
    def test_defaults_match_the_local_compose_stack(self):
        settings = Settings()

        assert settings.base_url == "http://127.0.0.1:8081"
        assert settings.api_prefix == "/api/v1"
        assert settings.admin_username == "admin"
        assert settings.db_port == 3307
        assert settings.run_id == "local"

    def test_browser_defaults_to_bundled_chromium(self):
        settings = Settings()

        assert settings.ui_browser_channel == "", "default must not require a system Chrome"
        assert settings.ui_headless is True
        assert settings.ui_screenshots is True

    def test_ui_server_defaults(self):
        settings = Settings()

        assert settings.ui_port == 8090
        assert settings.ui_external_server is False

    def test_computed_urls(self):
        settings = Settings()

        assert settings.api_root == "http://127.0.0.1:8081/api/v1"
        assert settings.health_url == "http://127.0.0.1:8081/actuator/health"

    def test_trailing_slash_in_base_url_is_normalised(self, monkeypatch):
        monkeypatch.setenv("API_BASE_URL", "http://backend:8081/")

        settings = Settings()

        assert settings.api_root == "http://backend:8081/api/v1"


class TestOverrides:
    def test_string_override(self, monkeypatch):
        monkeypatch.setenv("API_BASE_URL", "http://ci:9000")

        assert Settings().base_url == "http://ci:9000"

    def test_int_override(self, monkeypatch):
        monkeypatch.setenv("API_TIMEOUT", "45")
        monkeypatch.setenv("UI_PORT", "9100")

        settings = Settings()

        assert settings.request_timeout == 45
        assert settings.ui_port == 9100

    @pytest.mark.parametrize("raw", ["1", "true", "TRUE", "yes", "on"])
    def test_truthy_booleans(self, monkeypatch, raw):
        monkeypatch.setenv("UI_EXTERNAL_SERVER", raw)

        assert Settings().ui_external_server is True

    @pytest.mark.parametrize("raw", ["0", "false", "no", "off"])
    def test_falsy_booleans(self, monkeypatch, raw):
        monkeypatch.setenv("UI_EXTERNAL_SERVER", raw)

        assert Settings().ui_external_server is False

    def test_empty_boolean_falls_back_to_default(self, monkeypatch):
        monkeypatch.setenv("DB_CHECKS_ENABLED", "")

        assert Settings().db_enabled is True

    def test_non_numeric_integer_fails_loudly(self, monkeypatch):
        monkeypatch.setenv("API_TIMEOUT", "soon")

        with pytest.raises(ValueError):
            Settings()


class TestBrowserChannel:
    def test_unset_means_bundled(self):
        assert Settings().ui_browser_channel == ""

    def test_explicit_empty_means_bundled(self, monkeypatch):
        monkeypatch.setenv("UI_BROWSER_CHANNEL", "")

        assert Settings().ui_browser_channel == ""

    def test_channel_is_passed_through(self, monkeypatch):
        monkeypatch.setenv("UI_BROWSER_CHANNEL", "chrome")

        assert Settings().ui_browser_channel == "chrome"


class TestIsolation:
    def test_settings_are_immutable(self):
        settings = Settings()

        with pytest.raises(dataclasses.FrozenInstanceError):
            settings.base_url = "http://changed"  # type: ignore[misc]

    def test_existing_instance_is_not_affected_by_later_env_changes(self, monkeypatch):
        first = Settings()
        monkeypatch.setenv("API_BASE_URL", "http://later:1234")
        second = Settings()

        assert first.base_url != second.base_url
        assert second.base_url == "http://later:1234"

    def test_two_instances_with_the_same_env_are_equal(self):
        assert Settings() == Settings()
