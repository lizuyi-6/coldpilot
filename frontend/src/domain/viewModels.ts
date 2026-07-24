import type {
  ColdRoom,
  Device,
  InventoryBatch,
  RoomEventMarker,
  SensorSeries,
  Severity,
  TargetRange,
} from '@/domain/types';

/** 数据来源标注（演示/仿真，绝不表达为真实成果）。 */
export type DataBadge = 'demo' | 'simulated' | 'real';

/** 取指标序列的最新值。 */
export function latestValue(series: SensorSeries | undefined): number | null {
  if (!series || series.points.length === 0) return null;
  return series.points[series.points.length - 1].value;
}

/** 取指标序列最近 n 个值（趋势）。 */
export function recentValues(series: SensorSeries | undefined, n = 12): number[] {
  if (!series) return [];
  return series.points.slice(-n).map((p) => p.value);
}

/** 某库房某指标的序列。 */
export function metricSeries(telemetry: SensorSeries[], metric: string): SensorSeries | undefined {
  return telemetry.find((s) => s.metric === metric);
}

/** 指标是否超目标（温度主控）。 */
export function metricTone(series: SensorSeries | undefined, target?: TargetRange): 'ok' | 'warn' | 'danger' | 'muted' {
  if (!series) return 'muted';
  if (series.status !== 'online') return 'warn';
  const v = latestValue(series);
  if (v === null || !target) return 'ok';
  if (v < target.min || v > target.max) return 'danger';
  return 'ok';
}

/** 传感器在线状态 → 文案/tone。 */
export function sensorStatusTone(status: SensorSeries['status']): 'ok' | 'warn' | 'danger' | 'muted' {
  if (status === 'online') return 'ok';
  if (status === 'offline') return 'danger';
  return 'warn';
}

export function sensorStatusLabel(status: SensorSeries['status']): string {
  return { online: '实时', offline: '离线', drifting: '漂移', stale: '延迟' }[status];
}

/** 设备状态 → 文案/tone。 */
export function deviceStatusLabel(status: Device['status']): string {
  return { running: '运行中', idle: '待机', fault: '故障', offline: '离线' }[status];
}
export function deviceStatusTone(status: Device['status']): 'ok' | 'warn' | 'danger' | 'muted' {
  if (status === 'running') return 'ok';
  if (status === 'idle') return 'muted';
  return 'danger';
}

/** 库存批次风险 → 文案/tone。 */
export function riskLabel(risk: InventoryBatch['risk']): string {
  return { none: '正常', watch: '关注', high: '高风险' }[risk];
}
export function riskTone(risk: InventoryBatch['risk']): 'ok' | 'warn' | 'danger' {
  if (risk === 'high') return 'danger';
  if (risk === 'watch') return 'warn';
  return 'ok';
}

/** 库存剩余安全存储窗口（小时，演示估算：maxStorageHours - 已入库小时）。 */
export function remainingHours(batch: InventoryBatch, nowMs: number): number {
  const inboundMs = Date.parse(batch.inboundAt);
  const elapsed = Math.max(0, (nowMs - inboundMs) / 3_600_000);
  return Math.max(0, batch.maxStorageHours - elapsed);
}

/** 告警等级 tone。 */
export function severityTone(sev: Severity): 'ok' | 'warn' | 'danger' | 'info' {
  if (sev === 'notice') return 'info';
  if (sev === 'warning') return 'warn';
  return 'danger';
}

/** 库房综合状态（依据主控温度 + 传感器在线）。 */
export function roomOverall(
  room: ColdRoom,
  tempSeries: SensorSeries | undefined,
  telemetry: SensorSeries[],
): { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' } {
  const anyOffline = telemetry.some((s) => s.status === 'offline');
  if (anyOffline) return { label: '部分离线', tone: 'warn' };
  const tone = metricTone(tempSeries, room.targetRange);
  if (tone === 'danger') return { label: '越界', tone: 'danger' };
  return { label: '正常', tone: 'ok' };
}

/** 露点温度（由温湿度按 Magnus 公式推算，演示派生值）。 */
export function dewPointC(tempC: number, rhPct: number): number | null {
  if (rhPct <= 0 || rhPct > 100) return null;
  const a = 17.27;
  const b = 237.7;
  const gamma = Math.log(rhPct / 100) + (a * tempC) / (b + tempC);
  const denominator = a - gamma;
  if (denominator === 0) return null;
  return Math.round(((b * gamma) / denominator) * 10) / 10;
}

/** 仿真风险等级 → 文案。 */
export function riskLevelLabel(risk: 'low' | 'medium' | 'high'): string {
  return { low: '低', medium: '中', high: '高' }[risk];
}

export type { RoomEventMarker };