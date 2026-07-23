import type { ISODateString, TargetRange } from './primitives';

/** 监测指标。 */
export type MetricKey = 'temperature' | 'humidity' | 'o2' | 'co2' | 'pressureDiff';

/** 单个采样点。 */
export interface SensorReading {
  t: ISODateString;
  value: number;
}

/** 传感器健康状态。 */
export type SensorStatus = 'online' | 'offline' | 'drifting' | 'stale';

/** 某库房某指标的时序。 */
export interface SensorSeries {
  roomId: string;
  metric: MetricKey;
  unit: string;
  points: SensorReading[];
  /** 仅主控指标带目标区间。 */
  target?: TargetRange;
  status: SensorStatus;
  /** 最新采样时间，用于“数据延迟”判断。 */
  lastSampleAt: ISODateString;
}