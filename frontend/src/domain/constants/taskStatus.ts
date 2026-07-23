import type { TaskStatus } from '../types/workbench';

interface TaskStatusMeta {
  label: string;
  /** 语义色：success / warning / danger / info / neutral / accent。 */
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';
  /** 在流程阶段推进条中的顺序（失败/回退类不参与线性顺序）。 */
  step: number;
}

export const TASK_STATUS_META: Record<TaskStatus, TaskStatusMeta> = {
  detected: { label: '待响应', tone: 'danger', step: 0 },
  diagnosing: { label: '诊断中', tone: 'accent', step: 1 },
  diagnosisCompleted: { label: '诊断完成', tone: 'accent', step: 2 },
  simulating: { label: '仿真中', tone: 'info', step: 3 },
  simulationCompleted: { label: '仿真完成', tone: 'info', step: 4 },
  awaitingApproval: { label: '待审批', tone: 'warning', step: 5 },
  approved: { label: '已批准', tone: 'warning', step: 6 },
  rejected: { label: '已驳回', tone: 'neutral', step: 6 },
  executing: { label: '执行中', tone: 'accent', step: 7 },
  verifying: { label: '验证中', tone: 'accent', step: 8 },
  recovered: { label: '已恢复', tone: 'success', step: 9 },
  diagnosisFailed: { label: '诊断失败', tone: 'danger', step: 1 },
  simulationFailed: { label: '仿真失败', tone: 'danger', step: 3 },
  executionFailed: { label: '执行失败', tone: 'danger', step: 7 },
  safeFallback: { label: '安全模式', tone: 'danger', step: 9 },
};

/** 阶段推进条主链路（线性顺序，不含失败/回退分支）。 */
export const WORKFLOW_STEPS: TaskStatus[] = [
  'detected',
  'diagnosing',
  'diagnosisCompleted',
  'simulationCompleted',
  'awaitingApproval',
  'executing',
  'verifying',
  'recovered',
];