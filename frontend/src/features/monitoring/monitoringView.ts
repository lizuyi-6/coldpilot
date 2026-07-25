import type {
  AnomalyEventSummary,
  ColdRoom,
  Device,
  MetricKey,
  RoomEventMarker,
  SensorSeries,
  SensorStatus,
} from '@/domain/types';
import { METRIC_META } from '@/domain/constants/metrics';
import { latestValue } from '@/domain/viewModels';

/**
 * 监控页 ViewModel：全部由 ColdPilotClient 响应聚合派生。
 * 后端未提供的字段（如传感器物理位置、责任人）不在此编造。
 */

/** 传感器状态 → 健康度展示映射（仅展示用，真实状态以 status 为准）。 */
const HEALTH_BY_STATUS: Record<SensorStatus, number> = {
  online: 100,
  drifting: 80,
  stale: 60,
  offline: 0,
};

export interface SensorHealthRow {
  key: string;
  metric: MetricKey;
  metricLabel: string;
  unit: string;
  sampleCount: number;
  healthPct: number;
  /** 相对同库房最新采样的滞后（分钟；0 视为实时）。 */
  lagMinutes: number;
  status: SensorStatus;
  lastSampleAt: string;
}

/** 以同库房最晚采样时刻为锚点，避免用真实当前时间去衡量演示/回放数据。 */
export function telemetryAnchor(telemetry: SensorSeries[]): number | null {
  const stamps = telemetry.map((s) => Date.parse(s.lastSampleAt)).filter((t) => Number.isFinite(t));
  return stamps.length ? Math.max(...stamps) : null;
}

export function sensorHealthRows(telemetry: SensorSeries[]): SensorHealthRow[] {
  const anchor = telemetryAnchor(telemetry);
  return telemetry.map((series) => {
    const lagMinutes = anchor === null ? 0 : Math.max(0, Math.round((anchor - Date.parse(series.lastSampleAt)) / 60_000));
    return {
      key: `${series.roomId}-${series.metric}`,
      metric: series.metric,
      metricLabel: METRIC_META[series.metric].label,
      unit: series.unit,
      sampleCount: series.points.length,
      healthPct: HEALTH_BY_STATUS[series.status],
      lagMinutes,
      status: series.status,
      lastSampleAt: series.lastSampleAt,
    };
  });
}

export interface DataQualityView {
  /** 完整度 = 各通道健康度均值（0~100）。 */
  completenessPct: number;
  rating: string;
  onlineCount: number;
  degradedCount: number;
  offlineCount: number;
  total: number;
  /** 主控指标超出目标区间的采样点数（无目标区间时为 null）。 */
  anomalousPoints: number | null;
  /** 平均延迟 = 各通道相对库房最新采样的平均滞后（分钟；全为 0 视为实时）。 */
  avgLagMinutes: number;
}

export function dataQualityView(telemetry: SensorSeries[], primaryMetric: MetricKey = 'temperature'): DataQualityView {
  const rows = sensorHealthRows(telemetry);
  const total = rows.length;
  const onlineCount = rows.filter((r) => r.status === 'online').length;
  const offlineCount = rows.filter((r) => r.status === 'offline').length;
  const degradedCount = total - onlineCount - offlineCount;
  const completenessPct = total === 0 ? 0 : Math.round(rows.reduce((sum, r) => sum + r.healthPct, 0) / total);
  const avgLagMinutes = total === 0 ? 0 : Math.round(rows.reduce((sum, r) => sum + r.lagMinutes, 0) / total);

  const primary = telemetry.find((s) => s.metric === primaryMetric) ?? telemetry[0];
  let anomalousPoints: number | null = null;
  if (primary?.target) {
    anomalousPoints = primary.points.filter((p) => p.value < primary.target!.min || p.value > primary.target!.max).length;
  }

  const rating = completenessPct >= 90 ? '优秀' : completenessPct >= 70 ? '一般' : '较差';
  return { completenessPct, rating, onlineCount, degradedCount, offlineCount, total, anomalousPoints, avgLagMinutes };
}

/** 设备运行要点：从 Device.metrics 提取可解释的运行参数（无则回退状态文案）。 */
export function deviceOperationalHint(device: Device): string | null {
  const metrics = device.metrics ?? {};
  switch (device.kind) {
    case 'compressor':
      return typeof metrics.efficiencyPct === 'number' ? `效率 ${Math.round(metrics.efficiencyPct)}%` : null;
    case 'fan':
      return typeof metrics.airflowPct === 'number' ? `风量 ${Math.round(metrics.airflowPct)}%` : null;
    case 'valve':
      return typeof metrics.openingPct === 'number' ? `开启 ${Math.round(metrics.openingPct)}%` : null;
    case 'door':
      return typeof metrics.openPct === 'number' ? (metrics.openPct > 0 ? `开启 ${Math.round(metrics.openPct)}%` : '关闭') : null;
    case 'meter':
      return typeof metrics.todayKwh === 'number' ? `今日 ${Math.round(metrics.todayKwh)} kWh` : null;
    default:
      return null;
  }
}

/** 事件时间线筛选分组。 */
export type RoomEventGroup = 'all' | 'door' | 'inbound' | 'compressor';

export function filterRoomEvents(events: RoomEventMarker[], group: RoomEventGroup): RoomEventMarker[] {
  if (group === 'all') return events;
  return events.filter((e) => {
    if (group === 'door') return e.kind === 'door_open' || e.kind === 'door_close';
    if (group === 'inbound') return e.kind === 'inbound';
    return e.kind === 'compressor_start' || e.kind === 'compressor_stop';
  });
}

/** 告警时间线条目（异常事件摘要 → 时间线展示）。 */
export interface AlertTimelineItem {
  id: string;
  severity: AnomalyEventSummary['severity'];
  title: string;
  roomName: string;
  at: string;
  stageLabel: string;
  recovered: boolean;
}

export function roomTargetText(room: ColdRoom): string {
  return `${room.targetRange.min} ~ ${room.targetRange.max} ${room.targetRange.unit}`;
}

export function latestText(series: SensorSeries | undefined, unit: string): string {
  const value = latestValue(series);
  return value === null ? '—' : `${value.toFixed(1)} ${unit}`;
}
