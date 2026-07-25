import { useEffect, useMemo, useRef, useState } from 'react';
import { BellOff, Clock3, Thermometer, Timer } from 'lucide-react';
import { useAppData } from '@/state/appData';
import { useWorkbench } from '@/state/useWorkbench';
import { useStrategyData } from '@/features/commandCenter/useStrategyData';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { Tag } from '@/components/ui/Tag';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { PredictionChart, type PredictionSeries } from '@/components/domain/PredictionChart';
import { PlanSummaryCards } from '@/features/strategy/PlanSummaryCards';
import { ControlPlanTable } from '@/features/strategy/ControlPlanTable';
import { SafetyCheckPanel } from '@/features/strategy/SafetyCheckPanel';
import { StrategyApprovalPanel } from '@/features/strategy/StrategyApprovalPanel';
import { formatDateTime, formatDuration } from '@/utils/formatTime';
import { formatNumber } from '@/utils/formatNumber';
import styles from '@/features/strategy/strategy.module.css';

type StrategyTab = 'plans' | 'schedule' | 'records' | 'library';

const STRATEGY_TABS: { key: StrategyTab; label: string }[] = [
  { key: 'plans', label: '温控策略' },
  { key: 'schedule', label: '节能调度' },
  { key: 'records', label: '仿真记录' },
  { key: 'library', label: '策略库' },
];

const PREDICTION_COLORS = ['#0fa978', '#3478f6'];

/**
 * 策略与仿真页：事件上下文 + 方案 A/B 对比 + 温度预测 + 控制计划 +
 * 安全校验 + L2 审批（经 useWorkbench 状态机，全程留痕）。
 * 展示层经 useStrategyData 只读取（不触碰状态机）；操作层一律走状态机。
 */
