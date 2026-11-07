"""Ball flight simulation and dispersion (plan §3.6, #26).

Vectorised 200-sample Monte Carlo per head using Takomo physics.
Computes carry/side/apex stats, 1σ and 2σ covariance ellipses,
and 3D trajectories for up to 5 Takomo heads.
"""

from __future__ import annotations

import contextlib
import hashlib
import math
import statistics
from collections.abc import Sequence

import numpy as np

from app import pack
from app.fitting import priors
from app.fitting.mapping import build_answers
from app.fitting.session_inputs import evidence_of, intake_of
from app.fitting.trajectory import trajectory
from app.schemas.common import HeadSlug
from app.schemas.evidence import Shot
from app.schemas.fit import (
    CarryStats,
    Ellipse,
    Ellipses,
    FitEvidence,
    FlightResult,
    FlightSummary,
    HeadFlight,
    IntakeAnswers,
    SideStats,
)
from app.schemas.session import FitSession

CURRENT_CLUBS_GAIN_THRESHOLD_YD: float = 3.0


def own_shots_carry_gain(
    shots: Sequence[Shot],
    per_head: Sequence[HeadFlight],
    lie_change_deg: int | float = 0,
) -> float | None:
    """Carry gain in yards when own 7-iron shots exist and no lie change is needed.

    Returns None when there are no own shots, or when a lie change is needed.
    """
    if lie_change_deg != 0:
        return None

    own_carries = [
        float(s.carry_yd)
        for s in shots
        if s.carry_yd is not None and (s.club == "own_7i" or not s.club.startswith("takomo_"))
    ]
    if not own_carries:
        return None

    rec_flight = next((h for h in per_head if h.recommended), per_head[0] if per_head else None)
    if rec_flight is None:
        return None

    return round(float(rec_flight.summary.carry.mean) - float(np.mean(own_carries)), 1)


def _club_loft(s: Shot, intake: IntakeAnswers) -> float:
    if s.club_loft_deg is not None:
        return float(s.club_loft_deg)
    if s.club == "own_7i" and intake.own_7i_loft_deg is not None:
        return float(intake.own_7i_loft_deg)
    if s.club.startswith("takomo_"):
        parts = s.club.split("_")
        if len(parts) >= 2:
            h = pack.head(parts[1])
            if h and "seven_iron_loft_deg" in h:
                return float(h["seven_iron_loft_deg"])
    return 30.0


