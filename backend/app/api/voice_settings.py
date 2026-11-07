"""Voice settings (#51, FLOATER). Prefix `VOICE_`; the ElevenLabs key keeps the plan's name.

No key = no ElevenLabs: `POST .../voice/tts` answers 503 `voice_unavailable` and the browser speaks
with its own voice (Web Speech). The scripted demo never needs a key (invariant 8).
"""

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class VoiceSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="VOICE_", extra="ignore")

    elevenlabs_api_key: str = Field(
        default="", validation_alias=AliasChoices("ELEVENLABS_API_KEY", "VOICE_ELEVENLABS_API_KEY")
    )
    voice_id: str = "JBFqnCBsd6RMkjVDRZzb"  # VOICE_VOICE_ID, ElevenLabs premade "George"
    model_id: str = (
        "eleven_flash_v2_5"  # VOICE_MODEL_ID, ~75 ms latency, speaks English and Finnish
    )
    output_format: str = "mp3_44100_64"  # VOICE_OUTPUT_FORMAT
    base_url: str = "https://api.elevenlabs.io"  # VOICE_BASE_URL

    # Cost guard: the route speaks any text it is given, so it is capped like the chat (#18).
    max_chars: int = 600  # VOICE_MAX_CHARS, per request (one or two sentences)
    session_chars: int = 12_000  # VOICE_SESSION_CHARS, a whole fitting spoken is ~4-6k
    requests_per_minute: int = 40  # VOICE_REQUESTS_PER_MINUTE, per session
    daily_chars: int = (
        400_000  # VOICE_DAILY_CHARS, all sessions; past it the browser voice takes over
    )


settings = VoiceSettings()
