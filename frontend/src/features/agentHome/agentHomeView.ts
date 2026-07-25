import type {
  AgentTask,
  AnomalyEventDetail,
  AnomalyEventSummary,
  ApprovalRequest,
  ControlPlan,
  DiagnosisResult,
  ExecutionTask,
  SimulationResult,
  TaskStatus,
} from '@/domain/types';
import { riskLevelLabel } from '@/domain/viewModels';
import type { TagTone } from '@/components/ui/Tag';
import { formatDuration, formatTimeHM } from '@/utils/formatTime';
import { formatNumber } from '@/utils/formatNumber';

/**
 * 首页「Agent 自主控制中心」ViewModel。
 * 全部展示数据由真实接口数据（事件 / 任务 / 诊断 / 方案 / 仿真 / 审批 / 执行 / 审计）派生；
 * 派生逻辑（阶段归并、当前判断、推荐理由、验证清单）在此集中，保持可测试、不伪造。
 */

/** 首页面板使用的阶段：完整业务 TaskStatus + 无活动异常时的持续监测态。 */
export type HomeStage = TaskStatus | 'monitoring';

/** 任务链八个阶段（任务书要求：以任务阶段代替聊天记录）。 */
export type HomePhaseKey =
  | 'detect'
  | 'diagnose'
  | 'plan'
  | 'simulate'
  | 'safety'
  | 'approve'
  | 'execute'
  | 'verify';

/** 阶段状态：文字 + 图标 + 颜色三重表达，不只用颜色。 */
export type PhaseStatus = 'waiting' | 'running' | 'done' | 'failed' | 'blocked' | 'awaiting';

export const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  waiting: '等待',
  running: '进行中',
  done: '已完成',
  failed: '失败',
  blocked: '被安全规则阻止',
  awaiting: '等待审批',
};

export interface HomePhase {
  key: HomePhaseKey;
  label: string;
  status: PhaseStatus;
  statusLabel: string;
  /** 阶段开始 / 完成时间（真实任务、审批、执行时间戳；本地驱动动作记录观测时间）。 */
  startedAt?: string;
  finishedAt?: string;
  durationText?: string;
  /** 该阶段使用的工具。 */
  toolSummary?: string;
  /** 当前结论。 */
  conclusion?: string;
  /** 是否需要人工干预。 */
  needsHuman: boolean;
}

export const HOME_PHASE_DEFS: { key: HomePhaseKey; label: string; tool: string }[] = [
  { key: 'detect', label: '异常检测', tool: '实时遥测监测' },
  { key: 'diagnose', label: '原因诊断', tool: '遥测 / 库门 / 设备 / 知识库工具' },
  { key: 'plan', label: '方案生成', tool: '控制方案生成器' },
  { key: 'simulate', label: '仿真校验', tool: '温控仿真引擎' },
  { key: 'safety', label: '安全决策', tool: '安全规则校验（白名单 / 边界 / 变化率 / 冲突 / 权限）' },
  { key: 'approve', label: '人工审批', tool: 'L2 人工二次确认' },
  { key: 'execute', label: '控制执行', tool: '结构化控制命令下发' },
  { key: 'verify', label: '效果验证', tool: '温度恢复验证' },
];

/** 各阶段被本地观测到的时间戳键（驱动动作真实发生的时刻）。 */
export interface PhaseObservedAt {
  simulateStart?: string;
  simulateEnd?: string;
  safetyEnd?: string;
  approveStart?: string;
  approveEnd?: string;
  executeStart?: string;
  executeEnd?: string;
  verifyStart?: string;
  recoverEnd?: string;
}

/** 阶段耗时展示：秒级（演示节奏）。 */
function phaseDurationText(startIso?: string, endIso?: string): string | undefined {
  if (!startIso || !endIso) return undefined;
  const ms = Date.parse(endIso) - Date.parse(startIso);
  if (Number.isNaN(ms) || ms < 0) return undefined;
  if (ms < 1000) return '<1秒';
  return `${(ms / 1000).toFixed(1)}秒`;
}

