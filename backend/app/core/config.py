"""Application settings loaded from environment variables (and a local .env file).

Nothing secret is hardcoded here: DATABASE_URL and JWT_SECRET_KEY have no default on purpose,
so the app refuses to start without them instead of silently using made-up credentials.
"""

from decimal import Decimal
from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_title: str = "Enterprise Business Insights API"
    app_version: str = "5.0.0"

    # SecretStr keeps the password out of repr()/logs.
    database_url: SecretStr
    db_echo: bool = False

    cors_origins: str = "*"

    # Authentication. No default on purpose: the app refuses to start without a signing secret,
    # so a made-up secret can never end up in production by accident.
    jwt_secret_key: SecretStr
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=60, ge=1, le=1440)
        # Business alert rules (Task 6). All configurable through environment variables.
    # An order worth at least this much (INR) triggers a "High-Value Order" alert.
    high_value_order_threshold: Decimal = Field(default=Decimal("200000"), gt=0)
    # Revenue (completed orders, INR) for one reporting period: above target = good news, below = warning.
    revenue_target: Decimal = Field(default=Decimal("250000"), gt=0)
    # Fewer completed orders than this in one reporting period raises a "Low Sales" alert.
    low_sales_threshold: int = Field(default=5, ge=1)
    # Length of the reporting period the two rules above look at (days, ending yesterday).
    alert_period_days: int = Field(default=1, ge=1, le=30)

    # Reporting rules (see README "KPI definitions").
    kpi_period_days: int = Field(default=30, ge=1, le=365)
    trend_days: int = Field(default=7, ge=2, le=90)
    recent_activity_limit: int = Field(default=5, ge=1, le=20)

    # Fallback identity, only used if the dashboard is built without a logged-in user.
    default_user_id: str = "u_001"
    default_user_name: str = "Jeeva"
    default_user_role: str = "Regional Manager"

    @field_validator("jwt_secret_key")
    @classmethod
    def _secret_long_enough(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters long.")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # secrets come from the environment