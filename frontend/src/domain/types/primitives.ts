/** ISO-8601 时间字符串（UTC），例如 2026-07-23T09:15:00Z。 */
export type ISODateString = string;

/**
 * 数据来源标注：演示数据 / 仿真结果 / 真实结果。
 * 本阶段前端仅有 demo 与 simulated，绝不表达为真实成果。
 */
export type Provenance = 'demo' | 'simulated' | 'real';

/** 风险等级。 */
export type RiskLevel = 'low' | 'medium' | 'high';

/** 目标区间。 */
export interface TargetRange {
  metric: import('./sensor').MetricKey;
  min: number;
  max: number;
  unit: string;
}