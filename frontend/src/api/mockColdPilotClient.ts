import type {
  AgentTask,
  AnomalyEventDetail,
  AnomalyEventSummary,
  ApprovalDecision,
  ApprovalRequest,
  ApprovalResult,
  ControlPlan,
  DiagnosisResult,
  EventReport,
  ExecutionTask,
  SecurityAuditEntry,
  SimulationResult,
} from '@/domain/types';
import { ApiError } from './apiErrors';
import type { ColdPilotClient } from './coldPilotClient';
import {
  ANOMALY_EVENTS,
  CONTROL_PLANS,
  DEVICES,
  DIAGNOSIS_RESULT,
  DIAGNOSIS_TOOLS,
  EVENT_REPORTS,
  INVENTORY,
  ROOMS,
  ROOM_EVENTS,
  SAFETY_CHECKS,
  SECURITY_AUDIT,
  SIMULATION_RESULTS,
  TELEMETRY,
  buildExecutionSeries,
} from '@/mocks';

/** 可调时钟与节奏，测试可注入 0 时长实现确定性。 */
export interface MockTiming {
  latencyMs: number;
  diagnosisMs: number;
  executionMs: number;
  verificationMs: number;
}

const DEFAULT_TIMING: MockTiming = {
  latencyMs: 220,
  diagnosisMs: 1600,
  executionMs: 1800,
  verificationMs: 2000,
};

/** 演示/测试用失败注入与重置。仅 mock 暴露，不属于 ColdPilotClient 数据契约。 */
export interface DemoControls {
  armFailureOnce(kind: 'diagnosis' | 'simulation' | 'execution'): void;
  resetScenario(): void;
}

interface DiagnosisRecord {
  eventId: string;
  startMs: number;
  fail: boolean;
}

interface ExecutionRecord {
  planId: string;
  startMs: number;
  fail: boolean;
  targetTemp: number;
  recoveryHours: number;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Mock 实现：仅从 mocks 读取数据，用 Promise + 时间驱动模拟异步任务。
 * 所有数据均为演示 / 仿真结果，绝不表达为真实成果。
 */
export class MockColdPilotClient implements ColdPilotClient, DemoControls {
  private readonly timing: MockTiming;
  private readonly now: () => number;
  private idSeq = 0;

  private diagnosisTasks = new Map<string, DiagnosisRecord>();
  private approvalRequests = new Map<string, ApprovalRequest>();
  private executionTasks = new Map<string, ExecutionRecord>();
  private simulatedPlans = new Set<string>();
  private approvedPlans = new Set<string>();
  private armedFailures: Record<'diagnosis' | 'simulation' | 'execution', number> = {
    diagnosis: 0,
    simulation: 0,
    execution: 0,
  };

  constructor(timing: Partial<MockTiming> = {}, now: () => number = () => Date.now()) {
    this.timing = { ...DEFAULT_TIMING, ...timing };
    this.now = now;
  }

  // ---- DemoControls ----
  armFailureOnce(kind: 'diagnosis' | 'simulation' | 'execution'): void {
    this.armedFailures[kind] += 1;
  }

  resetScenario(): void {
    this.diagnosisTasks.clear();
    this.approvalRequests.clear();
    this.executionTasks.clear();
    this.simulatedPlans.clear();
    this.approvedPlans.clear();
    this.armedFailures = { diagnosis: 0, simulation: 0, execution: 0 };
  }

  private nextId(prefix: string): string {
    this.idSeq += 1;
    return `${prefix}-${this.idSeq}`;
  }

  // ---- 查询类 ----
  async listAnomalyEvents(): Promise<AnomalyEventSummary[]> {
    await delay(this.timing.latencyMs);
    return ANOMALY_EVENTS;
  }

