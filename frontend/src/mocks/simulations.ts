import type { SensorReading, SimulationResult } from '@/domain/types';
import { MOCK_NOW_MS } from './referenceTime';

/** 生成预测温度曲线：从当前值向目标值平滑/快速逼近。 */
function buildPredicted(start: number, target: number, hours: number, dip = 0): SensorReading[] {
  const points: SensorReading[] = [];
  const steps = Math.round(hours * 6); // 每 10 分钟一个点
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // 指数逼近，末端可带轻微过冲（dip）
    const eased = 1 - Math.exp(-3 * progress);
    let value = start + (target - start) * eased;
    if (dip > 0 && progress > 0.85) {
      value -= dip * Math.sin(((progress - 0.85) / 0.15) * Math.PI);
    }
    points.push({
      t: new Date(MOCK_NOW_MS + i * 10 * 60_000).toISOString(),
      value: Math.round(value * 100) / 100,
    });
  }
  return points;
}

/** 仿真结果：方案 A / B 对比（仿真结果，非真实成果）。 */
export const SIMULATION_RESULTS: Record<string, SimulationResult> = {
  'plan-a': {
    planId: 'plan-a',
    planVersion: 1,
    recoveryHours: 6.2,
    energyKWh: 1180,
    overshootRisk: 'low',
    frostRisk: 'low',
    compressorCycles: 8,
    predictedSeries: buildPredicted(10.6, 8.0, 6.2),
    provenance: 'simulated',
  },
  'plan-b': {
    planId: 'plan-b',
    planVersion: 1,
    recoveryHours: 3.8,
    energyKWh: 1520,
    overshootRisk: 'medium',
    frostRisk: 'medium',
    compressorCycles: 16,
    predictedSeries: buildPredicted(10.6, 7.5, 3.8, 0.5),
    provenance: 'simulated',
  },
};