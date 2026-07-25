import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MockColdPilotClient } from '@/api/mockColdPilotClient';
import { ANOMALY_EVENTS } from '@/mocks';
import { useAgentCenter } from '@/features/agentHome/useAgentCenter';
import {
  causeViews,
  computePhases,
  judgmentOf,
  securityLevelRows,
  subStatusOf,
} from '@/features/agentHome/agentHomeView';
import { DIAGNOSIS_RESULT } from '@/mocks';

/** 零时序 mock，保证自动驱动流程确定性。 */
function makeClient() {
  return new MockColdPilotClient({ latencyMs: 0, diagnosisMs: 0, executionMs: 0, verificationMs: 0 });
}

const EVT_1 = ANOMALY_EVENTS.find((e) => e.id === 'evt-1')!;
const EVT_3 = ANOMALY_EVENTS.find((e) => e.id === 'evt-3')!;

function setup(event = EVT_1) {
  const client = makeClient();
  const utils = renderHook(() => useAgentCenter(event, { client, taskPollMs: 0, detailPollMs: 60_000 }));
  return { client, ...utils };
}

describe('首页 Agent 自主控制中心（mock · 零时序）', () => {
  it('无用户输入时自动推进：检测→诊断→仿真→安全校验→等待人工审批', async () => {
    const { result } = setup();

    // 诊断完成不停滞：自动继续仿真与安全校验，直至 L2 等待人工（非人工提问触发）。
    await waitFor(() => expect(result.current.stage).toBe('awaitingApproval'), { timeout: 4000 });

    expect(result.current.data.diagnosis?.causes.length).toBe(4);
    expect(result.current.data.plans.length).toBeGreaterThan(0);
    expect(Object.keys(result.current.data.simulations).length).toBeGreaterThan(0);
    expect(result.current.data.approval?.status).toBe('pending');
    expect(result.current.data.approval?.level).toBe('L2');
    // L3 审计留痕真实加载（evt-1 种子含 1 条 L3 拦截）。
    expect(result.current.data.auditEntries.length).toBeGreaterThan(0);
  });

  it('批准后自动下发执行并轮询验证，验证通过才判定恢复', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.stage).toBe('awaitingApproval'), { timeout: 4000 });

    await act(async () => {
      await result.current.approveAndExecute();
    });
    // 状态流转必须 executing → verifying → recovered。
    await waitFor(() => expect(result.current.stage).toBe('recovered'), { timeout: 4000 });
    expect(result.current.reachedRecovered).toBe(true);
    expect(result.current.data.execution?.status).toBe('recovered');
    expect(result.current.data.execution?.recoveryMinutes).toBeGreaterThan(0);
    expect(result.current.data.report?.eventId).toBe('evt-1');
  });

  it('驳回后不下发任何控制命令，可重新仿真回到待审批', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.stage).toBe('awaitingApproval'), { timeout: 4000 });

    await act(async () => {
      await result.current.rejectPlan('人工驳回：测试');
    });
    expect(result.current.stage).toBe('rejected');
    expect(result.current.data.execution).toBeNull();

    act(() => {
      result.current.resimulate();
    });
    await waitFor(() => expect(result.current.stage).toBe('awaitingApproval'), { timeout: 4000 });
    expect(result.current.data.approval?.status).toBe('pending');
  });

  it('已恢复事件默认进入持续监测，而非重复展示任务链', () => {
    const { result } = setup(EVT_3);
    expect(result.current.stage).toBe('recovered');
    expect(result.current.reachedRecovered).toBe(false);
  });
});

describe('Agent 自主控制中心 ViewModel', () => {
  it('副状态：不再以「已完成分析」为终态', () => {
    expect(subStatusOf('monitoring').label).toBe('持续监测中');
    expect(subStatusOf('diagnosing').label).toBe('正在诊断');
    expect(subStatusOf('awaitingApproval').label).toBe('等待人工审批');
    expect(subStatusOf('executing').label).toBe('正在执行');
    expect(subStatusOf('verifying').label).toBe('正在验证');
    expect(subStatusOf('recovered').label).toBe('已恢复');
    expect(subStatusOf('safeFallback').label).toBe('已进入安全回退');
    expect(subStatusOf('executionFailed').label).toBe('任务失败');
  });

  it('任务链：监测态全部等待；诊断完成后继续进入方案 / 仿真 / 审批', () => {
    const monitoringPhases = computePhases({
      stage: 'monitoring',
      event: undefined,
      task: null,
      diagnosis: null,
      plans: [],
      simulations: {},
      approval: null,
      execution: null,
      observedAt: {},
    });
    expect(monitoringPhases).toHaveLength(8);
    expect(monitoringPhases.every((phase) => phase.status === 'waiting')).toBe(true);

    const donePhases = computePhases({
      stage: 'recovered',
      event: EVT_1,
      task: null,
      diagnosis: null,
      plans: [],
      simulations: {},
      approval: null,
      execution: null,
      observedAt: {},
    });
    expect(donePhases.find((p) => p.key === 'verify')?.status).toBe('done');
  });

  it('诊断判断文案：强调系统主动发现，而非用户提问触发', () => {
    const text = judgmentOf({
      stage: 'detected',
      event: EVT_1,
      task: null,
      diagnosis: null,
      plans: [],
      simulations: {},
      approval: null,
      execution: null,
      observedAt: {},
    });
    expect(text).toContain('主动发现');
    expect(text).toContain('自动启动');
  });

  it('原因视图：包含置信度、正 / 反证据与现场确认标记', () => {
    const causes = causeViews(DIAGNOSIS_RESULT);
    expect(causes.length).toBeGreaterThan(0);
    expect(causes[0].confidencePct).toBeGreaterThan(0);
    expect(causes[0].evidence.length).toBeGreaterThan(0);
    // 置信度降序。
    for (let i = 1; i < causes.length; i += 1) {
      expect(causes[i - 1].confidencePct).toBeGreaterThanOrEqual(causes[i].confidencePct);
    }
  });

  it('四级安全边界：L0/L1 自动执行、L2 需人工、L3 永久阻止且无绕过入口', () => {
    const levels = securityLevelRows({ toolsDone: 5, simDone: true, approval: null, stage: 'awaitingApproval', l3Blocked: 1 });
    expect(levels).toHaveLength(4);
    expect(levels[0]).toMatchObject({ level: 'L0', state: 'auto-done' });
    expect(levels[1]).toMatchObject({ level: 'L1', state: 'auto-done' });
    expect(levels[2]).toMatchObject({ level: 'L2', state: 'need-human' });
    expect(levels[3]).toMatchObject({ level: 'L3', state: 'blocked' });
    expect(levels[3].note).toContain('永久阻止');
    expect(levels[3].note).toContain('不提供');
  });
});
