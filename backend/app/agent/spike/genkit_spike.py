# ruff: noqa: E501
# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = [
#   "genkit==0.13.0",
#   "genkit-anthropic==0.13.0",
#   "genkit-fastapi==0.13.0",
#   "genkit-google-genai==0.13.0",
#   "anthropic==0.112.0",
#   "fastapi",
#   "uvicorn",
#   "httpx",
#   "pydantic",
# ]
# ///
"""
Genkit spike (issue #14): 7 checks on Sonnet 5.5 or Gemini. No pytest: run this script.

    uv run backend/app/agent/spike/genkit_spike.py          # all checks (1 offline, 2-7 need a key)
    uv run backend/app/agent/spike/genkit_spike.py 1 4      # selected checks

Provider: SPIKE_PROVIDER=anthropic (default) | google (key: GEMINI_API_KEY; check 1 is Anthropic-only).
Each check prints PASS / FAIL / SKIP(no key) with a reason. Exit code 1 on any FAIL.
"""

import asyncio
import base64
import json
import os
import struct
import sys
import zlib
from typing import Any, Literal

import httpx
from fastapi import FastAPI
from fastapi.sse import EventSourceResponse, ServerSentEvent
from genkit import Genkit, Message, Part, Role
from genkit_anthropic import Anthropic, AnthropicConfig
from genkit_anthropic import (
    _model_info as mi,
)  # PRIVATE API: OK only because the version is pinned
from genkit_google_genai import GeminiConfig, GoogleAI
from pydantic import BaseModel

PROVIDER = os.environ.get("SPIKE_PROVIDER", "anthropic")
GOOGLE = PROVIDER == "google"
KEY_VAR = "GEMINI_API_KEY" if GOOGLE else "ANTHROPIC_API_KEY"
HAS_KEY = bool(os.environ.get(KEY_VAR))
SONNET, HAIKU = "claude-sonnet-5-5", "claude-haiku-5-5"
REQUESTS: list[dict[str, Any]] = []  # every request body sent to api.anthropic.com


# ---- Check 1: model table -> BASE ----------------------------------------------------------------
def pick_base(family: str) -> str:
    """Newest entry of the family with constrained=ALL. Table order is release order within a family."""
    keys = [
        k
        for k, v in mi.SUPPORTED_ANTHROPIC_MODELS.items()
        if family in k
        and v.supports
        and v.supports.constrained
        and str(v.supports.constrained) != "none"
    ]
    return keys[-1]


def register_models() -> dict[str, str]:
    base = {SONNET: pick_base("sonnet"), HAIKU: pick_base("haiku")}
    for mid, key in base.items():
        info = mi.SUPPORTED_ANTHROPIC_MODELS[key]  # type: ignore[index]
        mi.SUPPORTED_ANTHROPIC_MODELS.setdefault(  # type: ignore[call-overload]
            mid,
            info.model_copy(update={"label": f"Anthropic - {mid}", "versions": [mid]}),
        )
    return base


def check1() -> str:
    print("  SUPPORTED_ANTHROPIC_MODELS (sorted):")
    for k in sorted(mi.SUPPORTED_ANTHROPIC_MODELS):
        s = mi.SUPPORTED_ANTHROPIC_MODELS[k].supports
        print(f"    {k:22s} constrained={s.constrained} output={s.output}")
    base = register_models()
    for mid, key in base.items():
        s = mi.SUPPORTED_ANTHROPIC_MODELS[mid].supports  # type: ignore[index]
        assert s and s.constrained, mid
        print(f"  BASE {mid} <- {key} (registered, constrained={s.constrained})")
    return f"BASE={base}"


# ---- Genkit instance that logs every request body --------------------------------------------------
async def _log_request(request: httpx.Request) -> None:
    if request.content:
        REQUESTS.append(json.loads(request.content))


def make_ai() -> Genkit:
    if GOOGLE:  # no wire logging: REQUESTS stays empty, wire assertions are Anthropic-only
        return Genkit(plugins=[GoogleAI()])
    http = httpx.AsyncClient(event_hooks={"request": [_log_request]}, timeout=120)
    return Genkit(plugins=[Anthropic(client_options={"http_client": http})])