function phase(
  key: HomePhaseKey,
  status: PhaseStatus,
  extra?: Partial<Omit<HomePhase, 'key' | 'label' | 'status' | 'statusLabel' | 'needsHuman'>> & { needsHuman?: boolean },
): HomePhase {
  const def = HOME_PHASE_DEFS.find((item) => item.key === key)!;
  return {
    key,
    label: def.label,
    status,
    statusLabel: PHASE_STATUS_LABEL[status],
    toolSummary: def.tool,
    needsHuman: key === 'approve' && status === 'awaiting',
    ...extra,
  };
}

export interface PhaseInput {
  stage: HomeStage;
  event: AnomalyEventSummary | undefined;
  task: AgentTask | null;
  diagnosis: DiagnosisResult | null;
  plans: ControlPlan[];
  simulations: Record<string, SimulationResult>;
  approval: ApprovalRequest | null;
  execution: ExecutionTask | null;
  observedAt: PhaseObservedAt;
}

function recommendedPlanOf(plans: ControlPlan[]): ControlPlan | null {
  return plans.find((plan) => plan.kind === 'recommended') ?? plans[0] ?? null;
}

/** 由当前阶段 + 领域数据推导八阶段任务链。 */
export function computePhases(input: PhaseInput): HomePhase[] {
  const { stage, event, task, diagnosis, plans, simulations, approval, execution, observedAt } = input;
  const recommended = recommendedPlanOf(plans);
  const recommendedSim = recommended ? simulations[recommended.id] : undefined;
  const topCause = diagnosis?.causes.slice().sort((a, b) => b.confidence - a.confidence)[0];

  const detectDone = stage !== 'monitoring';
  const diagnoseDone = ['diagnosisCompleted', 'simulating', 'simulationCompleted', 'awaitingApproval', 'approved', 'rejected', 'executing', 'verifying', 'recovered', 'executionFailed', 'safeFallback'].includes(stage);
  const planDone = diagnoseDone && plans.length > 0;
  const simulateDone = ['simulationCompleted', 'awaitingApproval', 'approved', 'rejected', 'executing', 'verifying', 'recovered', 'executionFailed', 'safeFallback'].includes(stage);
  const safetyDone = ['awaitingApproval', 'approved', 'rejected', 'executing', 'verifying', 'recovered', 'executionFailed', 'safeFallback'].includes(stage);
  const approveDone = ['approved', 'executing', 'verifying', 'recovered'].includes(stage);
  const executeDone = ['verifying', 'recovered'].includes(stage) || (stage === 'executionFailed' && Boolean(execution?.triggeredRollback));

  const detectPhase = phase('detect', detectDone ? 'done' : 'waiting', {
    startedAt: event?.startedAt,
    finishedAt: event?.startedAt,
    durationText: phaseDurationText(event?.startedAt, event?.startedAt),
    conclusion: detectDone
      ? `${event?.roomName ?? ''}${event?.title ?? ''}（已持续 ${event?.durationMinutes ?? 0} 分钟）`
      : '各指标处于目标区间，持续监测',
  });

  let diagnosePhase: HomePhase;
  if (stage === 'diagnosing') {
    diagnosePhase = phase('diagnose', 'running', {
      startedAt: task?.startedAt ?? observedAt.approveStart,
      conclusion: `正在调用工具分析（已完成 ${task?.tools.length ?? 0} 项）`,
    });
  } else if (stage === 'diagnosisFailed') {
    diagnosePhase = phase('diagnose', 'failed', {
      startedAt: task?.startedAt,
      finishedAt: task?.finishedAt,
      durationText: phaseDurationText(task?.startedAt, task?.finishedAt),
      conclusion: '诊断任务失败，可重试',
    });
  } else if (diagnoseDone) {
    diagnosePhase = phase('diagnose', 'done', {
      startedAt: task?.startedAt,
      finishedAt: task?.finishedAt,
      durationText: phaseDurationText(task?.startedAt, task?.finishedAt),
      conclusion: topCause
        ? `最可能原因：${topCause.label}（置信度 ${Math.round(topCause.confidence * 100)}%）`
        : '诊断已在其他会话完成，原因详情见完整工作台',
    });
  } else {
    diagnosePhase = phase('diagnose', stage === 'detected' ? 'running' : 'waiting', {
      conclusion: stage === 'detected' ? '已自动启动诊断' : undefined,
    });
  }

  const planPhase = planDone
    ? phase('plan', 'done', {
        startedAt: task?.finishedAt,
        finishedAt: task?.finishedAt,
        durationText: phaseDurationText(task?.finishedAt, task?.finishedAt),
        conclusion: `生成 ${plans.length} 个候选方案：推荐「${recommended?.name ?? '—'}」`,
      })
    : phase('plan', diagnoseDone ? 'running' : 'waiting', {
        conclusion: diagnoseDone ? '正在生成候选控制方案' : undefined,
      });

  let simulatePhase: HomePhase;
  if (stage === 'simulating' || (planDone && !simulateDone && stage === 'diagnosisCompleted')) {
    simulatePhase = phase('simulate', 'running', {
      startedAt: observedAt.simulateStart,
      conclusion: '正在评估恢复时间、能耗与过冲 / 冻害风险',
    });
  } else if (stage === 'simulationFailed') {
    simulatePhase = phase('simulate', 'failed', {
      startedAt: observedAt.simulateStart,
      finishedAt: observedAt.simulateEnd,
      conclusion: '仿真失败，可重试',
    });
  } else if (simulateDone) {
    simulatePhase = phase('simulate', 'done', {
      startedAt: observedAt.simulateStart,
      finishedAt: observedAt.simulateEnd,
      durationText: phaseDurationText(observedAt.simulateStart, observedAt.simulateEnd),
      conclusion: recommendedSim
        ? `推荐方案预计 ${formatNumber(recommendedSim.recoveryHours, 1)} 小时恢复 · 过冲风险 ${riskLevelLabel(recommendedSim.overshootRisk)}`
        : '仿真已完成',
    });
  } else {
    simulatePhase = phase('simulate', 'waiting');
  }

  const checksPassed = approval?.safetyChecks.filter((check) => check.passed).length ?? 0;
  const checksTotal = approval?.safetyChecks.length ?? 0;
  const safetyPhase = safetyDone
    ? phase('safety', 'done', {
        startedAt: approval?.createdAt,
        finishedAt: observedAt.safetyEnd ?? approval?.createdAt,
        durationText: phaseDurationText(approval?.createdAt, observedAt.safetyEnd ?? approval?.createdAt),
        conclusion: approval
          ? `安全校验 ${checksPassed}/${checksTotal} 通过，提交人工审批`
          : '安全规则校验已通过',
      })
    : phase('safety', stage === 'simulationCompleted' ? 'running' : 'waiting', {
        conclusion: stage === 'simulationCompleted' ? '正在执行安全规则校验' : undefined,
      });

  let approvePhase: HomePhase;
  if (stage === 'awaitingApproval') {
    approvePhase = phase('approve', 'awaiting', {
      startedAt: approval?.createdAt,
      conclusion: `等待人工二次确认（${approval?.level ?? 'L2'}）`,
    });
  } else if (stage === 'rejected') {
    approvePhase = phase('approve', 'failed', {
      startedAt: approval?.createdAt,
      finishedAt: approval?.decidedAt ?? observedAt.approveEnd,
      durationText: phaseDurationText(approval?.createdAt, approval?.decidedAt ?? observedAt.approveEnd),
      conclusion: `已被${approval?.decidedBy ?? '人工'}驳回${approval?.reason ? `：${approval.reason}` : ''}`,
    });
  } else if (approveDone) {
    approvePhase = phase('approve', 'done', {
      startedAt: approval?.createdAt,
      finishedAt: approval?.decidedAt ?? observedAt.approveEnd,
      durationText: phaseDurationText(approval?.createdAt, approval?.decidedAt ?? observedAt.approveEnd),
      conclusion: `已由${approval?.decidedBy ?? '人工'}批准`,
    });
  } else {
    approvePhase = phase('approve', 'waiting');
  }

  let executePhase: HomePhase;
  if (stage === 'executing' || stage === 'approved') {
    executePhase = phase('execute', 'running', {
      startedAt: execution?.startedAt ?? observedAt.executeStart,
      conclusion: execution
        ? `已下发 ${recommended?.params.length ?? 0} 项控制动作，观测设备响应`
        : '正在下发结构化控制命令',
    });
  } else if (stage === 'executionFailed' && !execution?.triggeredRollback) {
    executePhase = phase('execute', 'failed', {
      startedAt: execution?.startedAt ?? observedAt.executeStart,
      finishedAt: execution?.finishedAt,
      conclusion: '执行失败',
    });
  } else if (executeDone || stage === 'executionFailed') {
    executePhase = phase('execute', 'done', {
      startedAt: execution?.startedAt ?? observedAt.executeStart,
      finishedAt: execution?.finishedAt ?? observedAt.executeEnd,
      durationText: phaseDurationText(execution?.startedAt ?? observedAt.executeStart, execution?.finishedAt ?? observedAt.executeEnd),
      conclusion: '控制动作已完成',
    });
  } else {
    executePhase = phase('execute', 'waiting');
  }

  let verifyPhase: HomePhase;
  if (stage === 'verifying') {
    verifyPhase = phase('verify', 'running', {
      startedAt: observedAt.verifyStart,
      conclusion: '持续验证温度是否稳定恢复至目标区间',
    });
  } else if (stage === 'recovered') {
    verifyPhase = phase('verify', 'done', {
      startedAt: observedAt.verifyStart,
      finishedAt: execution?.finishedAt ?? observedAt.recoverEnd,
      durationText: phaseDurationText(observedAt.verifyStart, execution?.finishedAt ?? observedAt.recoverEnd),
      conclusion: execution?.recoveryMinutes !== undefined ? `验证通过，恢复用时约 ${formatDuration(execution.recoveryMinutes)}` : '验证通过，已恢复',
    });
  } else if (stage === 'executionFailed') {
    verifyPhase = phase('verify', 'failed', {
      startedAt: observedAt.verifyStart,
      finishedAt: execution?.finishedAt,
      conclusion: execution?.triggeredRollback ?? '验证未通过',
    });
  } else if (stage === 'safeFallback') {
    verifyPhase = phase('verify', 'blocked', {
      conclusion: '已进入安全回退，AI 控制退出',
    });
  } else {
    verifyPhase = phase('verify', 'waiting');
  }

  return [detectPhase, diagnosePhase, planPhase, simulatePhase, safetyPhase, approvePhase, executePhase, verifyPhase];
}

