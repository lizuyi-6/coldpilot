import { useMemo, useState } from 'react';
import { Boxes, Clock3, Download, PackageOpen, ShieldAlert } from 'lucide-react';
import type { InventoryBatch } from '@/domain/types';
import { useAppData } from '@/state/appData';
import { remainingHours, riskLabel } from '@/domain/viewModels';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Search } from '@/components/ui/Search';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { OfflineState } from '@/components/ui/OfflineState';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { BatchDetailPanel } from '@/features/inventory/BatchDetailPanel';
import { inventoryKpi, remainingDays } from '@/features/inventory/inventoryView';
import { formatDateTime } from '@/utils/formatTime';
import { formatInt, formatNumber } from '@/utils/formatNumber';
import styles from '@/features/inventory/inventory.module.css';

const PAGE_SIZE = 8;

const RISK_OPTIONS = [
  { value: 'all', label: '全部等级' },
  { value: 'none', label: '正常' },
  { value: 'watch', label: '关注' },
  { value: 'high', label: '高风险' },
];

const SORT_OPTIONS = [
  { value: 'remaining', label: '剩余窗口升序' },
  { value: 'quantity', label: '数量降序' },
  { value: 'inbound', label: '入库时间' },
];

/** 导出当前筛选结果为 CSV（前端导出已加载数据，后端无导出接口）。 */
function downloadBatchesCsv(roomName: string, batches: InventoryBatch[], nowMs: number): void {
  const header = 'batch_id,category,quantity_kg,inbound_at_utc,maturity,recommended_min,recommended_max,max_storage_hours,remaining_days,risk\n';
  const body = batches
    .map((batch) =>
      [
        batch.id,
        batch.category,
        batch.quantityKg,
        batch.inboundAt,
        batch.maturity,
        batch.recommendedRange.min,
        batch.recommendedRange.max,
        batch.maxStorageHours,
        remainingDays(batch, nowMs),
        batch.risk,
      ].join(','),
    )
    .join('\n');
  const blob = new Blob([`\uFEFF${header}${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${roomName}-库存批次-${new Date(nowMs).toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** 库存管理页：汇总指标 + 筛选 + 批次表 + 底部批次详情区。 */
export default function InventoryPage() {
  const { rooms, loading, roomId, online, lastUpdated, events } = useAppData();
  const bundle = rooms[roomId];
  const room = bundle?.room;
  const inventory = useMemo(() => bundle?.inventory ?? [], [bundle]);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [risk, setRisk] = useState('all');
  const [sort, setSort] = useState('remaining');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InventoryBatch | null>(null);

  const nowMs = useMemo(() => Date.now(), []);
  const kpi = useMemo(() => inventoryKpi(inventory, nowMs), [inventory, nowMs]);
  const roomEvents = useMemo(() => events.filter((event) => event.roomId === roomId), [events, roomId]);

  const categories = useMemo(() => Array.from(new Set(inventory.map((batch) => batch.category))), [inventory]);
  const categoryOptions = [{ value: 'all', label: '全部品类' }, ...categories.map((value) => ({ value, label: value }))];

  const latestOf = (metric: string): number | undefined => {
    const series = bundle?.telemetry.find((item) => item.metric === metric);
    return series && series.points.length > 0 ? series.points[series.points.length - 1].value : undefined;
  };
  const current = { temperature: latestOf('temperature'), humidity: latestOf('humidity'), co2: latestOf('co2') };

  const filtered = useMemo(() => {
    let list = [...inventory];
    if (query) {
      const lowered = query.toLowerCase();
      list = list.filter(
        (batch) =>
          batch.category.toLowerCase().includes(lowered) ||
          batch.source.toLowerCase().includes(lowered) ||
          batch.id.toLowerCase().includes(lowered),
      );
    }
    if (category !== 'all') list = list.filter((batch) => batch.category === category);
    if (risk !== 'all') list = list.filter((batch) => batch.risk === risk);
    list.sort((a, b) => {
      if (sort === 'quantity') return b.quantityKg - a.quantityKg;
      if (sort === 'inbound') return Date.parse(a.inboundAt) - Date.parse(b.inboundAt);
      return remainingHours(a, nowMs) - remainingHours(b, nowMs);
    });
    return list;
  }, [inventory, query, category, risk, sort, nowMs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const effectiveSelected = selected && inventory.some((batch) => batch.id === selected.id) ? selected : null;

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setRisk('all');
    setPage(1);
  };

  const columns: TableColumn<InventoryBatch>[] = [
    {
      key: 'id',
      header: '批次',
      render: (row) => (
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <b style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{row.id}</b>
          <small className={styles.note}>{row.source}</small>
        </span>
      ),
    },
    { key: 'category', header: '品类', width: '90px', render: (row) => row.category },
    { key: 'quantity', header: '数量', width: '96px', align: 'right', render: (row) => `${formatInt(row.quantityKg)} kg` },
    { key: 'inbound', header: '入库时间', width: '132px', render: (row) => formatDateTime(row.inboundAt) },
    { key: 'maturity', header: '成熟度', width: '90px', render: (row) => row.maturity },
    {
      key: 'range',
      header: '推荐温区',
      width: '110px',
      render: (row) => `${row.recommendedRange.min} ~ ${row.recommendedRange.max} ${row.recommendedRange.unit}`,
    },
    {
      key: 'maxStorage',
      header: '最长存储',
      width: '90px',
      align: 'right',
      render: (row) => `${Math.round(row.maxStorageHours / 24)} 天`,
    },
    {
      key: 'remaining',
      header: '剩余窗口',
      width: '96px',
      align: 'right',
      render: (row) => {
        const days = remainingDays(row, nowMs);
        const cls = row.risk === 'high' ? styles.remainingHigh : row.risk === 'watch' ? styles.remainingWatch : styles.remainingOk;
        return <span className={`${styles.remainingCell} ${cls}`}>{formatNumber(days, 1)} 天</span>;
      },
    },
    {
      key: 'risk',
      header: '当前风险',
      width: '90px',
      render: (row) => <Tag tone={row.risk === 'high' ? 'danger' : row.risk === 'watch' ? 'warning' : 'accent'}>{riskLabel(row.risk)}</Tag>,
    },
  ];

  if (loading && !bundle) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonLoader lines={2} />
        <SkeletonLoader lines={5} />
      </div>
    );
  }
  if (!room || !bundle) {
    return <EmptyState title="暂无库存数据" description="当前冷库没有库存信息。" />;
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="库存管理"
        description={`${room.name} · 库存批次与存储风险管理`}
        actions={<DemoDataBadge kind="demo" />}
      />

      {!online && <OfflineState lastUpdated={lastUpdated ?? undefined} />}

      {/* 汇总指标 */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiIcon}><Boxes size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>库存总量</span>
            <span className={styles.kpiValue}>{formatNumber(kpi.totalKg / 1000, 1)}<small>吨</small></span>
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiIcon}><PackageOpen size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>批次数量</span>
            <span className={styles.kpiValue}>{kpi.batches}<small>批</small></span>
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={`${styles.kpiIcon} ${kpi.riskBatches > 0 ? styles.kpiIconWarn : ''}`}><ShieldAlert size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>风险批次</span>
            <span className={styles.kpiValue}>{kpi.riskBatches}<small>批</small></span>
            <span className={styles.kpiSub}>占比 {kpi.riskPct}%</span>
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiIcon}><Clock3 size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>平均剩余安全窗口</span>
            <span className={styles.kpiValue}>{kpi.avgRemainingDays !== null ? formatNumber(kpi.avgRemainingDays, 1) : '—'}<small>天</small></span>
            <span className={styles.kpiSub}>按入库时间估算</span>
          </span>
        </div>
      </div>

      {/* 筛选 */}
      <div className={styles.toolbar}>
        <Select ariaLabel="品类" options={categoryOptions} value={category} onChange={(value) => { setCategory(value); setPage(1); }} />
        <Select ariaLabel="风险等级" options={RISK_OPTIONS} value={risk} onChange={(value) => { setRisk(value); setPage(1); }} />
        <div style={{ width: 220 }}>
          <Search value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="搜索批次 / 品类 / 来源" />
        </div>
        <Button variant="secondary" size="sm" onClick={resetFilters}>重置</Button>
        <Select ariaLabel="排序" options={SORT_OPTIONS} value={sort} onChange={setSort} />
        <span className={styles.toolbarSpacer} />
        <Button variant="secondary" size="sm" onClick={() => downloadBatchesCsv(room.name, filtered, nowMs)}>
          <Download size={13} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
          导出
        </Button>
      </div>

      {/* 批次表 */}
      <Panel flush>
        {pageRows.length === 0 ? (
          <EmptyState title="没有匹配的批次" description="尝试调整筛选条件。" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={pageRows}
              rowKey={(batch) => batch.id}
              onRowClick={(batch) => setSelected(batch)}
              rowLabel={(batch) => `批次 ${batch.id}`}
              minWidth={1020}
            />
            <div className={styles.pagerRow}>
              <Pagination total={filtered.length} page={safePage} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          </>
        )}
      </Panel>

      {/* 批次详情（底部区） */}
      {effectiveSelected && (
        <Panel title="批次详情">
          <BatchDetailPanel
            batch={effectiveSelected}
            roomName={room.name}
            current={current}
            roomEvents={roomEvents}
            nowMs={nowMs}
            onClose={() => setSelected(null)}
          />
        </Panel>
      )}
    </div>
  );
}
