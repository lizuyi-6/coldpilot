import type { TaskStatus } from '@/domain/types';
import { TASK_STATUS_META, WORKFLOW_STEPS } from '@/domain/constants/taskStatus';
import { Check } from 'lucide-react';
import styles from './ProgressStepper.module.css';

/** 流程阶段推进条：显示任务闭环进度（失败/回退类由状态徽章单独表达）。 */
export function ProgressStepper({ status }: { status: TaskStatus }) {
  const currentStep = TASK_STATUS_META[status].step;
  return (
    <ol className={styles.steps} aria-label="任务进度">
      {WORKFLOW_STEPS.map((step) => {
        const stepIndex = TASK_STATUS_META[step].step;
        const done = stepIndex < currentStep;
        const active = stepIndex === currentStep;
        const cls = done ? styles.done : active ? styles.active : styles.todo;
        return (
          <li key={step} className={`${styles.step} ${cls}`} aria-current={active ? 'step' : undefined}>
            <span className={styles.dot}>{done ? <Check size={11} aria-hidden /> : null}</span>
            <span className={styles.label}>{TASK_STATUS_META[step].label}</span>
          </li>
        );
      })}
    </ol>
  );
}