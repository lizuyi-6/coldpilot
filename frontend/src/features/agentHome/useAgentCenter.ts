import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentTask,
  AnomalyEventDetail,
  AnomalyEventSummary,
  ApprovalRequest,
  ControlPlan,
  DiagnosisResult,
  EventReport,
  ExecutionTask,
  SecurityAuditEntry,
  SimulationResult,
  TaskStatus,
} from '@/domain/types';
import { getColdPilotClient } from '@/api';
import type { ColdPilotClient } from '@/api';
import type { HomeStage, PhaseObservedAt } from './agentHomeView';

/**
 * 首页「Agent 自主控制中心」编排 Hook。
 *
 * 与诊断工作台共用同一组 ColdPilotClient 契约接口与后端事件状态机：
 * - 异常事件由后端 stage 驱动，本 Hook 作为「自动巡航」在首页无输入时持续推进：
 *   检测 → 诊断 → 仿真 → 安全校验 → 请求审批，然后在 L2 处停下等待人工；
 * - 人工批准后立即自动下发执行并轮询验证，直至 recovered / failed；
 * - 审批 / 执行在其他页面完成时，通过事件详情轮询对账（只前进了了，不回退）。
 * 不修改 workbench 状态机，不伪造任何执行成功。
 */

export interface AgentCenterData {
  detail: AnomalyEventDetail | null;
  task: AgentTask | null;
  diagnosis: DiagnosisResult | null;
  plans: ControlPlan[];
  simulations: Record<string, SimulationResult>;
  approval: ApprovalRequest | null;
  execution: ExecutionTask | null;
  report: EventReport | null;
  auditEntries: SecurityAuditEntry[];
  observedAt: PhaseObservedAt;
}

const EMPTY_DATA: AgentCenterData = {
  detail: null,
  task: null,
  diagnosis: null,
  plans: [],
  simulations: {},
  approval: null,
  execution: null,
  report: null,
  auditEntries: [],
  observedAt: {},
};

/** 线性主链阶段顺序（失败 / 驳回 / 回退为分支，不参与比较）。 */
const STAGE_RANK: Partial<Record<HomeStage, number>> = {
  detected: 0,
  diagnosing: 1,
  diagnosisCompleted: 2,
  simulating: 3,
  simulationCompleted: 4,
  awaitingApproval: 5,
  approved: 6,
  executing: 7,
  verifying: 8,
  recovered: 9,
};

/** 后端失败分支 → 本地对应进行中的阶段（用于对账）。 */
const FAILURE_OF_RUNNING: Partial<Record<HomeStage, TaskStatus>> = {
  diagnosing: 'diagnosisFailed',
  simulating: 'simulationFailed',
  executing: 'executionFailed',
  verifying: 'executionFailed',
};

const TASK_POLL_MS = 400;
const DETAIL_POLL_MS = 1500;

/**
 * 并发写操作去重（模块级）：StrictMode 双挂载会在 ~1ms 内触发两次相同 POST，
 * 后端幂等检查对并发请求存在 TOCTOU 竞态（各建一个任务），
 * 这里以前端在途 Promise 去重并发窗口；调用结束后由后端幂等 / 守卫接管。
 */
const inflightWrites = new Map<string, Promise<unknown>>();

function dedupeWrite<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflightWrites.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => {
    inflightWrites.delete(key);
  });
  inflightWrites.set(key, promise);
  return promise;
}

export interface UseAgentCenterOptions {
  client?: ColdPilotClient;
  taskPollMs?: number;
  detailPollMs?: number;
}

