import { useState } from 'react';
import { CheckCircle2, ListTree } from 'lucide-react';
import type { ControlPlan, SimulationResult } from '@/domain/types';
import { riskLevelLabel } from '@/domain/viewModels';
import type { UseWorkbench } from '@/state/useWorkbench';
import { ApprovalActionBar } from '@/features/approval/ApprovalActionBar';
import { ApprovalLevelBadge } from '@/components/domain/ApprovalLevelBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { recommendationReason } from './strategyView';
import styles from './strategy.module.css';

interface StrategyApprovalPanelProps {
  wb: UseWorkbench;
  plans: ControlPlan[];
  simulations: Record<string, SimulationResult>;
}

/**
 * 策略审批（L2）：推荐方案 + 审批人 + 审批意见 + 状态机驱动的操作区。
 * 批准/驳回仅在 awaitingApproval 状态出现（ApprovalActionBar）；审批意见随驳回提交留痕。
 */
export function StrategyApprovalPanel({ wb, plans, simulations }: StrategyApprovalPanelProps) {
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState<'approve' | 'reject' | null>(null);
  const [flowOpen, setFlowOpen] = useState(false);

  const recommended = plans.find((plan) => plan.kind === 'recommended') ?? plans[0] ?? null;
  const recommendedSimulation = recommended ? simulations[recommended.id] ?? null : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {recommended ? (
        <div className={styles.recommendBox}>
          <div className={styles.recommendBoxTitle}>
            <CheckCircle2 size={15} aria-hidden />
            推荐执行方案：{recommended.name}
          </div>
          <div className={styles.recommendBoxReason}>
            {recommendationReason(recommended, recommendedSimulation, riskLevelLabel)}
          </div>
        </div>
      ) : null}

      <div className={styles.approverRow}>
        <span className={styles.approverAvatar} aria-hidden>管</span>
        <span>
          当前审批人：<b>冷库管理员</b>（<ApprovalLevelBadge level="L2" />）
        </span>
        <span style={{ flex: 1 }} />
        <button className={styles.flowLink} onClick={() => setFlowOpen(true)}>
          <ListTree size={13} aria-hidden /> 审批流程
        </button>
      </div>

      <textarea
        className={styles.reasonInput}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="审批意见（可选；驳回时将随决定留痕）"
        aria-label="审批意见"
      />

      <ApprovalActionBar
        wb={wb}
        onApproveClick={() => setConfirmOpen('approve')}
        onRejectClick={() => setConfirmOpen('reject')}
      />

      <ConfirmDialog
        open={confirmOpen === 'approve'}
        title="确认批准并下发该方案？"
        confirmLabel="批准并下发"
        onCancel={() => setConfirmOpen(null)}
        onConfirm={() => {
          setConfirmOpen(null);
          void wb.approve();
        }}
      >
        该操作为 L2 级别，批准后可在仿真环境执行。方案版本变化将使本次审批自动失效。
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmOpen === 'reject'}
        title="驳回该方案？"
        confirmLabel="确认驳回"
        tone="danger"
        onCancel={() => setConfirmOpen(null)}
        onConfirm={() => {
          setConfirmOpen(null);
          void wb.reject(reason.trim() || '人工驳回：选择其他方案');
          setReason('');
        }}
      >
        驳回后可切换方案并重新仿真{reason.trim() ? `。驳回理由：${reason.trim()}` : '。'}
      </ConfirmDialog>

      <Dialog open={flowOpen} onClose={() => setFlowOpen(false)} title="L2 审批流程">
        <ol className={styles.flowSteps}>
          <li>诊断完成 → 生成候选控制方案（均为 L2，L3 动作不出现在方案中）。</li>
          <li>运行仿真 → 得到恢复时间 / 能耗 / 过冲 / 冻害风险（预测值，非真实成效）。</li>
          <li>请求审批 → 后端执行安全规则校验（白名单 / 上下限 / 变化率 / 冲突 / 权限）。</li>
          <li>人工批准或驳回（全程留痕）；方案版本变化后旧审批自动失效。</li>
          <li>批准后方可在仿真环境执行，执行结果持续验证直至恢复。</li>
        </ol>
      </Dialog>
    </div>
  );
}
