import { useMemo, useState } from 'react';
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
import { Drawer } from '@/components/ui/Drawer';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { OfflineState } from '@/components/ui/OfflineState';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { formatDateTime } from '@/utils/formatTime';
import { formatInt, formatNumber } from '@/utils/formatNumber';
import styles from './InventoryPage.module.css';

const PAGE_SIZE = 8;

const RISK_OPTIONS = [
  { value: 'all', label: '全部风险' },
  { value: 'none', label: '正常' },
  { value: 'watch', label: '关注' },
  { value: 'high', label: '高风险' },
];

const SORT_OPTIONS = [
  { value: 'remaining', label: '剩余窗口升序' },
  { value: 'quantity', label: '数量降序' },
  { value: 'inbound', label: '入库时间' },
];

export default function InventoryPage() {
  const { rooms, loading, roomId, setRoomId, online, lastUpdated } = useAppData();
  const bundle = rooms[roomId];
  const room = bundle?.room;
  const inventory = bundle?.inventory ?? [];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [risk, setRisk] = useState('all');
  const [sort, setSort] = useState('remaining');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InventoryBatch | null>(null);

  const roomOptions = Object.values(rooms).map((b) => ({ value: b.room.id, label: b.room.name }));
  const categories = useMemo(() => Array.from(new Set(inventory.map((b) => b.category))), [inventory]);
  const categoryOptions = [{ value: 'all', label: '全部品类' }, ...categories.map((c) => ({ value: c, label: c }))];

  const nowMs = useMemo(() => Date.now(), []);

  const filtered = useMemo(() => {
    let list = [...inventory];
    if (query) list = list.filter((b) => b.category.toLowerCase().includes(query.toLowerCase()) || b.source.toLowerCase().includes(query.toLowerCase()));
    if (category !== 'all') list = list.filter((b) => b.category === category);
    if (risk !== 'all') list = list.filter((b) => b.risk === risk);
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
  const totalKg = inventory.reduce((a, b) => a + b.quantityKg, 0);
  const riskCount = inventory.filter((b) => b.risk !== 'none').length;
  const resetPage = () => setPage(1);

  const columns: TableColumn<InventoryBatch>[] = [
    { key: 'category', header: '品类', render: (row) => row.category },
    { key: 'maturity', header: '成熟度', width: '90px', render: (row) => row.maturity },
    { key: 'quantity', header: '数量', width: '90px', align: 'right', render: (row) => `${formatInt(row.quantityKg)} kg` },
    { key: 'inbound', header: '入库时间', width: '130px', render: (row) => formatDateTime(row.inboundAt) },
    {
      key: 'remaining',
      header: '剩余窗口',
      width: '110px',
      align: 'right',
      render: (row) => {
        const rem = remainingHours(row, nowMs);
        const cls = row.risk === 'high' ? styles.riskHigh : row.risk === 'watch' ? styles.riskWatch : undefined;
        return <span className={cls}>{formatNumber(rem, 0)} h</span>;
      },
    },
    {
      key: 'risk',
      header: '风险',
      width: '90px',
      render: (row) => <Tag tone={row.risk === 'high' ? 'danger' : row.risk === 'watch' ? 'warning' : 'success'}>{riskLabel(row.risk)}</Tag>,
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

  const selRemaining = selected ? remainingHours(selected, nowMs) : 0;
  const selPct = selected ? Math.min(100, (selRemaining / selected.maxStorageHours) * 100) : 0;

  return (
    <div className={styles.page}>
      <PageHeader
        title="库存管理"
        description={`${room.name} · 批次 / 成熟度 / 来源 / 剩余安全存储窗口`}
        actions={<DemoDataBadge kind="demo" />}
      />

      {!online && <OfflineState lastUpdated={lastUpdated ?? undefined} />}

      <div className={styles.toolbar}>
        <div style={{ width: 200 }}>
          <Search value={query} onChange={setQuery} placeholder="搜索品类或来源" />
        </div>
        <Select ariaLabel="冷库" options={roomOptions} value={roomId} onChange={setRoomId} />
        <Select ariaLabel="品类" options={categoryOptions} value={category} onChange={(v) => { setCategory(v); resetPage(); }} />
        <Select ariaLabel="风险" options={RISK_OPTIONS} value={risk} onChange={(v) => { setRisk(v); resetPage(); }} />
        <span className={styles.toolbarSpacer} />
        <Select ariaLabel="排序" options={SORT_OPTIONS} value={sort} onChange={setSort} />
        {riskCount > 0 && <Tag tone="warning">{riskCount} 批需关注</Tag>}
        <Tag tone="neutral">{formatNumber(totalKg / 1000, 1)} 吨</Tag>
      </div>

      <Panel flush>
        {filtered.length === 0 ? (
          <EmptyState title="没有匹配的批次" description="尝试调整筛选条件。" />
        ) : (
          <>
            <Table
              columns={columns}
              rows={pageRows}
              rowKey={(b) => b.id}
              onRowClick={setSelected}
              rowLabel={(b) => `批次 ${b.category}`}
            />
            <div className={styles.pager}>
              <span className={styles.pagerInfo}>共 {filtered.length} 批 · 第 {safePage} / {totalPages} 页</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
                <Button variant="secondary" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</Button>
              </div>
            </div>
          </>
        )}
      </Panel>

      <Drawer open={selected !== null} title={selected ? `${selected.category} · 批次详情` : '批次详情'} onClose={() => setSelected(null)} width={400}>
        {selected && (
          <div className={styles.detailStack}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag tone={selected.risk === 'high' ? 'danger' : selected.risk === 'watch' ? 'warning' : 'success'}>{riskLabel(selected.risk)}</Tag>
              <span className={styles.note}>{selected.maturity}</span>
            </div>
            <DescriptionList
              items={[
                { label: '批次编号', value: selected.id },
                { label: '品类', value: selected.category },
                { label: '数量', value: `${formatInt(selected.quantityKg)} kg` },
                { label: '成熟度', value: selected.maturity },
                { label: '来源', value: selected.source },
                { label: '入库时间', value: formatDateTime(selected.inboundAt) },
                {
                  label: '推荐温区',
                  value: `${selected.recommendedRange.min} ~ ${selected.recommendedRange.max} ${selected.recommendedRange.unit}`,
                },
              ]}
            />
            <div>
              <div className={styles.note} style={{ marginBottom: 8 }}>剩余安全存储窗口</div>
              <div className={styles.windowBar}>
                <div className={styles.windowFill} style={{ width: `${selPct}%`, background: selected.risk === 'high' ? 'var(--color-danger)' : selected.risk === 'watch' ? 'var(--color-warning)' : 'var(--color-accent)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span className={styles.note}>剩 {formatNumber(selRemaining, 0)} 小时</span>
                <span className={styles.note}>共 {formatInt(selected.maxStorageHours)} 小时</span>
              </div>
              <p className={styles.note} style={{ marginTop: 8 }}>
                剩余窗口基于入库时间与最长可存储时长估算（演示）。请在窗口内优先出库或加工。
              </p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}