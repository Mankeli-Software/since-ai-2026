"""Session models (plan §8.2) and the L0 session API shapes (plan §3.8)."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.common import Engine, ProvenancedValue
from app.schemas.flags import Flag
from app.schemas.state import FittingState
from app.schemas.ui import UIBlock


class HostInfo(BaseModel):
    platform: Literal["standalone", "shopify", "generic"] = "standalone"
    locale: str | None = Field(default=None, max_length=16)


class Budget(BaseModel):
    """Per-session LLM spend counters."""

    turns: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    model_calls: int = 0  # raw model API calls (a turn's tool loop makes several)


class SessionNotice(BaseModel):
    """Why this session runs differently than asked (#18). Past the daily model-call cap a new
    session gets the scripted engine: personas replay their script, own fittings use the form."""

    code: str = Field(description='"replay_mode" today; more codes may be added')
    fallback: Literal["replay", "form"] = Field(
        description="replay = persona script replay (tap options); form = the form fallback"
    )
    message: str


class FitSession(BaseModel):
    """The stored session document (`sessions/{id}`, < 900 KB). Mutable for one turn only."""

    id: str
    resume_token: str
    created_at: datetime
    updated_at: datetime
    status: Literal["active", "saved", "done"] = "active"
    engine: Engine = "scripted"
    active_turn_id: str | None = None
    active_turn_expires: datetime | None = None
    host: HostInfo | None = None
    demo_golfer_id: str | None = None
    shopify_customer_id: str | None = None
    email: str | None = None  # never returned by any public endpoint
    profile: dict[str, ProvenancedValue] = Field(default_factory=dict)
    evidence_version: int = 0
    flags: list[Flag] = Field(default_factory=list)
    state: FittingState = Field(default_factory=FittingState)
    recommendation_json: str | None = None  # FitResult as a JSON string
    budget: Budget = Field(default_factory=Budget)
    ui_block_seq: int = 0  # generated ui_* blocks are numbered `<type>-<n>`, unique per session
    pending_ui_id: str | None = None  # input component the last turn is waiting on (AGENT)
    script_cursor: int = 0  # next step of the scripted engine's persona script (AGENT)
    notice: SessionNotice | None = None  # set when the guard downgraded the engine (AGENT, #18)


class StoredMessage(BaseModel):
    """`sessions/{id}/messages/{turn_no}`. Engine-native parts are kept as a JSON string."""

    turn_no: int
    role: Literal["user", "assistant", "tool"]
    engine: Engine
    parts_json: str = "[]"
    display_text: str | None = None
    created_at: datetime


class StoredImport(BaseModel):
    """`sessions/{id}/imports/{import_id}`. Parsed data only; raw uploads are never stored."""

    import_id: str
    kind: str
    club: str | None = None
    parsed_shots_json: str = "[]"
    report_json: str = "{}"
    status: Literal["pending", "confirmed", "discarded"] = "pending"
    created_at: datetime


# ---------------------------------------------------------------- API shapes


class HealthResponse(BaseModel):
    ok: bool
    version: str
    llm_mode: str
    store: str


class CreateSessionRequest(BaseModel):
    host: HostInfo | None = None
    demo_golfer_id: str | None = Field(default=None, pattern=r"^DEMO-\d{2}$")
    engine: Engine | None = Field(
        default=None, description="A request, not an override: live only when LLM_MODE=live."
    )


class CreateSessionResponse(BaseModel):
    session_id: str
    resume_token: str
    state: FittingState
    notice: SessionNotice | None = None


class TranscriptEntry(BaseModel):
    turn_no: int
    role: Literal["user", "assistant"]
    text: str


class PublicBlock(BaseModel):
    id: str
    block: UIBlock
    interactive: bool
    answer: Any = None


class PublicSession(BaseModel):
    """What `GET /api/sessions/{id}` returns. Never includes the email."""

    session_id: str
    engine: Engine
    status: Literal["active", "saved", "done"]
    state: FittingState
    transcript: list[TranscriptEntry] = Field(default_factory=list)
    blocks: list[PublicBlock] = Field(default_factory=list)
    notice: SessionNotice | None = None


class SaveSessionRequest(BaseModel):
    email: str | None = Field(default=None, max_length=254)


class SaveSessionResponse(BaseModel):
    saved: bool = True
    resume_url: str


class ResumeSessionResponse(BaseModel):
    session_id: str
    demo_golfer_id: str | None = None
    engine: Engine
    state: FittingState


class SampleImport(BaseModel):
    sample_id: str
    kind: Literal["trackman_csv", "ball_line"]
    club: str | None = None
    label: str


class DemoGolferSummary(BaseModel):
    golfer_id: str
    name: str
    age: int
    teaser: str
    synthetic: bool = True
    sample_imports: list[SampleImport] = Field(default_factory=list)


class DemoGolferDetail(BaseModel):
    session_id: str
    resume_token: str
    golfer_id: str
    name: str
    age: int
    teaser: str
    synthetic: bool = True
    profile: dict[str, ProvenancedValue] = Field(default_factory=dict)
    sample_imports: list[SampleImport] = Field(default_factory=list)
    state: FittingState
