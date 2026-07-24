import { useMemo } from 'react';
import { useAppData } from '@/state/appData';
import { metricSeries, roomOverall } from '@/domain/viewModels';
import { dailyCurve, todayKwh, yesterdayKwh } from '@/domain/energy';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ColdRoomOverviewPanel } from '@/features/commandCenter/ColdRoomOverviewPanel';
import { AgentCenterPanel } from '@/features/commandCenter/AgentCenterPanel';
import { InventoryOverviewCard } from '@/features/commandCenter/InventoryOverviewCard';
import { EnergyOverviewCard } from '@/features/commandCenter/EnergyOverviewCard';
import { AlertsOverviewCard } from '@/features/commandCenter/AlertsOverviewCard';
import { StrategySimPanel } from '@/features/commandCenter/StrategySimPanel';
import { AlertsTablePanel } from '@/features/commandCenter/AlertsTablePanel';
import { useStrategyData } from '@/features/commandCenter/useStrategyData';
import styles from './CommandCenterPage.module.css';

export default function CommandCenterPage() {
  const { client, events, rooms, loading, roomId } = useAppData();
  const bundle = rooms[roomId];
  const room = bundle?.room;

  const activeEvent = useMemo(
    () => events.find((e) => e.roomId === roomId && e.stage !== 'recovered') ?? events.find((e) => e.roomId === roomId),
    [events, roomId],
  );
  const { plans, simulations, simulating, rerun } = useStrategyData(client, activeEvent?.id);

  const telemetry = bundle?.telemetry ?? [];
  const devices = bundle?.devices ?? [];
  const inventory = bundle?.inventory ?? [];
  const tempSeries = metricSeries(telemetry, 'temperature');
  const overall = room ? roomOverall(room, tempSeries, telemetry) : { label: '—', tone: 'muted' as const };

  const today = todayKwh(devices);
  const yesterday = yesterdayKwh(today);
  const energyCurve = useMemo(() => dailyCurve(today, tempSeries), [today, tempSeries]);
  const deltaPct = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : 0;

  const openAlerts = useMemo(
    () => events.filter((e) => e.stage !== 'recovered'),
    [events],
  );
  const sortedEvents = useMemo(
    () => events.slice().sort((a, b) => (a.stage === 'recovered' ? 1 : 0) - (b.stage === 'recovered' ? 1 : 0)),
    [events],
  );

  if (loading && !bundle) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonLoader lines={2} />
        <SkeletonLoader lines={4} />
      </div>
    );
  }
  if (!room || !bundle) {
    return <EmptyState title="暂无冷库数据" description="当前冷库没有可聚合的领域数据。" />;
  }

  return (
    <div className={styles.page}>
      {/* 第一行：冷库概览综合面板 + Agent 对话中心 */}
      <div className={styles.rowTop}>
        <ColdRoomOverviewPanel room={room} telemetry={telemetry} devices={devices} inventory={inventory} overall={overall} />
        <AgentCenterPanel event={activeEvent} />
      </div>

      {/* 第二行：库存 / 能耗 / 当前告警 */}
      <div className={styles.rowMid}>
        <InventoryOverviewCard inventory={inventory} />
        <EnergyOverviewCard todayKwh={today} deltaPct={deltaPct} curve={energyCurve} />
        <AlertsOverviewCard alerts={openAlerts} />
      </div>

      {/* 第三行：策略与仿真 + 异常告警表格 */}
      <div className={styles.rowBottom}>
        <StrategySimPanel
          event={activeEvent}
          plans={plans}
          simulations={simulations}
          simulating={simulating}
          rerun={rerun}
          energyCurve={energyCurve}
        />
        <AlertsTablePanel events={sortedEvents} />
      </div>
    </div>
  );
}