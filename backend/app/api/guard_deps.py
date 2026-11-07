"""The `X-Demo-Key` header (#18). A key listed in AGENT_DEMO_KEYS skips the cost and abuse
limits in `app.agent.guard` (demo devices for the recording and the judges' walkthrough)."""

from typing import Annotated

from fastapi import Header

DemoKeyHeader = Annotated[
    str | None,
    Header(alias="X-Demo-Key", description="Allowlisted demo devices skip the rate limits."),
]
