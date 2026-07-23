import { SeverityTag } from '@/components/ui/SeverityTag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProgressStepper } from '@/components/ui/ProgressStepper';
import { Button } from '@/components/ui/Button';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { RotateCcw, ShieldAlert, Stethoscope } from 'lucide-react';
import type { UseWorkbench } from '@/state/useWorkbench';
import { formatDuration } from '@/utils/formatTime';
import styles from './diagnosis.module.css';

/** 中栏头部：事件标题、当前值 vs 目标区间、进度、主操作与演示控制。 */
export function EventHeader({ wb }: { wb: UseWorkbench }) {
  const { data, status } = wb;
  const detail = data.eventDetail;
  if (!detail) return null;

  const tempSeries = detail.telemetry.find((s) => s.metric === 'temperature');
  const currentTemp = tempSeries?.points[tempSeries.points.length - 1]?.value;
  const target = detail.room.targetRange;
  const exceed = currentTemp !== undefined && currentTemp > target.max ? currentTemp - target.max : 0;

  const canDiagnose = wb.canTransition({ type: 'START_DIAGNOSIS', eventId: detail.id, taskId: 'x' });
  const diagnosing = status === 'diagnosing';

  return (
    <div className={styles.header}>
      <div className={styles.headerTop}>
        <div>
          <div className={styles.headerTitle}>
            <h1 className={styles.eventTitle}>{detail.roomName} · {detail.title}</h1>
            <SeverityTag severity={detail.severity} />
            <StatusBadge status={status} />
            <DemoDataBadge kind="demo" />
          </div>
          <div className={styles.currentRow}>
            {currentTemp !== undefined ? (
              <span className={styles.currentValue}>{currentTemp.toFixed(1)}℃</span>
            ) : null}
            <span className={styles.targetRange}>目标 {target.min}~{target.max}{target.unit}</span>
            {exceed > 0 ? (
              <span className={styles.exceed}>越界 +{exceed.toFixed(1)}℃ · 持续{formatDuration(detail.durationMinutes)}</span>
            ) : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {canDiagnose && (
            <Button variant="primary" onClick={() => void wb.startDiagnosis()} disabled={diagnosing}>
              <Stethoscope size={15} aria-hidden /> {status === 'diagnosisFailed' ? '重新诊断' : '开始诊断'}
            </Button>
          )}
          <Button variant="ghost" size="sm" title="重置演示" onClick={() => void wb.resetDemo()}>
            <RotateCcw size={14} aria-hidden /> 重置
          </Button>
          <Button variant="ghost" size="sm" title="进入安全模式（演示）" onClick={() => wb.enterSafeFallback('手动触发安全模式')}>
            <ShieldAlert size={14} aria-hidden /> 安全模式
          </Button>
        </div>
      </div>
      <div className={styles.stepperRow}>
        <ProgressStepper status={status} />
      </div>
    </div>
  );
}