def simulate_flight(
    intake: IntakeAnswers,
    evidence: FitEvidence | None = None,
    heads: Sequence[HeadSlug] | None = None,
    *,
    recommended_head: HeadSlug | None = None,
    lie_error_deg: float | Sequence[float] = 0.0,
    lie_change_deg: int | float = 0,
    n_samples: int = 200,
    session_id: str = "default",
    evidence_version: int = 0,
) -> FlightResult:
    """Simulate ball flight and top/side dispersion for heads.

    Returns FlightResult containing per-head summaries, ellipses, trajectories,
    and any raw own-shot points for comparison.
    """
    ev = evidence or FitEvidence()
    shots = ev.shots

    # 1. Base club speed
    base_speed: float | None = None
    with contextlib.suppress(Exception):
        answers = build_answers(intake, ev)
        base_speed = answers.est_7i_speed_mph

    if base_speed is None and shots:
        speeds = [s.club_speed_mph for s in shots if s.club_speed_mph is not None]
        if speeds:
            base_speed = float(statistics.median(speeds))
    if base_speed is None and intake.reported_7i_speed_mph is not None:
        base_speed = float(intake.reported_7i_speed_mph) - 2.0
    if base_speed is None and intake.reported_7i_carry_yd is not None:
        base_speed = 26.646 + 0.3376 * float(intake.reported_7i_carry_yd)
    if base_speed is None and ev.phone and ev.phone.clubhead_speed_video_mph is not None:
        base_speed = float(ev.phone.clubhead_speed_video_mph)
    if base_speed is None:
        base_speed = priors.SPEED_MPH[0]

    # 2. Golfer delivery model: fall back per column to train priors
    # Loft delta: median of s.dynamic_loft_deg - club_loft
    deltas = [
        float(s.dynamic_loft_deg) - _club_loft(s, intake)
        for s in shots
        if s.dynamic_loft_deg is not None
    ]
    loft_delta = float(statistics.median(deltas)) if deltas else priors.LOFT_DELTA_DEG

    aoas = [float(s.attack_angle_deg) for s in shots if s.attack_angle_deg is not None]
    base_aoa = float(statistics.median(aoas)) if aoas else priors.ATTACK_ANGLE_DEG

    paths = [float(s.club_path_deg) for s in shots if s.club_path_deg is not None]
    base_path = float(statistics.median(paths)) if paths else priors.CLUB_PATH_DEG

    faces = [float(s.face_angle_deg) for s in shots if s.face_angle_deg is not None]
    base_face = float(statistics.median(faces)) if faces else priors.FACE_ANGLE_DEG

    offsets = [float(s.impact_offset_mm) for s in shots if s.impact_offset_mm is not None]
    base_offset = float(statistics.median(offsets)) if offsets else priors.IMPACT_OFFSET_MM

    heights = [float(s.impact_height_mm) for s in shots if s.impact_height_mm is not None]
    base_height = float(statistics.median(heights)) if heights else priors.IMPACT_HEIGHT_MM

    # Handedness handling (plan §3.6)
    # Face, path, and side are already in the target frame (+ right). Never mirror them.
    # Club-relative impact_offset_mm and lie_face_effect_deg flip sign for left-handers.
    is_lefty = intake.handedness == "left"

    target_heads = list(heads) if heads else list(pack.HEAD_ORDER)
    num_heads = len(target_heads)

    # 3. Deterministic Monte Carlo RNG
    seed_bytes = hashlib.sha256(f"{session_id}:{evidence_version}".encode()).digest()
    seed_int = int.from_bytes(seed_bytes[:8], "big")
    rng = np.random.default_rng(seed_int)

    # Sample random noise for all shots across all heads
    delta_face = rng.normal(0.0, priors.SHOT_FACE_SD_DEG, (num_heads, n_samples))
    delta_path = rng.normal(0.0, priors.SHOT_PATH_SD_DEG, (num_heads, n_samples))
    delta_off = rng.normal(0.0, priors.SHOT_OFFSET_SD_MM, (num_heads, n_samples))
    delta_hgt = rng.normal(0.0, priors.SHOT_HEIGHT_SD_MM, (num_heads, n_samples))
    delta_spd = rng.normal(0.0, priors.SHOT_SPEED_SD_MPH, (num_heads, n_samples))
    delta_loft = rng.normal(0.0, priors.SHOT_LOFT_SD_DEG, (num_heads, n_samples))
    delta_aoa = rng.normal(0.0, priors.SHOT_ATTACK_SD_DEG, (num_heads, n_samples))

    # Collect head specs and build batched arrays
    all_speeds: list[np.ndarray] = []
    all_lofts: list[np.ndarray] = []
    all_aoas: list[np.ndarray] = []
    all_faces: list[np.ndarray] = []
    all_paths: list[np.ndarray] = []
    all_offsets: list[np.ndarray] = []
    all_heights: list[np.ndarray] = []
    all_forgivenesses: list[np.ndarray] = []

    head_metadata: list[dict[str, float | str | bool]] = []

    for i, head_slug in enumerate(target_heads):
        head_rec = pack.head(head_slug)
        seven_loft = float(head_rec["seven_iron_loft_deg"]) if head_rec else 30.0
        forgiveness = float(head_rec["ratings"]["forgiveness"]) if head_rec else 3.0
        label = str(head_rec["name"]) if head_rec and "name" in head_rec else str(head_slug)

        head_lie_err = (
            float(lie_error_deg[i])
            if isinstance(lie_error_deg, (list, tuple))
            else float(lie_error_deg)
        )
        dynamic_loft = seven_loft + loft_delta
        lie_effect = pack.lie_face_effect_deg(head_lie_err, dynamic_loft)
        if is_lefty:
            lie_effect = -lie_effect
        eff_face = base_face + lie_effect
        eff_offset = -base_offset if is_lefty else base_offset

        head_metadata.append(
            {
                "head": head_slug,
                "label": label,
                "dynamic_loft": dynamic_loft,
                "forgiveness": forgiveness,
                "eff_face": eff_face,
                "eff_offset": eff_offset,
                "recommended": head_slug == recommended_head,
            }
        )

        all_speeds.append(base_speed + delta_spd[i])
        all_lofts.append(dynamic_loft + delta_loft[i])
        all_aoas.append(base_aoa + delta_aoa[i])
        all_faces.append(eff_face + delta_face[i])
        all_paths.append(base_path + delta_path[i])
        # Toe strike (+offset) produces lefty draw when negated for physics.impact
        head_offs = (base_offset + delta_off[i]) * (-1.0 if is_lefty else 1.0)
        all_offsets.append(head_offs)
        all_heights.append(base_height + delta_hgt[i])
        all_forgivenesses.append(np.full(n_samples, forgiveness, dtype=float))

    arr_speed = np.concatenate(all_speeds)
    arr_loft = np.concatenate(all_lofts)
    arr_aoa = np.concatenate(all_aoas)
    arr_face = np.concatenate(all_faces)
    arr_path = np.concatenate(all_paths)
    arr_offset = np.concatenate(all_offsets)
    arr_height = np.concatenate(all_heights)
    arr_forgiveness = np.concatenate(all_forgivenesses)

    # 4. Single vectorised physics shot call for all heads x samples
    sim = pack.physics_shot(
        arr_speed,
        arr_loft,
        arr_aoa,
        arr_face,
        arr_path,
        arr_offset,
        arr_height,
        arr_forgiveness,
    )

    per_head: list[HeadFlight] = []

    for i, meta in enumerate(head_metadata):
        s_slice = slice(i * n_samples, (i + 1) * n_samples)
        carries = np.asarray(sim["carry_yd"][s_slice], float)
        sides = np.asarray(sim["side_yd"][s_slice], float)
        totals = np.asarray(sim["total_yd"][s_slice], float)
        apexes = np.asarray(sim["apex_yd"][s_slice], float)
        land_angles = np.asarray(sim["land_angle_deg"][s_slice], float)
        launches = np.asarray(sim["launch_deg"][s_slice], float)
        spins = np.asarray(sim["spin_rpm"][s_slice], float)

        # Downrange x = sqrt(max(0, carry^2 - side^2))
        downrange_x = np.sqrt(np.maximum(0.0, carries**2 - sides**2))
        pts_x = np.round(downrange_x, 1)
        pts_z = np.round(sides, 1)
        landing_pts: list[tuple[float, float]] = [
            (float(x), float(z)) for x, z in zip(pts_x, pts_z, strict=True)
        ]

        # 1σ and 2σ covariance ellipses
        cx = float(np.mean(downrange_x))
        cz = float(np.mean(sides))
        cov = np.cov(downrange_x - cx, sides - cz)
        evals, evecs = np.linalg.eigh(cov)
        order = np.argsort(evals)[::-1]
        val_major = max(1e-4, float(evals[order[0]]))
        val_minor = max(1e-4, float(evals[order[1]]))
        vec_major = evecs[:, order[0]]
        angle_deg = float(np.degrees(np.arctan2(vec_major[1], vec_major[0])))

        one_sigma = Ellipse(
            cx=round(cx, 2),
            cz=round(cz, 2),
            rx=round(math.sqrt(val_major), 2),
            rz=round(math.sqrt(val_minor), 2),
            angle_deg=round(angle_deg, 2),
        )
        two_sigma = Ellipse(
            cx=round(cx, 2),
            cz=round(cz, 2),
            rx=round(2.0 * math.sqrt(val_major), 2),
            rz=round(2.0 * math.sqrt(val_minor), 2),
            angle_deg=round(angle_deg, 2),
        )

        # Trajectory for median delivery shot
        im = pack.physics_impact(
            base_speed,
            meta["dynamic_loft"],
            base_aoa,
            meta["eff_face"],
            base_path,
            meta["eff_offset"],
            base_height,
            meta["forgiveness"],
        )
        traj = trajectory(
            float(np.ravel(im["ball_speed_mph"])[0]),
            float(np.ravel(im["launch_deg"])[0]),
            float(np.ravel(im["spin_rpm"])[0]),
            float(np.ravel(im["spin_axis_deg"])[0]),
            float(np.ravel(im["launch_dir_deg"])[0]),
        )

        p10, p90 = np.percentile(carries, [10, 90])

        summary = FlightSummary(
            carry=CarryStats(
                mean=round(float(np.mean(carries)), 1),
                p10=round(float(p10), 1),
                p90=round(float(p90), 1),
            ),
            total=round(float(np.mean(totals)), 1),
            side=SideStats(
                mean=round(float(np.mean(sides)), 1),
                sd=round(float(np.std(sides)), 1),
            ),
            apex=round(float(np.mean(apexes)), 1),
            land_angle=round(float(np.mean(land_angles)), 1),
            launch=round(float(np.mean(launches)), 1),
            spin=round(float(np.mean(spins)), 0),
        )

        per_head.append(
            HeadFlight(
                head=meta["head"],  # type: ignore[arg-type]
                label=str(meta["label"]),
                recommended=bool(meta["recommended"]),
                trajectory=traj,
                landing_pts=landing_pts,
                ellipses=Ellipses(one_sigma=one_sigma, two_sigma=two_sigma),
                summary=summary,
            )
        )

    # 5. Extract own shots (if any)
    own_shots = [
        (round(float(s.carry_yd), 1), round(float(s.side_yd or 0.0), 1))
        for s in shots
        if s.carry_yd is not None and (s.club == "own_7i" or not s.club.startswith("takomo_"))
    ]

    actual_lie_change = lie_change_deg
    if actual_lie_change == 0:
        with contextlib.suppress(Exception):
            answers = build_answers(intake, ev)
            lie_need = (
                answers.lie_override_deg
                if answers.lie_override_deg is not None
                else pack.static_lie_deg(answers.height_cm, answers.wrist_to_floor_cm)
            )
            if round(lie_need) != 0:
                actual_lie_change = round(lie_need)

    gain = own_shots_carry_gain(shots, per_head, lie_change_deg=actual_lie_change)
    verdict = gain if gain is not None and gain < CURRENT_CLUBS_GAIN_THRESHOLD_YD else None

    return FlightResult(
        per_head=per_head,
        own_shots=own_shots,
        current_clubs_verdict=verdict,
    )


def simulate_session_flight(
    session: FitSession, heads: Sequence[HeadSlug] | None = None
) -> FlightResult:
    """Convenience wrapper to simulate flight directly from session state."""
    intake = intake_of(session)
    evidence = evidence_of(session)
    rec_head = session.state.best.head if session.state.best else None
    lie_error_deg = 0.0
    rec_lie = session.state.best.lie_deg if session.state.best else 0
    with contextlib.suppress(Exception):
        answers = build_answers(intake, evidence)
        lie_need = (
            answers.lie_override_deg
            if answers.lie_override_deg is not None
            else pack.static_lie_deg(answers.height_cm, answers.wrist_to_floor_cm)
        )
        if session.state.best is None:
            rec_lie = round(lie_need)
        lie_error_deg = float(rec_lie - lie_need)
    res = simulate_flight(
        intake,
        evidence,
        heads,
        recommended_head=rec_head,
        lie_error_deg=lie_error_deg,
        lie_change_deg=rec_lie,
        session_id=session.id,
        evidence_version=session.evidence_version,
    )
    if session.state is not None:
        session.state = session.state.model_copy(
            update={"current_clubs_verdict": res.current_clubs_verdict}
        )
    return res