  async getAnomalyEvent(eventId: string): Promise<AnomalyEventDetail> {
    await delay(this.timing.latencyMs);
    const summary = ANOMALY_EVENTS.find((e) => e.id === eventId);
    if (!summary) throw new ApiError('NOT_FOUND', `未找到异常事件 ${eventId}`, 404);
    const room = ROOMS.find((r) => r.id === summary.roomId);
    if (!room) throw new ApiError('NOT_FOUND', `未找到冷库 ${summary.roomId}`, 404);
    return {
      ...summary,
      room,
      devices: DEVICES.filter((d) => d.roomId === room.id),
      inventory: INVENTORY.filter((b) => b.roomId === room.id),
      telemetry: TELEMETRY[room.id] ?? [],
      roomEvents: ROOM_EVENTS[room.id] ?? [],
    };
  }

  // ---- 诊断 ----
  async startDiagnosis(eventId: string): Promise<AgentTask> {
    await delay(this.timing.latencyMs);
    const fail = this.armedFailures.diagnosis > 0;
    if (fail) this.armedFailures.diagnosis -= 1;
    const taskId = this.nextId('task');
    this.diagnosisTasks.set(taskId, { eventId, startMs: this.now(), fail });
    return this.buildAgentTaskSnapshot(taskId);
  }

  async getAgentTask(taskId: string): Promise<AgentTask> {
    await delay(this.timing.latencyMs);
    return this.buildAgentTaskSnapshot(taskId);
  }

  async getDiagnosisResult(taskId: string): Promise<DiagnosisResult> {
    await delay(this.timing.latencyMs);
    const record = this.diagnosisTasks.get(taskId);
    if (!record) throw new ApiError('NOT_FOUND', `未找到诊断任务 ${taskId}`, 404);
    const snapshot = this.buildAgentTaskSnapshot(taskId);
    if (snapshot.status !== 'succeeded') {
      throw new ApiError('INVALID_STATE', '诊断尚未完成，无法读取诊断结果', 409);
    }
    return DIAGNOSIS_RESULT;
  }

  private buildAgentTaskSnapshot(taskId: string): AgentTask {
    const record = this.diagnosisTasks.get(taskId);
    if (!record) throw new ApiError('NOT_FOUND', `未找到诊断任务 ${taskId}`, 404);
    const elapsed = this.now() - record.startMs;
    const total = DIAGNOSIS_TOOLS.length;
    const done = elapsed >= this.timing.diagnosisMs;
    const revealed = done ? total : Math.min(total, Math.floor((elapsed / this.timing.diagnosisMs) * total));
    return {
      id: taskId,
      eventId: record.eventId,
      goal: '分析 1 号辣椒库温度升高的原因，给出安全、节能的处理方案',
      status: done ? (record.fail ? 'failed' : 'succeeded') : 'running',
      tools: DIAGNOSIS_TOOLS.slice(0, revealed),
      startedAt: new Date(record.startMs).toISOString(),
      finishedAt: done ? new Date(record.startMs + this.timing.diagnosisMs).toISOString() : undefined,
    };
  }

  // ---- 方案与仿真 ----
  async listControlPlans(eventId: string): Promise<ControlPlan[]> {
    await delay(this.timing.latencyMs);
    return CONTROL_PLANS.filter((p) => p.eventId === eventId);
  }

  async runSimulation(planId: string): Promise<SimulationResult> {
    await delay(this.timing.latencyMs);
    if (this.armedFailures.simulation > 0) {
      this.armedFailures.simulation -= 1;
      throw new ApiError('INTERNAL', '仿真服务暂时不可用，请重试', 500);
    }
    const result = SIMULATION_RESULTS[planId];
    if (!result) throw new ApiError('NOT_FOUND', `未找到方案 ${planId}`, 404);
    this.simulatedPlans.add(planId);
    return result;
  }

  // ---- 审批 ----
  async requestApproval(planId: string): Promise<ApprovalRequest> {
    await delay(this.timing.latencyMs);
    const plan = CONTROL_PLANS.find((p) => p.id === planId);
    if (!plan) throw new ApiError('NOT_FOUND', `未找到方案 ${planId}`, 404);
    if (!this.simulatedPlans.has(planId)) {
      throw new ApiError('INVALID_STATE', '未完成仿真不得申请审批', 409);
    }
    const request: ApprovalRequest = {
      id: this.nextId('apr'),
      planId,
      planVersion: plan.version,
      level: plan.approvalLevel,
      safetyChecks: SAFETY_CHECKS,
      status: 'pending',
      createdAt: new Date(this.now()).toISOString(),
    };
    this.approvalRequests.set(request.id, request);
    return request;
  }

