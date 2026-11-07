"""Voice conversation contracts (#51). The fitter's replies are spoken with ElevenLabs when a key is
set, otherwise by the browser. Speech-to-text runs in the browser (Web Speech API)."""

from typing import Literal

from pydantic import BaseModel, Field


class VoiceInfo(BaseModel):
    """`GET /api/voice`: which voice the studio talks with."""

    tts: Literal["elevenlabs", "browser"]
    max_chars: int


class SpeakIn(BaseModel):
    """`POST /api/sessions/{id}/voice/tts`: one or two sentences of the fitter's reply."""

    text: str = Field(min_length=1, max_length=600)
    lang: Literal["en", "fi"] | None = None
    previous_text: str | None = Field(
        default=None, max_length=600, description="The sentence before, for smoother intonation"
    )
