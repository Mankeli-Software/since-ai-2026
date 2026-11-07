"""RK4 3D ball trajectory recorder (plan §3.6).

Produces 30-60 (x_yd, y_yd, z_yd, t_s) sample points for 3D club stage and 2D flight SVG.
Reaches physics constants and equations through app.pack only (import-linter enforced).
Fast scalar math implementation (< 1 ms per trajectory).
"""

from __future__ import annotations

import math

import numpy as np

from app import pack


def trajectory(
    ball_speed_mph: float,
    launch_deg: float,
    spin_rpm: float,
    spin_axis_deg: float = 0.0,
    launch_dir_deg: float = 0.0,
    *,
    dt: float = 0.02,
    t_max: float = 12.0,
) -> list[tuple[float, float, float, float]]:
    """Vectorised RK4 3D flight recording downsampled to 40-50 points.

    Returns [(x_yd, y_yd, z_yd, t_s), ...] starting at (0, 0, 0, 0)
    and ending at (land_x_yd, 0.0, land_z_yd, land_t_s).
    """
    vb = float(ball_speed_mph) * pack.MPH
    la = math.radians(float(launch_deg))
    ld = math.radians(float(launch_dir_deg))
    ax = math.radians(float(spin_axis_deg))
    w0 = float(spin_rpm) * 2.0 * math.pi / 60.0

    vx = vb * math.cos(la) * math.cos(ld)
    vy = vb * math.sin(la)
    vz = vb * math.cos(la) * math.sin(ld)
    px, py, pz = 0.0, 0.0, 0.0

    sy = -math.sin(ax)
    sz = math.cos(ax)

    k = 0.5 * pack.RHO_STD * pack.AREA / pack.BALL_MASS
    aero = pack.AERO
    spin_tau_s = aero["spin_tau_s"]
    cd0 = aero["cd0"]
    cd1 = aero["cd1"]
    cl1 = aero["cl1"]
    cl_pow = aero["cl_pow"]
    ball_r = pack.BALL_R
    g_val = pack.G
    yd = pack.YD

    def acc(v_x: float, v_y: float, v_z: float, t_curr: float) -> tuple[float, float, float]:
        speed = math.sqrt(v_x * v_x + v_y * v_y + v_z * v_z)
        w = w0 * math.exp(-t_curr / spin_tau_s)
        s_val = min(1.0, max(0.0, w * ball_r / max(speed, 1e-6)))
        cd = cd0 + cd1 * s_val
        cl = cl1 * (s_val**cl_pow)
        drag_factor = -k * cd * speed
        ax_drag = drag_factor * v_x
        ay_drag = drag_factor * v_y
        az_drag = drag_factor * v_z

        # lift_dir = cross(spin_dir, v) where spin_dir = (0, sy, sz)
        lx = sy * v_z - sz * v_y
        ly = sz * v_x
        lz = -sy * v_x
        norm_l = math.sqrt(lx * lx + ly * ly + lz * lz)
        inv_l = 1.0 / max(norm_l, 1e-9)
        lift_factor = k * cl * (speed * speed) * inv_l
        return (
            ax_drag + lift_factor * lx,
            ay_drag + lift_factor * ly - g_val,
            az_drag + lift_factor * lz,
        )

    raw_pts: list[tuple[float, float, float, float]] = [(0.0, 0.0, 0.0, 0.0)]
    land_pt: tuple[float, float, float, float] | None = None
    t = 0.0
    steps = int(t_max / dt)

    for _ in range(steps):
        k1vx, k1vy, k1vz = acc(vx, vy, vz, t)
        k1px, k1py, k1pz = vx, vy, vz

        k2vx, k2vy, k2vz = acc(
            vx + 0.5 * dt * k1vx,
            vy + 0.5 * dt * k1vy,
            vz + 0.5 * dt * k1vz,
            t + 0.5 * dt,
        )
        k2px, k2py, k2pz = (
            vx + 0.5 * dt * k1vx,
            vy + 0.5 * dt * k1vy,
            vz + 0.5 * dt * k1vz,
        )

        k3vx, k3vy, k3vz = acc(
            vx + 0.5 * dt * k2vx,
            vy + 0.5 * dt * k2vy,
            vz + 0.5 * dt * k2vz,
            t + 0.5 * dt,
        )
        k3px, k3py, k3pz = (
            vx + 0.5 * dt * k2vx,
            vy + 0.5 * dt * k2vy,
            vz + 0.5 * dt * k2vz,
        )

        k4vx, k4vy, k4vz = acc(vx + dt * k3vx, vy + dt * k3vy, vz + dt * k3vz, t + dt)
        k4px, k4py, k4pz = vx + dt * k3vx, vy + dt * k3vy, vz + dt * k3vz

        new_vx = vx + (dt / 6.0) * (k1vx + 2.0 * k2vx + 2.0 * k3vx + k4vx)
        new_vy = vy + (dt / 6.0) * (k1vy + 2.0 * k2vy + 2.0 * k3vy + k4vy)
        new_vz = vz + (dt / 6.0) * (k1vz + 2.0 * k2vz + 2.0 * k3vz + k4vz)

        new_px = px + (dt / 6.0) * (k1px + 2.0 * k2px + 2.0 * k3px + k4px)
        new_py = py + (dt / 6.0) * (k1py + 2.0 * k2py + 2.0 * k3py + k4py)
        new_pz = pz + (dt / 6.0) * (k1pz + 2.0 * k2pz + 2.0 * k3pz + k4pz)

        t += dt

        if new_py <= 0.0 and t > 0.05:
            f = py / (py - new_py)
            land_x = px + f * (new_px - px)
            land_z = pz + f * (new_pz - pz)
            land_t = (t - dt) + f * dt
            land_pt = (
                round(float(land_x / yd), 2),
                0.0,
                round(float(land_z / yd), 2),
                round(float(land_t), 3),
            )
            break

        px, py, pz = new_px, new_py, new_pz
        vx, vy, vz = new_vx, new_vy, new_vz
        raw_pts.append(
            (
                round(float(px / yd), 2),
                round(float(py / yd), 2),
                round(float(pz / yd), 2),
                round(float(t), 3),
            )
        )

    if land_pt is None:
        land_pt = (
            round(float(px / yd), 2),
            0.0,
            round(float(pz / yd), 2),
            round(float(t), 3),
        )

    # Downsample to ~40-50 points (including start and end)
    n_raw = len(raw_pts)
    if n_raw <= 45:
        return raw_pts + [land_pt]

    interior_indices = np.linspace(1, n_raw - 1, 42, dtype=int)
    sampled = [raw_pts[0]]
    for idx in interior_indices:
        sampled.append(raw_pts[int(idx)])
    sampled.append(land_pt)
    return sampled
