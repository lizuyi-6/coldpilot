import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Cpu, Wrench } from 'lucide-react';
import type { Device } from '@/domain/types';
import { useAppData } from '@/state/appData';
import { deviceStatusLabel, deviceStatusTone } from '@/domain/viewModels';
import { DEVICE_KIND_ICON, DEVICE_KIND_LABEL } from '@/components/domain/deviceMeta';
import { useMediaQuery } from '@/utils/useMediaQuery';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Search } from '@/components/ui/Search';
import { Select } from '@/components/ui/Select';
import { StatusDot } from '@/components/ui/StatusDot';
import { Tag } from '@/components/ui/Tag';
import { Drawer } from '@/components/ui/Drawer';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { OfflineState } from '@/components/ui/OfflineState';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { DeviceDetailPanel } from '@/features/devices/DeviceDetailPanel';
import { deviceHealth, deviceKpi, deviceMetricEntries, HEALTH_META, maintenanceAdvice } from '@/features/devices/devicesView';
import styles from '@/features/devices/devices.module.css';

const KIND_OPTIONS = [
  { value: 'all', label: '全部类型' },
  ...Object.entries(DEVICE_KIND_LABEL).map(([value, label]) => ({ value, label })),
];
const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'running', label: '运行中' },
  { value: 'idle', label: '待机' },
  { value: 'fault', label: '故障' },
  { value: 'offline', label: '离线' },
];

const PAGE_SIZE = 10;