if GOOGLE:  # same settings as ai.py
    CHAT = GoogleAI.gemini(
        os.environ.get("SPIKE_GEMINI_MODEL") or "gemini-3.1-pro-preview",
        config=GeminiConfig(
            thinking_level=os.environ.get("SPIKE_EFFORT", "LOW").upper(),  # type: ignore[arg-type]
            include_thoughts=True,
            max_output_tokens=8000,
        ),
    )
else:
    CHAT = Anthropic.claude(
        SONNET,
        config=AnthropicConfig(
            thinking="adaptive",
            thinking_display="summarized",
            effort=os.environ.get("SPIKE_EFFORT", "low"),  # low may skip thinking entirely
            max_output_tokens=8000,
            extra={"cache_control": {"type": "ephemeral"}},
        ),
    )


# ---- Check 2: streamed text through FastAPI ------------------------------------------------------
async def check2(ai: Genkit) -> str:
    app = FastAPI()

    @app.post("/turn", response_class=EventSourceResponse)
    async def turn():
        sr = ai.generate_stream(model=CHAT, prompt="Say hello in exactly five words.")
        async for chunk in sr.stream:
            if chunk.text:  # reasoning chunks must not reach SSE `text` events
                yield ServerSentEvent(event="text", data=chunk.text)
        await sr.response
        yield ServerSentEvent(event="done", data={})

    events = []
    async with (
        httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c,
        c.stream("POST", "/turn") as r,
    ):
        ctype = r.headers["content-type"]
        async for line in r.aiter_lines():
            if line.startswith("event:"):
                events.append(line[6:].strip())
    assert ctype.startswith("text/event-stream"), ctype
    assert events.count("text") >= 1 and events[-1] == "done", events
    return f"{events.count('text')} text events then done"


# ---- Check 3: tool round trip, Pydantic in, JSON string out ----------------------------------------
class LoftIn(BaseModel):
    club: str


class LoftOut(BaseModel):
    club: str
    loft_deg: float


async def check3(ai: Genkit) -> str:
    calls = []

    @ai.tool()
    async def get_loft(input: LoftIn) -> str:
        """Return the loft of a club."""
        calls.append(input)
        return LoftOut(club=input.club, loft_deg=34.0).model_dump_json()

    r = await ai.generate(
        model=CHAT,
        prompt="Use get_loft for club '7i', then state the loft.",
        tools=[get_loft],
    )
    assert calls and isinstance(calls[0], LoftIn), "tool not called with a Pydantic input"
    assert "34" in r.text, r.text
    if GOOGLE:
        return "tool called with a Pydantic input, model stated 34"
    # Wire check: the tool_result content sent back is the JSON string, not a Python repr.
    results = [
        b
        for q in REQUESTS
        for m in q["messages"]
        for b in m["content"]
        if b.get("type") == "tool_result"
    ]
    assert results and json.loads(results[-1]["content"])["loft_deg"] == 34.0, results[-1:]
    return f"tool_result content on the wire = {results[-1]['content']}"


# ---- Check 4: structured output, real ExtractedSession (plan 5.1, flat) ----------------------------
ShotField = Literal[
    "club_speed_mph", "attack_angle_deg", "dynamic_loft_deg", "club_path_deg", "face_angle_deg",
    "face_to_path_deg", "ball_speed_mph", "smash_factor", "launch_angle_deg", "launch_direction_deg",
    "spin_rate_rpm", "spin_axis_deg", "carry_yd", "total_yd", "side_yd", "apex_yd",
    "landing_angle_deg", "impact_offset_mm", "impact_height_mm", "impact_toe_up_deg",
]  # fmt: skip


class Cell(BaseModel):  # every field required; an unreadable cell is simply absent
    row: int
    field: ShotField
    literal: str
    value: float
    confidence: float