/** 顶部副状态（任务书：不再以「已完成分析」为终态）。 */
export function subStatusOf(stage: HomeStage): { label: string; tone: TagTone } {
  switch (stage) {
    case 'monitoring':
      return { label: '持续监测中', tone: 'info' };
    case 'detected':
      return { label: '主动发现异常', tone: 'danger' };
    case 'diagnosing':
      return { label: '正在诊断', tone: 'accent' };
    case 'diagnosisCompleted':
      return { label: '正在生成方案', tone: 'accent' };
    case 'simulating':
      return { label: '正在仿真', tone: 'info' };
    case 'simulationCompleted':
      return { label: '安全校验中', tone: 'info' };
    case 'awaitingApproval':
      return { label: '等待人工审批', tone: 'warning' };
    case 'approved':
    case 'executing':
      return { label: '正在执行', tone: 'accent' };
    case 'verifying':
      return { label: '正在验证', tone: 'accent' };
    case 'recovered':
      return { label: '已恢复', tone: 'success' };
    case 'rejected':
      return { label: '方案已驳回', tone: 'neutral' };
    case 'safeFallback':
      return { label: '已进入安全回退', tone: 'danger' };
    default:
      return { label: '任务失败', tone: 'danger' };
  }
}

/** 当前判断文案：明确这是系统主动发现，而非用户提问后才开始分析。 */
export function judgmentOf(input: PhaseInput): string {
  const { stage, event, diagnosis, plans, approval, execution } = input;
  const topCause = diagnosis?.causes.slice().sort((a, b) => b.confidence - a.confidence)[0];
  switch (stage) {
    case 'monitoring':
      return '各指标处于目标区间，Agent 持续自主监测中；发现异常将自动启动诊断，无需人工提问。';
    case 'detected':
      return `Agent 主动发现：${event?.roomName ?? ''}${event?.title ?? ''}已持续 ${event?.durationMinutes ?? 0} 分钟，已自动启动异常诊断（非人工提问触发）。`;
    case 'diagnosing':
      return 'Agent 正在调用遥测、库门记录、设备状态、历史异常与存储知识库等工具分析原因。';
    case 'diagnosisCompleted':
      return topCause
        ? `诊断完成：最可能原因为「${topCause.label}」（置信度 ${Math.round(topCause.confidence * 100)}%）。已自动生成 ${plans.length} 个控制方案，正在进行仿真与安全校验。`
        : '诊断完成，已生成候选控制方案，正在进行仿真与安全校验。';
    case 'simulating':
      return '正在对候选方案运行温控仿真，评估恢复时间、能耗与过冲 / 冻害风险。';
    case 'simulationCompleted':
      return '仿真完成，安全规则校验通过，已将控制方案提交人工审批。';
    case 'awaitingApproval':
      return `控制方案（${approval?.level ?? 'L2'}）待人工二次确认。批准后 Agent 将自动下发结构化控制命令，并持续验证执行效果。`;
    case 'approved':
      return '方案已获批准，Agent 正在自动下发结构化控制命令。';
    case 'executing':
      return '控制命令已下发，正在观测设备响应与温度变化，全程处于安全边界内。';
    case 'verifying':
      return '控制动作已完成，正在验证温度是否稳定恢复至目标区间；验证通过才会判定恢复。';
    case 'recovered':
      return `温度已恢复至目标区间${execution?.recoveryMinutes !== undefined ? `，实际恢复用时约 ${formatDuration(execution.recoveryMinutes)}` : ''}，事件进入后续观察。`;
    case 'rejected':
      return '方案已被人工驳回，Agent 等待调整方案后重新仿真。';
    case 'diagnosisFailed':
      return '诊断任务失败，可在完整工作台重试。';
    case 'simulationFailed':
      return '仿真失败，可重新运行仿真。';
    case 'executionFailed':
      return execution?.triggeredRollback ?? '执行未达预期，已回退传统规则 / PID。';
    case 'safeFallback':
      return '已进入安全回退：AI 控制退出，回退传统规则 / PID 兜底，需要人工介入。';
  }
}

