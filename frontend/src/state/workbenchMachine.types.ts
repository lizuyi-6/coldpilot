import type { ControlPlan, TaskStatus } from '@/domain/types';

/** 状态机上下文：只放流程所需的引用与集合，不放业务数据本体。 */
export interface WorkbenchContext {
  /** 当前选中的异常事件。 */
  eventId: string | null;
  /** 诊断任务句柄。 */
  diagnosisTaskId: string | null;
  /** 候选方案（诊断完成后加载）。 */
  plans: ControlPlan[];
  /** 当前选中的方案。 */
  activePlanId: string | null;
  /** 已完成仿真的方案集合。 */
  simulatedPlanIds: string[];
  /** 已批准的方案集合。 */
  approvedPlanIds: string[];
  /** 审批请求句柄。 */
  approvalRequestId: string | null;
  /** 执行任务句柄。 */
  executionTaskId: string | null;
  /** 最近一次失败原因。 */
  error: string | null;
}

export interface WorkbenchState {
  status: TaskStatus;
  context: WorkbenchContext;
}

export type WorkbenchEvent =
  | { type: 'START_DIAGNOSIS'; eventId: string; taskId: string }
  | { type: 'DIAGNOSIS_SUCCEEDED'; plans: ControlPlan[] }
  | { type: 'DIAGNOSIS_FAILED'; error?: string }
  | { type: 'RUN_SIMULATION'; planId: string }
  | { type: 'SIMULATION_SUCCEEDED'; planId: string }
  | { type: 'SIMULATION_FAILED'; error?: string }
  | { type: 'REQUEST_APPROVAL'; requestId: string }
  | { type: 'APPROVE_PLAN'; planId: string }
  | { type: 'REJECT_PLAN'; reason?: string }
  | { type: 'START_EXECUTION'; taskId: string }
  | { type: 'EXECUTION_SUCCEEDED' }
  | { type: 'EXECUTION_FAILED'; error?: string }
  | { type: 'VERIFICATION_SUCCEEDED' }
  | { type: 'VERIFICATION_FAILED'; error?: string }
  | { type: 'ENTER_SAFE_FALLBACK'; reason?: string }
  | { type: 'RESET' };