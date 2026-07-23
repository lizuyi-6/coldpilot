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

/**
 * 前端唯一的数据边界。
 *
 * - UI 与状态机只依赖本接口，不知道数据来自 Mock 还是真实 HTTP。
 * - Mock 数据只允许在 MockColdPilotClient 内部读取。
 * - 后续接入后端时新增 HttpColdPilotClient 并在入口切换实现，
 *   页面组件与状态机不需改动。
 */
export interface ColdPilotClient {
  /** 异常事件列表。 */
  listAnomalyEvents(): Promise<AnomalyEventSummary[]>;

  /** 异常事件详情（含库房、设备、库存、多指标时序、库房事件）。 */
  getAnomalyEvent(eventId: string): Promise<AnomalyEventDetail>;

  /** 发起诊断任务，返回任务句柄（异步，经 getAgentTask 轮询）。 */
  startDiagnosis(eventId: string): Promise<AgentTask>;

  /** 查询 Agent 诊断任务状态（轮询）。 */
  getAgentTask(taskId: string): Promise<AgentTask>;

  /** 诊断成功后读取结构化诊断结果。 */
  getDiagnosisResult(taskId: string): Promise<DiagnosisResult>;

  /** 候选控制方案（本阶段均为 L2，L3 不在其中）。 */
  listControlPlans(eventId: string): Promise<ControlPlan[]>;

  /** 对方案发起仿真。 */
  runSimulation(planId: string): Promise<SimulationResult>;

  /** 创建审批请求（仅仿真完成后的 L2 方案）。 */
  requestApproval(planId: string): Promise<ApprovalRequest>;

  /** 提交审批决定（批准 / 驳回）。 */
  submitApproval(requestId: string, decision: ApprovalDecision): Promise<ApprovalResult>;

  /** 批准后发起控制执行（仿真执行）。 */
  startExecution(planId: string): Promise<ExecutionTask>;

  /** 查询执行与验证状态（轮询）。 */
  getExecutionTask(taskId: string): Promise<ExecutionTask>;

  /** 事件报告。 */
  getEventReport(eventId: string): Promise<EventReport>;

  /** 安全审计记录（含 L3 被拦截动作）。 */
  listSecurityAuditEntries(eventId: string): Promise<SecurityAuditEntry[]>;
}