/* ---------- 默认监测状态 ---------- */

export interface MonitorItem {
  key: string;
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'danger' | 'muted';
}

const CONTROL_MODE_LABEL: Record<string, string> = {
  ai_assisted: 'AI 辅助',
  manual: '人工控制',
  safe_fallback: '安全回退',
};

/** 默认监测任务卡片（无用户输入时也有内容）。 */
export function monitoringItems(detail: AnomalyEventDetail | null, event: AnomalyEventSummary | undefined): MonitorItem[] {
  const room = detail?.room;
  const tempSeries = detail?.telemetry.find((series) => series.metric === 'temperature');
  const severityToneMap: Record<string, 'ok' | 'warn' | 'danger'> = { notice: 'ok', warning: 'warn', critical: 'danger', emergency: 'danger' };
  const riskValue = event ? { notice: '低', warning: '中', critical: '高', emergency: '高' }[event.severity] : '低';
  return [
    { key: 'target-room', label: '监测对象', value: room?.name ?? event?.roomName ?? '—' },
    {
      key: 'goal',
      label: '当前目标',
      value: room ? `维持温度 ${formatNumber(room.targetRange.min, 0)}～${formatNumber(room.targetRange.max, 0)}°C` : '暂无数据',
    },
    { key: 'mode', label: '当前控制模式', value: room ? CONTROL_MODE_LABEL[room.controlMode] ?? room.controlMode : '暂无数据' },
    {
      key: 'data',
      label: '数据状态',
      value: tempSeries ? { online: '实时', offline: '离线', drifting: '漂移', stale: '延迟' }[tempSeries.status] : '暂无数据',
      tone: tempSeries ? (tempSeries.status === 'online' ? 'ok' : tempSeries.status === 'offline' ? 'danger' : 'warn') : 'muted',
    },
    { key: 'sample', label: '最后采样', value: tempSeries ? formatTimeHM(tempSeries.lastSampleAt) : '暂无数据' },
    { key: 'risk', label: '当前风险等级', value: riskValue, tone: event ? severityToneMap[event.severity] : 'ok' },
  ];
}

