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

/**
 * 真实 HTTP 实现：调用 ColdPilot 后端（FastAPI）。
 *
 * - 仅依赖 ColdPilotClient 接口与冻结的 OpenAPI 路径，不触碰页面/状态机/DTO。
 * - 错误信封 `{ error: { code, message, ... } }` 被还原为 ApiError，
 *   状态机据此区分分支（如 INVALID_STATE / CONFLICT / NOT_FOUND）。
 * - Base URL 由 VITE_COLDPILOT_API_BASE_URL 提供（默认同源 ''），路径前缀 /api/v1。
 */
export class HttpColdPilotClient implements ColdPilotClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '') {
    // 去掉末尾斜杠，统一拼接。
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });

    if (!response.ok) {
      throw await this.toApiError(response);
    }

    // 204 / 空体兜底。
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  private async toApiError(response: Response): Promise<ApiError> {
    let code: ApiError['code'] = 'INTERNAL';
    let message = `请求失败：HTTP ${response.status}`;
    try {
      const body = await response.json();
      const envelope = body?.error;
      if (envelope?.code) code = envelope.code as ApiError['code'];
      if (envelope?.message) message = envelope.message as string;
    } catch {
      // 非 JSON 错误体，保留默认 message。
    }
    return new ApiError(code, message, response.status);
  }

  listAnomalyEvents(): Promise<AnomalyEventSummary[]> {
    return this.request<AnomalyEventSummary[]>('/anomaly-events');
  }

  getAnomalyEvent(eventId: string): Promise<AnomalyEventDetail> {
    return this.request<AnomalyEventDetail>(`/anomaly-events/${encodeURIComponent(eventId)}`);
  }

  startDiagnosis(eventId: string): Promise<AgentTask> {
    return this.request<AgentTask>(
      `/anomaly-events/${encodeURIComponent(eventId)}/diagnosis`,
      { method: 'POST' },
    );
  }

  getAgentTask(taskId: string): Promise<AgentTask> {
    return this.request<AgentTask>(`/agent-tasks/${encodeURIComponent(taskId)}`);
  }

  getDiagnosisResult(taskId: string): Promise<DiagnosisResult> {
    return this.request<DiagnosisResult>(
      `/agent-tasks/${encodeURIComponent(taskId)}/diagnosis-result`,
    );
  }

  listControlPlans(eventId: string): Promise<ControlPlan[]> {
    return this.request<ControlPlan[]>(
      `/anomaly-events/${encodeURIComponent(eventId)}/control-plans`,
    );
  }

  runSimulation(planId: string): Promise<SimulationResult> {
    return this.request<SimulationResult>(
      `/control-plans/${encodeURIComponent(planId)}/simulation`,
      { method: 'POST' },
    );
  }

  requestApproval(planId: string): Promise<ApprovalRequest> {
    return this.request<ApprovalRequest>(
      `/control-plans/${encodeURIComponent(planId)}/approval-requests`,
      { method: 'POST' },
    );
  }

  submitApproval(requestId: string, decision: ApprovalDecision): Promise<ApprovalResult> {
    return this.request<ApprovalResult>(
      `/approval-requests/${encodeURIComponent(requestId)}/decision`,
      { method: 'POST', body: JSON.stringify(decision) },
    );
  }

  startExecution(planId: string): Promise<ExecutionTask> {
    return this.request<ExecutionTask>(
      `/control-plans/${encodeURIComponent(planId)}/execution`,
      { method: 'POST' },
    );
  }

  getExecutionTask(taskId: string): Promise<ExecutionTask> {
    return this.request<ExecutionTask>(`/execution-tasks/${encodeURIComponent(taskId)}`);
  }

  getEventReport(eventId: string): Promise<EventReport> {
    return this.request<EventReport>(`/anomaly-events/${encodeURIComponent(eventId)}/report`);
  }

  listSecurityAuditEntries(eventId: string): Promise<SecurityAuditEntry[]> {
    return this.request<SecurityAuditEntry[]>(
      `/anomaly-events/${encodeURIComponent(eventId)}/security-audit`,
    );
  }
}
