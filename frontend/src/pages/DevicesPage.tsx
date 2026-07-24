import { useMemo, useState } from 'react';
import type { Device, DeviceKind } from '@/domain/types';
import { useAppData } from '@/state/appData';
import { deviceStatusLabel, deviceStatusTone } from '@/domain/viewModels';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Search } from '@/components/ui/Search';
import { Select } from '@/components/ui/Select';
import { StatusDot } from '@/components/ui/StatusDot';
import { Tag } from '@/components/ui/Tag';
import { Drawer } from '@/components/ui/Drawer';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { OfflineState } from '@/components/ui/OfflineState';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { Zap, Fan, SlidersHorizontal, DoorClosed, Gauge } from 'lucide-react';
import styles from './DevicesPage.module.css';

const KIND_META: Record<DeviceKind, { label: string; Icon: typeof Zap }> = {
  compressor: { label: '压缩机', Icon: Zap },
  fan: { label: '风机', Icon: Fan },
  valve: { label: '阀门', Icon: SlidersHorizontal },
  door: { label: '库门', Icon: DoorClosed },
  meter: { label: '电表', Icon: Gauge },
};

const KIND_OPTIONS = [{ value: 'all', label: '全部类型' }, ...Object.entries(KIND_META).map(([value, m]) => ({ value, label: m.label }))];
const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'running', label: '运行中' },
  { value: 'idle', label: '待机' },
  { value: 'fault', label: '故障' },
  { value: 'offline', label: '离线' },
];

/** 维护建议（只读，基于设备类型与状态）。 */
function maintenanceAdvice(device: Device): string[] {
  const advice: string[] = [];
  if (device.status === 'fault') advice.push('设备故障，需人工检修后方可恢复自动运行。');
  if (device.status === 'offline') advice.push('设备离线，请检查供电与通讯链路。');
  if (device.kind === 'compressor') {
    const eff = device.metrics?.efficiencyPct;
    if (eff !== undefined && eff < 80) advice.push(`压缩机效率 ${eff}% 偏低，建议检查制冷剂充注量与冷凝器清洁度。`);
    const dt = device.metrics?.dischargeTempC;
    if (dt !== undefined && dt > 90) advice.push(`排气温度 ${dt}℃ 偏高，建议检查油位与冷却。`);
    advice.push('建议按计划巡检压缩机油位、皮带与振动。');
  }
  if (device.kind === 'fan') advice.push('建议定期清理风机叶片积霜，检查轴承润滑。');
  if (device.kind === 'door') advice.push('建议检查库门密封条完整性，减少冷气泄漏。');
  if (device.kind === 'valve') advice.push('建议校验膨胀阀开度与感温包。');
  if (device.kind === 'meter') advice.push('电表用于能耗计量，建议定期校验精度。');
  if (advice.length === 0) advice.push('设备运行正常，按计划例行巡检。');
  return advice;
}