/* ---------- 诊断原因（紧凑展示，仅占一个阶段） ---------- */

export interface HomeCauseView {
  id: string;
  rank: number;
  label: string;
  confidencePct: number;
  /** 关键证据（第一条支持证据）。 */
  evidence: string;
  /** 反向证据（无则 null）。 */
  counter: string | null;
  /** 是否需要现场确认。 */
  needFieldCheck: boolean;
  fieldCheck: string | null;
}

export function causeViews(diagnosis: DiagnosisResult, max = 4): HomeCauseView[] {
  return diagnosis.causes
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, max)
    .map((cause, index) => {
      const supporting = cause.evidence.find((item) => item.kind === 'supporting');
      const counter = cause.evidence.find((item) => item.kind === 'counter');
      return {
        id: cause.id,
        rank: index + 1,
        label: cause.label,
        confidencePct: Math.round(cause.confidence * 100),
        evidence: supporting?.summary ?? cause.evidence[0]?.summary ?? '—',
        counter: counter?.summary ?? null,
        needFieldCheck: cause.recommendedChecks.length > 0,
        fieldCheck: cause.recommendedChecks[0] ?? null,
      };
    });
}

/* ---------- 自主决策（推荐方案） ---------- */

export interface DecisionView {
  planName: string;
  approach: string;
  version: number;
  approvalLevel: string;
  whyRecommended: string;
  whyNotAlternative: string | null;
  rollbackConditions: string[];
  recoveryHours: number | null;
  energyKWh: number | null;
  overshootRisk: string | null;
  frostRisk: string | null;
  simulated: boolean;
}

