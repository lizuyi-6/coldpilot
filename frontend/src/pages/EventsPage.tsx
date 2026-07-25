import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnomalyEventSummary } from '@/domain/types';
import { useAppData, type RoomBundle } from '@/state/appData';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Table, type SortDirection, type TableColumn } from '@/components/ui/Table';
import { Search } from '@/components/ui/Search';
import { Select } from '@/components/ui/Select';
import { Tag, type TagTone } from '@/components/ui/Tag';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { OfflineState } from '@/components/ui/OfflineState';
import { Pagination } from '@/components/ui/Pagination';
import { Drawer } from '@/components/ui/Drawer';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { AlertKpiCards } from '@/features/events/AlertKpiCards';
import { AlertDetailContent, AlertDetailPanel } from '@/features/events/AlertDetailPanel';
import { latestValue } from '@/domain/viewModels';
import { useMediaQuery } from '@/utils/useMediaQuery';
import {
  APPROVAL_STATE_LABEL,
  alertReading,
  approvalState,
  metricForEvent,
  severityRank,
  STAGE_GROUP_LABEL,
  stageGroup,
  type ApprovalState,
  type StageGroup,
} from '@/features/events/eventsView';
import { formatDateTimeShort, formatDuration, formatTimeHM } from '@/utils/formatTime';
import styles from '@/features/events/events.module.css';

const SEVERITY_OPTIONS = [
  { value: 'all', label: '全部等级' },
  { value: 'critical', label: '严重' },
  { value: 'warning', label: '警告' },
  { value: 'notice', label: '提示' },
];

const STAGE_OPTIONS: { value: StageGroup | 'all'; label: string }[] = [
  { value: 'all', label: '全部阶段' },
  { value: 'detected', label: '待响应' },
  { value: 'analyzing', label: '分析中' },
  { value: 'approval', label: '待审批' },
  { value: 'executing', label: '执行中' },
  { value: 'recovered', label: '已恢复' },
  { value: 'abnormal', label: '异常中断' },
];

const APPROVAL_OPTIONS: { value: ApprovalState | 'all'; label: string }[] = [
  { value: 'all', label: '全部审批状态' },
  { value: 'pending', label: '待审批' },
  { value: 'approved', label: '已批准' },
  { value: 'rejected', label: '已驳回' },
];

function stageTone(group: StageGroup): TagTone {
  const tones: Record<StageGroup, TagTone> = {
    detected: 'danger',
    analyzing: 'info',
    approval: 'warning',
    executing: 'accent',
    recovered: 'success',
    abnormal: 'danger',
  };
  return tones[group];
}

function approvalTone(state: ApprovalState): TagTone {
  if (state === 'pending') return 'warning';
  if (state === 'approved') return 'success';
  if (state === 'rejected') return 'danger';
  return 'neutral';
}

type AlertSortKey = 'severity' | 'reading' | 'started' | 'duration' | 'stage';

/** 阶段排序权重：越靠前越紧急（待响应 > 分析中 > 待审批 > 执行中 > 已恢复 > 异常中断）。 */
const STAGE_SORT_ORDER: Record<StageGroup, number> = {
  detected: 0,
  analyzing: 1,
  approval: 2,
  executing: 3,
  recovered: 4,
  abnormal: 5,
};

/** 排序取值；读数缺失返回 null（排序时恒排最后）。 */
function alertSortValue(
  event: AnomalyEventSummary,
  key: AlertSortKey,
  rooms: Record<string, RoomBundle>,
): number | null {
  switch (key) {
    case 'severity':
      return severityRank(event.severity);
    case 'reading': {
      const metric = metricForEvent(event);
      const series = rooms[event.roomId]?.telemetry.find((s) => s.metric === metric);
      return latestValue(series);
    }
    case 'started':
      return Date.parse(event.startedAt);
    case 'duration':
      return event.durationMinutes;
    case 'stage':
      return STAGE_SORT_ORDER[stageGroup(event.stage)];
  }
}

