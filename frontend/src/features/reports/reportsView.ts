import type { AnomalyEventSummary, EventReport, SecurityAuditEntry, TaskStatus } from '@/domain/types';

/** 报告列表行：事件摘要 + 该事件的处置报告（未生成时为 null）。 */
export interface ReportRow {
  event: AnomalyEventSummary;
  report: EventReport | null;
}

/** 审计列表行：L3 拦截记录 + 关联事件信息（跨事件聚合时补充）。 */
export interface AuditRow {
  entry: SecurityAuditEntry;
  eventTitle: string;
  roomName: string;
}

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  type: string;
  room: string;
  severity: string;
  stage: string;
  query: string;
}

export interface AuditFilters {
  dateFrom: string;
  dateTo: string;
  source: string;
  result: string;
  query: string;
}

export const EMPTY_REPORT_FILTERS: ReportFilters = {
  dateFrom: '',
  dateTo: '',
  type: 'all',
  room: 'all',
  severity: 'all',
  stage: 'all',
  query: '',
};

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  dateFrom: '',
  dateTo: '',
  source: 'all',
  result: 'all',
  query: '',
};

/** 阶段筛选分组：把全部 TaskStatus 归为可读的 5 组。 */
const STAGE_GROUPS: Record<string, TaskStatus[]> = {
  active: ['detected', 'diagnosing', 'diagnosisCompleted', 'simulating', 'simulationCompleted'],
  awaitingApproval: ['awaitingApproval'],
  executing: ['approved', 'executing', 'verifying'],
  recovered: ['recovered'],
  failed: ['diagnosisFailed', 'simulationFailed', 'executionFailed', 'rejected', 'safeFallback'],
};

export const STAGE_FILTER_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '处理中' },
  { value: 'awaitingApproval', label: '待审批' },
  { value: 'executing', label: '执行中' },
  { value: 'recovered', label: '已恢复' },
  { value: 'failed', label: '异常终止' },
];

/** 执行结果列：由事件阶段真实映射。 */
export function executionResultOf(stage: TaskStatus): { label: string; tone: 'accent' | 'warning' | 'neutral' | 'danger' } {
  if (stage === 'recovered') return { label: '已执行', tone: 'accent' };
  if (stage === 'executing' || stage === 'verifying') return { label: '执行中', tone: 'warning' };
  if (stage === 'approved') return { label: '已批准待执行', tone: 'neutral' };
  if (stage === 'rejected') return { label: '已驳回', tone: 'danger' };
  if (stage === 'executionFailed') return { label: '执行失败', tone: 'danger' };
  if (stage === 'safeFallback') return { label: '安全回退', tone: 'warning' };
  return { label: '未执行', tone: 'neutral' };
}

/** 恢复结果列：只有 recovered 阶段有真实恢复结论。 */
export function recoveryResultOf(stage: TaskStatus): { label: string; tone: 'accent' | 'neutral' } {
  return stage === 'recovered' ? { label: '已恢复', tone: 'accent' } : { label: '—', tone: 'neutral' };
}

/** 报告状态列。 */
export function reportStateOf(row: ReportRow): { label: string; tone: 'accent' | 'neutral' | 'danger' } {
  if (row.report) return { label: '已生成', tone: 'accent' };
  if (row.event.stage === 'recovered') return { label: '不可用', tone: 'danger' };
  return { label: '未生成', tone: 'neutral' };
}

function withinRange(iso: string, dateFrom: string, dateTo: string): boolean {
  const day = iso.slice(0, 10);
  if (dateFrom && day < dateFrom) return false;
  if (dateTo && day > dateTo) return false;
  return true;
}

export function filterReportRows(rows: ReportRow[], filters: ReportFilters): ReportRow[] {
  return rows.filter((row) => {
    const { event, report } = row;
    if (!withinRange(event.startedAt, filters.dateFrom, filters.dateTo)) return false;
    if (filters.type !== 'all' && event.type !== filters.type) return false;
    if (filters.room !== 'all' && event.roomName !== filters.room) return false;
    if (filters.severity !== 'all' && event.severity !== filters.severity) return false;
    if (filters.stage !== 'all' && !STAGE_GROUPS[filters.stage]?.includes(event.stage)) return false;
    if (filters.query) {
      const lowered = filters.query.toLowerCase();
      const haystack = [event.title, event.roomName, event.type, report?.summary ?? '', report?.causeSummary.join(' ') ?? '']
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(lowered)) return false;
    }
    return true;
  });
}

export function filterAuditRows(rows: AuditRow[], filters: AuditFilters): AuditRow[] {
  return rows.filter((row) => {
    const { entry } = row;
    if (!withinRange(entry.attemptedAt, filters.dateFrom, filters.dateTo)) return false;
    if (filters.source !== 'all' && entry.source !== filters.source) return false;
    if (filters.result !== 'all' && entry.outcome !== filters.result) return false;
    if (filters.query) {
      const lowered = filters.query.toLowerCase();
      const haystack = [entry.action, entry.triggeredRule, entry.reason, row.eventTitle, entry.id].join(' ').toLowerCase();
      if (!haystack.includes(lowered)) return false;
    }
    return true;
  });
}

export const SOURCE_LABEL: Record<SecurityAuditEntry['source'], string> = {
  agent: 'Agent',
  user: '用户',
  external: '外部',
};

function quoteCsvCell(cell: string): string {
  return `"${cell.replace(/"/g, '""')}"`;
}

function triggerCsvDownload(filename: string, header: string, body: string): void {
  const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** 导出报告列表 CSV（前端导出已加载数据，后端无导出接口）。 */
export function downloadReportsCsv(rows: ReportRow[]): void {
  const header = 'event_id,event,room,severity,started_at_utc,cause,plan_summary,approval,execution,recovery,report_state\n';
  const body = rows
    .map((row) => {
      const cells = [
        row.event.id,
        row.event.title,
        row.event.roomName,
        row.event.severity,
        row.event.startedAt,
        row.report?.causeSummary[0] ?? '',
        row.report?.summary ?? '',
        row.report ? `${row.report.approval.approver}(${row.report.approval.level})` : '',
        executionResultOf(row.event.stage).label,
        recoveryResultOf(row.event.stage).label,
        reportStateOf(row).label,
      ];
      return cells.map(quoteCsvCell).join(',');
    })
    .join('\n');
  triggerCsvDownload(`event-reports-${new Date().toISOString().slice(0, 10)}.csv`, header, body);
}

/** 导出审计日志 CSV（前端导出，后端无导出接口）。 */
export function downloadAuditCsv(rows: AuditRow[]): void {
  const header = 'id,attempted_at_utc,source,action,event,rule,reason,outcome\n';
  const body = rows
    .map((row) =>
      [
        row.entry.id,
        row.entry.attemptedAt,
        SOURCE_LABEL[row.entry.source],
        row.entry.action,
        row.eventTitle,
        row.entry.triggeredRule,
        row.entry.reason,
        row.entry.outcome,
      ]
        .map(quoteCsvCell)
        .join(','),
    )
    .join('\n');
  triggerCsvDownload(`security-audit-${new Date().toISOString().slice(0, 10)}.csv`, header, body);
}