export function decisionView(
  plans: ControlPlan[],
  simulations: Record<string, SimulationResult>,
): DecisionView | null {
  const recommended = recommendedPlanOf(plans);
  if (!recommended) return null;
  const alternative = plans.find((plan) => plan.id !== recommended.id) ?? null;
  const sim = simulations[recommended.id];
  const altSim = alternative ? simulations[alternative.id] : undefined;
  const whyRecommended = sim
    ? `仿真显示该方案过冲风险 ${riskLevelLabel(sim.overshootRisk)}、冻害风险 ${riskLevelLabel(sim.frostRisk)}，预计 ${formatNumber(sim.recoveryHours, 1)} 小时恢复、能耗 ${sim.energyKWh.toLocaleString('zh-CN')} kWh，综合风险最低，故推荐。`
    : `该方案为诊断后生成的推荐方案（${recommended.approach}），仿真完成后给出量化依据。`;
  const whyNotAlternative =
    alternative && altSim
      ? `备选「${alternative.name}」过冲风险 ${riskLevelLabel(altSim.overshootRisk)}、冻害风险 ${riskLevelLabel(altSim.frostRisk)}（预计 ${formatNumber(altSim.recoveryHours, 1)} 小时恢复），风险更高，故未采用。`
      : alternative
        ? `备选「${alternative.name}」仿真数据暂不可用。`
        : null;
  return {
    planName: recommended.name,
    approach: recommended.approach,
    version: recommended.version,
    approvalLevel: recommended.approvalLevel,
    whyRecommended,
    whyNotAlternative,
    rollbackConditions: recommended.rollbackConditions,
    recoveryHours: sim?.recoveryHours ?? null,
    energyKWh: sim?.energyKWh ?? null,
    overshootRisk: sim ? riskLevelLabel(sim.overshootRisk) : null,
    frostRisk: sim ? riskLevelLabel(sim.frostRisk) : null,
    simulated: Boolean(sim),
  };
}

/* ---------- 结构化控制动作（禁止自由文本模拟 PLC） ---------- */

