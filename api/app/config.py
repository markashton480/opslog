from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://opslog:opslog@localhost:5432/opslog"
    api_host: str = "0.0.0.0"
    api_port: int = 8600
    log_level: str = "INFO"
    app_version: str = "0.3.0"
    max_request_bytes: int = 512 * 1024
    max_detail_bytes: int = 200 * 1024
    max_metadata_bytes: int = 200 * 1024
    oidc_enabled: bool = False
    oidc_issuer: str | None = None
    oidc_audience: str | None = None
    oidc_username_claim: str = "preferred_username"
    oidc_algorithms: list[str] = ["RS256"]
    oidc_jwks_url: str | None = None
    oidc_jwks_ttl_seconds: int = 3600
    oidc_http_timeout_seconds: float = 5.0

    @field_validator("oidc_algorithms", mode="before")
    @classmethod
    def _parse_oidc_algorithms(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    model_config = SettingsConfigDict(env_file=".env", extra="allow")


settings = Settings()
