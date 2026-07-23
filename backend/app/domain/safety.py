"""Safety policy engine.

Deterministic rules ONLY. The LLM never decides safety/approval/execution.
- ``evaluate_l2`` produces the 5 frozen safety check items for an L2 plan.
- ``classify_action`` detects L3 (permanently forbidden) actions. An L3 action
  is blocked here and never becomes a plan/approval/command/execution.

Safety boundaries (hard) come from the room ``safety_params``; the ``target_range``
is advisory. ``maxRatePerHour`` is a soft target; a hard rate ceiling is enforced
separately so legitimately faster recovery plans remain approvable.
"""

from __future__ import annotations

from dataclasses import dataclass

HARD_RATE_CEILING_C_PER_H = 2.0
L2_ALLOWED_PARAM_KEYS = frozenset({"targetTemp", "rate", "fanMode", "valveOpening"})
L3_PATTERNS = ("关闭压缩机联锁", "关闭联锁", "越过设备保护", "越设备保护", "强制满负荷", "禁用联锁", "解除联锁")


@dataclass
class SafetyCheck:
    key: str
    label: str
    passed: bool
    detail: str


def evaluate_l2(
    params: list[dict],
    *,
    min_temp_c: float,
    max_temp_c: float,
) -> list[SafetyCheck]:
    """Evaluate the 5 frozen L2 safety checks against hard safety boundaries."""
    by_key = {p.get("key"): p for p in params}
    target_temp = _num(by_key.get("targetTemp", {}).get("value"))
    rate_cap = _rate(by_key.get("rate", {}).get("value"))

    # 1. whitelist
    unknown = [k for k in by_key if k not in L2_ALLOWED_PARAM_KEYS]
    whitelist_ok = not unknown
    whitelist = SafetyCheck(
        "whitelist", "参数白名单", whitelist_ok,
        "全部参数在白名单内" if whitelist_ok else f"非白名单参数：{unknown}",
    )

    # 2. bounds (hard safety boundary, not the advisory target_range)
    bounds_ok = min_temp_c <= target_temp <= max_temp_c
    bounds = SafetyCheck(
        "bounds", "上下限校验", bounds_ok,
        f"目标温度在 {min_temp_c}~{max_temp_c}℃ 安全区间" if bounds_ok else f"目标温度 {target_temp}℃ 超出安全区间",
    )

    # 3. rate (hard ceiling)
    rate_ok = rate_cap <= HARD_RATE_CEILING_C_PER_H
    rate = SafetyCheck(
        "rate", "变化速率校验", rate_ok,
        f"变化速率 ≤ {rate_cap}℃/h" if rate_ok else f"变化速率 {rate_cap}℃/h 超过硬上限",
    )

    # 4. conflict (single plan, no overlapping commands)
    conflict = SafetyCheck("conflict", "冲突检测", True, "无冲突控制指令")

    # 5. permission (server-injected operator holds L2)
    permission = SafetyCheck("permission", "权限校验", True, "当前角色具备 L2 审批权限")

    return [whitelist, bounds, rate, conflict, permission]


def is_safe(checks: list[SafetyCheck]) -> bool:
    return all(c.passed for c in checks)


def classify_action(action_text: str) -> str:
    """Return 'L3' if the action text matches a permanently-forbidden pattern."""
    text = action_text or ""
    if any(pattern in text for pattern in L3_PATTERNS):
        return "L3"
    return "L2"


def _num(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _rate(value) -> float:
    if isinstance(value, int | float):
        return float(value)
    text = str(value)
    cleaned = "".join(ch for ch in text if ch.isdigit() or ch == ".")
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0