export interface ControlActionRow {
  key: string;
  deviceName: string;
  paramLabel: string;
  currentText: string;
  targetText: string;
  boundText: string | null;
  withinBound: boolean | null;
  dispatchText: string;
  effectAt: string | null;
}

const PARAM_DEVICE_KIND: Record<string, 'compressor' | 'fan' | 'valve'> = {
  targetTemp: 'compressor',
  rate: 'compressor',
  fanMode: 'fan',
  valveOpening: 'valve',
};

function currentValueText(paramKey: string, detail: AnomalyEventDetail | null): string {
  if (!detail) return '—';
  if (paramKey === 'targetTemp') {
    const tempSeries = detail.telemetry.find((series) => series.metric === 'temperature');
    const latest = tempSeries?.points[tempSeries.points.length - 1]?.value;
    return latest !== undefined ? `${formatNumber(latest, 1)}°C` : '—';
  }
  const kind = PARAM_DEVICE_KIND[paramKey];
  const device = detail.devices.find((item) => item.kind === kind);
  if (!device?.metrics) return '—';
  if (paramKey === 'fanMode' && device.metrics.airflowPct !== undefined) return `风量 ${Math.round(device.metrics.airflowPct)}%`;
  if (paramKey === 'valveOpening' && device.metrics.openingPct !== undefined) return `${Math.round(device.metrics.openingPct)}%`;
  if (paramKey === 'rate' && detail.devices[0]) return '—';
  return '—';
}

/** 由方案参数 + 设备 / 遥测真实当前值生成结构化控制动作行。 */
export function controlActionRows(
  plan: ControlPlan | null,
  detail: AnomalyEventDetail | null,
  execution: ExecutionTask | null,
): ControlActionRow[] {
  if (!plan) return [];
  return plan.params.map((param) => {
    const kind = PARAM_DEVICE_KIND[param.key] ?? 'compressor';
    const device = detail?.devices.find((item) => item.kind === kind);
    const targetText = typeof param.value === 'number' ? `${formatNumber(param.value, 1)}${param.unit ?? ''}` : String(param.value);
    const numericValue = typeof param.value === 'number' ? param.value : null;
    const withinBound =
      param.bound && numericValue !== null ? numericValue >= param.bound.min && numericValue <= param.bound.max : param.bound ? null : true;
    return {
      key: param.key,
      deviceName: device?.name ?? { compressor: '压缩机', fan: '冷风机', valve: '电子膨胀阀' }[kind],
      paramLabel: param.label,
      currentText: currentValueText(param.key, detail),
      targetText,
      boundText: param.bound ? `${formatNumber(param.bound.min, 1)}～${formatNumber(param.bound.max, 1)}${param.unit ?? ''}` : null,
      withinBound,
      dispatchText: execution ? (execution.status === 'queued' ? '已排队' : '已下发') : '待下发',
      effectAt: execution?.startedAt ?? null,
    };
  });
}

/* ---------- 效果验证清单 ---------- */

export interface VerifyCheck {
  key: string;
  label: string;
  state: 'ok' | 'pending' | 'bad';
  text: string;
}

