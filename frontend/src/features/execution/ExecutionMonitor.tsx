import { InlineAlert } from '@/components/ui/InlineAlert';
import { Button } from '@/components/ui/Button';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { Activity, ShieldAlert } from 'lucide-react';
import type { UseWorkbench } from '@/state/useWorkbench';
import { formatDuration } from '@/utils/formatTime';
import styles from '../diagnosis/diagnosis.module.css';

/** 执行监视：执行中 / 验证中 / 执行失败的状态与处置。 */
export function ExecutionMonitor({ wb }: { wb: UseWorkbench }) {
  const { data, status } = wb;
  const execution = data.execution;

  if (status === 'executing' || status === 'verifying') {
    return (
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <span className={styles.sectionHeading}>
            <Activity size={15} aria-hidden /> {status === 'executing' ? '执行中' : '验证中'}
          </span>
          <DemoDataBadge kind="simulated" />
        </div>
        <InlineAlert tone="info">
          {status === 'executing'
            ? '正在按方案调节并观察环境与设备响应，观测曲线见上方趋势图。'
            : '持续验证温度是否恢复至目标区间，验证成功后将自动标记恢复。'}
        </InlineAlert>
      </section>
    );
  }

  if (status === 'executionFailed') {
    return (
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <span className={styles.sectionHeading}>执行失败</span>
          <DemoDataBadge kind="simulated" />
        </div>
        <InlineAlert tone="danger" title="执行未达预期">
          {execution?.triggeredRollback ?? wb.context.error ?? '执行偏差超限。'}
        </InlineAlert>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button variant="secondary" onClick={() => wb.enterSafeFallback('执行失败后人工进入安全模式')}>
            <ShieldAlert size={15} aria-hidden /> 进入安全模式
          </Button>
          <Button variant="primary" onClick={() => wb.context.activePlanId && void wb.simulatePlan(wb.context.activePlanId)}>
            重新仿真（复诊）
          </Button>
        </div>
      </section>
    );
  }

  if (status === 'recovered' && execution) {
    return (
      <section className={styles.section}>
        <InlineAlert tone="success" title="已恢复">
          温度已恢复至目标区间
          {execution.recoveryMinutes !== undefined ? `，恢复用时约 ${formatDuration(execution.recoveryMinutes)}` : ''}
          ，未发生过冲与冻害（仿真结果）。
        </InlineAlert>
      </section>
    );
  }

  return null;
}