/** 设备管理页：汇总 KPI + 筛选 + 设备表 + 右侧详情（≤1280px 详情转 Drawer）。 */
export default function DevicesPage() {
  const { rooms, loading, roomId, online, lastUpdated, events } = useAppData();
  const bundle = rooms[roomId];
  const room = bundle?.room;
  const devices = useMemo(() => bundle?.devices ?? [], [bundle]);
  const isCompact = useMediaQuery('(max-width: 1280px)');

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [alarmOnly, setAlarmOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Device | null>(null);

  const kpi = useMemo(() => deviceKpi(devices), [devices]);
  const roomEvents = useMemo(() => events.filter((event) => event.roomId === roomId), [events, roomId]);

  const filtered = useMemo(
    () =>
      devices.filter((device) => {
        if (query && !device.name.toLowerCase().includes(query.toLowerCase()) && !device.id.toLowerCase().includes(query.toLowerCase())) return false;
        if (kind !== 'all' && device.kind !== kind) return false;
        if (status !== 'all' && device.status !== status) return false;
        if (alarmOnly && device.status !== 'fault' && device.status !== 'offline') return false;
        return true;
      }),
    [devices, query, kind, status, alarmOnly],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // 默认选中首台设备（宽屏右栏展示）；筛选变化时同步选中项。
  const effectiveSelected = selected && filtered.some((device) => device.id === selected.id) ? selected : filtered[0] ?? null;

  const columns: TableColumn<Device>[] = [
    {
      key: 'name',
      header: '设备名称',
      render: (row) => {
        const KindIcon = DEVICE_KIND_ICON[row.kind];
        return (
          <span className={styles.deviceNameCell}>
            <KindIcon size={16} aria-hidden style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
            <span className={styles.deviceNameText}>
              <b>{row.name}</b>
              <small>{row.id}</small>
            </span>
          </span>
        );
      },
    },
    { key: 'kind', header: '类型', width: '100px', render: (row) => DEVICE_KIND_LABEL[row.kind] },
    {
      key: 'status',
      header: '当前状态',
      width: '100px',
      render: (row) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <StatusDot tone={deviceStatusTone(row.status)} />
          {deviceStatusLabel(row.status)}
        </span>
      ),
    },
    {
      key: 'metrics',
      header: '关键指标',
      render: (row) => {
        const entries = deviceMetricEntries(row).slice(0, 2);
        if (entries.length === 0) return <span className={styles.note}>—</span>;
        return (
          <span className={styles.metricCell}>
            {entries.map((metric) => (
              <span key={metric.key} className={styles.metricCellRow}>
                {metric.label} <b>{metric.value.toLocaleString('zh-CN')}{metric.unit}</b>
              </span>
            ))}
          </span>
        );
      },
    },
    {
      key: 'health',
      header: '健康状态',
      width: '90px',
      render: (row) => {
        const health = deviceHealth(row);
        return <Tag tone={HEALTH_META[health].tone}>{HEALTH_META[health].label}</Tag>;
      },
    },
    {
      key: 'advice',
      header: '维护建议',
      render: (row) => <span className={styles.note}>{maintenanceAdvice(row)[0]}</span>,
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
    return <EmptyState title="暂无设备数据" description="当前冷库没有设备信息。" />;
  }

  const detailPanel = effectiveSelected ? (
    <DeviceDetailPanel
      device={effectiveSelected}
      roomName={room.name}
      roomEvents={roomEvents}
      onClose={() => setSelected(null)}
    />
  ) : null;

  return (
    <div className={styles.page}>
      <PageHeader
        title="设备管理"
        description={`${room.name} · 设备运行监控、状态管理与维护建议`}
        actions={<DemoDataBadge kind="demo" />}
      />

      {!online && <OfflineState lastUpdated={lastUpdated ?? undefined} />}

      {/* 汇总 */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiIcon}><Cpu size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>设备总数</span>
            <span className={styles.kpiValue}>{kpi.total}<small>台</small></span>
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiIcon}><Activity size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>在线设备</span>
            <span className={styles.kpiValue}>{kpi.online}<small>台</small></span>
            <span className={styles.kpiSub}>{kpi.onlinePct}%</span>
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={`${styles.kpiIcon} ${kpi.alarm > 0 ? styles.kpiIconWarn : ''}`}><AlertTriangle size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>告警设备</span>
            <span className={styles.kpiValue}>{kpi.alarm}<small>台</small></span>
            <span className={styles.kpiSub}>{kpi.alarmPct}%</span>
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiIcon}><Wrench size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>维护建议</span>
            <span className={styles.kpiValue}>{kpi.adviceCount}<small>项</small></span>
            <span className={styles.kpiSub}>基于运行指标</span>
          </span>
        </div>
      </div>

      <div className={styles.layout}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0 }}>
          {/* 筛选 */}
          <div className={styles.toolbar}>
            <div style={{ width: 220 }}>
              <Search value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="搜索设备名称或编号" />
            </div>
            <Select ariaLabel="类型" options={KIND_OPTIONS} value={kind} onChange={(value) => { setKind(value); setPage(1); }} />
            <Select ariaLabel="状态" options={STATUS_OPTIONS} value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
            <label className={styles.alarmOnly}>
              <input type="checkbox" checked={alarmOnly} onChange={(event) => { setAlarmOnly(event.target.checked); setPage(1); }} />
              只看告警
            </label>
            <span className={styles.toolbarSpacer} />
            <Tag tone="neutral">共 {filtered.length} 台</Tag>
          </div>

          {/* 设备表 */}
          <Panel flush>
            {pageRows.length === 0 ? (
              <EmptyState title="没有匹配的设备" description="尝试调整筛选条件。" />
            ) : (
              <>
                <Table
                  columns={columns}
                  rows={pageRows}
                  rowKey={(device) => device.id}
                  onRowClick={(device) => setSelected(device)}
                  rowLabel={(device) => `设备 ${device.name}`}
                  minWidth={860}
                />
                <div className={styles.pagerRow}>
                  <Pagination total={filtered.length} page={safePage} pageSize={PAGE_SIZE} onPageChange={setPage} />
                </div>
              </>
            )}
          </Panel>
        </div>

        {/* 右侧详情（宽屏） */}
        {!isCompact && (
          <Panel title="设备详情" className={styles.sidePanel}>
            {detailPanel ?? <EmptyState title="未选择设备" description="点击左侧设备行查看详情。" />}
          </Panel>
        )}
      </div>

      {/* 窄屏详情 Drawer */}
      <Drawer open={isCompact && selected !== null} title={selected?.name ?? '设备详情'} width={420} onClose={() => setSelected(null)}>
        {selected && (
          <DeviceDetailPanel device={selected} roomName={room.name} roomEvents={roomEvents} onClose={() => setSelected(null)} />
        )}
      </Drawer>
    </div>
  );
}