export function useAgentCenter(event: AnomalyEventSummary | undefined, options: UseAgentCenterOptions = {}) {
  // 稳定实例：useState 惰性初始化仅执行一次（避免渲染期读取 ref）。
  const [client] = useState<ColdPilotClient>(() => options.client ?? getColdPilotClient());
  const taskPollMs = options.taskPollMs ?? TASK_POLL_MS;
  const detailPollMs = options.detailPollMs ?? DETAIL_POLL_MS;

  const eventId = event?.id;
  const [stage, setStage] = useState<HomeStage>(eventId ? (event?.stage ?? 'detected') : 'monitoring');
  const [data, setData] = useState<AgentCenterData>(EMPTY_DATA);
  const [reachedRecovered, setReachedRecovered] = useState(false);
  const [busy, setBusy] = useState(false);

  /** 代次：事件切换 / 卸载时使进行中的异步循环失效。 */
  const genRef = useRef(0);
  /** 驱动去重：同一阶段只自动驱动一次。 */
  const drivingRef = useRef<string | null>(null);
  /** 异步循环内读取最新数据（effect 中同步，避免渲染期写 ref）。 */
  const dataRef = useRef(data);
  const stageRef = useRef(stage);
  useEffect(() => {
    dataRef.current = data;
    stageRef.current = stage;
  });

  const alive = useCallback((gen: number) => genRef.current === gen, []);

  const patchData = useCallback((patch: Partial<AgentCenterData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const markObserved = useCallback((patch: Partial<PhaseObservedAt>) => {
    setData((prev) => ({ ...prev, observedAt: { ...prev.observedAt, ...patch } }));
  }, []);

  /* ---------- 事件加载与初始化 ---------- */
  useEffect(() => {
    const gen = ++genRef.current;
    drivingRef.current = null;
    setData({ ...EMPTY_DATA });
    setReachedRecovered(false);
    setBusy(false);
    if (!eventId) {
      setStage('monitoring');
      return;
    }
    setStage(event?.stage ?? 'detected');
    void (async () => {
      try {
        const [detail, auditEntries] = await Promise.all([
          client.getAnomalyEvent(eventId),
          client.listSecurityAuditEntries(eventId),
        ]);
        if (!alive(gen)) return;
        patchData({ detail, auditEntries });
        // 后端 stage 为唯一事实来源：加载后与摘要对账（取更靠前者）。
        setStage((prev) => {
          const backend = detail.stage as HomeStage;
          const prevRank = STAGE_RANK[prev] ?? -1;
          const backendRank = STAGE_RANK[backend] ?? -1;
          return backendRank > prevRank ? backend : prev;
        });
      } catch {
        /* 详情加载失败保持摘要阶段，展示降级 */
      }
    })();
    return () => {
      genRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, eventId]);

  /* ---------- 详情轮询对账（跨页面审批 / 执行、遥测刷新） ---------- */
  useEffect(() => {
    if (!eventId) return;
    const gen = genRef.current;
    let cancelled = false;
    let timer = 0;
    const tick = async () => {
      if (cancelled || !alive(gen)) return;
      try {
        const detail = await client.getAnomalyEvent(eventId);
        if (cancelled || !alive(gen)) return;
        setData((prev) => ({ ...prev, detail }));
        const backend = detail.stage as HomeStage;
        const local = stageRef.current;
        const backendRank = STAGE_RANK[backend];
        const localRank = STAGE_RANK[local];
        if (backend === 'safeFallback' && local !== 'safeFallback') {
          setStage('safeFallback');
        } else if (backendRank !== undefined && localRank !== undefined && backendRank > localRank) {
          // 只前进：批准 / 驳回 / 执行 / 恢复等在其他页面完成时同步到首页。
          setStage(backend);
          if (backend === 'recovered') setReachedRecovered(true);
        } else if (FAILURE_OF_RUNNING[local] === backend) {
          setStage(backend);
        } else if (backend === 'rejected' && local === 'awaitingApproval') {
          setStage('rejected');
        }
      } catch {
        /* 轮询失败静默重试 */
      }
      if (!cancelled) timer = window.setTimeout(() => void tick(), detailPollMs);
    };
    timer = window.setTimeout(() => void tick(), detailPollMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [client, eventId, detailPollMs, alive]);

  /* ---------- 诊断任务轮询 ---------- */
  const pollDiagnosis = useCallback(
    async (taskId: string, gen: number) => {
      while (alive(gen)) {
        try {
          const snapshot = await client.getAgentTask(taskId);
          if (!alive(gen)) return;
          patchData({ task: snapshot });
          if (snapshot.status === 'succeeded') {
            try {
              const [diagnosis, plans] = await Promise.all([
                client.getDiagnosisResult(taskId),
                eventId ? client.listControlPlans(eventId) : Promise.resolve([]),
              ]);
              if (!alive(gen)) return;
              patchData({ diagnosis, plans });
              setStage('diagnosisCompleted');
            } catch {
              // 结果读取失败：退出轮询，阶段由详情对账推进（不做无限重试）。
            }
            return;
          }
          if (snapshot.status === 'failed') {
            setStage('diagnosisFailed');
            return;
          }
        } catch {
          /* 单次轮询失败继续 */
        }
        await new Promise((resolve) => setTimeout(resolve, taskPollMs));
      }
    },
    [alive, client, eventId, patchData, taskPollMs],
  );

  /* ---------- 执行任务轮询 ---------- */
  const pollExecution = useCallback(
    async (taskId: string, gen: number) => {
      while (alive(gen)) {
        try {
          const snapshot = await client.getExecutionTask(taskId);
          if (!alive(gen)) return;
          patchData({ execution: snapshot });
          if (snapshot.status === 'verifying' && stageRef.current === 'executing') {
            markObserved({ executeEnd: new Date().toISOString(), verifyStart: new Date().toISOString() });
            setStage('verifying');
          } else if (snapshot.status === 'recovered') {
            markObserved({ recoverEnd: snapshot.finishedAt ?? new Date().toISOString() });
            setReachedRecovered(true);
            setStage('recovered');
            return;
          } else if (snapshot.status === 'failed') {
            setStage('executionFailed');
            return;
          }
        } catch {
          /* 单次轮询失败继续 */
        }
        await new Promise((resolve) => setTimeout(resolve, taskPollMs));
      }
    },
    [alive, client, markObserved, patchData, taskPollMs],
  );

  /* ---------- 自动驱动：阶段变化时推进（L2 处停下等待人工） ---------- */
  useEffect(() => {
    const gen = genRef.current;
    if (!eventId) return;
    if (drivingRef.current === stage) return;

    if (stage === 'detected') {
      drivingRef.current = stage;
      void (async () => {
        try {
          const task = await dedupeWrite(`diagnosis:${eventId}`, () => client.startDiagnosis(eventId));
          if (!alive(gen)) return;
          patchData({ task });
          setStage('diagnosing');
          await pollDiagnosis(task.id, gen);
        } catch {
          if (alive(gen)) setStage('diagnosisFailed');
        } finally {
          drivingRef.current = null;
        }
      })();
      return;
    }

    if (stage === 'diagnosisCompleted') {
      // 单异步块内完成「补方案 → 仿真」：避免依赖 effect 再次触发（effect 仅随阶段变化运行）。
      drivingRef.current = stage;
      void (async () => {
        try {
          let plans = dataRef.current.plans;
          if (plans.length === 0) {
            // 诊断在其他会话完成（或阶段由详情对账推进）：补充加载方案。
            plans = await client.listControlPlans(eventId);
            if (!alive(gen)) return;
            patchData({ plans });
            if (plans.length === 0) return;
          }
          markObserved({ simulateStart: new Date().toISOString() });
          setStage('simulating');
          const simulations: Record<string, SimulationResult> = {};
          for (const plan of plans) {
            if (!alive(gen)) return;
            try {
              simulations[plan.id] = await client.runSimulation(plan.id);
              patchData({ simulations: { ...simulations } });
            } catch {
              /* 单方案失败不阻塞其他方案 */
            }
          }
          if (!alive(gen)) return;
          markObserved({ simulateEnd: new Date().toISOString() });
          setStage('simulationCompleted');
        } catch {
          if (alive(gen)) {
            markObserved({ simulateEnd: new Date().toISOString() });
            setStage('simulationFailed');
          }
        } finally {
          drivingRef.current = null;
        }
      })();
      return;
    }

    if (stage === 'simulationCompleted') {
      const recommended = dataRef.current.plans.find((plan) => plan.kind === 'recommended') ?? dataRef.current.plans[0];
      if (!recommended) return;
      drivingRef.current = stage;
      void (async () => {
        try {
          const approval = await dedupeWrite(`approval:${recommended.id}`, () => client.requestApproval(recommended.id));
          if (!alive(gen)) return;
          patchData({ approval });
          markObserved({ safetyEnd: approval.createdAt, approveStart: approval.createdAt });
          setStage('awaitingApproval');
        } catch {
          /* 审批创建失败：停留在仿真完成，允许人工前往策略页处理 */
        } finally {
          drivingRef.current = null;
        }
      })();
      return;
    }

    if (stage === 'awaitingApproval' && !dataRef.current.approval) {
      // 审批在其他页面创建：经幂等接口取回待审批请求（同方案 + 版本 pending 直接返回）。
      const recommended = dataRef.current.plans.find((plan) => plan.kind === 'recommended') ?? dataRef.current.plans[0];
      if (!recommended) return;
      drivingRef.current = stage;
      void (async () => {
        try {
          const approval = await dedupeWrite(`approval:${recommended.id}`, () => client.requestApproval(recommended.id));
          if (!alive(gen)) return;
          patchData({ approval });
          markObserved({ safetyEnd: approval.createdAt, approveStart: approval.createdAt });
        } catch {
          /* 取回失败保持阶段展示，审批卡片降级 */
        } finally {
          drivingRef.current = null;
        }
      })();
      return;
    }

    if (stage === 'approved') {
      const planId = dataRef.current.approval?.planId ?? dataRef.current.plans[0]?.id;
      if (!planId) return;
      drivingRef.current = stage;
      void (async () => {
        try {
          const task = await dedupeWrite(`execution:${planId}`, () => client.startExecution(planId));
          if (!alive(gen)) return;
          patchData({ execution: task });
          markObserved({ executeStart: task.startedAt });
          setStage('executing');
          await pollExecution(task.id, gen);
        } catch {
          // 执行已在其他页面启动：无任务句柄，转为按阶段对账推进。
          if (alive(gen)) setStage('executing');
        } finally {
          drivingRef.current = null;
        }
      })();
      return;
    }

    if (stage === 'recovered' && !dataRef.current.report) {
      drivingRef.current = stage;
      void (async () => {
        for (let attempt = 0; attempt < 3 && alive(gen); attempt += 1) {
          try {
            const report = await client.getEventReport(eventId);
            if (!alive(gen)) return;
            patchData({ report });
            return;
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }
      })().finally(() => {
        drivingRef.current = null;
      });
    }
  }, [alive, client, eventId, markObserved, patchData, pollDiagnosis, pollExecution, stage]);

  /* ---------- 人工动作 ---------- */

  /** L2 批准并执行：真实提交审批决定，随后由驱动自动下发执行。 */
  const approveAndExecute = useCallback(async () => {
    const approval = dataRef.current.approval;
    if (!approval || stageRef.current !== 'awaitingApproval') return;
    setBusy(true);
    try {
      const result = await client.submitApproval(approval.id, { decision: 'approved', approverId: '冷库管理员' });
      patchData({
        approval: { ...approval, status: result.decision, decidedBy: result.decidedBy, decidedAt: result.decidedAt },
      });
      markObserved({ approveEnd: result.decidedAt });
      drivingRef.current = null;
      setStage('approved');
    } finally {
      setBusy(false);
    }
  }, [client, markObserved, patchData]);

  /** 驳回方案（留痕审批意见）。 */
  const rejectPlan = useCallback(
    async (reason?: string) => {
      const approval = dataRef.current.approval;
      if (!approval || stageRef.current !== 'awaitingApproval') return;
      setBusy(true);
      try {
        await client.submitApproval(approval.id, { decision: 'rejected', approverId: '冷库管理员', reason });
        patchData({ approval: { ...approval, status: 'rejected', decidedBy: '冷库管理员', decidedAt: new Date().toISOString(), reason } });
        markObserved({ approveEnd: new Date().toISOString() });
        drivingRef.current = null;
        setStage('rejected');
      } finally {
        setBusy(false);
      }
    },
    [client, markObserved, patchData],
  );

  /** 驳回 / 失败后重新仿真：重跑仿真并重新申请审批（真实重走 L1 + 安全校验）。 */
  const resimulate = useCallback(() => {
    if (dataRef.current.plans.length === 0) return;
    drivingRef.current = null;
    setStage('diagnosisCompleted');
  }, []);

  /** 重新诊断（诊断失败后）。 */
  const rediagnose = useCallback(() => {
    drivingRef.current = null;
    setStage('detected');
  }, []);

  /** 进入安全回退（前端语义，与工作台一致：AI 控制退出，回退传统规则 / PID）。 */
  const enterSafeFallback = useCallback(() => {
    drivingRef.current = null;
    setStage('safeFallback');
  }, []);

  return {
    stage,
    data,
    busy,
    /** 本会话内到达过 recovered（区分「刚恢复」与「历史已恢复」）。 */
    reachedRecovered,
    approveAndExecute,
    rejectPlan,
    resimulate,
    rediagnose,
    enterSafeFallback,
  };
}

export type UseAgentCenter = ReturnType<typeof useAgentCenter>;
