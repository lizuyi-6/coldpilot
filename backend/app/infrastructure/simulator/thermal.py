"""Deterministic parametric first-order thermal simulator.

Same inputs always produce the same outputs. This is a simplified physics
approximation (NOT a validated digital twin, NOT real pilot data). Outputs:
predicted temperature series, recovery hours, energy, overshoot/frost risk,
compressor cycles.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

FAN_FACTOR: dict[str, float] = {"低速": 0.65, "中速": 1.0, "高速": 1.7}
DEFAULT_START_TEMP = 10.6  # fallback if telemetry is empty


@dataclass
class SimulationOutput:
    recovery_hours: float
    energy_kwh: float
    overshoot_risk: str
    frost_risk: str
    compressor_cycles: int
    predicted_series: list[dict]


def parse_rate(value: float | str, default: float = 0.5) -> float:
    """Parse a rate cap like '≤0.5' (or a bare number) into deg/hour."""
    if isinstance(value, int | float):
        return float(value)
    text = str(value)
    cleaned = "".join(ch for ch in text if ch.isdigit() or ch in ".")
    try:
        return float(cleaned) if cleaned else default
    except ValueError:
        return default


def _risk(level: float, thresholds: tuple[float, float]) -> str:
    high, med = thresholds
    if level >= high:
        return "high"
    if level >= med:
        return "medium"
    return "low"


def simulate(
    *,
    start_temp: float,
    target_temp: float,
    rate_cap: float,
    fan_mode: str,
    valve_opening: float,
    min_temp_c: float,
) -> SimulationOutput:
    delta = max(start_temp - target_temp, 0.0)
    fan_factor = FAN_FACTOR.get(fan_mode, 1.0)
    valve_factor = min(max(valve_opening / 60.0, 0.5), 2.0)

    # First-order approach: temp(t) = target + delta*exp(-t/tau). Smaller tau
    # (more aggressive fan/valve) -> faster recovery.
    tau = 1.7 / (fan_factor * valve_factor)
    eps = 0.12
    recovery_hours = max(0.5, tau * math.log(max(delta, eps) / eps))
    recovery_hours = round(recovery_hours * 10) / 10

    # Energy: aggregate compressor+fan work over the recovery window.
    power_kw = 4.5 * (0.7 + 0.3 * fan_factor) * valve_factor
    energy_kwh = round(power_kw * recovery_hours * 50)

    # Risks driven by aggressiveness + thermal margin.
    aggressiveness = fan_factor * valve_factor
    overshoot_risk = _risk(aggressiveness, (2.5, 1.7))
    margin = target_temp - min_temp_c
    frost_risk = _risk((3.0 - margin) * aggressiveness, (2.5, 1.2)) if margin < 3.0 else "low"

    # Compressor cycles scale with recovery window and aggressiveness.
    compressor_cycles = max(1, round(recovery_hours * (1.0 + 1.2 * fan_factor)))

    # Predicted series: exponential easing toward target (10-min steps), with an
    # end-of-curve dip when overshoot risk is elevated.
    steps = max(1, round(recovery_hours * 6))
    now = datetime.now(UTC)
    dip = 0.7 if overshoot_risk == "high" else (0.4 if overshoot_risk == "medium" else 0.0)
    series: list[dict] = []
    for i in range(steps + 1):
        progress = i / steps
        eased = 1 - math.exp(-3 * progress)
        value = start_temp + (target_temp - start_temp) * eased
        if dip > 0 and progress > 0.85:
            value -= dip * math.sin(((progress - 0.85) / 0.15) * math.pi)
        series.append(
            {
                "t": (now + timedelta(minutes=i * 10)).isoformat().replace("+00:00", "Z"),
                "value": round(value * 100) / 100,
            }
        )

    return SimulationOutput(
        recovery_hours=recovery_hours,
        energy_kwh=float(energy_kwh),
        overshoot_risk=overshoot_risk,
        frost_risk=frost_risk,
        compressor_cycles=compressor_cycles,
        predicted_series=series,
    )
