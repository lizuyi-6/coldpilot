import { describe, expect, it } from 'vitest';
import type { ControlPlan } from '@/domain/types';
import {
  canTransition,
  initialWorkbenchState,
  transition,
  workbenchReducer,
} from '@/state/workbenchMachine';
import type { WorkbenchState } from '@/state/workbenchMachine.types';

const PLAN_A: ControlPlan = {
  id: 'plan-a',
  eventId: 'evt-1',
  name: '方案 A',
  kind: 'recommended',
  approvalLevel: 'L2',
  approach: '平滑逼近',
  params: [],
  rollbackConditions: [],
  version: 1,
};

function at(status: WorkbenchState['status'], overrides: Partial<WorkbenchState['context']> = {}): WorkbenchState {
  return {
    status,
    context: { ...initialWorkbenchState.context, eventId: 'evt-1', ...overrides },
  };
}

function startDiagnosis(state: WorkbenchState) {
  return workbenchReducer(state, { type: 'START_DIAGNOSIS', eventId: 'evt-1', taskId: 'task-1' });
}

describe('workbenchMachine · 主链路', () => {
  it('走通 detected → … → recovered', () => {
    let s = initialWorkbenchState;
    expect(s.status).toBe('detected');

    s = startDiagnosis(s);
    expect(s.status).toBe('diagnosing');
    expect(s.context.diagnosisTaskId).toBe('task-1');

    s = workbenchReducer(s, { type: 'DIAGNOSIS_SUCCEEDED', plans: [PLAN_A] });
    expect(s.status).toBe('diagnosisCompleted');
    expect(s.context.activePlanId).toBe('plan-a');

    s = workbenchReducer(s, { type: 'RUN_SIMULATION', planId: 'plan-a' });
    expect(s.status).toBe('simulating');

    s = workbenchReducer(s, { type: 'SIMULATION_SUCCEEDED', planId: 'plan-a' });
    expect(s.status).toBe('simulationCompleted');
    expect(s.context.simulatedPlanIds).toContain('plan-a');

    s = workbenchReducer(s, { type: 'REQUEST_APPROVAL', requestId: 'apr-1' });
    expect(s.status).toBe('awaitingApproval');

    s = workbenchReducer(s, { type: 'APPROVE_PLAN', planId: 'plan-a' });
    expect(s.status).toBe('approved');
    expect(s.context.approvedPlanIds).toContain('plan-a');

    s = workbenchReducer(s, { type: 'START_EXECUTION', taskId: 'exec-1' });
    expect(s.status).toBe('executing');

    s = workbenchReducer(s, { type: 'EXECUTION_SUCCEEDED' });
    expect(s.status).toBe('verifying');

    s = workbenchReducer(s, { type: 'VERIFICATION_SUCCEEDED' });
    expect(s.status).toBe('recovered');
  });

  it('支持驳回后切换方案重新仿真', () => {
    let s = at('awaitingApproval', { activePlanId: 'plan-a', simulatedPlanIds: ['plan-a'], plans: [PLAN_A] });
    s = workbenchReducer(s, { type: 'REJECT_PLAN', reason: '风险过高' });
    expect(s.status).toBe('rejected');
    s = workbenchReducer(s, { type: 'RUN_SIMULATION', planId: 'plan-a' });
    expect(s.status).toBe('simulating');
  });

  it('执行失败可进入安全回退', () => {
    let s = at('executing', { activePlanId: 'plan-a', approvedPlanIds: ['plan-a'] });
    s = workbenchReducer(s, { type: 'EXECUTION_FAILED', error: '偏差超限' });
    expect(s.status).toBe('executionFailed');
    s = workbenchReducer(s, { type: 'ENTER_SAFE_FALLBACK' });
    expect(s.status).toBe('safeFallback');
  });
});

describe('workbenchMachine · 非法组合被守卫拦截', () => {
  it('未仿真不得进入审批', () => {
    const s = at('simulationCompleted', { activePlanId: 'plan-a', simulatedPlanIds: [], plans: [PLAN_A] });
    expect(transition(s, { type: 'REQUEST_APPROVAL', requestId: 'apr-1' })).toBeNull();
    expect(canTransition(s, { type: 'REQUEST_APPROVAL', requestId: 'apr-1' })).toBe(false);
  });

  it('诊断完成但未仿真不得直接请求审批', () => {
    const s = at('diagnosisCompleted', { activePlanId: 'plan-a', plans: [PLAN_A] });
    expect(transition(s, { type: 'REQUEST_APPROVAL', requestId: 'apr-1' })).toBeNull();
  });

  it('未批准不得开始执行', () => {
    const s = at('awaitingApproval', { activePlanId: 'plan-a', simulatedPlanIds: ['plan-a'], plans: [PLAN_A] });
    expect(transition(s, { type: 'START_EXECUTION', taskId: 'exec-1' })).toBeNull();
  });

  it('仅批准的方案可执行（切换未批准方案后不得执行）', () => {
    const s = at('approved', { activePlanId: 'plan-b', approvedPlanIds: ['plan-a'], plans: [PLAN_A] });
    expect(transition(s, { type: 'START_EXECUTION', taskId: 'exec-1' })).toBeNull();
  });

  it('执行失败不得直接标记恢复', () => {
    const s = at('executionFailed');
    expect(transition(s, { type: 'VERIFICATION_SUCCEEDED' })).toBeNull();
    const s2 = workbenchReducer(s, { type: 'VERIFICATION_SUCCEEDED' });
    expect(s2.status).toBe('executionFailed');
  });

  it('验证失败不得标记恢复', () => {
    const s = at('verifying');
    expect(transition(s, { type: 'VERIFICATION_FAILED', error: '未达标' })?.status).toBe('executionFailed');
  });

  it('非法转换在 reducer 中为空操作', () => {
    const s = at('detected');
    const next = workbenchReducer(s, { type: 'APPROVE_PLAN', planId: 'plan-a' });
    expect(next).toBe(s);
  });
});

describe('workbenchMachine · 安全回退与重置', () => {
  it('任意状态可进入安全回退', () => {
    const s = at('executing', { activePlanId: 'plan-a', approvedPlanIds: ['plan-a'] });
    const next = workbenchReducer(s, { type: 'ENTER_SAFE_FALLBACK', reason: '断网' });
    expect(next.status).toBe('safeFallback');
    expect(next.context.error).toBe('断网');
  });

  it('重置回到 detected 并清空流程上下文', () => {
    const s = at('recovered', { activePlanId: 'plan-a', approvedPlanIds: ['plan-a'], simulatedPlanIds: ['plan-a'] });
    const next = workbenchReducer(s, { type: 'RESET' });
    expect(next.status).toBe('detected');
    expect(next.context.activePlanId).toBeNull();
    expect(next.context.simulatedPlanIds).toEqual([]);
    expect(next.context.eventId).toBe('evt-1');
  });
});