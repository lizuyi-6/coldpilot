import { useMemo, useState } from 'react';
import { useAppData } from '@/state/appData';
import { dailyCurve, deviceBreakdown, periodBreakdown, todayKwh } from '@/domain/energy';
import { metricSeries } from '@/domain/viewModels';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EnergyBarChart } from '@/components/domain/EnergyBarChart';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { formatInt, formatNumber } from '@/utils/formatNumber';
import styles from './EnergyPage.module.css';

const RANGE_OPTIONS = [
  { value: 'today', label: '今日' },
  { value: 'yesterday', label: '昨日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];

/** 时段倍率（演示：周/月按今日电量线性放大）。 */
const RANGE_FACTOR: Record<string, number> = { today: 1, yesterday: 1.06, week: 6.8, month: 29.2 };

export default function EnergyPage() {
  const { rooms, loading, roomId, setRoomId } = useAppData();
  const bundle = rooms[roomId];
  const room = bundle?.room;
  const [range, setRange] = useState('today');

  const devices = bundle?.devices ?? [];
  const inventory = bundle?.inventory ?? [];
  const tempSeries = metricSeries(bundle?.telemetry ?? [], 'temperature');

  const roomOptions = Object.values(rooms).map((b) => ({ value: b.room.id, label: b.room.name }));

  const baseToday = todayKwh(devices);
  const factor = RANGE_FACTOR[range] ?? 1;
  const total = baseToday * factor;
  const totalInventoryKg = inventory.reduce((a, b) => a + b.quantityKg, 0);
  const perKg = totalInventoryKg > 0 ? total / totalInventoryKg : 0;

  const energyCurve = useMemo(() => dailyCurve(baseToday, tempSeries), [baseToday, tempSeries]);
  const periods = useMemo(() => periodBreakdown(energyCurve), [energyCurve]);
  const deviceEnergy = useMemo(() => deviceBreakdown(devices, total), [devices, total]);
  const maxDevice = deviceEnergy[0]?.kwh ?? 1;

  // AI vs 人工对比（演示/仿真估算）：AI 平滑逼近目标，减少过冲与启停。
  const manualEstimate = total * 1.14;
  const aiSavingPct = total > 0 ? ((manualEstimate - total) / manualEstimate) * 100 : 0;

  // 库间对比（演示：用各库电表今日电量）。
  const roomCompare = useMemo(
    () =>
      Object.values(rooms).map((b) => ({
        id: b.room.id,
        name: b.room.name,
        kwh: todayKwh(b.devices),
      })),
    [rooms],
  );
  const maxRoom = Math.max(...roomCompare.map((r) => r.kwh), 1);

  if (loading && !bundle) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonLoader lines={2} />
        <SkeletonLoader lines={4} />
      </div>
    );
  }
  if (!room || !bundle) {
    return <EmptyState title="暂无能耗数据" description="当前冷库没有计量设备。" />;
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="能耗分析"
        description={`${room.name} · 电耗 / 峰谷 / 设备构成 / 单位库存能耗`}
        actions={<DemoDataBadge kind="demo" />}
      />

      <div className={styles.toolbar}>
        <Select ariaLabel="冷库" options={roomOptions} value={roomId} onChange={setRoomId} />
        <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} ariaLabel="统计范围" />
        <span className={styles.toolbarSpacer} />
      </div>

      <div className={styles.statGrid}>
        <StatCard label="总电耗" value={formatInt(total)} unit="kWh" tone="ok" footer={`${RANGE_OPTIONS.find((o) => o.value === range)?.label} · 演示`} />
        <StatCard label="峰时电耗" value={formatInt(periods.peak * factor)} unit="kWh" tone="warn" footer="8-11 / 18-21 时" />
        <StatCard label="谷时电耗" value={formatInt(periods.valley * factor)} unit="kWh" tone="ok" footer="23-7 时 · 低成本" />
        <StatCard label="单位库存能耗" value={formatNumber(perKg * 1000, 2)} unit="Wh/kg" tone="ok" footer={`${formatNumber(totalInventoryKg / 1000, 1)} 吨`} />
      </div>

      <div className={styles.grid2}>
        <div className={styles.colStack}>
          <Panel title="24 小时能耗趋势" action={<DemoDataBadge kind="demo" />}>
            <EnergyBarChart curve={energyCurve} height={180} />
            <div className={styles.note} style={{ marginTop: 8 }}>
              峰 {formatInt(periods.peak)} · 平 {formatInt(periods.flat)} · 谷 {formatInt(periods.valley)} kWh。曲线由温度负荷形态派生（演示）。
            </div>
          </Panel>

          <Panel title="库间能耗对比" action={<DemoDataBadge kind="demo" />}>
            {roomCompare.map((r) => (
              <div key={r.id} className={styles.deviceRow} style={{ gridTemplateColumns: '1fr 120px 60px' }}>
                <span className={styles.metricLabel}>{r.name}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(r.kwh / maxRoom) * 100}%`, background: r.id === roomId ? 'var(--color-accent)' : 'var(--color-info)' }} />
                </div>
                <span className={styles.metricValue}>{formatInt(r.kwh)}</span>
              </div>
            ))}
          </Panel>
        </div>

        <div className={styles.colStack}>
          <Panel title="设备能耗构成" action={<DemoDataBadge kind="demo" />}>
            {deviceEnergy.map((d) => (
              <div key={d.name} className={styles.deviceRow}>
                <span className={styles.metricLabel}>{d.name}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(d.kwh / maxDevice) * 100}%`, background: 'var(--color-accent)' }} />
                </div>
                <span className={styles.metricValue}>{d.pct}%</span>
              </div>
            ))}
            <div className={styles.note} style={{ marginTop: 8 }}>压缩机为主要耗能设备（演示估算）。</div>
          </Panel>

          <Panel title="AI 策略 vs 人工经验" action={<DemoDataBadge kind="simulated" />}>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>人工经验（估算）</span>
              <span className={styles.metricValue}>{formatInt(manualEstimate)} kWh</span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>AI 平滑逼近（估算）</span>
              <span className={styles.metricValue}>{formatInt(total)} kWh</span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>节能（估算）</span>
              <span className={styles.metricValue} style={{ color: 'var(--color-success)' }}>约 {formatNumber(aiSavingPct, 1)}%</span>
            </div>
            <InlineAlert tone="info" title="仿真估算">
              AI 节能数据为仿真/演示估算，非真实试点结果，需现场验证。
            </InlineAlert>
          </Panel>
        </div>
      </div>

      <div className={styles.disclaimer}>
        本页所有能耗数据均为演示/仿真派生（基于可得温度曲线与电表读数的估算），用于产品形态演示，不构成真实节能承诺。接入真实计量后将替换为实测数据。
      </div>
    </div>
  );
}