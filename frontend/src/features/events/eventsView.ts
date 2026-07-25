import type {
  AnomalyEventSummary,
  MetricKey,
  SensorSeries,
  Severity,
  TaskStatus,
} from '@/domain/types';
import { RECOMMENDED_BANDS } from '@/domain/constants/metrics';
import { latestValue } from '@/domain/viewModels';
import type { RoomBundle } from '@/state/appData';

/**
 * 告警页 ViewModel：由异常事件摘要 + 库房详情（telemetry）聚合。
 * 后端未提供的字段（责任人、关联设备、历史快照对比）一律不编造。
 */

/** 事件 type → 关联指标（覆盖当前后端产出的事件类型；未知类型回退主控温度）。 */
const EVENT_TYPE_METRIC: Record<string, MetricKey> = {
  sustained_high_temp: 'temperature',
  humidity_high: 'humidity',
  pressure_fluctuation: 'pressureDiff',
};

export function metricForEvent(event: AnomalyEventSummary): MetricKey {
  return EVENT_TYPE_METRIC[event.type] ?? 'temperature';
}

/** 阶段分组（筛选器口径，全部为真实 TaskStatus 的归组）。 */
export type StageGroup = 'detected' | 'analyzing' | 'approval' | 'executing' | 'recovered' | 'abnormal';

export function stageGroup(stage: TaskStatus): StageGroup {
  switch (stage) {
    case 'detected':
      return 'detected';
    case 'diagnosing':
    case 'diagnosisCompleted':
    case 'simulating':
    case 'simulationCompleted':
      return 'analyzing';
    case 'awaitingApproval':
    case 'approved':
      return 'approval';
    case 'executing':
    case 'verifying':
      return 'executing';
    case 'recovered':
      return 'recovered';
    default:
      return 'abnormal';
  }
}

export const STAGE_GROUP_LABEL: Record<StageGroup, string> = {
  detected: '待响应',
  analyzing: '分析中',
  approval: '待审批',
  executing: '执行中',
  recovered: '已恢复',
  abnormal: '异常中断',
};

/** 审批状态（由 awaitingApproval + stage 派生）。 */
export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'none';

export function approvalState(event: AnomalyEventSummary): ApprovalState {
  if (event.awaitingApproval) return 'pending';
  if (event.stage === 'approved' || event.stage === 'executing' || event.stage === 'verifying' || event.stage === 'recovered') {
    // 进入执行/恢复的事件必然经历过批准（状态机守卫）。
    return 'approved';
  }
  if (event.stage === 'rejected') return 'rejected';
  return 'none';
}

export const APPROVAL_STATE_LABEL: Record<ApprovalState, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已驳回',
  none: '—',
};

export interface AlertKpis {
  total: number;
  /** 数据锚定日期（UTC）当天触发的告警数。 */
  todayNew: number;
  critical: number;
  criticalPct: number;
  pending: number;
  /** 待响应中最早一条的持续分钟数（无待响应时为 null）。 */
  pendingOldestMinutes: number | null;
  awaitingApproval: number;
}

export function alertKpis(events: AnomalyEventSummary[]): AlertKpis {
  const anchorMs = events.length ? Math.max(...events.map((e) => Date.parse(e.startedAt))) : null;
  const anchorDay = anchorMs === null ? null : new Date(anchorMs).toISOString().slice(0, 10);
  const todayNew = anchorDay === null ? 0 : events.filter((e) => e.startedAt.slice(0, 10) === anchorDay).length;
  const critical = events.filter((e) => e.severity === 'critical' || e.severity === 'emergency').length;
  const pendingEvents = events.filter((e) => e.stage === 'detected');
  return {
    total: events.length,
    todayNew,
    critical,
    criticalPct: events.length === 0 ? 0 : Math.round((critical / events.length) * 100),
    pending: pendingEvents.length,
    pendingOldestMinutes: pendingEvents.length === 0 ? null : Math.max(...pendingEvents.map((e) => e.durationMinutes)),
    awaitingApproval: events.filter((e) => e.awaitingApproval).length,
  };
}

export interface AlertReading {
  valueText: string;
  outOfRange: boolean;
  targetText: string;
  /** 目标区间来自后端（true）还是经验参考（false）。 */
  targetFromBackend: boolean;
  series: SensorSeries | null;
}

/** 当前读数与目标范围：取事件关联指标的最新采样；目标仅在后端下发或经验参考存在时给出。 */
export function alertReading(event: AnomalyEventSummary, bundle: RoomBundle | undefined): AlertReading {
  const metric = metricForEvent(event);
  const series = bundle?.telemetry.find((s) => s.metric === metric) ?? null;
  const value = latestValue(series ?? undefined);
  const valueText = value === null || !series ? '暂无数据' : `${value.toFixed(1)} ${series.unit}`;
  if (series?.target) {
    const out = value !== null && (value < series.target.min || value > series.target.max);
    return {
      valueText,
      outOfRange: out,
      targetText: `${series.target.min} ~ ${series.target.max} ${series.target.unit}`,
      targetFromBackend: true,
      series,
    };
  }
  const reference = RECOMMENDED_BANDS[metric];
  return {
    valueText,
    outOfRange: false,
    targetText: reference ? reference.replace('目标 ', '') : '暂无数据',
    targetFromBackend: false,
    series,
  };
}

/** 告警触发瞬间的读数（取序列中最接近 startedAt 的点，用于详情时间线描述）。 */
export function readingAtStart(event: AnomalyEventSummary, bundle: RoomBundle | undefined): string | null {
  const metric = metricForEvent(event);
  const series = bundle?.telemetry.find((s) => s.metric === metric);
  if (!series || series.points.length === 0) return null;
  const startMs = Date.parse(event.startedAt);
  let closest = series.points[0];
  for (const point of series.points) {
    if (Math.abs(Date.parse(point.t) - startMs) < Math.abs(Date.parse(closest.t) - startMs)) closest = point;
  }
  const base = `${closest.value.toFixed(1)} ${series.unit}`;
  if (series.target && (closest.value < series.target.min || closest.value > series.target.max)) {
    return `${base}，超出目标 ${series.target.min}~${series.target.max} ${series.target.unit}`;
  }
  return base;
}

export function severityRank(severity: Severity): number {
  return { emergency: 4, critical: 3, warning: 2, notice: 1 }[severity];
}
