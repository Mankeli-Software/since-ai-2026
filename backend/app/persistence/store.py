"""`SessionStore` Protocol (defined in schemas.ports, re-exported here) + `encode_for_firestore`.

Firestore rejects arrays nested directly in arrays and documents over ~1 MiB. Payloads that need
nested arrays (message parts, FitResult, trajectories `[[x,y,z,t], ...]`) are stored as JSON
strings in `*_json` fields. Every store round-trips every write through `encode_for_firestore`,
so the memory store catches encoding bugs before Firestore ever runs.
"""

import json
from typing import Any

from pydantic import BaseModel

from app.core.errors import EncodingError
from app.schemas.ports import SessionStore

MAX_DOC_BYTES = 900 * 1024


def _check(value: Any, path: str, in_array: bool) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise EncodingError(f"{path}: non-string key {key!r}")
            _check(item, f"{path}.{key}", in_array=False)
    elif isinstance(value, list):
        if in_array:
            raise EncodingError(f"{path}: nested array; store it as a JSON string (*_json)")
        for i, item in enumerate(value):
            _check(item, f"{path}[{i}]", in_array=True)
    elif value is not None and not isinstance(value, str | int | float | bool):
        raise EncodingError(f"{path}: unsupported type {type(value).__name__}")


def encode_for_firestore(doc: BaseModel | dict[str, Any]) -> dict[str, Any]:
    """Return a Firestore-safe plain dict, or raise EncodingError (nested arrays, > 900 KB)."""
    data = doc.model_dump(mode="json") if isinstance(doc, BaseModel) else doc
    _check(data, "$", in_array=False)
    size = len(json.dumps(data, separators=(",", ":")).encode())
    if size > MAX_DOC_BYTES:
        raise EncodingError(f"document is {size} bytes, over the {MAX_DOC_BYTES} byte cap")
    return data


__all__ = ["MAX_DOC_BYTES", "SessionStore", "encode_for_firestore"]
