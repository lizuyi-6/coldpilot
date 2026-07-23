import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type {
  AgentTask,
  AnomalyEventDetail,
  ApprovalRequest,
  ControlPlan,
  DiagnosisResult,
  EventReport,
  ExecutionTask,
  SecurityAuditEntry,
  SimulationResult,
} from '@/domain/types';
import { getColdPilotClient } from '@/api';
import type { ColdPilotClient } from '@/api';
import { canTransition, initialWorkbenchState, workbenchReducer } from './workbenchMachine';

/** 工作台加载的领域数据（与状态机的“阶段”分离）。 */
export interface WorkbenchData {
  eventDetail: AnomalyEventDetail | null;
  agentTask: AgentTask | null;
  diagnosis: DiagnosisResult | null;
  plans: ControlPlan[];
  simulations: Record<string, SimulationResult>;
  approval: ApprovalRequest | null;
  execution: ExecutionTask | null;
  report: EventReport | null;
  auditEntries: SecurityAuditEntry[];
}

const EMPTY_DATA: WorkbenchData = {
  eventDetail: null,
  agentTask: null,
  diagnosis: null,
  plans: [],
  simulations: {},
  approval: null,
  execution: null,
  report: null,
  auditEntries: [],
};

const POLL_INTERVAL_MS = 320;

export interface UseWorkbenchOptions {
  /** 测试可注入自定义 client；默认使用全局 mock。 */
  client?: ColdPilotClient;
  /** 测试可注入轮询间隔。 */
  pollIntervalMs?: number;
}

/**
 * 工作台编排 Hook：
 * - 用单一 useReducer 状态机管理“任务阶段”；
 * - 用 useState 管理加载的领域数据；
 * - 所有异步经 ColdPilotClient 完成并轮询，UI 不感知 mock/http。
 */
