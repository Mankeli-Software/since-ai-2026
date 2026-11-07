"""Turn input and the 8 SSE stream events (plan §4.5). The event list is FROZEN in v0.

Every event carries a monotonic `seq` within its turn. The SSE `event:` name equals `type`.
Owned by AGENT after v0: additive changes only (new optional fields), never new event types.
"""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Spec, require_type_field
from app.schemas.state import FittingState
from app.schemas.ui import UIBlock

# ---------------------------------------------------------------- turn input


class TextMessage(BaseModel):
    kind: Literal["text"] = "text"
    text: str = Field(min_length=1, max_length=4000)


class UiResponseMessage(BaseModel):
    """The golfer's answer to an input component; resumes that exact tool call."""

    kind: Literal["ui_response"] = "ui_response"
    component_id: str
    value: Any = None
    display_text: str | None = Field(default=None, max_length=500)


TurnMessage = Annotated[TextMessage | UiResponseMessage, Field(discriminator="kind")]


class TurnRequest(BaseModel):
    """Body of `POST /api/sessions/{id}/turn`."""

    message: TurnMessage


# ---------------------------------------------------------------- stream events


class _Event(BaseModel):
    model_config = ConfigDict(json_schema_extra=require_type_field)

    seq: int = Field(ge=0)


class TurnStartEvent(_Event):
    type: Literal["turn_start"] = "turn_start"
    turn_id: str


class TextEvent(_Event):
    """A text delta of an assistant message. Never carries reasoning."""

    type: Literal["text"] = "text"
    msg_id: str
    delta: str


class UiEvent(_Event):
    type: Literal["ui"] = "ui"
    id: str = Field(description="Component id; a ui_response echoes it as component_id")
    block: UIBlock
    interactive: bool


StageAction = Literal["focus_part", "set_spec", "show_flight", "show_row"]


class StageEvent(_Event):
    type: Literal["stage"] = "stage"
    action: StageAction
    part: str | None = None
    spec: Spec | None = None
    heads: list[str] | None = None


class StateEvent(_Event):
    type: Literal["state"] = "state"
    state: FittingState


MascotMood = Literal["idle", "thinking", "talking", "happy", "surprised"]


class MascotEvent(_Event):
    type: Literal["mascot"] = "mascot"
    mood: MascotMood


class DoneEvent(_Event):
    type: Literal["done"] = "done"
    turn_id: str


class ErrorEvent(_Event):
    type: Literal["error"] = "error"
    code: str
    message: str
    retryable: bool = False


StreamEvent = Annotated[
    TurnStartEvent
    | TextEvent
    | UiEvent
    | StageEvent
    | StateEvent
    | MascotEvent
    | DoneEvent
    | ErrorEvent,
    Field(discriminator="type"),
]

STREAM_EVENT_TYPES: tuple[str, ...] = (
    "turn_start",
    "text",
    "ui",
    "stage",
    "state",
    "mascot",
    "done",
    "error",
)
