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
    oidc_jwks_url: str | None = None
    oidc_jwks_ttl_seconds: int = 3600
    oidc_http_timeout_seconds: float = 5.0

    model_config = SettingsConfigDict(env_file=".env", extra="allow")


settings = Settings()
