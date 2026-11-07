"""GLOBAL settings only. Lanes put their own settings in `<package>/settings.py` with an env
prefix (`EVIDENCE_`, `AGENT_`, ...). Nothing here may require an API key (scripted mode)."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")  # `.env` is loaded by just (dotenv-load)

    llm_mode: Literal["mock", "live"] = "mock"  # LLM_MODE; mock -> sessions default to scripted
    store: Literal["memory", "firestore"] = "memory"  # STORE
    allowed_frame_ancestors: str = "'self'"  # ALLOWED_FRAME_ANCESTORS, space-separated
    port: int = 8080  # PORT


@lru_cache
def get_settings() -> Settings:
    return Settings()
