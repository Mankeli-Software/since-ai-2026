"""Genkit setup (plan 4.1). The ONLY place that builds the Genkit instance.

Provider = AGENT_LLM_PROVIDER (anthropic | google, see settings.py).
Callers use `ai`, `CHAT`, `FAST` only.
Imports without any API key: the plugins check the key on the first call.
"""

import os

from genkit import Genkit
from genkit_anthropic import Anthropic, AnthropicConfig
from genkit_anthropic import (
    _model_info as mi,
)  # PRIVATE API: OK only because genkit-anthropic is pinned
from genkit_google_genai import GeminiConfig, GoogleAI

from .settings import settings

# genkit-anthropic 0.13.0 lists no 5.5 ids. Without an entry, structured output falls back
# to prompt-only JSON.
# BASE keys come from the spike dump (spike/VERDICT.md check 1): newest same-family entry with
# constrained=ALL. Haiku 4.5 is the only Haiku entry.
BASE: dict[str, str] = {
    "claude-sonnet-5-5": "claude-sonnet-5",
    "claude-haiku-5-5": "claude-haiku-4-5",
}
for _mid, _key in BASE.items():
    _base = mi.SUPPORTED_ANTHROPIC_MODELS[_key]  # type: ignore[index]
    mi.SUPPORTED_ANTHROPIC_MODELS.setdefault(  # type: ignore[call-overload]
        _mid,
        _base.model_copy(update={"label": f"Anthropic - {_mid}", "versions": [_mid]}),
    )

if settings.llm_provider == "google":
    # GoogleAI() raises at construction without a key; a placeholder keeps the import
    # key-free (fails on first call).
    ai = Genkit(plugins=[GoogleAI(api_key=os.environ.get("GEMINI_API_KEY") or "unset")])
    # Gemini caches the prompt prefix implicitly: leave config.context_cache unset.
    # include_thoughts keeps thought parts (and signatures) in the response so they replay.
    CHAT = GoogleAI.gemini(
        settings.model_chat,
        config=GeminiConfig(thinking_level="LOW", include_thoughts=True, max_output_tokens=8000),
    )
    FAST = GoogleAI.gemini(
        settings.model_fast,
        config=GeminiConfig(thinking_level="LOW", max_output_tokens=4000),
    )
else:
    ai = Genkit(plugins=[Anthropic()])
    CACHE = {"cache_control": {"type": "ephemeral"}}
    CHAT = Anthropic.claude(
        settings.model_chat,
        config=AnthropicConfig(
            thinking="adaptive",
            thinking_display="summarized",  # non-empty thinking survives Genkit's round trip
            effort="low",
            max_output_tokens=8000,
            extra=CACHE,
        ),
    )
    FAST = Anthropic.claude(
        settings.model_fast,
        config=AnthropicConfig(thinking="disabled", effort="low", max_output_tokens=4000),
    )
