import re
from collections.abc import Iterator

import pytest

from app.config import settings
from app.main import validate_startup_config


@pytest.fixture
def startup_settings_override() -> Iterator[None]:
    original_enabled = settings.oidc_enabled
    original_issuer = settings.oidc_issuer
    original_audience = settings.oidc_audience
    original_algorithms = list(settings.oidc_algorithms)
    try:
        yield
    finally:
        settings.oidc_enabled = original_enabled
        settings.oidc_issuer = original_issuer
        settings.oidc_audience = original_audience
        settings.oidc_algorithms = original_algorithms


def test_validate_startup_config_allows_oidc_disabled(startup_settings_override):
    settings.oidc_enabled = False
    settings.oidc_issuer = None
    settings.oidc_audience = None
    validate_startup_config()


def test_validate_startup_config_requires_issuer_and_audience(startup_settings_override):
    settings.oidc_enabled = True
    settings.oidc_issuer = None
    settings.oidc_audience = None

    with pytest.raises(
        RuntimeError,
        match=re.escape("OIDC_ENABLED=true requires OIDC_ISSUER, OIDC_AUDIENCE"),
    ):
        validate_startup_config()


def test_validate_startup_config_requires_algorithm(startup_settings_override):
    settings.oidc_enabled = True
    settings.oidc_issuer = "https://id.example.com/realms/lintel"
    settings.oidc_audience = "opslog-dev"
    settings.oidc_algorithms = []

    with pytest.raises(RuntimeError, match="at least one OIDC algorithm"):
        validate_startup_config()
