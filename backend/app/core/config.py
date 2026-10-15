"""Application settings loaded from environment variables (and a local .env file).

Nothing secret is hardcoded here: DATABASE_URL has no default on purpose, so the app
refuses to start without it instead of silently using made-up credentials.
"""

from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_title: str = "Enterprise Business Insights API"
    app_version: str = "3.0.0"

    # SecretStr keeps the password out of repr()/logs.
    database_url: SecretStr
    db_echo: bool = False

    cors_origins: str = "*"

    # Reporting rules (see README "KPI definitions").
    kpi_period_days: int = Field(default=30, ge=1, le=365)
    trend_days: int = Field(default=7, ge=2, le=90)
    recent_activity_limit: int = Field(default=5, ge=1, le=20)

    # Placeholder identity until authentication exists.
    default_user_id: str = "u_001"
    default_user_name: str = "Jeeva"
    default_user_role: str = "Regional Manager"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # database_url comes from the environment