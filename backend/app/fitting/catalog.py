"""Catalog and buildability (plan §3.2): `check_buildable`, `list_products`, `catalog_response`.

`check_buildable` is the official scorer's `score.buildable` (plus its `clean` normalisation)
without pandas: an unbuildable spec scores 0, so every spec we show or submit must pass it.
Stock vs custom always comes from the pack's `purchase_for`, never from the product JSON's
`stock_set_requires` (it disagrees with STOCK_GRIPS).

Product videos are not in the pack: they come from `fixtures/product_videos.json` (keyed by head
slug, owned by WEB-APP). Until that file exists, `videos` is empty.
"""

from __future__ import annotations

import json
import math
from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal, cast

from app import pack
from app.schemas.common import GripSize, HeadSlug, Spec
from app.schemas.fit import BuildCheck, CatalogResponse, HeadProduct, ShaftProduct

# Repo checkout: backend/app/fitting -> <repo>/fixtures. Image: /app/app/fitting -> /app/fixtures.
_HERE = Path(__file__).resolve()
FIXTURE_DIRS = (_HERE.parents[3] / "fixtures", _HERE.parents[2] / "fixtures")


def _text(x: Any) -> str:
    """score.clean: `astype(str).str.strip().str.lower()`."""
    return str(x).strip().lower()


def _number(x: Any) -> float:
    """score._num: strip quotes and units, NaN if it still isn't a number."""
    try:
        s = str(x).strip().replace('"', "").replace("in", "").replace("deg", "").replace("°", "")
        return float(s)
    except (TypeError, ValueError):
        return math.nan


def check_buildable(spec: Spec | Mapping[str, Any]) -> BuildCheck:
    """Can Takomo build this spec? Same verdict as `takomo_fit.score.buildable` after `clean`.

    Takes a `Spec` or a plain mapping (a CSV row, a tool argument), since an unbuildable spec
    usually fails `Spec` validation before it gets here. Lists every reason, not just the first.
    """
    raw = spec.model_dump() if isinstance(spec, Spec) else dict(spec)
    head = _text(raw.get("head"))
    shaft_slug = _text(raw.get("shaft"))
    grip = _text(raw.get("grip"))
    handedness = _text(raw.get("handedness"))
    purchase = _text(raw.get("purchase"))
    length = _number(raw.get("length_in"))
    lie = _number(raw.get("lie_deg"))

    reasons: list[str] = []
    shaft = pack.shaft(shaft_slug)
    if shaft is None:
        reasons.append(f"unknown shaft '{shaft_slug}'")
    elif head not in shaft["heads"]:
        if pack.head(head) is None:
            reasons.append(f"unknown head '{head}'")
        else:
            reasons.append(f"shaft '{shaft_slug}' is not offered on head '{head}'")
    if length not in pack.length_options_in():
        reasons.append(f"length_in {raw.get('length_in')!r} is not one of the length options")
    if lie not in pack.lie_options_deg():
        reasons.append(f"lie_deg {raw.get('lie_deg')!r} is not one of the lie options")
    if grip not in pack.GRIP_ORDER:
        reasons.append(f"unknown grip '{grip}'")
    if handedness not in pack.HANDEDNESS:
        reasons.append(f"handedness '{handedness}' is not right or left")
    if purchase not in pack.PURCHASES:
        reasons.append(f"purchase '{purchase}' is not stock or custom")

    if reasons:
        return BuildCheck(buildable=False, reasons=reasons)
    # head, grip and lie were all checked against the catalog above.
    rules_purchase = pack.get_engine().purchase_for(
        cast(HeadSlug, head), shaft_slug, length, int(lie), cast(GripSize, grip)
    )
    return BuildCheck(buildable=True, purchase=rules_purchase)


def list_products(
    kind: Literal["heads", "shafts"],
    head: str | None = None,
    flex: str | None = None,
    material: str | None = None,
) -> list[dict[str, Any]]:
    """Heads, or shafts filtered by head / flex / material. Deep copies, safe to mutate.
    Head records carry `video` from fixtures/product_videos.json when there is one."""
    data = pack.get_engine().catalog()
    if kind == "heads":
        videos = product_videos()
        heads = [h for h in data["heads"] if head is None or h["slug"] == head]
        return [{**h, "video": videos.get(h["slug"])} for h in heads]
    return [
        s
        for s in data["shafts"]
        if (head is None or head in s["heads"])
        and (flex is None or s["flex"] == flex)
        and (material is None or s["material"] == material)
    ]


@lru_cache(maxsize=1)
def _load_videos() -> dict[str, Any]:
    for d in FIXTURE_DIRS:
        path = d / "product_videos.json"
        if path.is_file():
            loaded = json.loads(path.read_text(encoding="utf-8"))
            return loaded if isinstance(loaded, dict) else {}
    return {}


def product_videos() -> dict[str, Any]:
    """fixtures/product_videos.json keyed by head slug; {} until WEB-APP adds the file."""
    return json.loads(json.dumps(_load_videos()))  # a copy, so callers can't edit the cache


def catalog_response() -> CatalogResponse:
    data = pack.get_engine().catalog()
    return CatalogResponse(
        heads=[HeadProduct.model_validate(h) for h in data["heads"]],
        shafts=[ShaftProduct.model_validate(s) for s in data["shafts"]],
        grips=data["grips"],
        length_options_in=[float(x) for x in data["length_options_in"]],
        lie_options_deg=[int(x) for x in data["lie_options_deg"]],
        videos=product_videos(),
    )
