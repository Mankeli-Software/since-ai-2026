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

    # Cost and abuse guard (plan 4.2, #18). In-memory: one Cloud Run instance, STORE=memory.
    turns_per_minute: int = 10  # AGENT_TURNS_PER_MINUTE, per session_id
    sessions_per_minute: int = 60  # AGENT_SESSIONS_PER_MINUTE, global bucket on POST /api/sessions
    daily_model_call_cap: int = (
        2000  # AGENT_DAILY_MODEL_CALL_CAP; past it new sessions are scripted
    )
    session_max_model_calls: int = 60  # AGENT_SESSION_MAX_MODEL_CALLS, per-session UX guard
    session_max_tokens: int = 300_000  # AGENT_SESSION_MAX_TOKENS, input + output per session
    max_tool_turns: int = 10  # AGENT_MAX_TOOL_TURNS, Genkit tool-loop cap per turn (default 50)
    demo_keys: str = ""  # AGENT_DEMO_KEYS, comma-separated X-Demo-Key values that skip limits
    # Rough USD per million tokens, only for the estimated cost in the model_call log line.
    price_in_per_mtok: float = 3.0  # AGENT_PRICE_IN_PER_MTOK
    price_out_per_mtok: float = 15.0  # AGENT_PRICE_OUT_PER_MTOK

    @model_validator(mode="after")
    def _fill_defaults(self) -> "AgentSettings":
        chat, fast = _DEFAULTS[self.llm_provider]
        self.model_chat = self.model_chat or chat
        self.model_fast = self.model_fast or fast
        return self


settings = AgentSettings()