export default function EventsPage() {
  const navigate = useNavigate();
  const { events, rooms, loading, error, online, lastUpdated, reload } = useAppData();

  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState<StageGroup | 'all'>('all');
  const [approvalFilter, setApprovalFilter] = useState<ApprovalState | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<AlertSortKey>('started');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  // ≤1280px 时详情改为右侧 Drawer（任务书响应式要求）。
  const inspectorAsDrawer = useMediaQuery('(max-width: 1280px)');

  const handleSort = (columnKey: string) => {
    const nextKey = columnKey as AlertSortKey;
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(nextKey);
      setSortDirection('desc');
    }
  };

  const roomOptions = [
    { value: 'all', label: '全部库房' },
    ...Object.values(rooms).map((b) => ({ value: b.room.id, label: b.room.name })),
  ];

  const filtered = useMemo(() => {
    let list = [...events];
    if (query) {
      const keyword = query.toLowerCase();
      list = list.filter(
        (event) =>
          event.title.toLowerCase().includes(keyword) ||
          event.roomName.toLowerCase().includes(keyword) ||
          event.type.toLowerCase().includes(keyword),
      );
    }
    if (severity !== 'all') list = list.filter((event) => event.severity === severity);
    if (roomFilter !== 'all') list = list.filter((event) => event.roomId === roomFilter);
    if (stageFilter !== 'all') list = list.filter((event) => stageGroup(event.stage) === stageFilter);
    if (approvalFilter !== 'all') list = list.filter((event) => approvalState(event) === approvalFilter);
    if (startDate) list = list.filter((event) => event.startedAt.slice(0, 10) >= startDate);
    if (endDate) list = list.filter((event) => event.startedAt.slice(0, 10) <= endDate);
    if (openOnly) list = list.filter((event) => event.stage !== 'recovered');
    const directionFactor = sortDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const valueA = alertSortValue(a, sortKey, rooms);
      const valueB = alertSortValue(b, sortKey, rooms);
      if (valueA === null && valueB === null) return 0;
      if (valueA === null) return 1;
      if (valueB === null) return -1;
      if (valueA !== valueB) return (valueA - valueB) * directionFactor;
      return Date.parse(b.startedAt) - Date.parse(a.startedAt); // 同值按最新触发在前
    });
    return list;
  }, [events, rooms, query, severity, roomFilter, stageFilter, approvalFilter, startDate, endDate, openOnly, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selected = filtered.find((event) => event.id === selectedId) ?? null;

  // 宽屏侧栏模式：默认选中第一条（参考图首行高亮）；筛选后保持有效选中。
  // 窄屏 Drawer 模式：不自动选中（避免 Drawer 被强制打开/关不掉），仅清理失效选中。
  useEffect(() => {
    const selectionValid = selectedId !== null && filtered.some((event) => event.id === selectedId);
    if (inspectorAsDrawer) {
      if (selectedId !== null && !selectionValid) setSelectedId(null);
      return;
    }
    if (filtered.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectionValid) setSelectedId(filtered[0].id);
  }, [filtered, selectedId, inspectorAsDrawer]);

  const resetPage = () => setPage(1);

  const columns: TableColumn<AnomalyEventSummary>[] = [
    { key: 'severity', header: '等级', width: '76px', sortable: true, render: (row) => <SeverityTag severity={row.severity} /> },
    {
      key: 'title',
      header: '告警内容',
      render: (row) => (
        <span className={styles.alertTitle}>
          <span className={styles.alertTitleMain}>{row.title}</span>
          <span className={styles.alertTitleSub}>{row.roomName}</span>
        </span>
      ),
    },
    { key: 'room', header: '库房', width: '96px', render: (row) => row.roomName },
    {
      key: 'reading',
      header: '当前读数',
      width: '96px',
      align: 'right',
      sortable: true,
      render: (row) => {
        const reading = alertReading(row, rooms[row.roomId]);
        return (
          <span className={`numeric ${reading.outOfRange ? styles.readingOut : ''}`}>{reading.valueText}</span>
        );
      },
    },
    {
      key: 'target',
      header: '目标范围',
      width: '104px',
      render: (row) => {
        const reading = alertReading(row, rooms[row.roomId]);
        return (
          <span className="numeric" title={reading.targetFromBackend ? undefined : '经验参考区间（非后端下发）'}>
            {reading.targetText}
            {reading.targetFromBackend ? '' : ' *'}
          </span>
        );
      },
    },
    {
      key: 'started',
      header: '开始时间',
      width: '108px',
      sortable: true,
      render: (row) => <span className="numeric">{formatDateTimeShort(row.startedAt)}</span>,
    },
    {
      key: 'duration',
      header: '持续时长',
      width: '84px',
      align: 'right',
      sortable: true,
      render: (row) => formatDuration(row.durationMinutes),
    },
    {
      key: 'stage',
      header: '当前阶段',
      width: '88px',
      sortable: true,
      render: (row) => <Tag tone={stageTone(stageGroup(row.stage))}>{STAGE_GROUP_LABEL[stageGroup(row.stage)]}</Tag>,
    },
    {
      key: 'approval',
      header: '审批状态',
      width: '84px',
      render: (row) => {
        const state = approvalState(row);
        return state === 'none' ? <span className={styles.alertTitleSub}>—</span> : <Tag tone={approvalTone(state)}>{APPROVAL_STATE_LABEL[state]}</Tag>;
      },
    },
    {
      key: 'owner',
      header: '责任人',
      width: '72px',
      render: () => (
        <span className={styles.alertTitleSub} title="责任人模块待接入用户权限系统">
          —
        </span>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      width: '150px',
      render: (row) => (
        <div className={styles.rowActions}>
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(row.id)}>
            查看
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/workbench/${row.id}`)}>
            处理
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="进入 Agent 对话与诊断分析"
            onClick={() => navigate(`/workbench/${row.id}?view=agent`)}
          >
            诊断
          </Button>
        </div>
      ),
    },
  ];

  if (loading && events.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonLoader lines={2} />
        <SkeletonLoader lines={2} />
        <SkeletonLoader lines={6} />
      </div>
    );
  }
  if (error && events.length === 0) {
    return <ErrorState title="告警数据加载失败" description={error} onRetry={() => void reload()} />;
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="异常告警"
        description="实时监控异常状态，快速响应并闭环处理，保障冷库安全稳定运行。"
        actions={<DemoDataBadge kind="demo" />}
      />

      {!online && <OfflineState lastUpdated={lastUpdated ? formatTimeHM(lastUpdated) : undefined} />}

      <AlertKpiCards events={events} />

      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search value={query} onChange={(v) => { setQuery(v); resetPage(); }} placeholder="搜索告警内容、库房或设备" />
        </div>
        <Select ariaLabel="告警等级" options={SEVERITY_OPTIONS} value={severity} onChange={(v) => { setSeverity(v); resetPage(); }} />
        <Select ariaLabel="库房" options={roomOptions} value={roomFilter} onChange={(v) => { setRoomFilter(v); resetPage(); }} />
        <Select ariaLabel="阶段" options={STAGE_OPTIONS} value={stageFilter} onChange={(v) => { setStageFilter(v as StageGroup | 'all'); resetPage(); }} />
        <Select ariaLabel="审批状态" options={APPROVAL_OPTIONS} value={approvalFilter} onChange={(v) => { setApprovalFilter(v as ApprovalState | 'all'); resetPage(); }} />
        <span className={styles.dateField}>
          <input
            type="date"
            className={styles.dateInput}
            value={startDate}
            aria-label="开始日期"
            onChange={(e) => { setStartDate(e.target.value); resetPage(); }}
          />
        </span>
        <span className={styles.dateField}>
          <input
            type="date"
            className={styles.dateInput}
            value={endDate}
            aria-label="结束日期"
            onChange={(e) => { setEndDate(e.target.value); resetPage(); }}
          />
        </span>
        <label className={styles.checkField}>
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => { setOpenOnly(e.target.checked); resetPage(); }}
          />
          仅看未处理
        </label>
      </div>

      <div className={styles.layout}>
        <Panel flush>
          <div className={styles.tableWrap}>
            {filtered.length === 0 ? (
              <div style={{ padding: 'var(--space-4)' }}>
                <EmptyState title="没有匹配的告警" description="尝试调整筛选条件。" />
              </div>
            ) : (
              <Table
                columns={columns}
                rows={pageRows}
                rowKey={(row) => row.id}
                onRowClick={(row) => setSelectedId(row.id)}
                isRowSelected={(row) => row.id === selectedId}
                rowLabel={(row) => `告警 ${row.title}`}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                minWidth={1180}
              />
            )}
            <div className={styles.pagerBar}>
              <Pagination
                total={filtered.length}
                page={safePage}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </Panel>

        {inspectorAsDrawer ? (
          <Drawer open={selected !== null} title="告警详情" onClose={() => setSelectedId(null)} width={400}>
            {selected && <AlertDetailContent event={selected} bundle={rooms[selected.roomId]} />}
          </Drawer>
        ) : (
          <AlertDetailPanel
            event={selected}
            bundle={selected ? rooms[selected.roomId] : undefined}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