export default function StrategyPage() {
  const { client, events, loading } = useAppData();
  const wb = useWorkbench();
  const [activeTab, setActiveTab] = useState<StrategyTab>('plans');

  const actionable = useMemo(() => events.filter((event) => event.stage !== 'recovered'), [events]);

  useEffect(() => {
    if (!wb.selectedEventId && actionable.length > 0) {
      void wb.selectEvent(actionable[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionable]);

  const currentEvent = events.find((event) => event.id === wb.selectedEventId);
  const { plans, simulations, simulating } = useStrategyData(client, wb.selectedEventId ?? undefined);

  // 自动诊断：选中事件且处于 detected 时启动诊断（幂等，状态机驱动，方案随后进入检查器上下文）。
  const wbRef = useRef(wb);
  useEffect(() => {
    wbRef.current = wb;
  });
  const autoStartedRef = useRef<string | null>(null);
  useEffect(() => {
    if (wb.selectedEventId) autoStartedRef.current = null;
  }, [wb.selectedEventId]);
  useEffect(() => {
    if (wb.status !== 'detected' || !wb.selectedEventId || autoStartedRef.current === wb.selectedEventId) return;
    // 仅后端仍处于 detected 的事件自动诊断；已进入诊断后阶段的事件由 selectEvent 水合恢复。
    const backendStage = events.find((event) => event.id === wb.selectedEventId)?.stage;
    if (backendStage !== 'detected') return;
    autoStartedRef.current = wb.selectedEventId;
    void wbRef.current.startDiagnosis();
  }, [wb.status, wb.selectedEventId, events]);

  const eventOptions = actionable.map((event) => ({ value: event.id, label: `${event.roomName} · ${event.title}` }));

  const telemetrySeries = wb.data.eventDetail?.telemetry ?? [];
  const temperatureSeries = telemetrySeries.find((series) => series.metric === 'temperature');
  const latestTemperature =
    temperatureSeries && temperatureSeries.points.length > 0
      ? temperatureSeries.points[temperatureSeries.points.length - 1].value
      : null;
  const targetRange = temperatureSeries?.target;

  const predictionSeries: PredictionSeries[] = useMemo(
    () =>
      [...plans]
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'recommended' ? -1 : 1))
        .filter((plan) => simulations[plan.id])
        .map((plan, index) => ({
          name: `${plan.name.split('·')[0].trim()} 预测`,
          points: simulations[plan.id].predictedSeries,
          color: PREDICTION_COLORS[index % PREDICTION_COLORS.length],
        })),
    [plans, simulations],
  );

  if (loading && events.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonLoader lines={2} />
        <SkeletonLoader lines={4} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="策略与仿真"
        description="候选控制方案的仿真、对比与审批执行"
        actions={
          <>
            <DemoDataBadge kind="simulated" />
            <button
              className={styles.flowLink}
              disabled
              title="告警规则配置接口未接入，仅展示入口"
              aria-label="告警配置（未接入）"
            >
              <BellOff size={13} aria-hidden /> 告警配置
            </button>
          </>
        }
      />

      {actionable.length === 0 ? (
        <EmptyState title="暂无待处理异常" description="当前没有需要制定控制策略的异常事件。" />
      ) : (
        <>
          {/* 事件上下文条 */}
          <div className={styles.contextBar}>
            {currentEvent && (
              <>
                <span className={styles.contextItem}>
                  当前异常：
                  <b>
                    {currentEvent.title}（{currentEvent.roomName}）
                  </b>
                  <SeverityTag severity={currentEvent.severity} />
                  <StatusBadge status={currentEvent.stage} size="sm" />
                </span>
                <span className={styles.contextItem}>
                  <Clock3 size={13} aria-hidden /> 触发时间 <span className="numeric">{formatDateTime(currentEvent.startedAt)}</span>
                </span>
                <span className={styles.contextItem}>
                  <Timer size={13} aria-hidden /> 异常时长 <span className="numeric">{formatDuration(currentEvent.durationMinutes)}</span>
                </span>
                <span className={styles.contextItem}>
                  <Thermometer size={13} aria-hidden /> 当前温度{' '}
                  <span className="numeric">{latestTemperature !== null ? `${formatNumber(latestTemperature, 1)}℃` : '暂无数据'}</span>
                  {targetRange ? (
                    <span>
                      （目标 {formatNumber(targetRange.min, 1)}~{formatNumber(targetRange.max, 1)}℃）
                    </span>
                  ) : null}
                </span>
              </>
            )}
            <span className={styles.contextSpacer} />
            <Select
              ariaLabel="切换异常事件"
              options={eventOptions}
              value={wb.selectedEventId ?? actionable[0].id}
              onChange={(id) => void wb.selectEvent(id)}
            />
          </div>

          {/* Tabs */}
          <div className={styles.strategyTabs} role="tablist" aria-label="策略与仿真视图">
            {STRATEGY_TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`${styles.strategyTab} ${activeTab === tab.key ? styles.strategyTabActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
            <span className={styles.contextSpacer} />
            <StatusBadge status={wb.status} size="sm" />
          </div>

          {activeTab === 'plans' && (
            <>
              {/* 方案摘要 A/B */}
              {plans.length === 0 ? (
                <Panel title="候选方案">
                  {wb.status === 'diagnosing' ? (
                    <SkeletonLoader lines={3} />
                  ) : (
                    <EmptyState title="暂无候选方案" description="诊断完成后此处展示候选控制方案（均为 L2）。" />
                  )}
                </Panel>
              ) : (
                <PlanSummaryCards plans={plans} simulations={simulations} simulating={simulating} />
              )}

              {/* 温度预测 + 控制计划 */}
              <div className={styles.chartPlanGrid}>
                <Panel
                  title="温度预测对比"
                  action={<DemoDataBadge kind="simulated" />}
                >
                  {predictionSeries.length > 0 && temperatureSeries ? (
                    <>
                      <PredictionChart
                        actual={temperatureSeries.points}
                        predictions={predictionSeries}
                        target={targetRange}
                        unit="℃"
                        height={300}
                      />
                      <p className={styles.chartNote}>预测基于当前设备状态与库内热惯性估计，实际效果受环境与设备响应影响（仿真数据）。</p>
                    </>
                  ) : (
                    <EmptyState title="暂无预测曲线" description={simulating ? '仿真计算中…' : '完成仿真后展示各方案温度预测曲线。'} />
                  )}
                </Panel>
                <Panel title="控制计划">
                  {plans.length > 0 ? (
                    <ControlPlanTable plans={plans} />
                  ) : (
                    <EmptyState title="暂无控制计划" description="诊断完成后展示各方案受控参数与边界。" />
                  )}
                </Panel>
              </div>

              {/* 安全校验 + L2 审批 */}
              <div className={styles.safetyApprovalGrid}>
                <Panel title="安全校验结果">
                  {plans.length > 0 ? (
                    <SafetyCheckPanel plans={plans} simulations={simulations} approval={wb.data.approval} />
                  ) : (
                    <EmptyState title="暂无安全校验" description="仿真完成后展示风险对比，请求审批后生成规则校验。" />
                  )}
                </Panel>
                <Panel title="策略审批（L2）">
                  <StrategyApprovalPanel wb={wb} plans={plans} simulations={simulations} />
                </Panel>
              </div>
            </>
          )}

          {activeTab === 'schedule' && (
            <Panel title="节能调度">
              <EmptyState
                title="暂无数据"
                description="节能调度（峰谷电价排程）接口尚未接入，当前仅支持温控策略的仿真与审批。"
              />
            </Panel>
          )}

          {activeTab === 'records' && (
            <Panel title="仿真记录">
              {predictionSeries.length > 0 ? (
                <div className={styles.recordList}>
                  {[...plans]
                    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'recommended' ? -1 : 1))
                    .filter((plan) => simulations[plan.id])
                    .map((plan) => {
                      const simulation = simulations[plan.id];
                      return (
                        <div key={plan.id} className={styles.recordItem}>
                          <Tag tone="neutral">仿真</Tag>
                          <b>{plan.name}</b>
                          <span>
                            恢复 <span className="numeric">{formatNumber(simulation.recoveryHours, 1)} h</span>
                          </span>
                          <span>
                            能耗 <span className="numeric">{simulation.energyKWh.toLocaleString('zh-CN')} kWh</span>
                          </span>
                          <span>
                            启停 <span className="numeric">{simulation.compressorCycles} 次</span>
                          </span>
                          <span>
                            方案版本 <span className="numeric">v{simulation.planVersion}</span>
                          </span>
                          <DemoDataBadge kind="simulated" />
                        </div>
                      );
                    })}
                </div>
              ) : (
                <EmptyState title="暂无仿真记录" description="运行仿真后此处列出本次会话的仿真结果。" />
              )}
            </Panel>
          )}

          {activeTab === 'library' && (
            <div className={styles.planGrid}>
              {plans.length === 0 ? (
                <Panel title="策略库">
                  <EmptyState title="暂无策略" description="诊断完成后此处展示候选策略的参数与回退条件。" />
                </Panel>
              ) : (
                plans.map((plan) => (
                  <div key={plan.id} className={styles.libraryCard}>
                    <div className={styles.planCardHead}>
                      <span className={styles.planCardName}>{plan.name}</span>
                      <Tag tone={plan.kind === 'recommended' ? 'accent' : 'neutral'}>
                        {plan.kind === 'recommended' ? '推荐' : '备选'} · v{plan.version}
                      </Tag>
                    </div>
                    <div className={styles.planApproach}>{plan.approach}</div>
                    <div className={styles.paramChips}>
                      {plan.params.map((param) => (
                        <span key={param.key} className={styles.paramChip}>
                          {param.label} {param.value}
                          {param.unit ?? ''}
                          {param.bound ? `（${param.bound.min}~${param.bound.max}）` : ''}
                        </span>
                      ))}
                    </div>
                    <ul className={styles.rollbackList}>
                      {plan.rollbackConditions.map((condition, index) => (
                        <li key={index}>{condition}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}

        </>
      )}
    </div>
  );
}
