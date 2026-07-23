import type { TaskStatus } from '@/domain/types';
import type { WorkbenchContext, WorkbenchEvent, WorkbenchState } from './workbenchMachine.types';

export const initialWorkbenchContext: WorkbenchContext = {
  eventId: null,
  diagnosisTaskId: null,
  plans: [],
  activePlanId: null,
  simulatedPlanIds: [],
  approvedPlanIds: [],
  approvalRequestId: null,
  executionTaskId: null,
  error: null,
};

export const initialWorkbenchState: WorkbenchState = {
  status: 'detected',
  context: initialWorkbenchContext,
};

/** 允许发起诊断的状态。 */
const DIAGNOSABLE: TaskStatus[] = ['detected', 'diagnosisFailed', 'diagnosisCompleted'];
/** 允许发起仿真的状态（含改方案重跑、驳回后重跑）。 */
const SIMULATABLE: TaskStatus[] = ['diagnosisCompleted', 'simulationCompleted', 'simulationFailed', 'rejected', 'executionFailed'];

function withError(context: WorkbenchContext, error?: string): WorkbenchContext {
  return { ...context, error: error ?? null };
}

/**
 * 计算状态转换。非法转换返回 null（由 reducer 拒绝，保证不可能状态组合）。
 * 所有守卫集中于此，UI 用 canTransition 判断可用操作。
 */
export function transition(state: WorkbenchState, event: WorkbenchEvent): WorkbenchState | null {
  const { status, context } = state;

  // 全局事件：安全回退与重置在任何状态下都允许。
  if (event.type === 'ENTER_SAFE_FALLBACK') {
    return { status: 'safeFallback', context: withError(context, event.reason ?? '已进入安全模式，回退传统规则 / PID') };
  }
  if (event.type === 'RESET') {
    return { status: 'detected', context: { ...initialWorkbenchContext, eventId: context.eventId } };
  }

  switch (event.type) {
    case 'START_DIAGNOSIS': {
      if (!DIAGNOSABLE.includes(status)) return null;
      return {
        status: 'diagnosing',
        context: {
          ...context,
          eventId: event.eventId,
          diagnosisTaskId: event.taskId,
          error: null,
        },
      };
    }

    case 'DIAGNOSIS_SUCCEEDED': {
      if (status !== 'diagnosing') return null;
      const firstPlanId = event.plans[0]?.id ?? null;
      return {
        status: 'diagnosisCompleted',
        context: { ...context, plans: event.plans, activePlanId: firstPlanId, error: null },
      };
    }

    case 'DIAGNOSIS_FAILED': {
      if (status !== 'diagnosing') return null;
      return { status: 'diagnosisFailed', context: withError(context, event.error ?? '诊断失败') };
    }

    case 'RUN_SIMULATION': {
      if (!SIMULATABLE.includes(status)) return null;
      return {
        status: 'simulating',
        context: { ...context, activePlanId: event.planId, error: null },
      };
    }

    case 'SIMULATION_SUCCEEDED': {
      if (status !== 'simulating') return null;
      const simulated = context.simulatedPlanIds.includes(event.planId)
        ? context.simulatedPlanIds
        : [...context.simulatedPlanIds, event.planId];
      return {
        status: 'simulationCompleted',
        context: { ...context, simulatedPlanIds: simulated, error: null },
      };
    }

    case 'SIMULATION_FAILED': {
      if (status !== 'simulating') return null;
      return { status: 'simulationFailed', context: withError(context, event.error ?? '仿真失败') };
    }

    case 'REQUEST_APPROVAL': {
      // 守卫：必须先完成仿真；且当前方案必须为 L2（L3 永不进入审批）。
      if (status !== 'simulationCompleted') return null;
      const activePlan = context.plans.find((p) => p.id === context.activePlanId);
      if (!activePlan) return null;
      if (activePlan.approvalLevel !== 'L2') return null;
      if (!context.simulatedPlanIds.includes(activePlan.id)) return null;
      return {
        status: 'awaitingApproval',
        context: { ...context, approvalRequestId: event.requestId, error: null },
      };
    }

    case 'APPROVE_PLAN': {
      if (status !== 'awaitingApproval') return null;
      const approved = context.approvedPlanIds.includes(event.planId)
        ? context.approvedPlanIds
        : [...context.approvedPlanIds, event.planId];
      return {
        status: 'approved',
        context: { ...context, approvedPlanIds: approved, error: null },
      };
    }

    case 'REJECT_PLAN': {
      if (status !== 'awaitingApproval') return null;
      return { status: 'rejected', context: withError(context, event.reason ?? '方案已驳回') };
    }

    case 'START_EXECUTION': {
      // 守卫：仅已批准方案可执行。
      if (status !== 'approved') return null;
      if (!context.activePlanId || !context.approvedPlanIds.includes(context.activePlanId)) return null;
      return {
        status: 'executing',
        context: { ...context, executionTaskId: event.taskId, error: null },
      };
    }

    case 'EXECUTION_SUCCEEDED': {
      if (status !== 'executing') return null;
      return { status: 'verifying', context: { ...context, error: null } };
    }

    case 'EXECUTION_FAILED': {
      if (status !== 'executing') return null;
      return { status: 'executionFailed', context: withError(context, event.error ?? '执行失败') };
    }

    case 'VERIFICATION_SUCCEEDED': {
      if (status !== 'verifying') return null;
      return { status: 'recovered', context: { ...context, error: null } };
    }

    case 'VERIFICATION_FAILED': {
      if (status !== 'verifying') return null;
      return { status: 'executionFailed', context: withError(context, event.error ?? '验证未通过') };
    }

    default:
      return null;
  }
}

/** 状态机 reducer：非法转换直接返回原状态（不可达组合被拦截）。 */
export function workbenchReducer(state: WorkbenchState, event: WorkbenchEvent): WorkbenchState {
  return transition(state, event) ?? state;
}

/** 供 UI 判断某操作当前是否可用。 */
export function canTransition(state: WorkbenchState, event: WorkbenchEvent): boolean {
  return transition(state, event) !== null;
}