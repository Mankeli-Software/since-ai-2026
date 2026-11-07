"""Tinker engine (plan §3.6, #27): deterministic spec diff, < 100 ms, no LLM.

Allows golfer to adjust head, shaft, length, lie, grip, handedness,
verifies buildability, recalculates purchase type, compares shafts,
and simulates flight differences between baseline and tinkered specs.
"""

from __future__ import annotations

import contextlib
from typing import Any

from app import pack
from app.fitting.catalog import check_buildable
from app.fitting.flight import simulate_flight
from app.fitting.mapping import build_answers
from app.fitting.recommend import recommend_fit
from app.fitting.session_inputs import evidence_of, intake_of
from app.schemas.common import Spec
from app.schemas.fit import HeadFlight
from app.schemas.session import FitSession
from app.schemas.tinker import TinkerResult, TinkerSpecPatch


def tinker(session: FitSession, patch: TinkerSpecPatch) -> TinkerResult:
    """Compute spec diff, buildability, and ball flight comparison against session baseline."""
    intake = intake_of(session)
    evidence = evidence_of(session)

    # 1. Resolve recommended spec
    rec_spec: Spec | None = session.state.best
    answers = None
    if rec_spec is None:
        answers = build_answers(intake, evidence)
        fit_res = recommend_fit(answers)
        if fit_res.recs:
            rec_spec = fit_res.recs[0]
        else:
            raise ValueError(f"Session {session.id} has no recommendation to tinker with")

    # 2. Apply patch fields
    head = patch.head or rec_spec.head
    shaft = patch.shaft or rec_spec.shaft
    length_in = patch.length_in if patch.length_in is not None else rec_spec.length_in
    lie_deg = patch.lie_deg if patch.lie_deg is not None else rec_spec.lie_deg
    grip = patch.grip or rec_spec.grip
    handedness = patch.handedness or rec_spec.handedness

    # 3. Head family switch check (MKII <-> 301)
    old_family = "301" if rec_spec.head in ("301-cb", "301-mb") else "mkii"
    new_family = "301" if head in ("301-cb", "301-mb") else "mkii"
    shaft_auto_switched: str | None = None

    shaft_rec = pack.shaft(shaft)
    if shaft_rec is None or head not in shaft_rec["heads"]:
        # Shaft is not available on this head family, auto-switch using rules
        if answers is None:
            answers = build_answers(intake, evidence)
        new_shaft, _ = pack.pick_shaft(head, answers)
        old_model = shaft_rec["model"] if shaft_rec else shaft
        new_rec = pack.shaft(new_shaft)
        new_model = new_rec["model"] if new_rec else new_shaft
        build_note = f" ({new_family.upper()} build)" if new_family != old_family else ""
        shaft_auto_switched = f"{old_model} -> {new_model}{build_note}"
        shaft = new_shaft
        shaft_rec = new_rec

    # 4. Check buildable & purchase
    check = check_buildable(
        {
            "head": head,
            "shaft": shaft,
            "length_in": length_in,
            "lie_deg": lie_deg,
            "grip": grip,
            "handedness": handedness,
            "purchase": "stock",
        }
    )
    buildable = check.buildable
    reasons = check.reasons
    purchase = check.purchase or "custom"

    flex = shaft_rec["flex"] if shaft_rec and "flex" in shaft_rec else rec_spec.flex
    material = shaft_rec["material"] if shaft_rec and "material" in shaft_rec else rec_spec.material
    shaft_model = shaft_rec["model"] if shaft_rec and "model" in shaft_rec else rec_spec.shaft_model

    new_spec = Spec(
        head=head,
        shaft=shaft,
        shaft_model=shaft_model,
        flex=flex,
        material=material,
        length_in=length_in,
        lie_deg=lie_deg,
        grip=grip,
        handedness=handedness,
        purchase=purchase,
    )
    purchase_changed = (purchase != rec_spec.purchase) or (
        purchase == "custom" and rec_spec.purchase == "stock"
    )

    # 5. Shaft comparison if shaft changed
    shaft_comparison: dict[str, Any] | None = None
    if shaft != rec_spec.shaft:
        s_from = pack.shaft(rec_spec.shaft)
        s_to = pack.shaft(shaft)
        if s_from and s_to:
            shaft_comparison = {
                "from": {
                    "slug": s_from["slug"],
                    "model": s_from["model"],
                    "manufacturer": s_from["manufacturer"],
                    "material": s_from["material"],
                    "flex": s_from["flex"],
                    "weight_g": s_from["weight_g"],
                    "flight_profile": s_from["flight_profile"],
                    "tempo_profile": s_from.get("tempo_profile"),
                },
                "to": {
                    "slug": s_to["slug"],
                    "model": s_to["model"],
                    "manufacturer": s_to["manufacturer"],
                    "material": s_to["material"],
                    "flex": s_to["flex"],
                    "weight_g": s_to["weight_g"],
                    "flight_profile": s_to["flight_profile"],
                    "tempo_profile": s_to.get("tempo_profile"),
                },
            }

    # 6. Diff labels & honest unmodelled labels
    diff_labels: list[str] = []
    not_modelled: list[str] = []

    if head != rec_spec.head:
        diff_labels.append(f"head: {head} (was {rec_spec.head})")
    if lie_deg != rec_spec.lie_deg:
        d_lie = lie_deg - rec_spec.lie_deg
        diff_labels.append(f"{d_lie:+d}° {'upright' if d_lie > 0 else 'flat'}")
    if length_in != rec_spec.length_in:
        d_len = length_in - rec_spec.length_in
        diff_labels.append(f"{d_len:+.2f} in (the height rule says {rec_spec.length_in:+.2f} in)")
        not_modelled.append("length is not modelled by the simulator")
    if shaft != rec_spec.shaft:
        diff_labels.append(f"shaft: {shaft}")
        not_modelled.append("shaft is not modelled by the simulator")
    if grip != rec_spec.grip:
        diff_labels.append(f"grip: {grip}")
        not_modelled.append("grip size is not modelled by the simulator")
    if handedness != rec_spec.handedness:
        diff_labels.append(f"handedness: {handedness}")

    # 7. Ball flight simulation
    if answers is None:
        with contextlib.suppress(Exception):
            answers = build_answers(intake, evidence)

    if answers is not None:
        lie_need = (
            answers.lie_override_deg
            if answers.lie_override_deg is not None
            else pack.static_lie_deg(answers.height_cm, answers.wrist_to_floor_cm)
        )
    else:
        lie_need = float(rec_spec.lie_deg)

    lie_err_rec = rec_spec.lie_deg - lie_need
    lie_err_ours = new_spec.lie_deg - lie_need

    flight_rec: HeadFlight | None = None
    flight_ours: HeadFlight | None = None

    # Batched flight simulation (100 samples per head for p95 < 100 ms)
    if new_spec.head == rec_spec.head and new_spec.lie_deg == rec_spec.lie_deg:
        res = simulate_flight(
            intake,
            evidence,
            [rec_spec.head],
            recommended_head=rec_spec.head,
            lie_error_deg=lie_err_rec,
            n_samples=100,
            session_id=session.id,
            evidence_version=session.evidence_version,
        )
        flight_rec = res.per_head[0]
        flight_ours = flight_rec.model_copy(update={"recommended": False})
    else:
        res = simulate_flight(
            intake,
            evidence,
            [rec_spec.head, new_spec.head],
            recommended_head=rec_spec.head,
            lie_error_deg=[lie_err_rec, lie_err_ours],
            n_samples=100,
            session_id=session.id,
            evidence_version=session.evidence_version,
        )
        flight_rec = res.per_head[0]
        flight_ours = res.per_head[1]
        flight_ours = flight_ours.model_copy(update={"recommended": False})

    return TinkerResult(
        spec=new_spec,
        recommended_spec=rec_spec,
        buildable=buildable,
        reasons=reasons,
        purchase=purchase,
        purchase_changed=purchase_changed,
        shaft_auto_switched=shaft_auto_switched,
        shaft_comparison=shaft_comparison,
        flight_ours=flight_ours,
        flight_rec=flight_rec,
        diff_labels=diff_labels,
        not_modelled=not_modelled,
        state=session.state,
    )
