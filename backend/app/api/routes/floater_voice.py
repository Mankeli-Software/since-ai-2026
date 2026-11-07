"""Voice conversation (#51): the fitter talks back with ElevenLabs.

- `GET /api/voice` -> `VoiceInfo`: `elevenlabs` when a key is set, else `browser`.
- `POST /api/sessions/{id}/voice/tts` -> `audio/mpeg`, streamed from ElevenLabs as it renders.

The web app splits each streaming reply into sentences and asks for them one by one, so the first
words play while the rest of the reply is still arriving. Without a key, past the caps, or when
ElevenLabs fails, the route answers with `{code, message}` and the browser speaks the sentence with
its own voice: the conversation never stops because of TTS. No text is stored.
"""

import logging
import time
from collections import deque
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.agent.guard import is_demo
from app.api.deps import SessionDep
from app.api.guard_deps import DemoKeyHeader
from app.api.voice_settings import settings
from app.core.errors import AppError
from app.schemas.voice import SpeakIn, VoiceInfo

log = logging.getLogger(__name__)
router = APIRouter(tags=["voice"])


class VoiceUnavailableError(AppError):
    status_code = 503
    code = "voice_unavailable"


class VoiceLimitError(AppError):
    status_code = 429
    code = "voice_limit"
    retryable = True


class VoiceUpstreamError(AppError):
    status_code = 502
    code = "voice_failed"
    retryable = True


# In memory, like the chat guard: one Cloud Run instance (agent/guard.py).
_WINDOW_S = 60.0
_RECENT: dict[str, deque[float]] = {}
_SESSION_CHARS: dict[str, int] = {}
_daily = {"day": "", "chars": 0}
_client: httpx.AsyncClient | None = None


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=settings.base_url, timeout=httpx.Timeout(20.0, connect=5.0)
        )
    return _client


def _charge(session_id: str, chars: int, demo_key: str | None) -> None:
    """Raise 429 past the per-minute, per-session or daily caps; otherwise count the characters."""
    today = datetime.now(UTC).date().isoformat()
    if _daily["day"] != today:
        _daily["day"], _daily["chars"] = today, 0
    if not is_demo(demo_key):
        now = time.monotonic()
        recent = _RECENT.setdefault(session_id, deque())
        while recent and now - recent[0] > _WINDOW_S:
            recent.popleft()
        if len(recent) >= settings.requests_per_minute:
            raise VoiceLimitError("Talking a bit fast. The fitter's text is on screen.")
        if _SESSION_CHARS.get(session_id, 0) + chars > settings.session_chars:
            raise VoiceLimitError("This fitting has used its voice time. Replies stay on screen.")
        if _daily["chars"] + chars > settings.daily_chars:
            log.warning("voice_daily_cap", extra={"chars": _daily["chars"]})
            raise VoiceLimitError("The fitter's voice is resting for today.")
        recent.append(now)
    _SESSION_CHARS[session_id] = _SESSION_CHARS.get(session_id, 0) + chars
    _daily["chars"] += chars


@router.get("/api/voice")
async def voice_info() -> VoiceInfo:
    return VoiceInfo(
        tts="elevenlabs" if settings.elevenlabs_api_key else "browser",
        max_chars=settings.max_chars,
    )


@router.post(
    "/api/sessions/{session_id}/voice/tts",
    response_class=StreamingResponse,
    responses={200: {"content": {"audio/mpeg": {}}, "description": "Spoken audio (MP3)"}},
)
async def speak(session: SessionDep, body: SpeakIn, demo_key: DemoKeyHeader = None):
    if not settings.elevenlabs_api_key:
        raise VoiceUnavailableError("No ElevenLabs key: the browser voice speaks instead.")
    text = body.text.strip()[: settings.max_chars]
    _charge(session.id, len(text), demo_key)

    payload: dict[str, object] = {"text": text, "model_id": settings.model_id}
    if body.lang:
        payload["language_code"] = body.lang
    if body.previous_text:
        payload["previous_text"] = body.previous_text[: settings.max_chars]
    req = _http().build_request(
        "POST",
        f"/v1/text-to-speech/{settings.voice_id}/stream",
        params={"output_format": settings.output_format},
        headers={"xi-api-key": settings.elevenlabs_api_key, "accept": "audio/mpeg"},
        json=payload,
    )
    try:
        upstream = await _http().send(req, stream=True)
    except httpx.HTTPError as e:
        log.warning("voice_upstream_error", extra={"error": type(e).__name__})
        raise VoiceUpstreamError("The fitter's voice didn't load. The text is on screen.") from e
    if upstream.status_code != 200:
        detail = (await upstream.aread())[:200]
        await upstream.aclose()
        log.warning("voice_upstream_status", extra={"status": upstream.status_code, "body": detail})
        raise VoiceUpstreamError("The fitter's voice didn't load. The text is on screen.")
    log.info("voice_tts", extra={"session_id": session.id, "chars": len(text)})
    return StreamingResponse(
        upstream.aiter_bytes(),
        media_type="audio/mpeg",
        headers={"cache-control": "no-store"},
        background=BackgroundTask(upstream.aclose),
    )
