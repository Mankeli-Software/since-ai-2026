"""Cost and abuse guard for the public link (plan 4.2, #18). In-memory, single instance.

- `check_session_create`: global token bucket on `POST /api/sessions`.
- `check_turn`: 10 turns/min per `session_id`, plus the per-session budget (UX guard) for live.
- `check_vision`: the same for screenshot reads, plus no live vision past the daily cap.
- `pick_engine`: past the global daily model-call cap, NEW sessions get `scripted` + a notice.
- `record_model_call`: one JSON log line per model call; bumps the daily and session counters.
- A valid `X-Demo-Key` (AGENT_DEMO_KEYS) skips every limit above.

No genkit here (the scripted path imports this); the Genkit middleware lives in `metering.py`.
The Anthropic workspace spend limit stays the real backstop.
"""

import hmac
import logging
import time
from collections import deque
from contextvars import ContextVar
from datetime import UTC, datetime

from app.agent.settings import settings
from app.core.errors import AppError
from app.schemas.common import Engine
from app.schemas.session import Budget, FitSession, SessionNotice

log = logging.getLogger(__name__)

WINDOW_S = 60.0
REPLAY_TEXT = "Replay mode: tap an option."
_NOTICE_REPLAY = (
    "Live chat is paused for today, so this is a replay of the simulated golfer's fitting. "
    "Tap the options to follow along. The numbers still come from Takomo's own rules."
)
_NOTICE_FORM = (
    "Live chat is paused for today. You can still get fitted with the form: "
    "the numbers come from Takomo's own rules either way."
)


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"
    retryable = True


class SessionBudgetError(AppError):
    status_code = 429
    code = "session_budget"


# ---------------------------------------------------------------- demo keys


def is_demo(key: str | None) -> bool:
    """True when `key` is one of AGENT_DEMO_KEYS (constant-time compare)."""
    if not key:
        return False
    keys = [k.strip() for k in settings.demo_keys.split(",") if k.strip()]
    return any(hmac.compare_digest(key.encode(), k.encode()) for k in keys)


# ---------------------------------------------------------------- limiters


class TokenBucket:
    """`rate` tokens per minute, burst `rate`."""

    def __init__(self, rate: int) -> None:
        self.rate = rate
        self.tokens = float(rate)
        self.at = time.monotonic()

    def take(self) -> bool:
        now = time.monotonic()
        self.tokens = min(self.rate, self.tokens + (now - self.at) * self.rate / WINDOW_S)
        self.at = now
        if self.tokens < 1:
            return False
        self.tokens -= 1
        return True


_SESSION_BUCKET = TokenBucket(settings.sessions_per_minute)
_TURNS: dict[str, deque[float]] = {}  # session_id -> turn timestamps in the last minute


def check_session_create(demo_key: str | None) -> None:
    if is_demo(demo_key):
        return
    if not _SESSION_BUCKET.take():
        log.warning("rate_limited", extra={"limit": "sessions_per_minute"})
        raise RateLimitedError("Too many new fittings right now. Try again in a minute.")


def check_turn(session: FitSession, demo_key: str | None) -> None:
    """Sliding window per session_id, then the per-session budget for live sessions."""
    if is_demo(demo_key):
        return
    now = time.monotonic()
    window = _TURNS.setdefault(session.id, deque())
    while window and now - window[0] > WINDOW_S:
        window.popleft()
    if len(window) >= settings.turns_per_minute:
        log.warning("rate_limited", extra={"limit": "turns_per_minute", "session_id": session.id})
        raise RateLimitedError("That was quick. Wait a few seconds and send it again.")
    window.append(now)
    if len(_TURNS) > 10_000:  # drop idle sessions so the dict stays small
        for sid in [s for s, w in _TURNS.items() if not w or now - w[-1] > WINDOW_S]:
            _TURNS.pop(sid, None)
    b = session.budget
    over_calls = b.model_calls >= settings.session_max_model_calls
    over_tokens = b.input_tokens + b.output_tokens >= settings.session_max_tokens
    if session.engine == "live" and (over_calls or over_tokens):
        log.warning("session_budget", extra={"session_id": session.id, **b.model_dump()})
        raise SessionBudgetError(
            "This fitting has reached its chat limit. Your result so far is kept: "
            "save it, or start a new fitting."
        )


def check_vision(session: FitSession, demo_key: str | None, *, live: bool) -> None:
    """Screenshot reads (#19) share the per-session window and budget with turns. Past the daily
    cap live vision is off: the golfer can still import a CSV or type the numbers."""
    if is_demo(demo_key):
        return
    check_turn(session, demo_key)
    if live and cap_reached():
        log.warning("daily_cap_reached", extra={"calls": daily_calls(), "flow": "vision"})
        raise RateLimitedError(
            "Reading screenshots is paused for today. Import a CSV or type the numbers instead."
        )


# ---------------------------------------------------------------- daily cap + engine choice


class _Daily:
    def __init__(self) -> None:
        self.day = ""
        self.calls = 0

    def _roll(self) -> None:
        today = datetime.now(UTC).date().isoformat()
        if today != self.day:
            self.day, self.calls = today, 0

    def add(self) -> int:
        self._roll()
        self.calls += 1
        return self.calls

    def used(self) -> int:
        self._roll()
        return self.calls


_DAILY = _Daily()


def daily_calls() -> int:
    return _DAILY.used()


def cap_reached() -> bool:
    return _DAILY.used() >= settings.daily_model_call_cap


def pick_engine(
    wants_live: bool, demo_golfer_id: str | None, demo_key: str | None
) -> tuple[Engine, SessionNotice | None]:
    """The engine for a NEW session. Existing sessions keep theirs (the budget guards them)."""
    if not wants_live:
        return "scripted", None
    if is_demo(demo_key) or not cap_reached():
        return "live", None
    log.warning("daily_cap_reached", extra={"calls": daily_calls()})
    if demo_golfer_id:
        return "scripted", SessionNotice(
            code="replay_mode", fallback="replay", message=_NOTICE_REPLAY
        )
    return "scripted", SessionNotice(code="replay_mode", fallback="form", message=_NOTICE_FORM)


# ---------------------------------------------------------------- per-call metering

# Set by the engine for the running turn (each turn is its own asyncio task, so no reset needed).
_CURRENT: ContextVar[tuple[str, Budget] | None] = ContextVar("guard_current", default=None)


def bind(session_id: str, budget: Budget) -> None:
    """Attribute the model calls of this task to `session_id` and its `budget`."""
    _CURRENT.set((session_id, budget))


def record_model_call(
    *,
    flow: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: float,
    session_id: str | None = None,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
    max_tokens: int | None = None,
    ok: bool = True,
) -> None:
    """Count one model API call and write its JSON log line. Call it for every call, ok or not."""
    cur = _CURRENT.get()
    if cur is not None:
        session_id = session_id or cur[0]
        budget = cur[1]
        budget.model_calls += 1
        budget.input_tokens += input_tokens
        budget.output_tokens += output_tokens
    calls = _DAILY.add()
    cost = (
        input_tokens * settings.price_in_per_mtok + output_tokens * settings.price_out_per_mtok
    ) / 1e6
    log.info(
        "model_call",
        extra={
            "session_id": session_id,
            "flow": flow,
            "model": model,
            "tokens_in": input_tokens,
            "tokens_out": output_tokens,
            "cache_read": cache_read_tokens,
            "cache_write": cache_write_tokens,
            "max_tokens": max_tokens,
            "latency_ms": round(latency_ms, 1),
            "est_cost_usd": round(cost, 5),
            "ok": ok,
            "daily_calls": calls,
        },
    )