export default function DevicesPage() {
  const { rooms, loading, roomId, setRoomId, online, lastUpdated } = useAppData();
  const bundle = rooms[roomId];
  const room = bundle?.room;
  const devices = bundle?.devices ?? [];
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<Device | null>(null);

  const roomOptions = Object.values(rooms).map((b) => ({ value: b.room.id, label: b.room.name }));

  const filtered = useMemo(
    () =>
      devices.filter((d) => {
        if (query && !d.name.toLowerCase().includes(query.toLowerCase())) return false;
        if (kind !== 'all' && d.kind !== kind) return false;
        if (status !== 'all' && d.status !== status) return false;
        return true;
      }),
    [devices, query, kind, status],
  );

  const faultCount = devices.filter((d) => d.status === 'fault' || d.status === 'offline').length;

  const columns: TableColumn<Device>[] = [
    {
      key: 'name',
      header: '设备',
      render: (row) => {
        const meta = KIND_META[row.kind];
        const Icon = meta.Icon;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon size={15} style={{ color: 'var(--color-text-muted)' }} />
            {row.name}
          </span>
        );
      },
    },
    { key: 'kind', header: '类型', width: '90px', render: (row) => KIND_META[row.kind].label },
    {
      key: 'status',
      header: '状态',
      width: '100px',
      render: (row) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <StatusDot tone={deviceStatusTone(row.status)} />
          {deviceStatusLabel(row.status)}
        </span>
      ),
    },
    {
      key: 'metric',
      header: '关键指标',
      render: (row) => {
        const entries = Object.entries(row.metrics ?? {});
        if (entries.length === 0) return <span className={styles.note}>—</span>;
        const [k, v] = entries[0];
        return (
          <span>
            {k} <strong>{v}</strong>
          </span>
        );
      },
    },
    {
      key: 'advice',
      header: '维护建议',
      render: (row) => {
        const first = maintenanceAdvice(row)[0];
        return <span className={styles.note}>{first}</span>;
      },
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

  return (
    <div className={styles.page}>
      <PageHeader
        title="设备管理"
        description={`${room.name} · 制冷 / 通风 / 阀件 / 库门 / 计量设备`}
        actions={<DemoDataBadge kind="demo" />}
      />

      {!online && <OfflineState lastUpdated={lastUpdated ?? undefined} />}

      <div className={styles.toolbar}>
        <div style={{ width: 200 }}>
          <Search value={query} onChange={setQuery} placeholder="搜索设备" />
        </div>
        <Select ariaLabel="冷库" options={roomOptions} value={roomId} onChange={setRoomId} />
        <Select ariaLabel="类型" options={KIND_OPTIONS} value={kind} onChange={setKind} />
        <Select ariaLabel="状态" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        <span className={styles.toolbarSpacer} />
        {faultCount > 0 && <Tag tone="danger">{faultCount} 台需关注</Tag>}
        <Tag tone="neutral">{devices.length} 台设备</Tag>
      </div>

      <Panel flush>
        {filtered.length === 0 ? (
          <EmptyState title="没有匹配的设备" description="尝试调整筛选条件。" />
        ) : (
          <Table
            columns={columns}
            rows={filtered}
            rowKey={(d) => d.id}
            onRowClick={setSelected}
            rowLabel={(d) => `设备 ${d.name}`}
          />
        )}
      </Panel>

      <Drawer open={selected !== null} title={selected?.name ?? '设备详情'} onClose={() => setSelected(null)} width={400}>
        {selected && (
          <div className={styles.detailStack}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusDot tone={deviceStatusTone(selected.status)} label={deviceStatusLabel(selected.status)} />
              <Tag tone="neutral">{KIND_META[selected.kind].label}</Tag>
            </div>
            {(selected.status === 'fault' || selected.status === 'offline') && (
              <InlineAlert tone="danger" title="需人工介入">
                该设备当前不可用，自动调节已避开此设备。请安排检修。
              </InlineAlert>
            )}
            <div>
              <div className={styles.note} style={{ marginBottom: 8 }}>基础信息</div>
              <DescriptionList
                items={[
                  { label: '设备编号', value: selected.id },
                  { label: '所属冷库', value: room.name },
                  { label: '类型', value: KIND_META[selected.kind].label },
                  { label: '状态', value: deviceStatusLabel(selected.status) },
                ]}
              />
            </div>
            {Object.keys(selected.metrics ?? {}).length > 0 && (
              <div>
                <div className={styles.note} style={{ marginBottom: 8 }}>运行指标</div>
                {Object.entries(selected.metrics ?? {}).map(([k, v]) => (
                  <div key={k} className={styles.metricRow}>
                    <span className={styles.metricLabel}>{k}</span>
                    <span className={styles.metricValue}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <div className={styles.note} style={{ marginBottom: 8 }}>维护建议（只读）</div>
              <ul className={styles.adviceList}>
                {maintenanceAdvice(selected).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}