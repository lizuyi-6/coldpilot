import { Button } from '@/components/ui/Button';
import { Check, FlaskConical, Play, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { UseWorkbench } from '@/state/useWorkbench';
import styles from './approval.module.css';

interface ApprovalActionBarProps {
  wb: UseWorkbench;
  onApproveClick: () => void;
  onRejectClick: () => void;
}

/**
 * 操作区状态机：按任务阶段渲染可用操作。
 * L2 → “批准”需二次确认；L3 永不出现执行/审批入口。
 */
export function ApprovalActionBar({ wb, onApproveClick, onRejectClick }: ApprovalActionBarProps) {
  const { status, context } = wb;
  const activePlanId = context.activePlanId;

  switch (status) {
    case 'diagnosisCompleted':
    case 'rejected':
    case 'executionFailed':
      return (
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => activePlanId && void wb.simulatePlan(activePlanId)}>
            <FlaskConical size={15} aria-hidden />
            {status === 'rejected' ? '重新仿真' : status === 'executionFailed' ? '重新仿真（复诊）' : '运行仿真'}
          </Button>
          <div className={styles.note}>
            {status === 'rejected' ? '方案已驳回，可切换方案后重新仿真' : '对方案运行仿真以查看预计影响'}
          </div>
        </div>
      );

    case 'simulating':
      return (
        <div className={styles.actions}>
          <Button variant="primary" disabled>仿真中…</Button>
        </div>
      );

    case 'simulationFailed':
      return (
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => activePlanId && void wb.simulatePlan(activePlanId)}>
            重试仿真
          </Button>
          <div className={styles.note}>仿真失败，可重试</div>
        </div>
      );

    case 'simulationCompleted':
      return (
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => void wb.requestApproval()}>
            <Check size={15} aria-hidden /> 请求审批（L2）
          </Button>
          <div className={styles.note}>已完成仿真与安全校验，提交人工确认</div>
        </div>
      );

    case 'awaitingApproval':
      return (
        <div className={styles.actions}>
          <div className={styles.actionRow}>
            <Button variant="secondary" onClick={onRejectClick}>
              <ThumbsDown size={15} aria-hidden /> 驳回
            </Button>
            <Button variant="primary" onClick={onApproveClick}>
              <ThumbsUp size={15} aria-hidden /> 批准
            </Button>
          </div>
          <div className={styles.note}>L2 操作：批准后方可执行</div>
        </div>
      );

    case 'approved':
      return (
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => void wb.startExecution()}>
            <Play size={15} aria-hidden /> 开始执行（仿真）
          </Button>
          <div className={styles.note}>已批准，可在仿真环境执行并持续验证</div>
        </div>
      );

    case 'executing':
      return (
        <div className={styles.actions}>
          <Button variant="primary" disabled>执行中…</Button>
          <div className={styles.note}>正在按方案调节并观察响应</div>
        </div>
      );

    case 'verifying':
      return (
        <div className={styles.actions}>
          <Button variant="primary" disabled>验证中…</Button>
          <div className={styles.note}>持续验证是否恢复至目标区间</div>
        </div>
      );

    case 'recovered':
      return (
        <div className={styles.actions}>
          <div className={styles.note}>已恢复，事件报告已生成</div>
        </div>
      );

    default:
      return (
        <div className={styles.actions}>
          <div className={styles.note}>请先开始诊断以生成候选方案</div>
        </div>
      );
  }
}