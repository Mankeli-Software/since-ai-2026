"""Explanations from the rule trace (plan §3.7, §5.3, Issue #28).

Deterministic templates map each trace prefix (`head:`, `shaft:`, `length:`, `lie:`,
`grip:`, `purchase:`) and provenance to structured WhyItems.
Pure: no I/O, no LLM. Reaches Takomo's pack only through `app.pack`.
"""

from __future__ import annotations

from collections.abc import Sequence

from app import pack
from app.schemas.common import Depth, HeadSlug, Part, Provenance
from app.schemas.fit import (
    CloseCall,
    HeadScore,
    IntakeAnswers,
    MappedAnswers,
    Recommendation,
    WhyItem,
)

HEAD_NAMES: dict[str, str] = {
    "101-mkii": "101 MKII",
    "201-mkii": "201 MKII",
    "201t-mkii": "201T MKII",
    "301-cb": "301 CB",
    "301-mb": "301 MB",
}


def _head_name(slug: str) -> str:
    return HEAD_NAMES.get(slug, slug.upper())


def infer_depth(head: HeadSlug, score_bucket: int) -> Depth:
    """Infer explanation depth from club head and player skill bucket (plan §3.7)."""
    if head == "101-mkii":
        return "beginner"
    if score_bucket in (1, 2):
        return "numbers"
    return "standard"


