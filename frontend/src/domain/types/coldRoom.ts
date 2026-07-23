import type { TargetRange } from './primitives';

/** 控制模式。 */
export type ControlMode = 'ai_assisted' | 'manual' | 'safe_fallback';

/** 冷库。 */
export interface ColdRoom {
  id: string;
  name: string;
  location: string;
  volumeM3: number;
  controlMode: ControlMode;
  /** 主控指标目标区间（如温度 8~10℃）。 */
  targetRange: TargetRange;
  deviceIds: string[];
  sensorIds: string[];
  safetyParams: {
    minTempC: number;
    maxTempC: number;
    maxRatePerHour: number;
  };
}