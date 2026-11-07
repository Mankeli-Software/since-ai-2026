"""Nearest-stock advisor (plan §3.6, Issue #123): deterministic stock-vs-custom guidance.

Follows Jonas's c14 rule: custom is over-produced; small changes for non-expert
players mean stock is a fine choice.
"""

from __future__ import annotations

from app import pack
from app.fitting.session_inputs import intake_of
from app.fitting.tinker import tinker
from app.schemas.common import GripSize
from app.schemas.fit import StockAdvice
from app.schemas.session import FitSession
from app.schemas.tinker import TinkerSpecPatch

# c14 L167-170 (Jonas)
MAX_LIE_DEG = 1
MAX_LENGTH_IN = 0.25
MIN_SCORE_BUCKET = 4


def _compute_p_stock(session: FitSession) -> float | None:
    per_part = getattr(session.state, "per_part", {}) if session.state else {}
    if not per_part or "purchase" not in per_part:
        return None
    pp = per_part["purchase"]
    if pp.ours == "stock":
        p = float(pp.share)
    elif pp.alt == "stock":
        p = float(1.0 - pp.share)
    else:
        p = 0.0
    return min(max(round(p, 4), 0.0), 1.0)


def nearest_stock(session: FitSession) -> StockAdvice:
    """Compute nearest stock build vs fitted build, flight deltas, and stock recommendation."""
    fitted = session.state.best
    if fitted is None:
        raise ValueError("no fit yet")

    # 1. Nearest stock shaft
    head_info = pack.head(fitted.head)
    stock_shaft_models: list[str] = head_info.get("stock_shafts", []) if head_info else []
    fitted_shaft_rec = pack.shaft(fitted.shaft)
    shaft_is_stock = (
        fitted_shaft_rec is not None
        and fitted_shaft_rec.get("material") == "steel"
        and fitted_shaft_rec.get("model") in stock_shaft_models
    )

    p_stock = _compute_p_stock(session)

    if shaft_is_stock:
        stock_shaft = fitted.shaft
    else:
        candidates = [
            s
            for s in pack.shafts_for_head(fitted.head)
            if s.get("material") == "steel"
            and s.get("model") in stock_shaft_models
            and s.get("flex") == fitted.flex
        ]
        candidates.sort(key=lambda s: s["slug"])
        if not candidates:
            return StockAdvice(
                lean="custom",
                fitted=fitted,
                stock=None,
                lie_change_deg=fitted.lie_deg,
                length_change_in=round(fitted.length_in, 2),
                p_stock=p_stock,
                carry_delta_yd=None,
                side_delta_yd=None,
                reasons=[f"No stock shaft in {fitted.flex} flex for this head."],
                stock_return_days=30,
            )
        stock_shaft = candidates[0]["slug"]

    # 2. Stock grip: keep fitted.grip if standard or midsize, else midsize
    stock_grip: GripSize = fitted.grip if fitted.grip in ("standard", "midsize") else "midsize"

    # 3. Call tinker for spec resolution and ball flight differences
    patch = TinkerSpecPatch(
        shaft=stock_shaft,
        length_in=0.0,
        lie_deg=0,
        grip=stock_grip,
    )
    res = tinker(session, patch)
    stock_spec = res.spec

    # 4. Flight deltas from res.flight_ours (stock) minus res.flight_rec (fitted)
    carry_delta_yd: float | None = None
    side_delta_yd: float | None = None
    if res.flight_ours and res.flight_rec:
        carry_delta_yd = round(
            res.flight_ours.summary.carry.mean - res.flight_rec.summary.carry.mean, 1
        )
        if res.flight_ours.summary.side and res.flight_rec.summary.side:
            side_delta_yd = round(
                res.flight_ours.summary.side.mean - res.flight_rec.summary.side.mean, 1
            )

    lie_change_deg = fitted.lie_deg - (stock_spec.lie_deg if stock_spec else 0)
    length_change_in = round(fitted.length_in - (stock_spec.length_in if stock_spec else 0.0), 2)

    if not res.buildable or res.purchase != "stock":
        reasons = list(res.reasons)
        if not reasons and res.purchase != "stock":
            reasons.append("Nearest build is not a stock configuration.")
        return StockAdvice(
            lean="custom",
            fitted=fitted,
            stock=stock_spec,
            lie_change_deg=lie_change_deg,
            length_change_in=length_change_in,
            p_stock=p_stock,
            carry_delta_yd=carry_delta_yd,
            side_delta_yd=side_delta_yd,
            reasons=reasons,
            stock_return_days=30,
        )

    # 5. Rule (c14): evaluate whether stock is a fine choice
    intake = intake_of(session)
    score_bucket = intake.score_bucket

    lie_ok = abs(fitted.lie_deg) <= MAX_LIE_DEG
    length_ok = abs(fitted.length_in) <= MAX_LENGTH_IN
    grip_ok = fitted.grip in ("standard", "midsize")
    shaft_ok = shaft_is_stock
    score_ok = score_bucket is not None and score_bucket >= MIN_SCORE_BUCKET

    rule_ok = lie_ok and length_ok and grip_ok and shaft_ok and score_ok

    if fitted.purchase == "stock":
        lean = "stock"
        reasons = []
    elif rule_ok:
        lean = "stock" if p_stock is not None and p_stock >= 0.5 else "either"
        reasons = []
    else:
        lean = "custom"
        reasons = []
        if not lie_ok:
            direction = "upright" if fitted.lie_deg > 0 else "flat"
            reasons.append(f"Lie is {fitted.lie_deg:+d}° {direction}; stock is 0°.")
        if not length_ok:
            reasons.append(f"Length is {fitted.length_in:+.2f} in; stock is standard.")
        if not shaft_ok:
            fitted_shaft_name = fitted.shaft_model or fitted.shaft
            stock_shaft_name = stock_spec.shaft_model or stock_spec.shaft
            reasons.append(f"Shaft {fitted_shaft_name} is custom; stock is {stock_shaft_name}.")
        if not grip_ok:
            reasons.append(f"Grip is {fitted.grip}; stock is standard or midsize.")
        if not score_ok:
            reasons.append("Your scoring range gains more from the exact build.")

    return StockAdvice(
        lean=lean,
        fitted=fitted,
        stock=stock_spec,
        lie_change_deg=lie_change_deg,
        length_change_in=length_change_in,
        p_stock=p_stock,
        carry_delta_yd=carry_delta_yd,
        side_delta_yd=side_delta_yd,
        reasons=reasons,
        stock_return_days=30,
    )
