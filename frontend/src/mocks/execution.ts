import type { SensorReading } from '@/domain/types';
import { MOCK_NOW_MS } from './referenceTime';

/** 生成执行观测曲线：从当前温度逼近目标（仿真执行）。 */
export function buildExecutionSeries(target: number, hours: number): SensorReading[] {
  const start = 10.6;
  const points: SensorReading[] = [];
  const steps = Math.round(hours * 6);
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const eased = 1 - Math.exp(-2.5 * progress);
    const wobble = Math.sin(progress * 14) * 0.08;
    const value = start + (target - start) * eased + wobble;
    points.push({
      t: new Date(MOCK_NOW_MS + i * 10 * 60_000).toISOString(),
      value: Math.round(value * 100) / 100,
    });
  }
  return points;
}