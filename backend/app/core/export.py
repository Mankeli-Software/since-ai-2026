"""Contract export: `python -m app.core.export --out DIR` (plan §10.3).

Writes `DIR/openapi.json` and `DIR/schemas/<Name>.json` with no server running. Output is
deterministic (sorted keys, sorted routes/modules, stable operation ids) and gitignored.
"""

import argparse
import importlib
import json
import shutil
from pathlib import Path
from typing import Any

from pydantic import TypeAdapter

from app.schemas.chat import StreamEvent, TurnRequest
from app.schemas.session import PublicSession
from app.schemas.state import FittingState
from app.schemas.ui import UIBlock

# Types the web app needs beyond what OpenAPI already references.
SCHEMA_EXPORTS: dict[str, Any] = {
    "FittingState": FittingState,
    "PublicSession": PublicSession,
    "StreamEvent": StreamEvent,
    "TurnRequest": TurnRequest,
    "UIBlock": UIBlock,
}


def _dump(obj: Any) -> str:
    return json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def build_openapi() -> dict[str, Any]:
    # Imported by name so `core` keeps no static dependency on the app wiring (layer rule §2.2).
    create_app = importlib.import_module("app.main").create_app
    return create_app().openapi()


def export(out: Path) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    written = [out / "openapi.json"]
    written[0].write_text(_dump(build_openapi()), encoding="utf-8")
    schemas_dir = out / "schemas"
    if schemas_dir.exists():
        shutil.rmtree(schemas_dir)
    schemas_dir.mkdir()
    for name in sorted(SCHEMA_EXPORTS):
        path = schemas_dir / f"{name}.json"
        schema = TypeAdapter(SCHEMA_EXPORTS[name]).json_schema(mode="serialization")
        path.write_text(_dump(schema), encoding="utf-8")
        written.append(path)
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    for path in export(args.out):
        print(path)


if __name__ == "__main__":
    main()
