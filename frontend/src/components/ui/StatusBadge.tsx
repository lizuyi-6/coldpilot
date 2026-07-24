import type { TaskStatus } from '@/domain/types';
import { TASK_STATUS_META } from '@/domain/constants/taskStatus';
import {
  AlertCircle,
  CheckCircle2,
  Hourglass,
  Loader2,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './StatusBadge.module.css';

const STATUS_ICON: Record<TaskStatus, LucideIcon> = {
  detected: AlertCircle,
  diagnosing: Loader2,
  diagnosisCompleted: CheckCircle2,
  simulating: Loader2,
  simulationCompleted: CheckCircle2,
  awaitingApproval: Hourglass,
  approved: CheckCircle2,
  rejected: PauseCircle,
  executing: PlayCircle,
  verifying: Loader2,
  recovered: CheckCircle2,
  diagnosisFailed: XCircle,
  simulationFailed: XCircle,
  executionFailed: XCircle,
  safeFallback: ShieldAlert,
};

const SPINNING: TaskStatus[] = ['diagnosing', 'simulating', 'verifying'];

/** 状态徽标：颜色 + 图标 + 文字三重编码，不只依赖颜色。 */
export function StatusBadge({ status, size = 'md' }: { status: TaskStatus; size?: 'sm' | 'md' }) {
  const meta = TASK_STATUS_META[status];
  const Icon = STATUS_ICON[status];
  const spinning = SPINNING.includes(status);
  return (
    <span className={`${styles.badge} ${styles[meta.tone]} ${styles[size]}`} data-status={status}>
      <Icon size={size === 'sm' ? 12 : 14} className={spinning ? styles.spin : undefined} aria-hidden />
      <span>{meta.label}</span>
    </span>
  );
}