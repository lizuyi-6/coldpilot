import { useMemo, useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApprovalLevelBadge } from '@/components/domain/ApprovalLevelBadge';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { ApprovalActionBar } from '@/features/approval/ApprovalActionBar';
import { SimulationCompareView } from '@/features/simulation/SimulationCompareView';
import { DemoControlsBar } from './DemoControlsBar';
import { Ban, CheckCircle2, GitCompareArrows, ShieldCheck, Undo2, XCircle } from 'lucide-react';
import type { UseWorkbench } from '@/state/useWorkbench';
import { formatInt } from '@/utils/formatNumber';
import styles from './inspector.module.css';

const RISK_LABEL = { low: '低', medium: '中', high: '高' } as const;

/** 右栏：方案检查器（推荐方案 / 风险 / 控制参数 / 安全校验 / 审批操作）。 */
export function InspectorPane({ wb }: { wb: UseWorkbench }) {
  const { data, context } = wb;
  const [confirmOpen, setConfirmOpen] = useState<'approve' | 'reject' | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const plans = context.plans;
  const activePlan = plans.find((p) => p.id === context.activePlanId) ?? null;
  const simulation = activePlan ? data.simulations[activePlan.id] ?? null : null;
  const simulatedCount = context.simulatedPlanIds.length;

  const planOptions = useMemo(
    () => plans.map((p) => ({ value: p.id, label: p.kind === 'recommended' ? '方案 A' : '方案 B' })),
    [plans],
  );

  if (plans.length === 0 || !activePlan) {
    return (
      <div className={styles.pane}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>方案检查器</div>
        </div>
        <div className={styles.emptyInspector}>完成诊断后，此处将展示候选控制方案、风险与审批操作。</div>
      </div>
    );
  }

  return (
    <div className={styles.pane}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>方案检查器</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Segmented
            options={planOptions}
            value={activePlan.id}
            onChange={(id) => void wb.simulatePlan(id)}
            ariaLabel="方案切换"
          />
          <button
            className={styles.note}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, opacity: simulatedCount >= 2 ? 1 : 0.4 }}
            onClick={() => simulatedCount >= 2 && setCompareOpen(true)}
            disabled={simulatedCount < 2}
            title={simulatedCount >= 2 ? '并排对比 A/B' : '需两个方案均已仿真'}
          >
            <GitCompareArrows size={14} aria-hidden /> 对比
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.block}>
          <div className={styles.planName}>
            {activePlan.name}
            {activePlan.kind === 'recommended' ? <span className={styles.recommend}>● 推荐</span> : null}
          </div>
          <div className={styles.approach}>{activePlan.approach}</div>
          <div className={styles.levelRow}>
            <ApprovalLevelBadge level={activePlan.approvalLevel} showDescription />
          </div>
        </div>

        {simulation ? (
          <div className={styles.block}>
            <div className={styles.blockTitle}>
              预计指标 <DemoDataBadge kind="simulated" />
            </div>
            <div className={styles.metricRow}><span className={styles.metricLabel}>恢复时间</span><span className={styles.metricValue}>{simulation.recoveryHours} h</span></div>
            <div className={styles.metricRow}><span className={styles.metricLabel}>预计能耗</span><span className={styles.metricValue}>{formatInt(simulation.energyKWh)} kWh</span></div>
            <div className={styles.metricRow}><span className={styles.metricLabel}>温度过冲风险</span><span className={styles.metricValue}>{RISK_LABEL[simulation.overshootRisk]}</span></div>
            <div className={styles.metricRow}><span className={styles.metricLabel}>冻害风险</span><span className={styles.metricValue}>{RISK_LABEL[simulation.frostRisk]}</span></div>
            <div className={styles.metricRow}><span className={styles.metricLabel}>压缩机启停</span><span className={styles.metricValue}>{simulation.compressorCycles} 次</span></div>
          </div>
        ) : (
          <div className={styles.block}>
            <div className={styles.blockTitle}>预计指标</div>
            <div className={styles.note}>运行仿真后展示恢复时间、能耗、过冲与冻害风险。</div>
          </div>
        )}

        <div className={styles.block}>
          <div className={styles.blockTitle}>控制参数（受限 · 可校验）</div>
          {activePlan.params.map((param) => (
            <div key={param.key} className={styles.paramRow}>
              <span className={styles.metricLabel}>{param.label}</span>
              <span className={styles.metricValue}>
                {param.value}{param.unit ?? ''}
                {param.bound ? <span className={styles.paramBound}>（{param.bound.min}~{param.bound.max}{param.unit ?? ''}）</span> : null}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.block}>
          <div className={styles.blockTitle}>回退条件</div>
          <div className={styles.rollbackList}>
            {activePlan.rollbackConditions.map((cond, i) => (
              <div key={i} className={styles.rollbackItem}>
                <Undo2 size={13} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-neutral-400)' }} />
                <span>{cond}</span>
              </div>
            ))}
          </div>
        </div>

        {data.approval ? (
          <div className={styles.block}>
            <div className={styles.blockTitle}>
              <ShieldCheck size={13} aria-hidden style={{ verticalAlign: -2 }} /> 安全规则校验
            </div>
            {data.approval.safetyChecks.map((check) => (
              <div key={check.key} className={styles.checkRow}>
                {check.passed ? (
                  <CheckCircle2 size={14} className={styles.checkPass} aria-hidden />
                ) : (
                  <XCircle size={14} className={styles.checkFail} aria-hidden />
                )}
                <span>{check.label}</span>
                {check.detail ? <span className={styles.paramBound}>{check.detail}</span> : null}
              </div>
            ))}
          </div>
        ) : null}

        {data.auditEntries.length > 0 ? (
          <div className={styles.block}>
            <div className={styles.blockTitle}>安全审计（L3 已被阻止）</div>
            {data.auditEntries.map((entry) => (
              <div key={entry.id} className={styles.l3Item}>
                <Ban size={14} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <b>{entry.action}</b>
                  <div>{entry.triggeredRule} · 已被安全规则引擎阻止</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <DemoControlsBar />
      </div>

      <ApprovalActionBar
        wb={wb}
        onApproveClick={() => setConfirmOpen('approve')}
        onRejectClick={() => setConfirmOpen('reject')}
      />

      <ConfirmDialog
        open={confirmOpen === 'approve'}
        title="确认批准并执行该方案？"
        confirmLabel="批准"
        onCancel={() => setConfirmOpen(null)}
        onConfirm={() => {
          setConfirmOpen(null);
          void wb.approve();
        }}
      >
        该操作为 L2 级别，将按方案「{activePlan.name}」调整目标温度 / 风机 / 阀门。批准后可在仿真环境执行。
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmOpen === 'reject'}
        title="驳回该方案？"
        confirmLabel="确认驳回"
        tone="danger"
        onCancel={() => setConfirmOpen(null)}
        onConfirm={() => {
          setConfirmOpen(null);
          void wb.reject('人工驳回：选择其他方案');
        }}
      >
        驳回后可切换方案并重新仿真。
      </ConfirmDialog>

      <SimulationCompareView wb={wb} open={compareOpen} onClose={() => setCompareOpen(false)} />
    </div>
  );
}