def explain_fit(
    answers: MappedAnswers,
    rec: Recommendation,
    ranking: list[HeadScore],
    close_calls: Sequence[CloseCall] = (),
    *,
    intake: IntakeAnswers | None = None,
    depth: Depth | None = None,
) -> list[WhyItem]:
    """Generate structured explanations for a recommendation from the rule trace and provenance."""
    depth_hint: Depth = depth if depth is not None else infer_depth(rec.head, answers.score_bucket)
    cc_by_part: dict[Part, CloseCall] = {cc.part: cc for cc in close_calls}

    trace_by_prefix: dict[str, list[str]] = {}
    for line in rec.trace:
        parts = line.split(":", 1)
        prefix = parts[0].strip().lower()
        trace_by_prefix.setdefault(prefix, []).append(line)

    items: list[WhyItem] = []

    # 1. Head
    head_name = _head_name(rec.head)
    runner_up = ranking[1] if len(ranking) > 1 else None
    runner_up_name = _head_name(runner_up.head) if runner_up else None
    runner_up_total = float(runner_up.total) if runner_up else 0.0

    head_numbers: dict[str, float] = {k: float(v) for k, v in rec.score_parts.items()}
    head_numbers["total"] = float(rec.head_score)
    head_numbers["head_score"] = float(rec.head_score)
    if runner_up:
        head_numbers["runner_up_total"] = runner_up_total
        head_numbers["runner_up_score"] = runner_up_total

    head_sources: list[Provenance] = [
        answers.provenance[k]
        for k in ("score_bucket", "swing_bucket", "characteristics")
        if k in answers.provenance
    ]
    if not head_sources:
        head_sources = [Provenance(source="questionnaire")]

    if depth_hint == "beginner":
        head_plain = (
            f"The {head_name} gives you the best combination of forgiveness "
            "and distance for your game."
        )
        if runner_up_name:
            head_plain += f" The {runner_up_name} is close behind."
    elif depth_hint == "numbers":
        skill = float(rec.score_parts.get("skill", 0.0))
        speed = float(rec.score_parts.get("speed", 0.0))
        chars = float(rec.score_parts.get("characteristics", 0.0))
        head_plain = (
            f"The {head_name} scored {rec.head_score:g} points (skill {skill:g}, speed {speed:g}, "
            f"characteristics {chars:g}) based on your score and swing speed."
        )
        if runner_up_name:
            head_plain += f" Runner-up {runner_up_name} scored {runner_up_total:g} points."
    else:  # standard
        head_plain = f"The {head_name} suits your swing speed and scoring."
        if runner_up_name:
            head_plain += (
                f" The {runner_up_name} is close behind "
                f"({runner_up_total:g} pts vs {rec.head_score:g} pts)."
            )

    # Mikko's one own-loft line (plan §3.7, §5.3)
    if intake and intake.own_7i_loft_deg is not None:
        head_info = pack.head(rec.head) or {}
        head_loft = float(head_info.get("seven_iron_loft_deg", 33.0))
        head_forgiveness = float(head_info.get("ratings", {}).get("forgiveness", 3.0))
        own_loft = float(intake.own_7i_loft_deg)
        diff_deg = head_loft - own_loft
        speed = float(
            answers.est_7i_speed_mph or (intake.reported_7i_speed_mph if intake else None) or 75.0
        )
        # Train median dynamic loft offset for irons is -6.9 deg
        c_own = pack.shot_carry_yd(
            speed, own_loft - 6.9, attack_deg=-3.0, forgiveness=head_forgiveness
        )
        c_takomo = pack.shot_carry_yd(
            speed, head_loft - 6.9, attack_deg=-3.0, forgiveness=head_forgiveness
        )
        carry_diff = max(0.0, c_own - c_takomo)
        loft_line = (
            f"Your {own_loft:g}° 7-iron is {diff_deg:g}° stronger than the {head_name} "
            f"({head_loft:g}°), which adds about {carry_diff:.0f} yd of carry on loft alone."
        )
        head_plain = f"{head_plain} {loft_line}"
        head_numbers["own_7i_loft_deg"] = own_loft
        head_numbers["takomo_7i_loft_deg"] = head_loft
        head_numbers["loft_carry_diff_yd"] = round(carry_diff, 1)
        head_sources.append(
            Provenance(source="questionnaire", note=f"stated {own_loft:g}° 7-iron loft")
        )

    items.append(
        WhyItem(
            part="head",
            plain=head_plain,
            numbers=head_numbers,
            sources=head_sources,
            close_call=cc_by_part.get("head"),
            depth_hint=depth_hint,
        )
    )

    # 2. Flex
    flex_numbers: dict[str, float] = {"swing_bucket": float(answers.swing_bucket)}
    if answers.est_7i_speed_mph is not None:
        flex_numbers["speed_mph"] = round(float(answers.est_7i_speed_mph), 1)
    claimed = (intake.claimed_7i_carry_yd or intake.reported_7i_carry_yd) if intake else None
    if claimed is not None:
        flex_numbers["claimed_carry_yd"] = float(claimed)
    if intake and intake.reported_7i_speed_mph is not None:
        flex_numbers["reported_speed_mph"] = float(intake.reported_7i_speed_mph)

    flex_sources: list[Provenance] = (
        [answers.provenance["swing_bucket"]]
        if "swing_bucket" in answers.provenance
        else [Provenance(source="questionnaire")]
    )

    swing_prov = answers.provenance.get("swing_bucket")
    is_measured = swing_prov is not None and swing_prov.source in ("trackman", "radar")

    if depth_hint == "beginner":
        flex_plain = f"{rec.flex.capitalize()} flex fits your swing speed."
    elif depth_hint == "numbers":
        speed_str = f" ({answers.est_7i_speed_mph:.1f} mph)" if answers.est_7i_speed_mph else ""
        flex_plain = (
            f"{rec.flex.capitalize()} flex selected from swing bucket "
            f"{answers.swing_bucket}{speed_str}."
        )
    else:  # standard
        if (
            is_measured
            and intake
            and intake.claimed_7i_carry_yd is not None
            and claimed is not None
            and answers.est_7i_speed_mph
        ):
            flex_plain = (
                f"{rec.flex.capitalize()} flex fits your measured swing speed. "
                f"Your {claimed:g} yd claim was higher than your shots show."
            )
        elif is_measured and answers.est_7i_speed_mph:
            flex_plain = (
                f"{rec.flex.capitalize()} flex fits your measured swing speed of "
                f"{answers.est_7i_speed_mph:.1f} mph."
            )
        else:
            flex_plain = f"{rec.flex.capitalize()} flex fits your swing speed."

    items.append(
        WhyItem(
            part="flex",
            plain=flex_plain,
            numbers=flex_numbers,
            sources=flex_sources,
            close_call=cc_by_part.get("flex"),
            depth_hint=depth_hint,
        )
    )

    # 3. Shaft Model
    shaft_info = pack.shaft(rec.shaft) or {}
    buildable_shafts = pack.shafts_for_head(rec.head)
    shaft_numbers: dict[str, float] = {}
    if "weight_g" in shaft_info:
        shaft_numbers["weight_g"] = float(shaft_info["weight_g"])
    if buildable_shafts:
        shaft_numbers["buildable_shafts_count"] = float(len(buildable_shafts))

    shaft_sources: list[Provenance] = [
        answers.provenance[k] for k in ("flight", "tempo") if k in answers.provenance
    ]
    if not shaft_sources:
        shaft_sources = [Provenance(source="questionnaire")]

    model_name = rec.shaft_model or shaft_info.get("model", rec.shaft)
    nearest_note = ""
    for line in trace_by_prefix.get("shaft", []):
        if "nearest flex" in line:
            nearest_note = " Nearest available flex was selected for this head."
            break

    shaft_plain = (
        f"The {model_name} ({rec.material}) matches your {answers.flight} flight "
        f"and {answers.tempo} tempo.{nearest_note}"
    )
    if intake and intake.joint_pain and any(p != "none" for p in intake.joint_pain):
        shaft_plain += (
            " You noted joint pain; a fitter would consider a graphite shaft to reduce vibration, "
            "though it may change the build to custom."
        )
        shaft_sources.append(Provenance(source="questionnaire", note="joint pain reported"))

    items.append(
        WhyItem(
            part="shaft_model",
            plain=shaft_plain,
            numbers=shaft_numbers,
            sources=shaft_sources,
            close_call=cc_by_part.get("shaft_model"),
            depth_hint=depth_hint,
        )
    )

    # 4. Length
    length_numbers: dict[str, float] = {
        "height_cm": float(answers.height_cm),
        "length_in": float(rec.length_in),
    }
    if answers.wrist_to_floor_cm is not None:
        length_numbers["wrist_to_floor_cm"] = float(answers.wrist_to_floor_cm)
    length_sources: list[Provenance] = (
        [answers.provenance["height_cm"]]
        if "height_cm" in answers.provenance
        else [Provenance(source="questionnaire")]
    )

    if depth_hint == "numbers":
        length_plain = (
            f"Height {answers.height_cm:.0f} cm maps to length adjustment {rec.length_in:+.1f} in."
        )
    elif rec.length_in == 0.0:
        length_plain = (
            f"Standard length fits your height ({answers.height_cm:.0f} cm) "
            "and wrist-to-floor measure."
        )
    else:
        length_plain = (
            f"Length {rec.length_in:+.1f} in fits your height ({answers.height_cm:.0f} cm) "
            "and wrist-to-floor measure."
        )

    items.append(
        WhyItem(
            part="length",
            plain=length_plain,
            numbers=length_numbers,
            sources=length_sources,
            close_call=cc_by_part.get("length"),
            depth_hint=depth_hint,
        )
    )

    # 5. Lie
    chart_lie = pack.static_lie_deg(answers.height_cm, answers.wrist_to_floor_cm)
    lie_numbers: dict[str, float] = {
        "lie_deg": float(rec.lie_deg),
        "chart_lie_deg": round(float(chart_lie), 1),
    }
    if answers.lie_override_deg is not None:
        lie_numbers["evidence_lie_deg"] = round(float(answers.lie_override_deg), 1)

    lie_prov = answers.provenance.get("lie")
    if lie_prov is not None:
        lie_sources: list[Provenance] = [
            lie_prov,
            Provenance(source="derived", note="static fit chart"),
        ]
    else:
        lie_sources = [
            answers.provenance[k]
            for k in ("height_cm", "wrist_to_floor_cm")
            if k in answers.provenance
        ]
        if not lie_sources:
            lie_sources = [Provenance(source="derived", note="static fit chart")]

    if lie_prov is not None and lie_prov.source == "ball_line":
        n_readings = f" ({lie_prov.n} readings)" if lie_prov.n else " readings"
        lie_plain = (
            f"Your ball-line test{n_readings} fused with the static chart "
            f"gives {rec.lie_deg:+d}° lie."
        )
    elif lie_prov is not None and lie_prov.source in ("trackman", "radar"):
        note = (lie_prov.note or "").lower()
        if "test" in note:
            ev_deg = (
                round(answers.lie_override_deg)
                if answers.lie_override_deg is not None
                else rec.lie_deg
            )
            ch_deg = round(chart_lie)
            lie_plain = (
                f"The test-club TrackMan shots point to {rec.lie_deg:+d}° lie "
                f"(chart {ch_deg:+d}° → evidence {ev_deg:+d}°)."
            )
        else:
            lie_plain = (
                "Your own 7-iron TrackMan Dynamic Lie fused with the static chart "
                f"gives {rec.lie_deg:+d}° lie."
            )
    else:
        if rec.lie_deg == 0:
            lie_plain = (
                f"Standard lie fits your height ({answers.height_cm:.0f} cm) "
                "and wrist-to-floor measure on the static chart."
            )
        else:
            lie_plain = (
                f"The static chart based on height ({answers.height_cm:.0f} cm) "
                f"and wrist-to-floor measure gives {rec.lie_deg:+d}° lie."
            )

    items.append(
        WhyItem(
            part="lie",
            plain=lie_plain,
            numbers=lie_numbers,
            sources=lie_sources,
            close_call=cc_by_part.get("lie"),
            depth_hint=depth_hint,
        )
    )

    # 6. Grip
    grip_numbers: dict[str, float] = {}
    if answers.est_hand_length_cm is not None:
        grip_numbers["hand_length_cm"] = round(float(answers.est_hand_length_cm), 1)

    grip_sources: list[Provenance] = (
        [answers.provenance["glove"]]
        if "glove" in answers.provenance
        else [Provenance(source="questionnaire")]
    )
    grip_plain = f"{rec.grip.capitalize()} grip fits your glove size ({answers.glove}). " + (
        "Standard and midsize grips keep the set stock."
        if rec.grip != "oversize"
        else "Oversize grips make the set a custom order; standard and midsize are stock."
    )

    items.append(
        WhyItem(
            part="grip",
            plain=grip_plain,
            numbers=grip_numbers,
            sources=grip_sources,
            close_call=cc_by_part.get("grip"),
            depth_hint=depth_hint,
        )
    )

    # 7. Purchase
    if rec.purchase == "stock":
        purchase_plain = "Stock build qualifies for Takomo's 30-day return policy."
        purchase_sources = [
            answers.provenance.get("height_cm") or Provenance(source="questionnaire")
        ]
    else:
        custom_parts: list[str] = []
        custom_sources: list[Provenance] = []
        if rec.length_in != 0.0:
            custom_parts.append(f"length {rec.length_in:+.1f} in")
            if "height_cm" in answers.provenance:
                custom_sources.append(answers.provenance["height_cm"])
        if rec.lie_deg != 0:
            custom_parts.append(f"lie {rec.lie_deg:+d}°")
            lie_src = answers.provenance.get("lie") or answers.provenance.get("wrist_to_floor_cm")
            if lie_src:
                custom_sources.append(lie_src)
        if rec.grip not in pack.STOCK_GRIPS:
            custom_parts.append(f"{rec.grip} grip")
            if "glove" in answers.provenance:
                custom_sources.append(answers.provenance["glove"])
        head_rec = pack.head(rec.head)
        stock_shafts = head_rec.get("stock_shafts", []) if head_rec else []
        if rec.shaft_model and rec.shaft_model not in stock_shafts:
            custom_parts.append(f"{rec.shaft_model} shaft")
            if "swing_bucket" in answers.provenance:
                custom_sources.append(answers.provenance["swing_bucket"])
        if not custom_parts:
            custom_parts.append("custom specifications")
        if not custom_sources:
            custom_sources = [Provenance(source="questionnaire")]
        purchase_plain = (
            f"Custom build ({', '.join(custom_parts)}) is built to order and is non-returnable."
        )
        purchase_sources = custom_sources

    items.append(
        WhyItem(
            part="purchase",
            plain=purchase_plain,
            numbers={},
            sources=purchase_sources,
            close_call=cc_by_part.get("purchase"),
            depth_hint=depth_hint,
        )
    )

    return items
