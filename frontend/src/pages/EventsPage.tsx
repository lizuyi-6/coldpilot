import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnomalyEventSummary, Severity } from '@/domain/types';
import { useAppData } from '@/state/appData';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Search } from '@/components/ui/Search';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { Tag } from '@/components/ui/Tag';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { OfflineState } from '@/components/ui/OfflineState';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { formatDateTime, formatDuration } from '@/utils/formatTime';
import styles from './EventsPage.module.css';

const PAGE_SIZE = 8;

const SEVERITY_OPTIONS = [
  { value: 'all', label: '全部等级' },
  { value: 'critical', label: '严重' },
  { value: 'warning', label: '警告' },
  { value: 'notice', label: '提示' },
];

const STAGE_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'detected', label: '待诊断' },
  { value: 'awaitingApproval', label: '待审批' },
  { value: 'executing', label: '执行中' },
  { value: 'recovered', label: '已恢复' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: '最新优先' },
  { value: 'severity', label: '严重程度' },
  { value: 'duration', label: '持续时长' },
];

const SEV_RANK: Record<Severity, number> = { emergency: 4, critical: 3, warning: 2, notice: 1 };

export default function EventsPage() {
  const navigate = useNavigate();
  const { events, rooms, loading, online, lastUpdated } = useAppData();
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [pendingOnly, setPendingOnly] = useState<'all' | 'pending'>('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const roomOptions = [{ value: 'all', label: '全部冷库' }, ...Object.values(rooms).map((b) => ({ value: b.room.id, label: b.room.name }))];

  const filtered = useMemo(() => {
    let list = [...events];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q) || e.roomName.toLowerCase().includes(q));
    }
    if (severity !== 'all') list = list.filter((e) => e.severity === severity);
    if (roomFilter !== 'all') list = list.filter((e) => e.roomId === roomFilter);
    if (stageFilter !== 'all') list = list.filter((e) => e.stage === stageFilter);
    if (pendingOnly === 'pending') list = list.filter((e) => e.awaitingApproval);
    list.sort((a, b) => {
      if (sort === 'severity') return SEV_RANK[b.severity] - SEV_RANK[a.severity];
      if (sort === 'duration') return b.durationMinutes - a.durationMinutes;
      return Date.parse(b.startedAt) - Date.parse(a.startedAt);
    });
    return list;
  }, [events, query, severity, roomFilter, stageFilter, pendingOnly, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = filtered.find((e) => e.id === selectedId) ?? null;

  const resetPage = () => setPage(1);

  const columns: TableColumn<AnomalyEventSummary>[] = [
    { key: 'severity', header: '等级', width: '70px', render: (row) => <SeverityTag severity={row.severity} /> },
    { key: 'title', header: '异常', render: (row) => row.title },
    { key: 'room', header: '冷库', width: '110px', render: (row) => row.roomName },
    { key: 'type', header: '类型', width: '80px', render: (row) => (row.type === 'temperature' ? '温度' : '湿度') },
    {
      key: 'stage',
      header: '状态',
      width: '120px',
      render: (row) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <StatusBadge status={row.stage} size="sm" />
          {row.awaitingApproval && <Tag tone="warning">待审批</Tag>}
        </span>
      ),
    },
    { key: 'duration', header: '持续', width: '76px', align: 'right', render: (row) => formatDuration(row.durationMinutes) },
    { key: 'started', header: '首次发现', width: '130px', render: (row) => formatDateTime(row.startedAt) },
    {
      key: 'actions',
      header: '操作',
      width: '180px',
      render: (row) => (
        <div className={styles.rowActions}>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/workbench/${row.id}`)}>
            进入诊断
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={row.stage !== 'recovered'}
            title={row.stage !== 'recovered' ? '报告将在恢复后生成' : undefined}
            onClick={() => navigate('/reports')}
          >
            查看报告
          </Button>
        </div>
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
      <PageHeader
        title="异常事件"
        description="异常事件的检索、筛选与处理入口"
        actions={<DemoDataBadge kind="demo" />}
      />

      {!online && <OfflineState lastUpdated={lastUpdated ? formatDateTime(lastUpdated) : undefined} />}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search value={query} onChange={setQuery} placeholder="搜索异常或冷库" />
        </div>
        <Select ariaLabel="等级" options={SEVERITY_OPTIONS} value={severity} onChange={(v) => { setSeverity(v); resetPage(); }} />
        <Select ariaLabel="冷库" options={roomOptions} value={roomFilter} onChange={(v) => { setRoomFilter(v); resetPage(); }} />
        <Select ariaLabel="状态" options={STAGE_OPTIONS} value={stageFilter} onChange={(v) => { setStageFilter(v); resetPage(); }} />
        <Segmented
          options={[{ value: 'all', label: '全部' }, { value: 'pending', label: '待审批' }]}
          value={pendingOnly}
          onChange={(v) => { setPendingOnly(v as 'all' | 'pending'); resetPage(); }}
          ariaLabel="待审批筛选"
        />
        <span className={styles.toolbarSpacer} />
        <Select ariaLabel="排序" options={SORT_OPTIONS} value={sort} onChange={setSort} />
      </div>

      <div className={styles.layout}>
        <Panel flush>
          {filtered.length === 0 ? (
            <EmptyState title="没有匹配的异常事件" description="尝试调整筛选条件。" />
          ) : (
            <>
              <Table
                columns={columns}
                rows={pageRows}
                rowKey={(row) => row.id}
                onRowClick={(row) => setSelectedId(row.id)}
                isRowSelected={(row) => row.id === selectedId}
                rowLabel={(row) => `异常 ${row.title}`}
              />
              <div className={styles.pager} style={{ padding: '0 16px' }}>
                <span className={styles.pagerInfo}>
                  共 {filtered.length} 条 · 第 {safePage} / {totalPages} 页
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    上一页
                  </Button>
                  <Button variant="secondary" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </Panel>

        <Panel title="事件详情">
          {selected ? (
            <div className={styles.detailPanel}>
              <div className={styles.detailTitle}>
                <SeverityTag severity={selected.severity} />
                {selected.title}
              </div>
              <div className={styles.detailMeta}>
                <span>{selected.roomName}</span>
                <span>{selected.type === 'temperature' ? '温度' : '湿度'}异常</span>
                <span>持续 {formatDuration(selected.durationMinutes)}</span>
              </div>
              <div className={styles.detailMeta}>
                <span>发现 {formatDateTime(selected.startedAt)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusBadge status={selected.stage} />
                {selected.awaitingApproval && <Tag tone="warning">待 L2 人工审批</Tag>}
              </div>
              <div className={styles.detailActions}>
                <Button variant="primary" size="md" onClick={() => navigate(`/workbench/${selected.id}`)}>
                  进入诊断工作台
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={selected.stage !== 'recovered'}
                  title={selected.stage !== 'recovered' ? '报告将在恢复后生成' : undefined}
                  onClick={() => navigate('/reports')}
                >
                  查看报告
                </Button>
              </div>
              <p className={styles.detailMeta}>分配负责人：待接入用户权限模块后提供（当前仅浏览）。</p>
            </div>
          ) : (
            <EmptyState title="选择一条事件" description="点击列表中的事件查看详情与处理入口。" />
          )}
        </Panel>
      </div>
    </div>
  );
}