import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Gauge, Leaf, Zap } from 'lucide-react';
import { useAppData } from '@/state/appData';
import { useStrategyData } from '@/features/commandCenter/useStrategyData';
import { dailyCurve, deviceBreakdown, periodBreakdown, todayKwh } from '@/domain/energy';
import { metricSeries } from '@/domain/viewModels';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { EnergyTrendChart } from '@/features/energy/EnergyTrendChart';
import { PeriodDonut, type DonutSlice } from '@/features/energy/PeriodDonut';
import { energyInsights, energyKpi, savingsRows } from '@/features/energy/energyView';
import { formatInt, formatNumber } from '@/utils/formatNumber';
import styles from '@/features/energy/energy.module.css';

const TREND_RANGE_OPTIONS = [
  { value: 'hour', label: '分时' },
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
];

const PERIOD_COLORS = { peak: '#e76f51', flat: '#3478f6', valley: '#0fa978' } as const;
const KIND_COLORS = ['#0fa978', '#3478f6', '#e7a13a', '#a68fc4'];

/** 能耗分析页：顶部指标 + 趋势/峰谷/库间对比 + 设备构成 + 节能效果（provenance 标注）+ 洞察。 */
export default function EnergyPage() {
  const { client, rooms, loading, roomId, events } = useAppData();
  const bundle = rooms[roomId];
  const room = bundle?.room;
  const [trendRange, setTrendRange] = useState('hour');

  const devices = useMemo(() => bundle?.devices ?? [], [bundle]);
  const inventory = useMemo(() => bundle?.inventory ?? [], [bundle]);
  const tempSeries = metricSeries(bundle?.telemetry ?? [], 'temperature');

  // 仿真列：取首个未恢复事件的方案仿真（真实仿真返回值，恢复周期口径，页面标注）。
  const firstActionable = events.find((event) => event.stage !== 'recovered');
  const { plans, simulations } = useStrategyData(client, firstActionable?.id);
  const recommendedPlan = plans.find((plan) => plan.kind === 'recommended');
  const simulatedPlanKwh = recommendedPlan ? simulations[recommendedPlan.id]?.energyKWh ?? null : null;

  const kpi = useMemo(() => energyKpi(devices, inventory, tempSeries), [devices, inventory, tempSeries]);
  const baseToday = todayKwh(devices);
  const todayCurve = useMemo(() => dailyCurve(baseToday, tempSeries), [baseToday, tempSeries]);
  const yesterdayCurve = useMemo(() => dailyCurve(kpi.yesterdayKwh, tempSeries), [kpi.yesterdayKwh, tempSeries]);
  const periods = useMemo(() => periodBreakdown(todayCurve), [todayCurve]);
  const periodSlices: DonutSlice[] = [
    { label: '峰段（8-11 / 18-21 时）', kwh: periods.peak, color: PERIOD_COLORS.peak },
    { label: '平段', kwh: periods.flat, color: PERIOD_COLORS.flat },
    { label: '谷段（23-7 时）', kwh: periods.valley, color: PERIOD_COLORS.valley },
  ];

  const deviceSlices: DonutSlice[] = useMemo(() => {
    const breakdown = deviceBreakdown(devices, baseToday);
    const byKind = new Map<string, number>();
    breakdown.forEach((item) => {
      const device = devices.find((candidate) => candidate.name === item.name);
      const kindLabel = device?.kind === 'compressor' ? '压缩机' : device?.kind === 'fan' ? '冷风机' : '其他设备';
      byKind.set(kindLabel, (byKind.get(kindLabel) ?? 0) + item.kwh);
    });
    return Array.from(byKind.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, kwh], index) => ({ label, kwh, color: KIND_COLORS[index % KIND_COLORS.length] }));
  }, [devices, baseToday]);

  const topDevices = useMemo(() => deviceBreakdown(devices, baseToday).slice(0, 3), [devices, baseToday]);
  const topDeviceMax = topDevices[0]?.kwh ?? 1;

  const roomCompare = useMemo(
    () =>
      Object.values(rooms)
        .map((roomBundle) => ({ id: roomBundle.room.id, name: roomBundle.room.name, kwh: todayKwh(roomBundle.devices) }))
        .sort((a, b) => b.kwh - a.kwh),
    [rooms],
  );
  const maxRoomKwh = Math.max(...roomCompare.map((item) => item.kwh), 1);

  const savings = useMemo(() => savingsRows(baseToday, simulatedPlanKwh), [baseToday, simulatedPlanKwh]);
  const insights = useMemo(() => energyInsights(devices, inventory, tempSeries), [devices, inventory, tempSeries]);

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

  const deltaClass = kpi.dayOverDayPct <= 0 ? styles.kpiDeltaDown : styles.kpiDeltaUp;
  const DeltaIcon = kpi.dayOverDayPct <= 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <div className={styles.page}>
      <PageHeader
        title="能耗分析"
        description={`${room.name} · 全面洞察能耗结构与趋势，发现节能机会（演示/仿真派生）`}
        actions={<DemoDataBadge kind="demo" />}
      />

      {/* 顶部指标 */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiIcon}><Zap size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>今日能耗</span>
            <span className={styles.kpiValue}>{formatInt(kpi.todayKwh)}<small>kWh</small></span>
            <span className={styles.kpiSub}>
              较昨日 <span className={deltaClass}><DeltaIcon size={11} aria-hidden style={{ verticalAlign: -1 }} />{Math.abs(kpi.dayOverDayPct)}%</span>
              <span>峰值功率（估算）{formatNumber(kpi.peakPowerKw, 0)} kW</span>
            </span>
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiIcon}><CalendarDays size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>昨日能耗（派生）</span>
            <span className={styles.kpiValue}>{formatInt(kpi.yesterdayKwh)}<small>kWh</small></span>
            <span className={styles.kpiSub}><span>峰值功率（估算）{formatNumber(kpi.yesterdayPeakPowerKw, 0)} kW</span></span>
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiIcon}><Gauge size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>本周能耗（估算）</span>
            <span className={styles.kpiValue}>{formatInt(kpi.weekKwh)}<small>kWh</small></span>
            <span className={styles.kpiSub}>
              较上周（估算）<span className={styles.kpiDeltaDown}><ArrowDownRight size={11} aria-hidden style={{ verticalAlign: -1 }} />{kpi.weekOverWeekPct}%</span>
            </span>
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiIcon}><Leaf size={19} aria-hidden /></span>
          <span className={styles.kpiBody}>
            <span className={styles.kpiLabel}>单位库存能耗</span>
            <span className={styles.kpiValue}>{kpi.unitKwhPerTon !== null ? formatNumber(kpi.unitKwhPerTon, 2) : '—'}<small>kWh/吨</small></span>
            <span className={styles.kpiSub}>
              {kpi.unitDayOverDayPct !== null ? (
                <>
                  较昨日（派生）
                  <span className={kpi.unitDayOverDayPct <= 0 ? styles.kpiDeltaDown : styles.kpiDeltaUp}>
                    {kpi.unitDayOverDayPct <= 0 ? <ArrowDownRight size={11} aria-hidden style={{ verticalAlign: -1 }} /> : <ArrowUpRight size={11} aria-hidden style={{ verticalAlign: -1 }} />}
                    {Math.abs(kpi.unitDayOverDayPct)}%
                  </span>
                </>
              ) : (
                '暂无库存数据'
              )}
            </span>
          </span>
        </div>
      </div>

      {/* 趋势 / 峰谷分布 / 库间对比 */}
      <div className={styles.gridRow}>
        <Panel
          title="能耗趋势（24 小时）"
          action={<Segmented options={TREND_RANGE_OPTIONS} value={trendRange} onChange={setTrendRange} ariaLabel="趋势粒度" />}
        >
          {trendRange === 'hour' ? (
            <>
              <EnergyTrendChart today={todayCurve} yesterday={yesterdayCurve} height={250} />
              <p className={styles.note}>曲线由电表今日读数与温度负荷形态派生（演示）；昨日为确定性偏移对比。</p>
            </>
          ) : (
            <EmptyState title="暂无数据" description="日 / 周 / 月粒度历史能耗接口未接入，当前仅支持 24 小时分时派生曲线。" />
          )}
        </Panel>

        <Panel title="分时电量分布" action={<DemoDataBadge kind="demo" />}>
          <PeriodDonut slices={periodSlices} centerValue={formatInt(kpi.todayKwh)} centerLabel="kWh 今日总量" />
          <p className={styles.note} style={{ marginTop: 8 }}>峰平谷按华东工业电价时段假设划分（演示）。</p>
        </Panel>

        <Panel title="各冷间能耗（今日）" action={<DemoDataBadge kind="demo" />}>
          <div className={styles.roomBars}>
            {roomCompare.map((item) => (
              <div key={item.id} className={styles.roomBarRow}>
                <span className={styles.roomBarName}>{item.name}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(item.kwh / maxRoomKwh) * 100}%`, background: item.id === roomId ? 'var(--color-accent)' : 'var(--color-neutral-400)' }}
                  />
                </div>
                <span className={styles.roomBarValue}>{formatInt(item.kwh)}</span>
              </div>
            ))}
          </div>
          <p className={styles.note} style={{ marginTop: 8 }}>单位 kWh；按各库电表今日读数。</p>
        </Panel>
      </div>

      {/* 设备构成 / 节能效果 / 洞察 */}
      <div className={styles.gridRow}>
        <Panel title="设备能耗占比（今日）" action={<DemoDataBadge kind="demo" />}>
          <PeriodDonut slices={deviceSlices} centerValue={formatInt(baseToday)} centerLabel="kWh 今日总量" />
          <p className={styles.note} style={{ marginTop: 8 }}>按设备类型分摊（演示估算：压缩机 62% / 风机 24% / 其他 14%）。</p>
        </Panel>

        <Panel title="策略节能效果对比" action={<DemoDataBadge kind="simulated" />}>
          <table className={styles.savingsTable} aria-label="策略节能效果对比">
            <thead>
              <tr>
                <th>较基线</th>
                <th>演示结果</th>
                <th>仿真结果</th>
                <th>待真实试点</th>
              </tr>
            </thead>
            <tbody>
              {savings.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className={styles.savingsGood}>{row.demo}</td>
                  <td className={styles.savingsGood}>{row.simulated}</td>
                  <td>{row.pilot}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.note} style={{ marginTop: 8 }}>
            基线：未开启优化策略的历史同期平均水平（演示假设 ×1.14）；仿真结果为方案 A 恢复周期仿真能耗（非全日数据，仿真值）。
          </p>
        </Panel>

        <Panel title="能耗洞察" action={<DemoDataBadge kind="demo" />}>
          <ul className={styles.insightList}>
            {insights.map((finding, index) => (
              <li key={index} className={styles.insightItem}>
                <span className={styles.insightDot} />
                {finding}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <div className={styles.note} style={{ marginBottom: 4 }}>高能耗设备 TOP3（演示分摊）</div>
            {topDevices.map((device) => (
              <div key={device.name} className={styles.topDeviceRow}>
                <span className={styles.topDeviceName}>{device.name}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${(device.kwh / topDeviceMax) * 100}%`, background: 'var(--color-accent)' }} />
                </div>
                <span className={styles.topDeviceValue}>{formatInt(device.kwh)} kWh</span>
                <span className={styles.topDevicePct}>{device.pct}%</span>
              </div>
            ))}
          </div>
          <div className={styles.suggestBox}>
            建议：关注压缩机启停频次与库温设定，利用谷段电价时段预冷降温，以降低峰段负荷与整体能耗（演示建议）。
          </div>
        </Panel>
      </div>

      <div className={styles.disclaimer}>
        本页所有能耗数据均为演示/仿真派生（基于电表读数、温度负荷形态与确定性假设的估算），用于产品形态演示，不构成真实节能承诺。接入真实分项计量与电费账单后将替换为实测数据。
      </div>
    </div>
  );
}