export function useWorkbench(options: UseWorkbenchOptions = {}) {
  const clientRef = useRef<ColdPilotClient>(options.client ?? getColdPilotClient());
  const client = clientRef.current;
  const pollInterval = options.pollIntervalMs ?? POLL_INTERVAL_MS;

  const [state, dispatch] = useReducer(workbenchReducer, initialWorkbenchState);
  const [data, setData] = useState<WorkbenchData>(EMPTY_DATA);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEventIdRef = useRef<string | null>(null);

  const cancelPollRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelPollRef.current?.(), []);

  const stopPolling = useCallback(() => {
    cancelPollRef.current?.();
    cancelPollRef.current = null;
  }, []);

  /** 通用轮询：直到 isDone 或取消。 */
  const poll = useCallback(
    <T,>(fetcher: () => Promise<T>, onTick: (value: T) => boolean) => {
      stopPolling();
      let cancelled = false;
      cancelPollRef.current = () => {
        cancelled = true;
      };
      const tick = async () => {
        if (cancelled) return;
        try {
          const value = await fetcher();
          const done = onTick(value);
          if (!done && !cancelled) {
            setTimeout(tick, pollInterval);
          }
        } catch {
          // 轮询失败静默重试（演示场景）。
          if (!cancelled) setTimeout(tick, pollInterval);
        }
      };
      void tick();
    },
    [pollInterval, stopPolling],
  );

  const selectEvent = useCallback(
    async (eventId: string) => {
      stopPolling();
      setSelectedEventId(eventId);
      selectedEventIdRef.current = eventId;
      dispatch({ type: 'RESET' });
      setData({ ...EMPTY_DATA });
      const [detail, auditEntries] = await Promise.all([
        client.getAnomalyEvent(eventId),
        client.listSecurityAuditEntries(eventId),
      ]);
      setData((prev) => ({ ...prev, eventDetail: detail, auditEntries }));
    },
    [client, stopPolling],
  );

  const startDiagnosis = useCallback(async () => {
    const eventId = selectedEventIdRef.current;
    if (!eventId) return;
    stopPolling();
    const task = await client.startDiagnosis(eventId);
    dispatch({ type: 'START_DIAGNOSIS', eventId, taskId: task.id });
    setData((prev) => ({ ...prev, agentTask: task }));
    poll(
      () => client.getAgentTask(task.id),
      (snapshot) => {
        setData((prev) => ({ ...prev, agentTask: snapshot }));
        if (snapshot.status === 'succeeded') {
          void (async () => {
            const [diagnosis, plans] = await Promise.all([
              client.getDiagnosisResult(task.id),
              client.listControlPlans(eventId),
            ]);
            setData((prev) => ({ ...prev, diagnosis, plans }));
            dispatch({ type: 'DIAGNOSIS_SUCCEEDED', plans });
          })();
          return true;
        }
        if (snapshot.status === 'failed') {
          dispatch({ type: 'DIAGNOSIS_FAILED', error: '诊断任务失败，请重试' });
          return true;
        }
        return false;
      },
    );
  }, [client, poll, stopPolling]);

  const simulatePlan = useCallback(
    async (planId: string) => {
      if (!canTransition(state, { type: 'RUN_SIMULATION', planId })) return;
      stopPolling();
      dispatch({ type: 'RUN_SIMULATION', planId });
      try {
        const result = await client.runSimulation(planId);
        setData((prev) => ({ ...prev, simulations: { ...prev.simulations, [planId]: result } }));
        dispatch({ type: 'SIMULATION_SUCCEEDED', planId });
      } catch {
        dispatch({ type: 'SIMULATION_FAILED', error: '仿真失败，请重试' });
      }
    },
    [client, state, stopPolling],
  );

  const requestApproval = useCallback(async () => {
    const planId = state.context.activePlanId;
    if (!planId) return;
    if (!canTransition(state, { type: 'REQUEST_APPROVAL', requestId: 'pending' })) return;
    try {
      const request = await client.requestApproval(planId);
      setData((prev) => ({ ...prev, approval: request }));
      dispatch({ type: 'REQUEST_APPROVAL', requestId: request.id });
    } catch {
      // 守卫未通过（理论上 canTransition 已拦截）。
    }
  }, [client, state]);

  const approve = useCallback(async () => {
    const request = data.approval;
    const planId = state.context.activePlanId;
    if (!request || !planId) return;
    const result = await client.submitApproval(request.id, { decision: 'approved', approverId: '冷库管理员' });
    setData((prev) => ({
      ...prev,
      approval: prev.approval ? { ...prev.approval, status: result.decision, decidedBy: result.decidedBy, decidedAt: result.decidedAt } : prev.approval,
    }));
    dispatch({ type: 'APPROVE_PLAN', planId });
  }, [client, data.approval, state.context.activePlanId]);

  const reject = useCallback(
    async (reason?: string) => {
      const request = data.approval;
      if (!request) return;
      await client.submitApproval(request.id, { decision: 'rejected', approverId: '冷库管理员', reason });
      setData((prev) => ({ ...prev, approval: prev.approval ? { ...prev.approval, status: 'rejected' } : prev.approval }));
      dispatch({ type: 'REJECT_PLAN', reason });
    },
    [client, data.approval],
  );

  const startExecution = useCallback(async () => {
    const planId = state.context.activePlanId;
    if (!planId) return;
    if (!canTransition(state, { type: 'START_EXECUTION', taskId: 'pending' })) return;
    stopPolling();
    try {
      const task = await client.startExecution(planId);
      setData((prev) => ({ ...prev, execution: task }));
      dispatch({ type: 'START_EXECUTION', taskId: task.id });
      poll(
        () => client.getExecutionTask(task.id),
        (snapshot) => {
          setData((prev) => ({ ...prev, execution: snapshot }));
          if (snapshot.status === 'verifying') {
            dispatch({ type: 'EXECUTION_SUCCEEDED' });
            return false; // 继续轮询直至终态
          }
          if (snapshot.status === 'recovered') {
            // 仿真时序下 mock 可能直接由 executing 跳到终态（跳过 verifying）。
            // 先补发 EXECUTION_SUCCEEDED（若已在 verifying 则被状态机安全忽略），再进入终态。
            dispatch({ type: 'EXECUTION_SUCCEEDED' });
            dispatch({ type: 'VERIFICATION_SUCCEEDED' });
            void client.getEventReport(selectedEventIdRef.current!).then((report) => {
              setData((prev) => ({ ...prev, report }));
            });
            return true;
          }
          if (snapshot.status === 'failed') {
            dispatch({ type: 'EXECUTION_SUCCEEDED' });
            dispatch({ type: 'VERIFICATION_FAILED', error: '执行未达预期，已回退传统规则 / PID' });
            return true;
          }
          return false;
        },
      );
    } catch {
      dispatch({ type: 'EXECUTION_FAILED', error: '执行启动失败' });
    }
  }, [client, poll, state, stopPolling]);

  const enterSafeFallback = useCallback((reason?: string) => {
    stopPolling();
    dispatch({ type: 'ENTER_SAFE_FALLBACK', reason });
  }, [stopPolling]);

  const resetDemo = useCallback(async () => {
    stopPolling();
    dispatch({ type: 'RESET' });
    setData({ ...EMPTY_DATA });
    const eventId = selectedEventIdRef.current;
    if (eventId) {
      const [detail, auditEntries] = await Promise.all([
        client.getAnomalyEvent(eventId),
        client.listSecurityAuditEntries(eventId),
      ]);
      setData((prev) => ({ ...prev, eventDetail: detail, auditEntries }));
    }
  }, [client, stopPolling]);

  return {
    state,
    status: state.status,
    context: state.context,
    data,
    selectedEventId,
    selectEvent,
    startDiagnosis,
    simulatePlan,
    requestApproval,
    approve,
    reject,
    startExecution,
    enterSafeFallback,
    resetDemo,
    canTransition: (event: Parameters<typeof canTransition>[1]) => canTransition(state, event),
  };
}

export type UseWorkbench = ReturnType<typeof useWorkbench>;