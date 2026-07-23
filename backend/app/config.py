"""Application configuration.

Settings are loaded from environment variables (and an optional ``.env`` file).
All values have safe MVP defaults so the service runs without any configuration.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class DemoActor(BaseModel):
    """Server-injected demo identity. The frontend MUST NOT be trusted for identity."""

    actor_id: str = "demo-cold-room-admin"
    display_name: str = "冷库管理员"
    role: str = "operator"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Runtime ---
    app_name: str = "ColdPilot Backend"
    # SQLite is stored relative to the backend working directory.
    database_url: str = "sqlite+aiosqlite:///./data/coldpilot.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # --- Agent ---
    agent_mode: Literal["deterministic", "llm"] = "deterministic"
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    llm_request_timeout_seconds: float = 30.0

    # --- Async worker ---
    worker_poll_interval_seconds: float = 0.5
    # A running task older than this is treated as stale after a crash/restart.
    worker_stale_running_timeout_seconds: float = 120.0
    worker_requeue_batch_size: int = 50

    # --- Task timeouts (guard against tasks stuck in running forever) ---
    diagnosis_total_timeout_seconds: float = 60.0
    execution_total_timeout_seconds: float = 120.0

    # --- Server-injected identity (MVP: fixed demo operator) ---
    demo_actor: DemoActor = DemoActor()

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_base_url and self.llm_api_key and self.llm_model)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