class ExtractedSession(BaseModel):
    monitor: str
    unit_labels_seen: list[str]
    headers_read: list[str]
    cells: list[Cell]


async def check4(ai: Genkit) -> str:
    text = "Monitor: Rapsodo MLM2\nCarry yd | Ball speed mph\n141 | 98.2\n150 | 101.0"
    r = await ai.generate(
        model=CHAT,
        prompt=f"Extract this screen text:\n{text}",
        output_schema=ExtractedSession,
    )
    assert r.output is not None, r.error
    out = ExtractedSession.model_validate(r.output)
    assert len(out.cells) >= 4, out
    if GOOGLE:
        return f"{len(out.cells)} cells, validated against ExtractedSession"
    fmt = REQUESTS[-1].get("output_config", {}).get("format", {})
    assert fmt.get("type") == "json_schema", f"NOT native constrained output: {REQUESTS[-1].keys()}"
    return f"{len(out.cells)} cells, native json_schema output_config sent"


# ---- Check 5: image input ----------------------------------------------------------------------
def red_png(size: int = 32) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    raw = b"".join(b"\x00" + b"\xff\x00\x00" * size for _ in range(size))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


async def check5(ai: Genkit) -> str:
    uri = "data:image/png;base64," + base64.b64encode(red_png()).decode()
    msg = Message(
        role=Role.USER,
        content=[
            Part.from_text("One word: what colour is this image?"),
            Part.from_media(uri, content_type="image/png"),
        ],
    )
    r = await ai.generate(model=CHAT, messages=[msg])
    assert "red" in r.text.lower(), r.text
    return f"model said: {r.text.strip()[:40]!r}"


# ---- Check 6: Interrupt + resume -----------------------------------------------------------------
class Ask(BaseModel):
    question: str


async def check6(ai: Genkit) -> str:
    ask = ai.define_interrupt(
        name="ui_ask", input_schema=Ask, description="Ask the user a question and wait."
    )
    r1 = await ai.generate(
        model=CHAT,
        # "Do nothing else" made Gemini return empty text after the resume, so ask for a reply.
        prompt="Call ui_ask to ask the user their favourite colour. After the answer, repeat it in one sentence.",
        tools=[ask],
    )
    assert r1.interrupts, f"no interrupt, text={r1.text!r}"
    i = r1.interrupts[0]
    r2 = await ai.generate(
        model=CHAT,
        messages=r1.messages,
        tools=[ask],
        resume_respond=[i.respond({"answer": "blue"})],
    )
    assert "blue" in r2.text.lower(), (
        f"text={r2.text!r} finish={r2.finish_reason} last parts="
        f"{[next(iter(p.model_dump(exclude_none=True, exclude={'metadata'})), '?') for p in r2.messages[-1].content]}"
    )
    name = i.tool_request.name
    return f"interrupted on {name}, resumed with tool_result, model said {r2.text.strip()[:40]!r}"


# ---- Check 7: 2-tool turn, second turn, thinking blocks replayed, cache read ----------------------
CATALOG = "\n".join(
    f"Head {n:03d}: loft {20 + n % 15} deg, bounce {n % 9} deg, offset {n % 5} mm."
    for n in range(400)
)
SYSTEM = (
    f"You are a golf club fitter. Be brief. Always call both tools before answering.\n{CATALOG}"
)


class Q(BaseModel):
    topic: str


