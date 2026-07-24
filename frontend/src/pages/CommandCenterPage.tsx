import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ControlPlan, SimulationResult } from '@/domain/types';
import { useAppData } from '@/state/appData';
import { METRIC_META, METRIC_ORDER } from '@/domain/constants/metrics';
import {
  deviceStatusLabel,
  deviceStatusTone,
  latestValue,
  metricSeries,
  metricTone,
  recentValues,
  remainingHours,
  riskLabel,
  roomOverall,
  sensorStatusLabel,
} from '@/domain/viewModels';
import { dailyCurve, deviceBreakdown, periodBreakdown, todayKwh, yesterdayKwh } from '@/domain/energy';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/ui/StatCard';
import { Sparkline } from '@/components/ui/Sparkline';
import { StatusDot } from '@/components/ui/StatusDot';
import { Tag } from '@/components/ui/Tag';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { ColdRoomDiagram } from '@/components/domain/ColdRoomDiagram';
import { EnergyBarChart } from '@/components/domain/EnergyBarChart';
import { formatDuration, formatTimeHM } from '@/utils/formatTime';
import { formatInt, formatNumber } from '@/utils/formatNumber';
import { Send } from 'lucide-react';
import styles from './CommandCenterPage.module.css';

const CATEGORY_COLORS = ['#0f766e', '#2f6fdb', '#c7861b', '#8e1f1f', '#52606d', '#7c5cbf'];

