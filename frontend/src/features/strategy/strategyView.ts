import type { ControlPlan, SimulationResult } from '@/domain/types';

/**
 * 策略与仿真页 ViewModel：方案卡片与推荐理由全部由真实方案 + 仿真结果派生。
 * 后端未提供分时段控制计划、温度波动与设备负荷指标，页面相应位置显示“暂无数据”。
 */

export interface PlanSummary {
  plan: ControlPlan;
  simulation: SimulationResult | null;
}

/** 方案摘要：推荐方案在前（与效果图 A/B 顺序一致）。 */
export function planSummaries(
  plans: ControlPlan[],
  simulations: Record<string, SimulationResult>,
): PlanSummary[] {
  return [...plans]
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'recommended' ? -1 : 1))
    .map((plan) => ({ plan, simulation: simulations[plan.id] ?? null }));
}

/** 方案简称（「方案 A · 平滑逼近目标」→「方案 A」）。 */
export function planShortName(plan: ControlPlan): string {
  return plan.name.split('·')[0].trim();
}

/** 推荐执行理由：模板句 + 仿真真实数字；无仿真时退化为方案思路。 */
export function recommendationReason(plan: ControlPlan, simulation: SimulationResult | null, riskLabel: (level: SimulationResult['overshootRisk']) => string): string {
  if (!simulation) return plan.approach;
  return `综合恢复时间 ${simulation.recoveryHours} h、预计能耗 ${simulation.energyKWh.toLocaleString('zh-CN')} kWh 与风险（过冲${riskLabel(simulation.overshootRisk)}/冻害${riskLabel(simulation.frostRisk)}），建议采用${planShortName(plan)}执行。`;
}