async def check7(ai: Genkit) -> str:
    @ai.tool()
    async def get_head(input: Q) -> str:
        """Look up a head."""
        return json.dumps({"topic": input.topic, "head": "201T MKII"})

    @ai.tool()
    async def get_shaft(input: Q) -> str:
        """Look up a shaft."""
        return json.dumps({"topic": input.topic, "shaft": "Regular 5.5"})

    tools = [get_head, get_shaft]  # sorted by name = byte-stable
    t1 = await ai.generate(
        model=CHAT,
        system=SYSTEM,
        # A trivial prompt gets no thinking at all, even at effort=high; this one makes the model reason.
        prompt=(
            "Mikko claims 160 yd 7-iron carry, but his 10 TrackMan shots average 124.7 yd with club"
            " speed 72 mph and one 151 yd outlier. Work out carefully which claim to trust and what"
            " flex bucket that implies, then call get_head and get_shaft with precise topics."
        ),
        tools=tools,
    )
    t2 = await ai.generate(
        model=CHAT,
        system=SYSTEM,
        messages=[
            *t1.messages,
            Message(role=Role.USER, content=[Part.from_text("Repeat the head name.")]),
        ],
        tools=tools,
    )
    produced = [
        next(k for k, v in p.model_dump(exclude_none=True).items() if k != "metadata")
        for m in t1.messages
        if m.role == Role.MODEL
        for p in m.content
    ]
    print(f"  turn-1 model part types: {produced}")
    if GOOGLE:
        # Gemini keeps the signature in Part.metadata["thoughtSignature"] (on reasoning and tool_request parts)
        # and the plugin replays it from there. Implicit caching is not guaranteed, so cached tokens are reported only.
        sigs = [
            p
            for m in (*t1.messages, *t2.messages)
            if m.role == Role.MODEL
            for p in m.content
            if (p.reasoning is not None or p.tool_request is not None)
            and (p.metadata or {}).get("thoughtSignature")
        ]
        thoughts = [
            p for m in t1.messages if m.role == Role.MODEL for p in m.content if p.reasoning
        ]
        cached = (t2.usage.cached_content_tokens or 0) if t2.usage else 0
        print(
            f"  thought parts={len(thoughts)}; signed parts={len(sigs)}; cached_content_tokens={cached}"
        )
        if thoughts:
            assert sigs, "model produced thoughts but no thoughtSignature round-tripped"
        assert "201T" in t2.text, t2.text
        return f"signed parts kept in history={len(sigs)}, cached_content_tokens={cached} (not required)"
    thinking = [
        b
        for q in REQUESTS[1:]
        for m in q["messages"]
        if m["role"] == "assistant"
        for b in m["content"]
        if b.get("type") == "thinking"
    ]
    assert thinking, "no thinking block was ever replayed in a request"
    assert all(b["thinking"] and b["signature"] for b in thinking), "EMPTY thinking block sent"
    cache_read = (t2.usage.custom or {}).get("cache_read_input_tokens", 0) if t2.usage else 0
    print(
        f"  requests={len(REQUESTS)}; replayed thinking blocks={len(thinking)}; cache_read={cache_read}"
    )
    last = REQUESTS[-1]
    print(
        f"  turn-2 params: thinking={last.get('thinking')} output_config={last.get('output_config')}"
    )
    print(
        f"  turn-2 params: cache_control={last.get('cache_control')} tools={[t['name'] for t in last['tools']]}"
    )
    assert cache_read > 0, "cache_read_input_tokens == 0"
    return (
        f"{len(thinking)} non-empty thinking blocks replayed, cache_read_input_tokens={cache_read}"
    )


CHECKS = {"2": check2, "3": check3, "4": check4, "5": check5, "6": check6, "7": check7}


async def main(wanted: list[str]) -> int:
    failed = 0

    def report(n: str, status: str, why: str) -> None:
        print(f"[{n}] {status}: {why}")

    if GOOGLE and (not wanted or "1" in wanted):
        report("1", "SKIP", "Anthropic-only (model registration)")
    elif not wanted or "1" in wanted:
        try:
            report("1", "PASS", check1())
        except Exception as e:  # noqa: BLE001
            failed += 1
            report("1", "FAIL", repr(e))
    ai = make_ai() if HAS_KEY else None
    for n, fn in CHECKS.items():
        if wanted and n not in wanted:
            continue
        if ai is None:
            report(n, "SKIP(no key)", f"set {KEY_VAR}")
            continue
        try:
            report(n, "PASS", await fn(ai))
        except Exception as e:  # noqa: BLE001
            failed += 1
            report(n, "FAIL", f"{type(e).__name__}: {e}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1:])))