export default function CommandCenterPage() {
  const navigate = useNavigate();
  const { client, events, rooms, loading, roomId } = useAppData();
  const bundle = rooms[roomId];
  const room = bundle?.room;
  const [question, setQuestion] = useState('');

  // 方案/仿真（策略摘要）：取当前冷库首个未处理事件。
  const activeEvent = useMemo(
    () => events.find((e) => e.roomId === roomId && e.stage !== 'recovered') ?? events.find((e) => e.roomId === roomId),
    [events, roomId],
  );
  const [plans, setPlans] = useState<ControlPlan[]>([]);
  const [simulations, setSimulations] = useState<Record<string, SimulationResult>>({});
  useEffect(() => {
    let cancelled = false;
    setPlans([]);
    setSimulations({});
    if (!activeEvent) return;
    void (async () => {
      try {
        const list = await client.listControlPlans(activeEvent.id);
        if (cancelled) return;
        setPlans(list);
        const sims: Record<string, SimulationResult> = {};
        await Promise.all(
          list.map(async (p) => {
            try {
              sims[p.id] = await client.runSimulation(p.id);
            } catch {
              /* 仿真失败留空 */
            }
          }),
        );
        if (!cancelled) setSimulations(sims);
      } catch {
        /* 无方案 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, activeEvent]);

  const telemetry = bundle?.telemetry ?? [];
  const devices = bundle?.devices ?? [];
  const inventory = bundle?.inventory ?? [];
  const tempSeries = metricSeries(telemetry, 'temperature');
  const overall = room ? roomOverall(room, tempSeries, telemetry) : { label: '—', tone: 'muted' as const };

  const nowMs = useMemo(() => Date.now(), []);
  const today = todayKwh(devices);
  const yesterday = yesterdayKwh(today);
  const energyCurve = useMemo(() => dailyCurve(today, tempSeries), [today, tempSeries]);
  const periods = useMemo(() => periodBreakdown(energyCurve), [energyCurve]);
  const deviceEnergy = useMemo(() => deviceBreakdown(devices, today), [devices, today]);
  const deltaPct = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : 0;

  const totalInventory = inventory.reduce((a, b) => a + b.quantityKg, 0);
  const riskBatches = inventory.filter((b) => b.risk !== 'none');
  const openAlerts = events.filter((e) => e.roomId === roomId && e.stage !== 'recovered');

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

  const anomalyActive = metricTone(tempSeries, room.targetRange) === 'danger';

  const handleAsk = () => {
    if (!activeEvent) return;
    navigate(`/workbench/${activeEvent.id}`);
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="指挥中心"
        description={
          <>
            {room.name} · {room.location} · 综合状态{' '}
            <StatusDot tone={overall.tone} label={overall.label} /> · 更新{' '}
            {tempSeries ? formatTimeHM(tempSeries.lastSampleAt) : '—'}
          </>
        }
        actions={<DemoDataBadge kind="demo" />}
      />

      {/* 顶部：冷库示意 + 指标网格 */}
      <div className={styles.topGrid}>
        <Panel title="冷库概览" action={<Tag tone={anomalyActive ? 'danger' : 'success'}>{overall.label}</Tag>}>
          <ColdRoomDiagram devices={devices} inventory={inventory} anomaly={anomalyActive} name={room.name} />
          <div className={styles.deviceChips}>
            {devices.map((d) => (
              <span key={d.id} className={styles.deviceChip}>
                <StatusDot tone={deviceStatusTone(d.status)} />
                {d.name} · {deviceStatusLabel(d.status)}
              </span>
            ))}
          </div>
        </Panel>

        <div className={styles.metricGrid}>
          {METRIC_ORDER.map((metric) => {
            const series = metricSeries(telemetry, metric);
            const meta = METRIC_META[metric];
            const value = latestValue(series);
            const target = metric === 'temperature' ? room.targetRange : undefined;
            const tone = metric === 'temperature' ? metricTone(series, target) : series?.status === 'online' ? 'ok' : 'muted';
            return (
              <StatCard
                key={metric}
                icon={<meta.Icon size={14} />}
                label={meta.label}
                value={value !== null ? formatNumber(value, metric === 'temperature' ? 1 : metric === 'pressureDiff' ? 0 : 1) : '—'}
                unit={meta.shortUnit}
                target={target ? `${target.min} ~ ${target.max} ${target.unit}` : series ? sensorStatusLabel(series.status) : undefined}
                tone={tone}
                statusLabel={series ? sensorStatusLabel(series.status) : undefined}
                trend={<Sparkline data={recentValues(series, 12)} band={target ? [target.min, target.max] : undefined} />}
              />
            );
          })}
          <StatCard
            label="库存总量"
            value={formatNumber(totalInventory / 1000, 1)}
            unit="吨"
            tone={riskBatches.length > 0 ? 'warn' : 'ok'}
            statusLabel={riskBatches.length > 0 ? `${riskBatches.length} 批关注` : '正常'}
            footer={`${inventory.length} 个批次`}
          />
        </div>
      </div>

      {/* 三栏内容 */}
      <div className={styles.columns}>
        {/* 左：Agent 中心 + 策略与仿真摘要 */}
        <div className={styles.colStack}>
          <Panel
            title="Agent 中心"
            action={
              activeEvent ? (
                <Button variant="ghost" size="sm" onClick={() => navigate(`/workbench/${activeEvent.id}`)}>
                  进入诊断
                </Button>
              ) : undefined
            }
          >
            {activeEvent ? (
              <>
                <div className={styles.causeRow}>
                  <div className={styles.alertInfo}>
                    <span className={styles.alertTitle}>{activeEvent.roomName} · {activeEvent.title}</span>
                    <span className={styles.alertMeta}>
                      <SeverityTag severity={activeEvent.severity} />
                      <StatusBadge status={activeEvent.stage} size="sm" />
                      <span>持续 {formatDuration(activeEvent.durationMinutes)}</span>
                    </span>
                  </div>
                </div>
                <div className={styles.causeRow}>
                  {plans.length > 0 ? (
                    <div className={styles.sectionNote}>已生成 {plans.length} 个候选控制方案（均需 L2 人工审批）。</div>
                  ) : (
                    <div className={styles.sectionNote}>分析当前异常并给出安全、节能的处理建议。</div>
                  )}
                </div>
                <div className={styles.agentInput}>
                  <Input
                    placeholder="追问：该异常如何处理？"
                    aria-label="向 Agent 提问"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                  />
                  <Button variant="primary" size="md" onClick={handleAsk} aria-label="提交问题">
                    <Send size={15} />
                  </Button>
                </div>
                <div className={styles.sectionNote}>自然语言提问将进入诊断工作台，由 Agent 结合实时数据分析。</div>
              </>
            ) : (
              <EmptyState title="暂无待处理异常" description="当前冷库运行平稳。" />
            )}
          </Panel>

          <Panel title="策略与仿真摘要" action={<DemoDataBadge kind="simulated" />}>
            {plans.length === 0 ? (
              <EmptyState title="暂无方案" description="诊断完成后将生成候选控制方案。" />
            ) : (
              plans.map((plan) => {
                const sim = simulations[plan.id];
                return (
                  <div key={plan.id} className={styles.planRow}>
                    <div className={styles.alertInfo}>
                      <span className={styles.planName}>{plan.name}</span>
                      <div className={styles.planMeta}>
                        {sim ? (
                          <>
                            <span>恢复 {formatNumber(sim.recoveryHours, 1)}h</span>
                            <span>能耗 {formatInt(sim.energyKWh)} kWh</span>
                            <span>过冲 {sim.overshootRisk}</span>
                            <span>冻害 {sim.frostRisk}</span>
                            <span>启停 {sim.compressorCycles} 次</span>
                          </>
                        ) : (
                          <span>仿真中…</span>
                        )}
                      </div>
                    </div>
                    <Tag tone={plan.kind === 'recommended' ? 'accent' : 'neutral'}>
                      {plan.kind === 'recommended' ? '推荐' : '备选'}
                    </Tag>
                  </div>
                );
              })
            )}
            {plans.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => navigate('/strategy')}>
                查看策略与仿真
              </Button>
            )}
          </Panel>
        </div>

        {/* 中：库存概览 + 当前告警 */}
        <div className={styles.colStack}>
          <Panel title="库存概览">
            <div className={styles.energySummary}>
              <span className={styles.energyBig}>{formatNumber(totalInventory / 1000, 1)}</span>
              <span className={styles.energyUnit}>吨 · {inventory.length} 批</span>
            </div>
            <div className={styles.invBar}>
              {inventory.map((b, i) => (
                <div
                  key={b.id}
                  className={styles.invSeg}
                  style={{ width: `${(b.quantityKg / totalInventory) * 100}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                  title={`${b.category} · ${b.quantityKg} kg`}
                />
              ))}
            </div>
            <div className={styles.invLegend}>
              {inventory.map((b, i) => (
                <span key={b.id} className={styles.invLegendItem}>
                  <i className={styles.invSw} style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  {b.category} {formatNumber(b.quantityKg / 1000, 1)}t
                </span>
              ))}
            </div>
            {riskBatches.length > 0 ? (
              <div className={styles.causeRow}>
                {riskBatches.map((b) => (
                  <div key={b.id} className={styles.causeItem}>
                    <span>{b.category}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag tone={b.risk === 'high' ? 'danger' : b.risk === 'watch' ? 'warning' : 'success'}>{riskLabel(b.risk)}</Tag>
                      <span className={styles.sectionNote}>剩 {formatNumber(remainingHours(b, nowMs), 0)}h</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.sectionNote}>所有批次均在安全存储窗口内。</div>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')}>
              库存管理 →
            </Button>
          </Panel>

          <Panel title="当前告警" action={<Button variant="ghost" size="sm" onClick={() => navigate('/events')}>全部 →</Button>}>
            {openAlerts.length === 0 ? (
              <EmptyState title="无未处理告警" description="当前冷库运行平稳。" />
            ) : (
              openAlerts.map((e) => (
                <div key={e.id} className={styles.alertRow}>
                  <div className={styles.alertInfo}>
                    <span className={styles.alertTitle}>
                      <SeverityTag severity={e.severity} /> {e.title}
                    </span>
                    <span className={styles.alertMeta}>
                      <span>{e.roomName}</span>
                      <span>持续 {formatDuration(e.durationMinutes)}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <StatusBadge status={e.stage} size="sm" />
                    {e.awaitingApproval && <Tag tone="warning">待审批</Tag>}
                  </div>
                </div>
              ))
            )}
          </Panel>
        </div>

        {/* 右：今日能耗 + 设备状态 */}
        <div className={styles.colStack}>
          <Panel title="今日能耗" action={<DemoDataBadge kind="demo" />}>
            <div className={styles.energySummary}>
              <span className={styles.energyBig}>{formatInt(today)}</span>
              <span className={styles.energyUnit}>kWh</span>
              <span className={`${styles.delta} ${deltaPct <= 0 ? styles.deltaDown : styles.deltaUp}`}>
                {deltaPct <= 0 ? '↓' : '↑'} {formatNumber(Math.abs(deltaPct), 1)}% 较昨日
              </span>
            </div>
            <EnergyBarChart curve={energyCurve} height={120} />
            <div className={styles.planMeta}>
              <span>峰 {formatInt(periods.peak)}</span>
              <span>平 {formatInt(periods.flat)}</span>
              <span>谷 {formatInt(periods.valley)} kWh</span>
            </div>
            <div className={styles.sectionNote}>高耗能设备（演示估算）</div>
            <div className={styles.causeRow}>
              {deviceEnergy.slice(0, 3).map((d) => (
                <div key={d.name} className={styles.causeItem}>
                  <span>{d.name}</span>
                  <span className={styles.sectionNote}>
                    {formatInt(d.kwh)} kWh · {d.pct}%
                  </span>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/energy')}>
              能耗分析 →
            </Button>
          </Panel>

          <Panel title="设备状态">
            <div className={styles.causeRow}>
              {devices.map((d) => (
                <div key={d.id} className={styles.causeItem}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusDot tone={deviceStatusTone(d.status)} />
                    {d.name}
                  </span>
                  <span className={styles.sectionNote}>{deviceStatusLabel(d.status)}</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/devices')}>
              设备管理 →
            </Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}