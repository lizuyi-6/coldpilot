import type {
  AgentTask,
  AnomalyEventSummary,
  DiagnosisResult,
  ToolInvocation,
} from '@/domain/types';

/**
 * Agent 对话与分析页 ViewModel。
 * 任务列表、工具步骤、结论摘要全部由真实接口数据派生；后端没有任务列表接口，
 * “最近任务”由异常事件映射（每个事件对应一次可发起的诊断任务），不编造任务 ID。
 */

/** 诊断任务目标文案（与诊断 understanding 同语义）。 */
export function goalForEvent(event: AnomalyEventSummary): string {
  return `分析${event.roomName}${event.title}的原因，并给出处理建议`;
}

export type AgentTaskItemState = 'running' | 'done' | 'pending';

export interface AgentTaskListItem {
  eventId: string;
  goal: string;
  /** 发起时间（ISO）：真实任务取 task.startedAt，未发起取事件 startedAt。 */
  startedAt: string;
  state: AgentTaskItemState;
  stateLabel: string;
  /** 已发起任务的真实任务 ID；未发起为 null。 */
  taskId: string | null;
}

const PAST_DIAGNOSIS_STAGES = new Set([
  'diagnosisCompleted',
  'simulating',
  'simulationCompleted',
  'awaitingApproval',
  'approved',
  'rejected',
  'executing',
  'verifying',
  'recovered',
]);

/** 最近任务列表：由异常事件派生；当前正在运行的诊断任务覆盖对应事件的状态与 ID。 */
export function agentTaskListItems(
  events: AnomalyEventSummary[],
  activeTask: AgentTask | null,
): AgentTaskListItem[] {
  return events.map((event) => {
    const isActive = activeTask !== null && activeTask.eventId === event.id && activeTask.status !== 'succeeded';
    if (isActive) {
      return {
        eventId: event.id,
        goal: activeTask.goal || goalForEvent(event),
        startedAt: activeTask.startedAt,
        state: 'running' as const,
        stateLabel: '进行中',
        taskId: activeTask.id,
      };
    }
    if (PAST_DIAGNOSIS_STAGES.has(event.stage) || (activeTask?.eventId === event.id && activeTask.status === 'succeeded')) {
      const isSameTask = activeTask?.eventId === event.id;
      return {
        eventId: event.id,
        goal: isSameTask && activeTask.goal ? activeTask.goal : goalForEvent(event),
        startedAt: isSameTask ? activeTask.startedAt : event.startedAt,
        state: 'done' as const,
        stateLabel: '已完成',
        taskId: isSameTask ? activeTask.id : null,
      };
    }
    return {
      eventId: event.id,
      goal: goalForEvent(event),
      startedAt: event.startedAt,
      state: 'pending' as const,
      stateLabel: '待诊断',
      taskId: null,
    };
  });
}

/** 工具步骤状态。 */
export type ToolStepState = 'done' | 'running' | 'pending' | 'failed';

export interface ToolStep {
  key: string;
  label: string;
  state: ToolStepState;
  durationMs: number | null;
  inputSummary: string | null;
  outputSummary: string | null;
}

function toolState(tool: ToolInvocation): ToolStepState {
  return tool.status === 'succeeded' ? 'done' : 'failed';
}

/**
 * 工具调用进度步骤：真实工具调用 + 末尾“生成分析结论”派生步骤。
 * 任务 running 且工具未全部返回时，下一步显示为进行中。
 */
export function toolSteps(task: AgentTask | null, diagnosing: boolean): ToolStep[] {
  if (!task) return [];
  const steps: ToolStep[] = task.tools.map((tool) => ({
    key: tool.id,
    label: tool.label,
    state: toolState(tool),
    durationMs: tool.durationMs,
    inputSummary: tool.inputSummary,
    outputSummary: tool.outputSummary,
  }));
  const anyFailed = steps.some((step) => step.state === 'failed');
  const conclusionState: ToolStepState = anyFailed
    ? 'failed'
    : task.status === 'succeeded'
      ? 'done'
      : diagnosing
        ? 'running'
        : 'pending';
  steps.push({
    key: 'conclusion',
    label: '生成分析结论',
    state: conclusionState,
    durationMs: null,
    inputSummary: null,
    outputSummary: task.status === 'succeeded' ? '分析结论已生成' : null,
  });
  return steps;
}

export type ConfidenceTier = 'high' | 'medium' | 'low';

export const CONFIDENCE_TIER_LABEL: Record<ConfidenceTier, string> = {
  high: '高置信',
  medium: '中置信',
  low: '低置信',
};

export function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.6) return 'high';
  if (confidence >= 0.35) return 'medium';
  return 'low';
}

export interface ConclusionCauseView {
  id: string;
  rank: number;
  label: string;
  confidencePct: number;
  tier: ConfidenceTier;
  /** 顶部证据摘要（取前两条）。 */
  evidenceDigest: string[];
}

export type ActionPriority = 'high' | 'medium' | 'low';

export const ACTION_PRIORITY_LABEL: Record<ActionPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export interface ConclusionActionView {
  key: string;
  text: string;
  priority: ActionPriority;
  /** 来源原因（标注措施由哪个候选原因导出）。 */
  fromCause: string;
}

export interface ConclusionView {
  causes: ConclusionCauseView[];
  /** 关键证据摘要：各原因的支持证据按置信度顺序展开。 */
  evidenceDigest: string[];
  actions: ConclusionActionView[];
  /** 风险提示：诊断不确定项。 */
  risks: string[];
}

function priorityForRank(rank: number): ActionPriority {
  if (rank === 1) return 'high';
  if (rank === 2) return 'medium';
  return 'low';
}

/** 分析结论视图：原因按置信度降序；措施由推荐排查项派生并标注来源。 */
export function conclusionView(diagnosis: DiagnosisResult): ConclusionView {
  const sorted = [...diagnosis.causes].sort((a, b) => b.confidence - a.confidence);
  const causes = sorted.map((cause, index) => ({
    id: cause.id,
    rank: index + 1,
    label: cause.label,
    confidencePct: Math.round(cause.confidence * 100),
    tier: confidenceTier(cause.confidence),
    evidenceDigest: cause.evidence.slice(0, 2).map((evidence) => evidence.summary),
  }));
  const evidenceDigest = sorted.flatMap((cause) =>
    cause.evidence.filter((evidence) => evidence.kind === 'supporting').map((evidence) => evidence.summary),
  );
  const actions = sorted.flatMap((cause, index) =>
    cause.recommendedChecks.map((check, checkIndex) => ({
      key: `${cause.id}-${checkIndex}`,
      text: check,
      priority: priorityForRank(index + 1),
      fromCause: cause.label,
    })),
  );
  return { causes, evidenceDigest, actions, risks: diagnosis.uncertainties };
}
