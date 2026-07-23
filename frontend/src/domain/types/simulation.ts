import type { SensorReading } from './sensor';
import type { RiskLevel } from './primitives';

/** 仿真结果（恒为 simulated）。 */
export interface SimulationResult {
  planId: string;
  planVersion: number;
  recoveryHours: number;
  energyKWh: number;
  overshootRisk: RiskLevel;
  frostRisk: RiskLevel;
  compressorCycles: number;
  /** 预测温度曲线。 */
  predictedSeries: SensorReading[];
  provenance: 'simulated';
}