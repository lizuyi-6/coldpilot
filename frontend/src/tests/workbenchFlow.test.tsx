import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MockColdPilotClient } from '@/api/mockColdPilotClient';
import { useWorkbench } from '@/state/useWorkbench';

/** 零时序 mock，保证流程测试确定性。 */
function makeClient() {
  return new MockColdPilotClient({ latencyMs: 0, diagnosisMs: 0, executionMs: 0, verificationMs: 0 });
}

function setup() {
  const client = makeClient();
  const utils = renderHook(() => useWorkbench({ client, pollIntervalMs: 0 }));
  return { client, ...utils };
}

describe('workbench 流程集成（mock · 零时序）', () => {
  it('走通 检测→诊断→仿真→审批→执行→验证→恢复 全链路', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.selectEvent('evt-1');
    });
    expect(result.current.status).toBe('detected');
    expect(result.current.data.eventDetail?.id).toBe('evt-1');
    expect(result.current.data.auditEntries.length).toBeGreaterThan(0);

    await act(async () => {
      await result.current.startDiagnosis();
    });
    await waitFor(() => expect(result.current.status).toBe('diagnosisCompleted'));
    expect(result.current.data.diagnosis?.causes.length).toBe(4);
    expect(result.current.context.activePlanId).toBe('plan-a');

    await act(async () => {
      await result.current.simulatePlan('plan-a');
    });
    expect(result.current.status).toBe('simulationCompleted');
    expect(result.current.data.simulations['plan-a'].recoveryHours).toBeCloseTo(6.2);

    // 仿真第二个方案后可用于对比。
    await act(async () => {
      await result.current.simulatePlan('plan-b');
    });
    expect(result.current.context.simulatedPlanIds).toEqual(expect.arrayContaining(['plan-a', 'plan-b']));

    // 切回推荐方案 A 并请求审批。
    await act(async () => {
      await result.current.simulatePlan('plan-a');
    });
    await act(async () => {
      await result.current.requestApproval();
    });
    expect(result.current.status).toBe('awaitingApproval');
    expect(result.current.data.approval?.safetyChecks.every((c) => c.passed)).toBe(true);

    await act(async () => {
      await result.current.approve();
    });
    expect(result.current.status).toBe('approved');

    await act(async () => {
      await result.current.startExecution();
    });
    await waitFor(() => expect(result.current.status).toBe('recovered'));
    expect(result.current.data.report?.eventId).toBe('evt-1');
  });

  it('守卫：未仿真不得请求审批', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.selectEvent('evt-1');
      await result.current.startDiagnosis();
    });
    await waitFor(() => expect(result.current.status).toBe('diagnosisCompleted'));

    // 诊断完成但未仿真，requestApproval 应被拦截（状态不变）。
    await act(async () => {
      await result.current.requestApproval();
    });
    expect(result.current.status).toBe('diagnosisCompleted');
  });

  it('守卫：未批准不得执行', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.selectEvent('evt-1');
      await result.current.startDiagnosis();
    });
    await waitFor(() => expect(result.current.status).toBe('diagnosisCompleted'));
    await act(async () => {
      await result.current.startExecution();
    });
    expect(result.current.status).toBe('diagnosisCompleted');
  });

  it('失败注入：诊断失败后重试成功', async () => {
    const { result, client } = setup();
    await act(async () => {
      await result.current.selectEvent('evt-1');
    });
    client.armFailureOnce('diagnosis');
    await act(async () => {
      await result.current.startDiagnosis();
    });
    await waitFor(() => expect(result.current.status).toBe('diagnosisFailed'));

    await act(async () => {
      await result.current.startDiagnosis();
    });
    await waitFor(() => expect(result.current.status).toBe('diagnosisCompleted'));
  });

  it('执行失败进入 executionFailed，可进入安全回退', async () => {
    const { result, client } = setup();
    await act(async () => {
      await result.current.selectEvent('evt-1');
      await result.current.startDiagnosis();
    });
    await waitFor(() => expect(result.current.status).toBe('diagnosisCompleted'));
    await act(async () => {
      await result.current.simulatePlan('plan-a');
    });
    await act(async () => {
      await result.current.requestApproval();
    });
    await act(async () => {
      await result.current.approve();
    });
    expect(result.current.status).toBe('approved');

    client.armFailureOnce('execution');
    await act(async () => {
      await result.current.startExecution();
    });
    await waitFor(() => expect(result.current.status).toBe('executionFailed'));

    act(() => {
      result.current.enterSafeFallback('执行失败后进入安全模式');
    });
    expect(result.current.status).toBe('safeFallback');
  });

  it('重置回到 detected', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.selectEvent('evt-1');
      await result.current.startDiagnosis();
    });
    await waitFor(() => expect(result.current.status).toBe('diagnosisCompleted'));
    await act(async () => {
      await result.current.resetDemo();
    });
    expect(result.current.status).toBe('detected');
    expect(result.current.data.eventDetail?.id).toBe('evt-1');
  });
});