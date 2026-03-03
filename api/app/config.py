from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://opslog:opslog@localhost:5432/opslog"
    api_host: str = "0.0.0.0"
    api_port: int = 8600
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
