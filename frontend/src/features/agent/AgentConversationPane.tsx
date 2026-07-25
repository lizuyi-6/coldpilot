import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Loader2,
  Paperclip,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { AnomalyEventSummary } from '@/domain/types';
import type { UseWorkbench } from '@/state/useWorkbench';
import { TASK_STATUS_META } from '@/domain/constants/taskStatus';
import { deviceStatusLabel } from '@/domain/viewModels';
import { DEVICE_KIND_ICON, deviceStatusTagTone } from '@/components/domain/deviceMeta';
import { Panel } from '@/components/ui/Panel';
import { Tag, type TagTone } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfidenceBar } from '@/components/ui/ConfidenceBar';
import { StatusDot } from '@/components/ui/StatusDot';
import { deviceOperationalHint } from '@/features/monitoring/monitoringView';
import { TrendSection } from '@/features/diagnosis/TrendSection';
import { ExecutionMonitor } from '@/features/execution/ExecutionMonitor';
import { EventReportView } from '@/features/report/EventReportView';
import {
  ACTION_PRIORITY_LABEL,
  CONFIDENCE_TIER_LABEL,
  conclusionView,
  goalForEvent,
  toolSteps,
  type ConfidenceTier,
  type ToolStep,
} from './agentView';
import { formatTimeHM } from '@/utils/formatTime';
import styles from './agent.module.css';

type ResultTabKey = 'conclusion' | 'evidence' | 'devices' | 'trend';

const RESULT_TABS: { value: ResultTabKey; label: string }[] = [
  { value: 'conclusion', label: '分析结论' },
  { value: 'evidence', label: '数据证据' },
  { value: 'devices', label: '设备状态' },
  { value: 'trend', label: '历史趋势' },
];

const TIER_TONE: Record<ConfidenceTier, TagTone> = {
  high: 'accent',
  medium: 'warning',
  low: 'neutral',
};

function agentStatusTone(status: UseWorkbench['status']): TagTone {
  if (status === 'diagnosing') return 'info';
  if (status === 'diagnosisFailed' || status === 'safeFallback') return 'danger';
  if (status === 'detected') return 'warning';
  return 'accent';
}

function StepNode({ step }: { step: ToolStep }) {
  const stateClass =
    step.state === 'done'
      ? styles.stepNodeDone
      : step.state === 'running'
        ? styles.stepNodeRunning
        : step.state === 'failed'
          ? styles.stepNodeFailed
          : '';
  const tooltip = [step.inputSummary ? `输入：${step.inputSummary}` : null, step.outputSummary ? `输出：${step.outputSummary}` : null]
    .filter(Boolean)
    .join('\n');
  return (
    <span className={`${styles.stepNode} ${stateClass}`} title={tooltip || step.label}>
      {step.state === 'done' ? (
        <Check size={12} aria-hidden />
      ) : step.state === 'running' ? (
        <Loader2 size={12} className={styles.stepSpin} aria-hidden />
      ) : step.state === 'failed' ? (
        <X size={12} aria-hidden />
      ) : null}
      {step.label}
      {step.durationMs !== null && <span className={styles.stepDuration}>{step.durationMs}ms</span>}
    </span>
  );
}

interface AgentConversationPaneProps {
  wb: UseWorkbench;
  event: AnomalyEventSummary | null;
}