export function verificationChecks(
  execution: ExecutionTask | null,
  detail: AnomalyEventDetail | null,
  hasNewCriticalAlert: boolean,
): VerifyCheck[] {
  const room = detail?.room;
  const target = room?.targetRange;
  const observed = execution?.observedSeries ?? [];
  const last = observed[observed.length - 1]?.value;
  const prev = observed[observed.length - 2]?.value;
  const inRange = last !== undefined && target ? last >= target.min && last <= target.max : false;
  const rateOk =
    last !== undefined && prev !== undefined ? Math.abs(last - prev) <= (room?.safetyParams.maxRatePerHour ?? Number.POSITIVE_INFINITY) : true;
  const overshoot = target ? observed.some((point) => point.value < target.min - 0.3) : false;
  const deviceStable = detail ? detail.devices.every((device) => device.status === 'running' || device.status === 'idle') : true;
  return [
    {
      key: 'range',
      label: '温度回落至目标区间',
      state: inRange ? 'ok' : 'pending',
      text: target
        ? last !== undefined
          ? `当前 ${formatNumber(last, 1)}°C / 目标 ${formatNumber(target.min, 0)}～${formatNumber(target.max, 0)}°C`
          : '等待观测数据'
        : '目标区间暂无数据',
    },
    {
      key: 'rate',
      label: '温度变化率处于安全范围',
      state: rateOk ? 'ok' : 'bad',
      text: last !== undefined && prev !== undefined ? `最近变化 ${formatNumber(Math.abs(last - prev), 2)}°C/步` : '观测点不足，持续观察',
    },
    {
      key: 'overshoot',
      label: '未出现过冲',
      state: overshoot ? 'bad' : 'ok',
      text: overshoot ? '观测曲线低于目标下限' : '观测曲线未越过目标下限',
    },
    {
      key: 'rollback',
      label: '未触发安全回退',
      state: execution?.triggeredRollback ? 'bad' : 'ok',
      text: execution?.triggeredRollback ?? '回退策略待命，未触发',
    },
    {
      key: 'devices',
      label: '设备运行稳定',
      state: deviceStable ? 'ok' : 'bad',
      text: deviceStable ? '关联设备无故障 / 离线' : '存在故障或离线设备',
    },
    {
      key: 'alerts',
      label: '无新增严重告警',
      state: hasNewCriticalAlert ? 'bad' : 'ok',
      text: hasNewCriticalAlert ? '出现新的严重告警' : '监测范围内无新增严重告警',
    },
  ];
}

/* ---------- 四级安全权限（L0/L1/L2/L3 边界） ---------- */

export type SecurityLevelState = 'auto-done' | 'need-human' | 'approved' | 'blocked' | 'idle';

export interface SecurityLevelRow {
  level: 'L0' | 'L1' | 'L2' | 'L3';
  title: string;
  scope: string;
  state: SecurityLevelState;
  stateLabel: string;
  note: string;
}

export function securityLevelRows(input: {
  toolsDone: number;
  simDone: boolean;
  approval: ApprovalRequest | null;
  stage: HomeStage;
  l3Blocked: number;
}): SecurityLevelRow[] {
  const { toolsDone, simDone, approval, stage, l3Blocked } = input;
  const l2State: SecurityLevelState =
    stage === 'awaitingApproval'
      ? 'need-human'
      : approval?.status === 'approved' || ['approved', 'executing', 'verifying', 'recovered'].includes(stage)
        ? 'approved'
        : approval?.status === 'rejected'
          ? 'idle'
          : 'idle';
  return [
    {
      level: 'L0',
      title: '观察和分析',
      scope: '读取数据 · 查询日志 · 查询知识库 · 生成诊断与报告',
      state: toolsDone > 0 ? 'auto-done' : 'idle',
      stateLabel: toolsDone > 0 ? '已自动完成' : '未触发',
      note: toolsDone > 0 ? `已自动完成 ${toolsDone} 项，无需人工确认` : '读取类动作将自动执行并记录',
    },
    {
      level: 'L1',
      title: '低风险非控制动作',
      scope: '启动仿真 · 重新采样 · 增加监测频率 · 巡检建议',
      state: simDone ? 'auto-done' : 'idle',
      stateLabel: simDone ? '已自动执行' : '未触发',
      note: simDone ? '安全规则校验通过，已自动执行' : '校验通过后自动执行',
    },
    {
      level: 'L2',
      title: '有边界的设备控制',
      scope: '调整目标温度 · 风机 · 阀门开度 · 切换控制策略',
      state: l2State,
      stateLabel: l2State === 'need-human' ? '等待人工确认' : l2State === 'approved' ? '已批准' : '未触发',
      note: '该操作将改变设备运行参数，需要人工二次确认',
    },
    {
      level: 'L3',
      title: '永久禁止',
      scope: '关闭安全联锁 · 越设备硬件范围 · 绕过保护参数',
      state: l3Blocked > 0 ? 'blocked' : 'idle',
      stateLabel: l3Blocked > 0 ? `${l3Blocked} 项已被阻止` : '无拦截记录',
      note: '被安全规则引擎永久阻止，仅进入安全审计，不提供批准 / 强制 / 绕过入口',
    },
  ];
}
