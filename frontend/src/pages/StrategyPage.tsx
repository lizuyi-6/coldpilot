import { useEffect, useMemo } from 'react';
import { useAppData } from '@/state/appData';
import { useWorkbench } from '@/state/useWorkbench';
import { riskLevelLabel } from '@/domain/viewModels';
import { useStrategyData } from '@/features/commandCenter/useStrategyData';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { Tag } from '@/components/ui/Tag';
import { Sparkline } from '@/components/ui/Sparkline';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { InspectorPane } from '@/features/inspector/InspectorPane';
import { formatInt, formatNumber } from '@/utils/formatNumber';
import styles from './StrategyPage.module.css';

/**
 * 策略与仿真独立页：复用方案检查器的完整状态机操作
 * （方案切换 / 仿真 / 对比 / 审批 / 执行），不绕过 useWorkbench。
 * 左侧为只读方案/仿真摘要（直接经 client 读取，不触碰状态机）。
 */
export default function StrategyPage() {
  const { client, events, loading } = useAppData();
  const wb = useWorkbench();

  const actionable = useMemo(() => events.filter((e) => e.stage !== 'recovered'), [events]);
  const eventOptions = actionable.map((e) => ({ value: e.id, label: `${e.roomName} · ${e.title}` }));

  // 默认选中首个未处理事件。
  useEffect(() => {
    if (!wb.selectedEventId && actionable.length > 0) {
      void wb.selectEvent(actionable[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionable]);

  const currentEvent = events.find((e) => e.id === wb.selectedEventId);
  const { plans, simulations, simulating } = useStrategyData(client, wb.selectedEventId ?? undefined);

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
        actions={<DemoDataBadge kind="simulated" />}
      />

      {actionable.length === 0 ? (
        <EmptyState title="暂无待处理异常" description="当前没有需要制定控制策略的异常事件。" />
      ) : (
        <>
          <div className={styles.toolbar}>
            <Select
              ariaLabel="选择异常事件"
              options={eventOptions}
              value={wb.selectedEventId ?? actionable[0].id}
              onChange={(id) => void wb.selectEvent(id)}
            />
            {currentEvent && (
              <>
                <SeverityTag severity={currentEvent.severity} />
                <StatusBadge status={currentEvent.stage} size="sm" />
              </>
            )}
            <span className={styles.toolbarSpacer} />
            <span className={styles.note}>
              方案 A/B 并排对比、预测曲线、审批与执行均在右侧检查器内进行，全程留痕。
            </span>
          </div>

          <div className={styles.layout}>
            <Panel
              title="候选方案与仿真摘要"
              action={
                currentEvent ? <StatusBadge status={wb.status} size="sm" /> : undefined
              }
            >
              {plans.length === 0 ? (
                <EmptyState
                  title="无候选方案"
                  description="该事件尚未产出候选控制方案。"
                />
              ) : (
                <div className={styles.planCards}>
                  {plans.map((plan) => {
                    const sim = simulations[plan.id];
                    const curve = sim ? sim.predictedSeries.map((p) => p.value) : [];
                    return (
                      <div key={plan.id} className={styles.planCard}>
                        <div className={styles.planCardHead}>
                          <span className={styles.planCardName}>{plan.name}</span>
                          <Tag tone={plan.kind === 'recommended' ? 'accent' : 'neutral'}>
                            {plan.kind === 'recommended' ? '推荐' : '备选'}
                          </Tag>
                        </div>
                        <div className={styles.planCardApproach}>{plan.approach}</div>
                        <div className={styles.planCardStats}>
                          <span>恢复 {sim ? `${formatNumber(sim.recoveryHours, 1)}h` : simulating ? '仿真中…' : '—'}</span>
                          <span>能耗 {sim ? `${formatInt(sim.energyKWh)} kWh` : '—'}</span>
                          <span>过冲 {sim ? riskLevelLabel(sim.overshootRisk) : '—'}</span>
                          <span>冻害 {sim ? riskLevelLabel(sim.frostRisk) : '—'}</span>
                        </div>
                        {curve.length > 1 && (
                          <div className={styles.planCardCurve}>
                            <Sparkline data={curve} width={240} height={40} />
                          </div>
                        )}
                        <div className={styles.planCardParams}>
                          {plan.params.map((param) => (
                            <span key={param.key} className={styles.planCardParam}>
                              {param.label} <b className="numeric">{param.value}{param.unit ?? ''}</b>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className={styles.note}>
                以上仿真为预测结果（非真实成效）。切换方案、运行仿真、提交 L2 审批与执行均在右侧检查器内按状态机流程进行。
              </p>
            </Panel>

            <div className={styles.inspectorWrap}>
              <InspectorPane wb={wb} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}