/** 中栏：Agent 对话与分析（任务入口 + 工具进度 + 结果 Tabs + 追问）。 */
export function AgentConversationPane({ wb, event }: AgentConversationPaneProps) {
  const navigate = useNavigate();
  const { data, status } = wb;
  const [activeTab, setActiveTab] = useState<ResultTabKey>('conclusion');
  const [traceExpanded, setTraceExpanded] = useState(false);

  const task = data.agentTask;
  const diagnosing = status === 'diagnosing';
  const steps = useMemo(() => toolSteps(task, diagnosing), [task, diagnosing]);
  const conclusion = useMemo(() => (data.diagnosis ? conclusionView(data.diagnosis) : null), [data.diagnosis]);
  const goalText = task?.goal ?? (event ? goalForEvent(event) : '');

  const lastUpdate = task ? formatTimeHM(task.finishedAt ?? task.startedAt) : null;
  const devices = data.eventDetail?.devices ?? [];

  return (
    <>
      {/* 对话入口：任务目标 + Agent 状态（对话只作任务入口与过程说明，非聊天软件）。 */}
      <Panel
        title="Agent 对话与分析"
        action={
          <div className={styles.chatHeadMeta}>
            <Tag tone={agentStatusTone(status)}>{TASK_STATUS_META[status].label}</Tag>
            {lastUpdate && <span>更新于 {lastUpdate}</span>}
          </div>
        }
      >
        <div className={styles.mainCol}>
          {goalText && (
            <div className={`${styles.message} ${styles.messageUser}`}>
              <span className={`${styles.avatar} ${styles.avatarUser}`}>你</span>
              <div className={`${styles.bubble} ${styles.bubbleUser}`}>
                <div className={styles.bubbleMeta}>
                  <span>{task ? formatTimeHM(task.startedAt) : '待发起'}</span>
                </div>
                {goalText}
              </div>
            </div>
          )}
          <div className={styles.message}>
            <span className={`${styles.avatar} ${styles.avatarAgent}`}>
              <Bot size={15} aria-hidden />
            </span>
            <div className={`${styles.bubble} ${styles.bubbleAgent}`}>
              <div className={styles.bubbleMeta}>
                <span>ColdPilot 智能体</span>
                {diagnosing && <Tag tone="info">分析中</Tag>}
              </div>
              {data.diagnosis
                ? data.diagnosis.understanding
                : diagnosing
                  ? `正在分析${event?.roomName ?? ''}状态、设备运行、环境因素与历史异常…`
                  : '尚未发起诊断。点击下方「开始诊断」，我将读取实时数据、设备与历史记录并给出原因分析。'}
            </div>
          </div>

          {status === 'diagnosisFailed' && (
            <InlineAlert tone="danger" title="诊断失败">
              {wb.context.error ?? '诊断任务失败'}，可点击「重新诊断」重试。
            </InlineAlert>
          )}
          {status === 'safeFallback' && (
            <InlineAlert tone="danger" title="安全模式">
              <ShieldAlert size={14} aria-hidden style={{ verticalAlign: -2 }} />{' '}
              {wb.context.error ?? '已进入安全模式'}。AI 控制已置灰，系统回退传统规则 / PID 兜底，需要人工介入。
            </InlineAlert>
          )}
          {(status === 'detected' || status === 'diagnosisFailed') && (
            <div>
              <Button variant="primary" size="md" onClick={() => void wb.startDiagnosis()}>
                {status === 'diagnosisFailed' ? (
                  <RotateCcw size={14} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
                ) : (
                  <Play size={14} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
                )}
                {status === 'diagnosisFailed' ? '重新诊断' : '开始诊断'}
              </Button>
            </div>
          )}
        </div>
      </Panel>

      {/* 工具调用进度：真实工具轨迹 + 结论步骤。 */}
      {task && (
        <Panel title="工具调用进度">
          <div className={styles.stepper} role="list" aria-label="工具调用步骤">
            {steps.map((step, index) => (
              <span key={step.key} className={styles.step} role="listitem">
                <StepNode step={step} />
                {index < steps.length - 1 && <ChevronRight size={13} className={styles.stepArrow} aria-hidden />}
              </span>
            ))}
          </div>
          {task.tools.length > 0 && (
            <>
              <button type="button" className={styles.disclosureBtn} onClick={() => setTraceExpanded((v) => !v)}>
                {traceExpanded ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
                {traceExpanded ? '收起输入/输出摘要' : '展开输入/输出摘要'}
              </button>
              {traceExpanded && (
                <div className={styles.toolDetails}>
                  {task.tools.map((tool) => (
                    <div key={tool.id} className={styles.toolDetailRow}>
                      <b>{tool.label}</b>
                      <span className={styles.stepDuration}> · {tool.durationMs}ms</span>
                      <div>
                        <span className={styles.toolDetailLabel}>输入</span>
                        {tool.inputSummary}
                      </div>
                      <div>
                        <span className={styles.toolDetailLabel}>输出</span>
                        {tool.outputSummary}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>
      )}

      {/* 分析结果 Tabs。 */}
      <Panel>
        <div className={styles.resultTabs} role="tablist" aria-label="分析结果">
          {RESULT_TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={activeTab === tab.value}
              className={`${styles.resultTab} ${activeTab === tab.value ? styles.resultTabActive : ''}`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.tabBody}>
          {activeTab === 'conclusion' &&
            (conclusion ? (
              <>
                <section aria-label="可能原因">
                  <h4 className={styles.blockTitle}>可能原因（按置信度排序）</h4>
                  <div>
                    {conclusion.causes.map((cause) => (
                      <div key={cause.id} className={styles.causeRow}>
                        <span className={styles.causeRank}>{cause.rank}</span>
                        <div className={styles.causeBody}>
                          <div className={styles.causeTop}>
                            <span className={styles.causeLabel}>{cause.label}</span>
                            <Tag tone={TIER_TONE[cause.tier]}>{CONFIDENCE_TIER_LABEL[cause.tier]}</Tag>
                            <span className={styles.causeConf}>
                              <ConfidenceBar value={cause.confidencePct / 100} format="percent" />
                            </span>
                          </div>
                          {cause.evidenceDigest.map((digest) => (
                            <span key={digest} className={styles.causeEvidence}>
                              {digest}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section aria-label="关键证据摘要">
                  <h4 className={styles.blockTitle}>关键证据摘要</h4>
                  <div className={styles.evidenceList}>
                    {conclusion.evidenceDigest.map((digest) => (
                      <div key={digest} className={styles.evidenceItem}>
                        <Check size={13} className={styles.evidenceKind} color="var(--color-accent)" aria-hidden />
                        <span>{digest}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section aria-label="推荐处理措施">
                  <h4 className={styles.blockTitle}>
                    推荐处理措施
                    <Button variant="secondary" size="sm" onClick={() => navigate('/strategy')}>
                      <ClipboardList size={13} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
                      进入策略与仿真
                    </Button>
                  </h4>
                  <ol className={styles.actionList}>
                    {conclusion.actions.map((action) => (
                      <li key={action.key} className={styles.actionItem}>
                        <span className={styles.actionText}>
                          {action.text}
                          <span className={styles.actionFrom}>由「{action.fromCause}」导出</span>
                        </span>
                        <Tag tone={action.priority === 'high' ? 'danger' : action.priority === 'medium' ? 'warning' : 'neutral'}>
                          优先级 {ACTION_PRIORITY_LABEL[action.priority]}
                        </Tag>
                      </li>
                    ))}
                  </ol>
                </section>

                {conclusion.risks.length > 0 && (
                  <div className={styles.riskBox} role="note" aria-label="风险提示">
                    <CircleAlert size={14} aria-hidden style={{ flex: 'none', marginTop: 2 }} color="var(--color-warning)" />
                    <span>
                      <b>风险提示：</b>
                      {conclusion.risks.join('；')}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                title={diagnosing ? '分析结论生成中' : '暂无分析结论'}
                description={diagnosing ? 'Agent 正在调用工具分析，请稍候…' : '发起诊断后在此展示原因排序、证据与推荐措施。'}
              />
            ))}

          {activeTab === 'evidence' &&
            (data.diagnosis ? (
              <>
                <section aria-label="数据源">
                  <h4 className={styles.blockTitle}>本次分析使用的数据源</h4>
                  <div className={styles.evidenceChips}>
                    {data.diagnosis.dataSources.map((source) => (
                      <Tag key={source} tone="neutral">
                        {source}
                      </Tag>
                    ))}
                  </div>
                </section>
                <section aria-label="证据明细">
                  <h4 className={styles.blockTitle}>证据明细（正 / 反）</h4>
                  <div className={styles.evidenceList}>
                    {data.diagnosis.causes.flatMap((cause) =>
                      cause.evidence.map((evidence) => (
                        <div key={evidence.id} className={styles.evidenceItem}>
                          <Tag tone={evidence.kind === 'supporting' ? 'accent' : 'neutral'}>
                            {evidence.kind === 'supporting' ? '支持' : '反向'}
                          </Tag>
                          <span>
                            {evidence.summary}
                            <span className={styles.evidenceSource}>
                              [{cause.label} · {evidence.sourceRef}]
                            </span>
                          </span>
                        </div>
                      )),
                    )}
                  </div>
                </section>
              </>
            ) : (
              <EmptyState title="暂无数据证据" description="诊断完成后展示证据与数据来源。" />
            ))}

          {activeTab === 'devices' &&
            (devices.length > 0 ? (
              <div className={styles.deviceRows}>
                {devices.map((device) => {
                  const Icon = DEVICE_KIND_ICON[device.kind];
                  const hint = deviceOperationalHint(device);
                  return (
                    <div key={device.id} className={styles.deviceRow}>
                      <span className={styles.deviceIcon}>
                        <Icon size={15} aria-hidden />
                      </span>
                      <span className={styles.deviceName} title={device.name}>
                        {device.name}
                      </span>
                      {hint && <span className={styles.deviceHint}>{hint}</span>}
                      <StatusDot
                        tone={device.status === 'running' ? 'ok' : device.status === 'idle' ? 'muted' : 'danger'}
                        label={deviceStatusLabel(device.status)}
                      />
                      <Tag tone={deviceStatusTagTone(device.status)}>{deviceStatusLabel(device.status)}</Tag>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="暂无设备数据" description="事件详情加载后展示关联设备状态。" />
            ))}

          {activeTab === 'trend' && <TrendSection wb={wb} />}
        </div>
      </Panel>

      {/* L2 执行与报告（状态机后续阶段，保留原有流程呈现）。 */}
      <ExecutionMonitor wb={wb} />
      <EventReportView wb={wb} />

      {/* 追问输入：追问接口未接入后端，输入与发送保持禁用并说明原因。 */}
      <div className={styles.composer}>
        <div className={styles.composerInputRow}>
          <textarea
            className={styles.composerInput}
            disabled
            rows={1}
            aria-label="追问输入（暂未接入）"
            placeholder="追问能力暂未接入后端接口；可通过「开始诊断 / 重新诊断」发起新的分析任务。"
          />
          <IconButton aria-label="上传附件（暂未接入）" disabled title="后端未提供附件上传接口，暂不可用">
            <Paperclip size={15} />
          </IconButton>
          <IconButton aria-label="发送追问（暂未接入）" disabled title="追问接口暂未接入后端，暂不可用">
            <Send size={15} />
          </IconButton>
        </div>
        <div className={styles.composerMeta}>
          <span>追问接口未接入 · 诊断任务经 ColdPilotClient 真实发起</span>
          <span className="numeric">0/500</span>
        </div>
      </div>
    </>
  );
}
