"""Genkit middleware that meters every raw model API call (#18, plan 4.2).

`use=[meter("chat", CHAT)]` on any `ai.generate*` call: each model request in the tool loop gets
`max_output_tokens` (if a caller forgot it), one JSON log line, and counts toward the daily cap
and the bound session budget (`guard.bind`).
"""

import time
from typing import Any

from genkit.middleware import Middleware
from pydantic import BaseModel

from app.agent.ai import ai
from app.agent.guard import record_model_call

DEFAULT_MAX_TOKENS = 4000


class MeterConfig(BaseModel):
    flow: str = "chat"
    model: str = ""


def _max_tokens(config: Any) -> int | None:
    if isinstance(config, dict):
        return config.get("max_output_tokens") or config.get("maxOutputTokens")
    return getattr(config, "max_output_tokens", None)


def _with_max_tokens(request: Any) -> Any:
    cfg = request.config
    if _max_tokens(cfg) is not None:
        return request
    if cfg is None or isinstance(cfg, dict):
        cfg = {**(cfg or {}), "max_output_tokens": DEFAULT_MAX_TOKENS}
    else:
        cfg = cfg.model_copy(update={"max_output_tokens": DEFAULT_MAX_TOKENS})
    return request.model_copy(update={"config": cfg})


def _int(x: Any) -> int:
    return int(x or 0)


class ModelMeter(Middleware[MeterConfig]):
    name = "model_meter"
    description = "Logs and counts every model call (cost and abuse guard)."

    async def wrap_model(self, params, ctx, next_fn):  # type: ignore[override]
        params = params.model_copy(update={"request": _with_max_tokens(params.request)})
        start = time.perf_counter()
        usage = None
        ok = False
        try:
            resp = await next_fn(params, ctx)
            usage = resp.usage
            ok = resp.error is None
            return resp
        finally:
            custom = (usage.custom if usage else None) or {}
            record_model_call(
                flow=self.config.flow,
                model=self.config.model,
                input_tokens=_int(usage and usage.input_tokens),
                output_tokens=_int(usage and usage.output_tokens),
                cache_read_tokens=_int(
                    (usage and usage.cached_content_tokens) or custom.get("cache_read_input_tokens")
                ),
                cache_write_tokens=_int(
                    (usage and usage.cache_write_tokens)
                    or custom.get("cache_creation_input_tokens")
                ),
                max_tokens=_max_tokens(params.request.config),
                latency_ms=(time.perf_counter() - start) * 1000,
                ok=ok,
            )


ai.define_middleware(ModelMeter)


def meter(flow: str, model: Any) -> ModelMeter:
    """`model` is the ModelRef (CHAT / FAST) or its name."""
    return ModelMeter(flow=flow, model=str(getattr(model, "name", model)))
