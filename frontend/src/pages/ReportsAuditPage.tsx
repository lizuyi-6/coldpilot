import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { AnomalyEventDetail, EventReport, SecurityAuditEntry } from '@/domain/types';
import { useAppData } from '@/state/appData';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { Search } from '@/components/ui/Search';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { ApprovalLevelBadge } from '@/components/domain/ApprovalLevelBadge';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { ReportDetailSection } from '@/features/reports/ReportDetailSection';
import { AuditLogTab } from '@/features/reports/AuditLogTab';
import {
  EMPTY_REPORT_FILTERS,
  STAGE_FILTER_OPTIONS,
  downloadReportsCsv,
  executionResultOf,
  filterReportRows,
  recoveryResultOf,
  reportStateOf,
  type AuditRow,
  type ReportFilters,
  type ReportRow,
} from '@/features/reports/reportsView';
import { SEVERITY_META } from '@/domain/constants/severity';
import type { Severity } from '@/domain/types';
import { formatDateTimeISO } from '@/utils/formatTime';
import styles from '@/features/reports/reports.module.css';

const PAGE_SIZE = 10;

/** 报告中心页：事件报告 Tab（筛选 + 表格 + 详情）与审计日志 Tab（L3 拦截留痕）。 */
export default function ReportsAuditPage() {
  const { client, events, loading } = useAppData();
  const [tab, setTab] = useState<'reports' | 'audit'>('reports');
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [reportMap, setReportMap] = useState<Record<string, EventReport | null>>({});
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [detail, setDetail] = useState<AnomalyEventDetail | null>(null);

  // 聚合加载全部事件的报告与 L3 审计记录（报告仅已恢复事件存在，失败按未生成处理）。
  useEffect(() => {
    if (events.length === 0) return;
    let cancelled = false;
    void (async () => {
      const [reportResults, auditResults] = await Promise.all([
        Promise.all(events.map((event) => client.getEventReport(event.id).catch(() => null))),
        Promise.all(events.map((event) => client.listSecurityAuditEntries(event.id).catch(() => [] as SecurityAuditEntry[]))),
      ]);
      if (cancelled) return;
      const map: Record<string, EventReport | null> = {};
      events.forEach((event, index) => {
        map[event.id] = reportResults[index];
      });
      setReportMap(map);
      const rows: AuditRow[] = [];
      events.forEach((event, index) => {
        for (const entry of auditResults[index]) {
          rows.push({ entry, eventTitle: event.title, roomName: event.roomName });
        }
      });
      rows.sort((a, b) => Date.parse(b.entry.attemptedAt) - Date.parse(a.entry.attemptedAt));
      setAuditRows(rows);
      setReportsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, events]);

  // 选中事件时加载详情（时间线库房事件 + 最大温度偏差）。
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setDetail(null);
    void (async () => {
      try {
        const eventDetail = await client.getAnomalyEvent(selectedId);
        if (!cancelled) setDetail(eventDetail);
      } catch {
        if (!cancelled) setDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, selectedId]);

  const rows = useMemo<ReportRow[]>(
    () =>
      events
        .map((event) => ({ event, report: reportMap[event.id] ?? null }))
        .sort((a, b) => Date.parse(b.event.startedAt) - Date.parse(a.event.startedAt)),
    [events, reportMap],
  );

  const typeOptions = useMemo(
    () => [{ value: 'all', label: '全部事件类型' }, ...Array.from(new Set(events.map((event) => event.type))).map((value) => ({ value, label: value }))],
    [events],
  );
  const roomOptions = useMemo(
    () => [{ value: 'all', label: '全部冷库' }, ...Array.from(new Set(events.map((event) => event.roomName))).map((value) => ({ value, label: value }))],
    [events],
  );
  const severityOptions = useMemo(
    () => [
      { value: 'all', label: '全部严重级别' },
      ...(Object.keys(SEVERITY_META) as Severity[]).map((value) => ({ value, label: SEVERITY_META[value].label })),
    ],
    [],
  );

  const patch = (partial: Partial<ReportFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setPage(1);
  };

  const filtered = useMemo(() => filterReportRows(rows, filters), [rows, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedRow = selectedId ? (rows.find((row) => row.event.id === selectedId) ?? null) : null;
  const selectedAudit = useMemo(
    () => (selectedId ? auditRows.filter((row) => row.entry.eventId === selectedId).map((row) => row.entry) : []),
    [auditRows, selectedId],
  );

  const columns: TableColumn<ReportRow>[] = [
    {
      key: 'event',
      header: '事件',
      render: (row) => (
        <span className={styles.eventCell}>
          <span className={styles.eventTitle}>{row.event.title}</span>
          <SeverityTag severity={row.event.severity} />
        </span>
      ),
    },
    { key: 'room', header: '冷库', width: '110px', render: (row) => row.event.roomName },
    { key: 'startedAt', header: '发生时间', width: '140px', render: (row) => formatDateTimeISO(row.event.startedAt) },
    {
      key: 'cause',
      header: '原因',
      render: (row) =>
        row.report ? <span className={styles.causeCell}>{row.report.causeSummary[0] ?? '—'}</span> : <span className={styles.note}>—</span>,
    },
    {
      key: 'plan',
      header: '处理方案',
      render: (row) =>
        row.report ? <span className={styles.planCell}>{row.report.summary}</span> : <span className={styles.note}>—</span>,
    },
    {
      key: 'approval',
      header: '审批',
      width: '110px',
      render: (row) =>
        row.report ? (
          <span className={styles.approvalCell}>
            <span className={styles.approver}>{row.report.approval.approver}</span>
            <ApprovalLevelBadge level={row.report.approval.level} />
          </span>
        ) : (
          <span className={styles.note}>—</span>
        ),
    },
    {
      key: 'execution',
      header: '执行结果',
      width: '110px',
      render: (row) => {
        const result = executionResultOf(row.event.stage);
        return <Tag tone={result.tone}>{result.label}</Tag>;
      },
    },
    {
      key: 'recovery',
      header: '恢复结果',
      width: '90px',
      render: (row) => {
        const result = recoveryResultOf(row.event.stage);
        return result.label === '—' ? <span className={styles.note}>—</span> : <Tag tone={result.tone}>{result.label}</Tag>;
      },
    },
    {
      key: 'report',
      header: '报告状态',
      width: '90px',
      render: (row) => {
        if (!reportsLoaded) return <span className={styles.note}>加载中…</span>;
        const state = reportStateOf(row);
        return <Tag tone={state.tone}>{state.label}</Tag>;
      },
    },
    {
      key: 'action',
      header: '操作',
      width: '80px',
      render: (row) => (
        <button type="button" className={styles.detailLink} onClick={() => setSelectedId(row.event.id)}>
          查看详情
        </button>
      ),
    },
  ];

  if (loading && events.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonLoader lines={2} />
        <SkeletonLoader lines={6} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader title="报告中心" description="事件处置报告与安全审计留痕" actions={<DemoDataBadge kind="demo" />} />

      <Tabs
        items={[
          { key: 'reports', label: '事件报告' },
          { key: 'audit', label: '审计日志' },
        ]}
        activeKey={tab}
        onChange={(key) => setTab(key as 'reports' | 'audit')}
        ariaLabel="报告中心切换"
      />

      {tab === 'audit' ? (
        <AuditLogTab rows={auditRows} />
      ) : (
        <>
          <div className={styles.toolbar}>
            <input
              type="date"
              className={styles.dateInput}
              aria-label="开始日期"
              value={filters.dateFrom}
              onChange={(e) => patch({ dateFrom: e.target.value })}
            />
            <span className={styles.dateSep}>至</span>
            <input
              type="date"
              className={styles.dateInput}
              aria-label="结束日期"
              value={filters.dateTo}
              onChange={(e) => patch({ dateTo: e.target.value })}
            />
            <Select ariaLabel="事件类型" options={typeOptions} value={filters.type} onChange={(value) => patch({ type: value })} />
            <Select ariaLabel="冷库" options={roomOptions} value={filters.room} onChange={(value) => patch({ room: value })} />
            <Select ariaLabel="严重级别" options={severityOptions} value={filters.severity} onChange={(value) => patch({ severity: value })} />
            <Select ariaLabel="状态" options={STAGE_FILTER_OPTIONS} value={filters.stage} onChange={(value) => patch({ stage: value })} />
            <div style={{ width: 200 }}>
              <Search value={filters.query} onChange={(value) => patch({ query: value })} placeholder="搜索事件 / 原因 / 方案" />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_REPORT_FILTERS)}>
              重置
            </Button>
            <span className={styles.toolbarSpacer} />
            <Button variant="secondary" size="sm" onClick={() => downloadReportsCsv(filtered)}>
              <Download size={13} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
              导出
            </Button>
          </div>

          <Panel flush>
            {pageRows.length === 0 ? (
              <EmptyState title="没有匹配的事件" description="尝试调整筛选条件。" />
            ) : (
              <>
                <Table
                  columns={columns}
                  rows={pageRows}
                  rowKey={(row) => row.event.id}
                  onRowClick={(row) => setSelectedId(row.event.id)}
                  isRowSelected={(row) => row.event.id === selectedId}
                  rowLabel={(row) => `事件 ${row.event.title}`}
                  minWidth={1240}
                />
                <div className={styles.pagerRow}>
                  <Pagination total={filtered.length} page={safePage} pageSize={PAGE_SIZE} onPageChange={setPage} />
                </div>
              </>
            )}
          </Panel>

          {selectedRow && (
            <Panel>
              <ReportDetailSection
                row={selectedRow}
                detail={detail}
                auditEntries={selectedAudit}
                onViewAudit={() => setTab('audit')}
                onClose={() => setSelectedId(null)}
              />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