  async submitApproval(requestId: string, decision: ApprovalDecision): Promise<ApprovalResult> {
    await delay(this.timing.latencyMs);
    const request = this.approvalRequests.get(requestId);
    if (!request) throw new ApiError('NOT_FOUND', `未找到审批请求 ${requestId}`, 404);
    if (request.status !== 'pending') {
      throw new ApiError('CONFLICT', '该审批请求已被处理', 409);
    }
    request.status = decision.decision;
    request.decidedBy = decision.approverId;
    request.decidedAt = new Date(this.now()).toISOString();
    request.reason = decision.reason;
    if (decision.decision === 'approved') {
      this.approvedPlans.add(request.planId);
    }
    return {
      requestId,
      decision: decision.decision,
      decidedBy: decision.approverId,
      decidedAt: request.decidedAt,
    };
  }

  // ---- 执行与验证 ----
  async startExecution(planId: string): Promise<ExecutionTask> {
    await delay(this.timing.latencyMs);
    if (!this.approvedPlans.has(planId)) {
      throw new ApiError('INVALID_STATE', '方案未批准，不能执行', 409);
    }
    const fail = this.armedFailures.execution > 0;
    if (fail) this.armedFailures.execution -= 1;
    const targetTemp = planId === 'plan-a' ? 8.0 : 7.5;
    const recoveryHours = SIMULATION_RESULTS[planId]?.recoveryHours ?? 6;
    const taskId = this.nextId('exec');
    this.executionTasks.set(taskId, { planId, startMs: this.now(), fail, targetTemp, recoveryHours });
    return this.buildExecutionSnapshot(taskId);
  }

  async getExecutionTask(taskId: string): Promise<ExecutionTask> {
    await delay(this.timing.latencyMs);
    return this.buildExecutionSnapshot(taskId);
  }

  private buildExecutionSnapshot(taskId: string): ExecutionTask {
    const record = this.executionTasks.get(taskId);
    if (!record) throw new ApiError('NOT_FOUND', `未找到执行任务 ${taskId}`, 404);
    const elapsed = this.now() - record.startMs;
    const { executionMs, verificationMs } = this.timing;
    const fullSeries = buildExecutionSeries(record.targetTemp, record.recoveryHours);

    let status: ExecutionTask['status'];
    let observed = fullSeries;
    if (elapsed < executionMs) {
      status = 'executing';
      const revealed = Math.max(1, Math.floor((elapsed / executionMs) * fullSeries.length));
      observed = fullSeries.slice(0, revealed);
    } else if (elapsed < executionMs + verificationMs) {
      status = 'verifying';
    } else {
      status = record.fail ? 'failed' : 'recovered';
    }

    return {
      id: taskId,
      planId: record.planId,
      planVersion: 1,
      status,
      observedSeries: observed,
      startedAt: new Date(record.startMs).toISOString(),
      finishedAt: status === 'recovered' || status === 'failed' ? new Date(record.startMs + executionMs + verificationMs).toISOString() : undefined,
      recoveryMinutes: status === 'recovered' ? Math.round(record.recoveryHours * 60) : undefined,
      triggeredRollback: status === 'failed' ? '执行偏差超限，已回退传统规则 / PID' : undefined,
      provenance: 'simulated',
    };
  }

  // ---- 报告与审计 ----
  async getEventReport(eventId: string): Promise<EventReport> {
    await delay(this.timing.latencyMs);
    const report = EVENT_REPORTS[eventId];
    if (!report) throw new ApiError('NOT_FOUND', `事件 ${eventId} 尚无报告`, 404);
    return report;
  }

  async listSecurityAuditEntries(eventId: string): Promise<SecurityAuditEntry[]> {
    await delay(this.timing.latencyMs);
    return SECURITY_AUDIT[eventId] ?? [];
  }
}
