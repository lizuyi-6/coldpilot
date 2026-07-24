import { useEffect, useMemo } from 'react';
import { useAppData } from '@/state/appData';
import { useWorkbench } from '@/state/useWorkbench';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { InspectorPane } from '@/features/inspector/InspectorPane';
import styles from './StrategyPage.module.css';

/**
 * 策略与仿真独立页：复用方案检查器的完整状态机操作
 * （方案切换 / 仿真 / 对比 / 审批 / 执行），不绕过 useWorkbench。
 */
export default function StrategyPage() {
  const { events, loading } = useAppData();
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
              title="诊断与方案生成"
              action={
                currentEvent ? <StatusBadge status={wb.status} size="sm" /> : undefined
              }
            >
              <p className={styles.note}>
                选择异常事件后，Agent 将诊断根因并生成候选控制方案（均需 L2 人工审批）。在右侧检查器中切换方案、运行仿真、并排对比预测曲线，随后提交审批并在仿真环境执行、持续验证。
              </p>
              {wb.context.plans.length === 0 ? (
                <EmptyState
                  title={wb.status === 'detected' ? '尚未生成方案' : '无候选方案'}
                  description={wb.status === 'detected' ? '在右侧检查器中开始诊断以生成候选方案。' : '诊断未产出候选方案。'}
                />
              ) : (
                <ul className={styles.planSummary}>
                  {wb.context.plans.map((p) => {
                    const sim = wb.data.simulations[p.id];
                    return (
                      <li key={p.id} className={styles.planSummaryItem}>
                        <span className={styles.planSummaryName}>
                          {p.kind === 'recommended' ? '方案 A（推荐）' : '方案 B（备选）'} · {p.name}
                        </span>
                        <span className={styles.note}>
                          {p.approach}
                          {sim ? ` · 恢复 ${sim.recoveryHours}h · 能耗 ${sim.energyKWh} kWh` : ' · 未仿真'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
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