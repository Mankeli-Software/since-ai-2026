"""AGENT lane settings (AGENTS.md 1.3: lane env vars live in their package, prefix AGENT_).

Keys are NOT read here. Each plugin reads its own key on the first call:
Anthropic -> ANTHROPIC_API_KEY, Google -> GEMINI_API_KEY (the name the plugin reads).
"""

from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Per-provider defaults for AGENT_MODEL_CHAT / AGENT_MODEL_FAST.
_DEFAULTS = {
    "anthropic": ("claude-sonnet-5-5", "claude-haiku-5-5"),
    "google": ("gemini-3.1-pro-preview", "gemini-3.8-flash"),
}


class AgentSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AGENT_", extra="ignore", protected_namespaces=())

    llm_provider: Literal["anthropic", "google"] = "anthropic"  # AGENT_LLM_PROVIDER
    model_chat: str = ""  # AGENT_MODEL_CHAT, empty = provider default
    model_fast: str = ""  # AGENT_MODEL_FAST, empty = provider default

    @model_validator(mode="after")
    def _fill_defaults(self) -> "AgentSettings":
        chat, fast = _DEFAULTS[self.llm_provider]
        self.model_chat = self.model_chat or chat
        self.model_fast = self.model_fast or fast
        return self


settings = AgentSettings()
