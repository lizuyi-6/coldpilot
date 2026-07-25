import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Cog,
  Eye,
  FlaskConical,
  Hourglass,
  Loader2,
  Lock,
  Play,
  Radar,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  UserCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { AnomalyEventSummary, SecurityAuditEntry } from '@/domain/types';
import { useAppData } from '@/state/appData';
import { useAgentCenter, type UseAgentCenter } from './useAgentCenter';
import {
  causeViews,
  computePhases,
  controlActionRows,
  decisionView,
  judgmentOf,
  monitoringItems,
  securityLevelRows,
  subStatusOf,
  verificationChecks,
  type HomePhase,
  type HomePhaseKey,
  type PhaseStatus,
} from './agentHomeView';
import { Panel } from '@/components/ui/Panel';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Sparkline } from '@/components/ui/Sparkline';
import { ApprovalLevelBadge } from '@/components/domain/ApprovalLevelBadge';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { formatDuration, formatTimeHM } from '@/utils/formatTime';
import { formatNumber } from '@/utils/formatNumber';
import styles from './agentHome.module.css';

const PHASE_ICON: Record<HomePhaseKey, LucideIcon> = {
  detect: Radar,
  diagnose: Stethoscope,
  plan: ClipboardList,
  simulate: FlaskConical,
  safety: ShieldCheck,
  approve: UserCheck,
  execute: Cog,
  verify: Activity,
};

const LEVEL_ICON: Record<string, LucideIcon> = {
  L0: Eye,
  L1: Play,
  L2: SlidersHorizontal,
  L3: Lock,
};

function PhaseStatusIcon({ status }: { status: PhaseStatus }) {
  switch (status) {
    case 'done':
      return <Check size={11} aria-hidden />;
    case 'running':
      return <Loader2 size={11} className={styles.spin} aria-hidden />;
    case 'failed':
      return <X size={11} aria-hidden />;
    case 'blocked':
      return <Lock size={10} aria-hidden />;
    case 'awaiting':
      return <Hourglass size={10} aria-hidden />;
    default:
      return null;
  }
}

/** 八阶段任务链单元格：图标 + 文字 + 状态三重表达。 */
function PhaseCell({ phase, active }: { phase: HomePhase; active: boolean }) {
  const Icon = PHASE_ICON[phase.key];
  return (
    <div
      className={`${styles.phaseCell} ${styles[`phase-${phase.status}`]} ${active ? styles.phaseActive : ''}`}
      title={`${phase.label} · ${phase.statusLabel}${phase.toolSummary ? `\n工具：${phase.toolSummary}` : ''}${phase.conclusion ? `\n${phase.conclusion}` : ''}`}
    >
      <span className={styles.phaseIcon}>
        <Icon size={13} aria-hidden />
      </span>
      <span className={styles.phaseText}>
        <span className={styles.phaseLabel}>{phase.label}</span>
        <span className={styles.phaseState}>
          <PhaseStatusIcon status={phase.status} />
          {phase.statusLabel}
          {phase.needsHuman ? ' · 需人工' : ''}
          {phase.durationText ? ` · ${phase.durationText}` : ''}
        </span>
      </span>
    </div>
  );
}

/** 诊断工具调用摘要：默认简要，可展开输入 / 输出详情（不直接展示大段原始 JSON）。 */
function ToolTrace({ ac }: { ac: UseAgentCenter }) {
  const [expanded, setExpanded] = useState(false);
  const task = ac.data.task;
  if (!task) return null;
  return (
    <section className={styles.card} aria-label="工具调用">
      <div className={styles.cardHead}>
        <b>Agent 工具调用</b>
        <Tag tone="accent">{task.tools.length} 项已执行</Tag>
      </div>
      <ul className={styles.toolList}>
        {task.tools.map((tool) => (
          <li key={tool.id} className={styles.toolItem}>
            <span className={`${styles.toolStatus} ${tool.status === 'succeeded' ? styles.toolOk : styles.toolBad}`}>
              {tool.status === 'succeeded' ? <Check size={11} aria-hidden /> : <X size={11} aria-hidden />}
            </span>
            <span className={styles.toolLabel}>{tool.label}</span>
            <span className={`${styles.toolMs} numeric`}>{tool.durationMs}ms</span>
          </li>
        ))}
        {task.status === 'running' && (
          <li className={styles.toolItem}>
            <span className={styles.toolStatus}>
              <Loader2 size={11} className={styles.spin} aria-hidden />
            </span>
            <span className={styles.toolLabel}>正在调用下一项工具…</span>
          </li>
        )}
      </ul>
      {task.tools.length > 0 && (
        <>
          <button type="button" className={styles.disclosure} onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
            {expanded ? '收起输入 / 输出摘要' : '展开输入 / 输出摘要'}
          </button>
          {expanded && (
            <div className={styles.toolDetails}>
              {task.tools.map((tool) => (
                <div key={tool.id} className={styles.toolDetailRow}>
                  <b>{tool.label}</b>
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
    </section>
  );
}

/** 诊断结论（紧凑）：原因 + 置信度 + 正/反证据 + 是否需现场确认，下方衔接下一步。 */
function CauseDigest({ ac }: { ac: UseAgentCenter }) {
  const diagnosis = ac.data.diagnosis;
  const causes = useMemo(() => (diagnosis ? causeViews(diagnosis) : []), [diagnosis]);
  if (!diagnosis) {
    return (
      <section className={styles.card} aria-label="诊断结论">
        <div className={styles.cardHead}>
          <b>原因诊断</b>
        </div>
        <p className={styles.muted}>诊断已在其他会话完成，原因详情请进入完整工作台查看。</p>
      </section>
    );
  }
  return (
    <section className={styles.card} aria-label="诊断结论">
      <div className={styles.cardHead}>
        <b>主要原因</b>
        <span className={styles.muted}>按置信度排序</span>
      </div>
      <ol className={styles.causeList}>
        {causes.map((cause) => (
          <li key={cause.id} className={styles.causeItem}>
            <span className={styles.causeRank}>{cause.rank}</span>
            <div className={styles.causeBody}>
              <div className={styles.causeTop}>
                <span className={styles.causeLabel}>{cause.label}</span>
                <span className={`${styles.causeConf} numeric`}>置信度 {cause.confidencePct}%</span>
                {cause.needFieldCheck && <Tag tone="warning">需现场确认</Tag>}
              </div>
              <span className={styles.causeEvidence}>证据：{cause.evidence}</span>
              {cause.counter && <span className={styles.causeCounter}>反向：{cause.counter}</span>}
              {cause.fieldCheck && <span className={styles.causeCheck}>现场核查：{cause.fieldCheck}</span>}
            </div>
          </li>
        ))}
      </ol>
      <p className={styles.nextStep}>
        已自动生成 {ac.data.plans.length} 个控制方案，正在进行仿真与安全校验。
      </p>
    </section>
  );
}

/** 自主决策卡：推荐动作 + 理由 + 仿真量化依据 + 回退条件。 */
function DecisionCard({ ac }: { ac: UseAgentCenter }) {
  const navigate = useNavigate();
  const decision = useMemo(() => decisionView(ac.data.plans, ac.data.simulations), [ac.data.plans, ac.data.simulations]);
  if (!decision) return null;
  return (
    <section className={styles.card} aria-label="当前推荐动作">
      <div className={styles.cardHead}>
        <b>当前推荐动作：{decision.planName}</b>
        <span className={styles.cardHeadRight}>
          <ApprovalLevelBadge level="L2" />
          {decision.simulated && <DemoDataBadge kind="simulated" />}
        </span>
      </div>
      <p className={styles.muted}>{decision.approach} · 方案版本 v{decision.version}</p>
      {decision.recoveryHours !== null && (
        <div className={styles.statRow}>
          <span>
            预计恢复 <b className="numeric">{formatNumber(decision.recoveryHours, 1)} h</b>
          </span>
          <span>
            预计能耗 <b className="numeric">{decision.energyKWh?.toLocaleString('zh-CN')} kWh</b>
          </span>
          <span>
            过冲风险 <b>{decision.overshootRisk}</b>
          </span>
          <span>
            冻害风险 <b>{decision.frostRisk}</b>
          </span>
        </div>
      )}
      <p className={styles.reason}>推荐理由：{decision.whyRecommended}</p>
      {decision.whyNotAlternative && <p className={styles.reason}>未选备选：{decision.whyNotAlternative}</p>}
      <p className={styles.muted}>回退条件：{decision.rollbackConditions.join('；')}</p>
      <div className={styles.linkRow}>
        <button type="button" className={styles.linkBtn} onClick={() => navigate('/strategy')}>
          查看方案对比 ›
        </button>
        <button type="button" className={styles.linkBtn} onClick={() => navigate('/strategy')}>
          查看仿真详情 ›
        </button>
      </div>
    </section>
  );
}

/** L2 审批卡：首页核心内容，等待人工二次确认。 */
function ApprovalCard({ ac, event, onApprove, onReject }: { ac: UseAgentCenter; event: AnomalyEventSummary; onApprove: () => void; onReject: () => void }) {
  const navigate = useNavigate();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const approval = ac.data.approval;
  const plan = useMemo(() => {
    const plans = ac.data.plans;
    return plans.find((p) => p.id === approval?.planId) ?? plans.find((p) => p.kind === 'recommended') ?? plans[0] ?? null;
  }, [ac.data.plans, approval?.planId]);
  const sim = plan ? ac.data.simulations[plan.id] : undefined;
  const rows = useMemo(() => controlActionRows(plan, ac.data.detail, null), [plan, ac.data.detail]);
  const tempSeries = ac.data.detail?.telemetry.find((series) => series.metric === 'temperature');
  const latestTemp = tempSeries?.points[tempSeries.points.length - 1]?.value;
  const target = ac.data.detail?.room.targetRange;

  return (
    <section className={`${styles.card} ${styles.cardWarning}`} aria-label="待批准控制方案">
      <div className={styles.cardHead}>
        <b>
          <Hourglass size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 5 }} />
          待批准控制方案
        </b>
        <span className={styles.cardHeadRight}>
          <ApprovalLevelBadge level="L2" />
          {sim && <DemoDataBadge kind="simulated" />}
        </span>
      </div>

      <div className={styles.kvGrid}>
        <span className={styles.kvItem}>
          <i>事件</i>
          {event.roomName}
          {event.title}
        </span>
        <span className={styles.kvItem}>
          <i>推荐方案</i>
          {plan?.name ?? '—'}
        </span>
        <span className={styles.kvItem}>
          <i>方案版本</i>v{plan?.version ?? approval?.planVersion ?? '—'}
        </span>
        <span className={styles.kvItem}>
          <i>当前温度</i>
          {latestTemp !== undefined ? `${formatNumber(latestTemp, 1)}°C` : '暂无数据'}
          {target ? `（目标 ${formatNumber(target.min, 0)}～${formatNumber(target.max, 0)}°C）` : ''}
        </span>
      </div>

      {rows.length > 0 && (
        <table className={styles.paramTable}>
          <thead>
            <tr>
              <th>控制设备</th>
              <th>参数</th>
              <th>当前值</th>
              <th>目标值</th>
              <th>允许范围</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.deviceName}</td>
                <td>{row.paramLabel}</td>
                <td className="numeric">{row.currentText}</td>
                <td className="numeric">{row.targetText}</td>
                <td className="numeric">{row.boundText ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sim && (
        <p className={styles.muted}>
          仿真结果：预计 {formatNumber(sim.recoveryHours, 1)} 小时恢复 · 能耗 {sim.energyKWh.toLocaleString('zh-CN')} kWh · 过冲风险{' '}
          {sim.overshootRisk === 'low' ? '低' : sim.overshootRisk === 'medium' ? '中' : '高'} · 冻害风险{' '}
          {sim.frostRisk === 'low' ? '低' : sim.frostRisk === 'medium' ? '中' : '高'}
        </p>
      )}
      {plan && <p className={styles.muted}>回退条件：{plan.rollbackConditions.join('；')}</p>}
      <p className={styles.muted}>审批时效：绑定方案版本 v{plan?.version ?? approval?.planVersion ?? '—'}，方案变更后本次审批自动失效。</p>

      {approval && (
        <>
          <button type="button" className={styles.disclosure} onClick={() => setSafetyOpen((v) => !v)}>
            {safetyOpen ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
            查看安全校验（{approval.safetyChecks.filter((check) => check.passed).length}/{approval.safetyChecks.length} 通过）
          </button>
          {safetyOpen && (
            <ul className={styles.safetyList}>
              {approval.safetyChecks.map((check) => (
                <li key={check.key}>
                  <span className={check.passed ? styles.toolOk : styles.toolBad}>
                    {check.passed ? <Check size={11} aria-hidden /> : <X size={11} aria-hidden />}
                  </span>
                  {check.label}
                  {check.detail ? <span className={styles.muted}> · {check.detail}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className={styles.approveNote}>批准后 Agent 将自动下发结构化控制命令，并持续验证执行效果。</p>
      <div className={styles.actionRow}>
        <Button variant="secondary" size="sm" onClick={onReject} disabled={ac.busy || !approval}>
          驳回
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('/strategy')}>
          查看完整方案
        </Button>
        <Button variant="primary" size="sm" onClick={onApprove} disabled={ac.busy || !approval}>
          <ShieldCheck size={13} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
          批准并执行
        </Button>
      </div>
    </section>
  );
}

/** 执行卡：结构化控制动作 + 设备反馈 + 安全边界（禁止自由文本模拟 PLC）。 */
function ExecutionCard({ ac }: { ac: UseAgentCenter }) {
  const plan = useMemo(() => {
    const plans = ac.data.plans;
    return plans.find((p) => p.id === ac.data.execution?.planId) ?? plans.find((p) => p.kind === 'recommended') ?? plans[0] ?? null;
  }, [ac.data.plans, ac.data.execution?.planId]);
  const execution = ac.data.execution;
  const rows = useMemo(() => controlActionRows(plan, ac.data.detail, execution), [plan, ac.data.detail, execution]);
  const sim = plan ? ac.data.simulations[plan.id] : undefined;
  const progressPct =
    execution && sim && sim.predictedSeries.length > 0
      ? Math.min(100, Math.round((execution.observedSeries.length / sim.predictedSeries.length) * 100))
      : execution
        ? Math.min(99, execution.observedSeries.length * 10)
        : 0;

  return (
    <section className={styles.card} aria-label="控制执行中">
      <div className={styles.cardHead}>
        <b>
          <Cog size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 5 }} />
          控制执行中
        </b>
        <span className={styles.cardHeadRight}>
          <DemoDataBadge kind="simulated" />
        </span>
      </div>

      {rows.length > 0 ? (
        <table className={styles.paramTable}>
          <thead>
            <tr>
              <th>控制设备</th>
              <th>参数</th>
              <th>当前值 → 目标值</th>
              <th>安全边界</th>
              <th>下发状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.deviceName}</td>
                <td>{row.paramLabel}</td>
                <td className="numeric">
                  {row.currentText} → <b>{row.targetText}</b>
                </td>
                <td>
                  {row.withinBound === false ? (
                    <Tag tone="danger">越界</Tag>
                  ) : (
                    <Tag tone="success">边界内{row.boundText ? ` ${row.boundText}` : ''}</Tag>
                  )}
                </td>
                <td>
                  {row.dispatchText}
                  {row.effectAt ? ` · ${formatTimeHM(row.effectAt)} 生效` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.muted}>控制命令已由其他会话下发，执行曲线请进入完整工作台查看。</p>
      )}

      <div className={styles.execMeta}>
        <span>
          <ShieldCheck size={12} aria-hidden /> 安全联锁：正常
        </span>
        <span>回退策略：已启用</span>
        <span>命令绑定：方案版本 v{plan?.version ?? execution?.planVersion ?? '—'}</span>
      </div>
      <div className={styles.progressRow}>
        <span className={styles.muted}>执行进度</span>
        <span className={styles.progressTrack}>
          <span className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </span>
        <span className="numeric">{progressPct}%</span>
      </div>
      {execution && execution.observedSeries.length > 1 && (
        <div className={styles.sparkRow}>
          <Sparkline
            data={execution.observedSeries.map((point) => point.value)}
            width={220}
            height={30}
            band={
              ac.data.detail?.room.targetRange
                ? [ac.data.detail.room.targetRange.min, ac.data.detail.room.targetRange.max]
                : undefined
            }
          />
          <span className={styles.muted}>
            观测 {execution.observedSeries.length} 点 · 最新 {formatNumber(execution.observedSeries[execution.observedSeries.length - 1].value, 1)}°C
          </span>
        </div>
      )}
    </section>
  );
}

/** 验证卡：executing → verifying → recovered，验证通过才判定恢复。 */
function VerificationCard({ ac, hasNewCritical }: { ac: UseAgentCenter; hasNewCritical: boolean }) {
  const execution = ac.data.execution;
  const checks = useMemo(
    () => verificationChecks(execution, ac.data.detail, hasNewCritical),
    [execution, ac.data.detail, hasNewCritical],
  );
  const observedSeconds = execution ? Math.max(0, Math.round((Date.now() - Date.parse(execution.startedAt)) / 1000)) : 0;
  return (
    <section className={styles.card} aria-label="效果验证中">
      <div className={styles.cardHead}>
        <b>
          <Activity size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 5 }} />
          效果验证中
        </b>
        <span className={styles.cardHeadRight}>
          <DemoDataBadge kind="simulated" />
        </span>
      </div>
      <p className={styles.muted}>
        状态流转：执行完成 → 验证 → 恢复（验证通过才判定恢复）。已观察约 {observedSeconds} 秒 · {execution?.observedSeries.length ?? 0} 个观测点。
      </p>
      <ul className={styles.checkList}>
        {checks.map((check) => (
          <li key={check.key}>
            <span className={check.state === 'ok' ? styles.toolOk : check.state === 'bad' ? styles.toolBad : styles.toolPending}>
              {check.state === 'ok' ? <Check size={11} aria-hidden /> : check.state === 'bad' ? <X size={11} aria-hidden /> : <Loader2 size={11} className={styles.spin} aria-hidden />}
            </span>
            <span className={styles.checkLabel}>{check.label}</span>
            <span className={styles.muted}>{check.text}</span>
          </li>
        ))}
      </ul>
      {execution && execution.observedSeries.length > 1 && (
        <div className={styles.sparkRow}>
          <Sparkline
            data={execution.observedSeries.map((point) => point.value)}
            width={220}
            height={30}
            band={
              ac.data.detail?.room.targetRange
                ? [ac.data.detail.room.targetRange.min, ac.data.detail.room.targetRange.max]
                : undefined
            }
          />
          <span className={styles.muted}>温度变化趋势（阴影为目标区间）</span>
        </div>
      )}
      <p className={styles.muted}>恢复判定：温度回落至目标区间并保持，设备稳定，无新增严重告警，未触发安全回退。</p>
    </section>
  );
}

/** 已恢复卡：恢复结果 + 审计留痕 + 报告入口。 */
function RecoveredCard({ ac, event }: { ac: UseAgentCenter; event: AnomalyEventSummary }) {
  const navigate = useNavigate();
  const execution = ac.data.execution;
  const approval = ac.data.approval;
  const plan = ac.data.plans.find((p) => p.id === execution?.planId) ?? ac.data.plans.find((p) => p.kind === 'recommended');
  return (
    <section className={`${styles.card} ${styles.cardSuccess}`} aria-label="已恢复">
      <div className={styles.cardHead}>
        <b>
          <Check size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 5 }} />
          已恢复
        </b>
        <span className={styles.cardHeadRight}>
          <DemoDataBadge kind="simulated" />
        </span>
      </div>
      <div className={styles.kvGrid}>
        <span className={styles.kvItem}>
          <i>恢复时间</i>
          {execution?.finishedAt ? formatTimeHM(execution.finishedAt) : '暂无数据'}
        </span>
        <span className={styles.kvItem}>
          <i>实际恢复用时</i>
          {execution?.recoveryMinutes !== undefined ? `约 ${formatDuration(execution.recoveryMinutes)}` : '暂无数据'}
        </span>
        <span className={styles.kvItem}>
          <i>实际能耗</i>暂无数据（后端未回传执行能耗）
        </span>
        <span className={styles.kvItem}>
          <i>执行方案</i>
          {plan ? `${plan.name} · v${plan.version}` : '暂无数据'}
        </span>
        <span className={styles.kvItem}>
          <i>审批记录</i>
          {approval?.decidedBy ? `${approval.decidedBy}${approval.decidedAt ? ` · ${formatTimeHM(approval.decidedAt)}` : ''} 批准` : '暂无数据'}
        </span>
        <span className={styles.kvItem}>
          <i>后续观察</i>持续监测中，再次越限将自动重新诊断
        </span>
      </div>
      {ac.data.report ? (
        <p className={styles.muted}>{ac.data.report.summary}</p>
      ) : (
        <p className={styles.muted}>事件报告生成中或不可用。</p>
      )}
      <div className={styles.linkRow}>
        <button type="button" className={styles.linkBtn} onClick={() => navigate('/reports')}>
          查看事件报告 ›
        </button>
        <button type="button" className={styles.linkBtn} onClick={() => navigate(`/workbench/${event.id}`)}>
          完整工作台 ›
        </button>
      </div>
    </section>
  );
}

/** L3 永久禁止卡：红色锁定 + 触发规则 + 拦截原因，只进审计，无任何绕过入口。 */
function L3BlockedCard({ entries }: { entries: SecurityAuditEntry[] }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  const latest = entries[entries.length - 1];
  return (
    <>
      <section className={`${styles.card} ${styles.cardDanger}`} aria-label="L3 永久禁止">
        <div className={styles.cardHead}>
          <b>
            <Lock size={13} aria-hidden style={{ verticalAlign: -2, marginRight: 5 }} />
            L3 永久禁止 · {entries.length} 项动作已被安全规则引擎阻止
          </b>
          <ApprovalLevelBadge level="L3" />
        </div>
        <p className={styles.l3Action}>{latest.action}</p>
        <p className={styles.muted}>
          触发规则：{latest.triggeredRule} · {formatTimeHM(latest.attemptedAt)} · 来源：{latest.source === 'agent' ? 'Agent' : latest.source === 'user' ? '人工' : '外部'}
        </p>
        <p className={styles.muted}>拦截原因：{latest.reason}</p>
        <p className={styles.l3Note}>该级别不提供批准、强制执行、管理员绕过或修改后直接执行；仅进入安全审计记录。</p>
        <div className={styles.linkRow}>
          <button type="button" className={styles.linkBtn} onClick={() => setOpen(true)}>
            查看安全审计记录 ›
          </button>
        </div>
      </section>

      <Dialog open={open} title="L3 安全审计记录" onClose={() => setOpen(false)} width={520}>
        <ul className={styles.auditList}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.auditItem}>
              <div className={styles.auditTop}>
                <Lock size={12} aria-hidden />
                <b>{entry.action}</b>
                <Tag tone="danger">已阻止</Tag>
              </div>
              <p className={styles.muted}>
                触发规则 {entry.triggeredRule} · {formatTimeHM(entry.attemptedAt)} · 来源 {entry.source === 'agent' ? 'Agent' : entry.source === 'user' ? '人工' : '外部'}
              </p>
              <p className={styles.muted}>{entry.reason}</p>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

interface AgentHomePanelProps {
  event: AnomalyEventSummary | undefined;
}

/**
 * 首页「Agent 自主控制中心」：聊天输入降级为辅助入口。
 * 主体 = 监测任务 + 当前判断 + 八阶段任务链 + 当前阶段焦点卡 + 四级安全边界。
 */
export function AgentHomePanel({ event }: AgentHomePanelProps) {
  const navigate = useNavigate();
  const { events, lastUpdated } = useAppData();
  const ac = useAgentCenter(event);
  const { stage, data } = ac;
  const [confirm, setConfirm] = useState<'approve' | 'reject' | null>(null);
  const [question, setQuestion] = useState('');

  const phaseInput = useMemo(
    () => ({
      stage,
      event,
      task: data.task,
      diagnosis: data.diagnosis,
      plans: data.plans,
      simulations: data.simulations,
      approval: data.approval,
      execution: data.execution,
      observedAt: data.observedAt,
    }),
    [stage, event, data],
  );
  const phases = useMemo(() => computePhases(phaseInput), [phaseInput]);
  const sub = subStatusOf(stage);
  const judgment = judgmentOf(phaseInput);
  const monitors = useMemo(() => monitoringItems(data.detail, event), [data.detail, event]);
  const levels = useMemo(
    () =>
      securityLevelRows({
        toolsDone: data.task?.tools.length ?? 0,
        simDone: Object.keys(data.simulations).length > 0,
        approval: data.approval,
        stage,
        l3Blocked: data.auditEntries.length,
      }),
    [data.task, data.simulations, data.approval, stage, data.auditEntries],
  );
  const activePhaseKey = phases.find((p) => p.status === 'running' || p.status === 'awaiting')?.key;
  // 「无新增严重告警」：除当前事件外是否还有其他未恢复的严重 / 紧急事件（真实事件列表派生）。
  const hasNewCritical = useMemo(
    () =>
      events.some(
        (item) => item.id !== event?.id && item.stage !== 'recovered' && (item.severity === 'critical' || item.severity === 'emergency'),
      ),
    [events, event?.id],
  );

  const showRecovered = stage === 'recovered' && ac.reachedRecovered && event;
  const monitoringMode = stage === 'monitoring' || (stage === 'recovered' && !ac.reachedRecovered);

  const goWorkbench = () => navigate(event ? `/workbench/${event.id}` : '/workbench');

  return (
    <Panel
      title="Agent 自主控制中心"
      className={styles.panelFill}
      action={
        <span className={styles.headActions}>
          <Tag tone={sub.tone}>{sub.label}</Tag>
          {data.detail && <span className={styles.headMeta}>{data.detail.room.controlMode === 'ai_assisted' ? 'AI 辅助' : data.detail.room.controlMode === 'manual' ? '人工控制' : '安全回退'}</span>}
          {lastUpdated && <span className={styles.headMeta}>{formatTimeHM(lastUpdated)}</span>}
        </span>
      }
    >
      <div className={styles.homeBody}>
        {/* 默认监测任务（无输入也有内容） */}
        <div className={styles.monitorStrip} aria-label="当前监测任务">
          {monitors.map((item) => (
            <span key={item.key} className={styles.monitorItem}>
              <i>{item.label}</i>
              <b className={item.tone ? styles[`tone-${item.tone}`] : undefined}>{item.value}</b>
            </span>
          ))}
        </div>

        {/* 当前判断：明确系统主动发现 */}
        <p className={styles.judgment} aria-label="当前判断">
          {judgment}
        </p>

        <div className={styles.scroll}>
          {/* 八阶段任务链 */}
          <div className={styles.phaseGrid} role="list" aria-label="任务阶段">
            {phases.map((phase) => (
              <PhaseCell key={phase.key} phase={phase} active={phase.key === activePhaseKey} />
            ))}
          </div>

          {/* 当前阶段焦点区 */}
          {monitoringMode && (
            <section className={styles.card} aria-label="自主监测">
              <div className={styles.cardHead}>
                <b>
                  <Radar size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 5 }} />
                  持续自主监测
                </b>
                <Tag tone="info">自动</Tag>
              </div>
              <p className={styles.muted}>
                Agent 持续读取实时温度、湿度、气体与设备状态；发现异常将自动启动诊断、生成方案并请求审批，无需人工提问。
              </p>
              {event?.stage === 'recovered' && (
                <p className={styles.muted}>
                  最近事件「{event.title}」已恢复。
                  <button type="button" className={styles.linkBtn} onClick={() => navigate('/reports')}>
                    查看事件报告 ›
                  </button>
                </p>
              )}
            </section>
          )}

          {stage === 'detected' && (
            <InlineAlert tone="warning" title="Agent 主动发现异常">
              已自动启动异常诊断（非人工提问触发），正在接入实时数据…
            </InlineAlert>
          )}

          {stage === 'diagnosing' && <ToolTrace ac={ac} />}

          {(stage === 'diagnosisCompleted' || stage === 'simulating' || stage === 'simulationCompleted') && (
            <>
              <CauseDigest ac={ac} />
              {stage === 'simulationCompleted' && <DecisionCard ac={ac} />}
              {stage === 'simulating' && (
                <p className={styles.progressLine}>
                  <Loader2 size={13} className={styles.spin} aria-hidden /> 正在运行温控仿真与安全校验…
                </p>
              )}
            </>
          )}

          {stage === 'awaitingApproval' && event && (
            <ApprovalCard ac={ac} event={event} onApprove={() => setConfirm('approve')} onReject={() => setConfirm('reject')} />
          )}

          {stage === 'rejected' && (
            <section className={styles.card} aria-label="方案已驳回">
              <div className={styles.cardHead}>
                <b>方案已驳回</b>
                <Tag tone="neutral">L2 人工决定</Tag>
              </div>
              <p className={styles.muted}>{data.approval?.reason ?? '人工驳回。'}可重新仿真，或前往策略页调整方案。</p>
              <div className={styles.actionRow}>
                <Button variant="secondary" size="sm" onClick={() => navigate('/strategy')}>
                  前往策略页调整
                </Button>
                <Button variant="primary" size="sm" onClick={ac.resimulate}>
                  <RotateCcw size={13} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
                  重新仿真
                </Button>
              </div>
            </section>
          )}

          {(stage === 'approved' || stage === 'executing') && <ExecutionCard ac={ac} />}

          {stage === 'verifying' && <VerificationCard ac={ac} hasNewCritical={hasNewCritical} />}

          {showRecovered && <RecoveredCard ac={ac} event={event} />}

          {stage === 'diagnosisFailed' && (
            <InlineAlert tone="danger" title="任务失败：诊断未完成">
              诊断任务失败。
              <button type="button" className={styles.linkBtn} onClick={ac.rediagnose}>
                重新诊断 ›
              </button>
            </InlineAlert>
          )}
          {stage === 'simulationFailed' && (
            <InlineAlert tone="danger" title="任务失败：仿真未完成">
              仿真失败，可
              <button type="button" className={styles.linkBtn} onClick={ac.resimulate}>
                重新仿真 ›
              </button>
            </InlineAlert>
          )}
          {stage === 'executionFailed' && (
            <section className={`${styles.card} ${styles.cardDanger}`} aria-label="执行失败">
              <div className={styles.cardHead}>
                <b>执行失败，已进入安全回退</b>
                <Tag tone="danger">回退</Tag>
              </div>
              <p className={styles.muted}>{data.execution?.triggeredRollback ?? '执行未达预期，已回退传统规则 / PID。'}</p>
              <div className={styles.actionRow}>
                <Button variant="secondary" size="sm" onClick={ac.enterSafeFallback}>
                  <ShieldAlert size={13} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
                  进入安全模式
                </Button>
                <Button variant="primary" size="sm" onClick={ac.resimulate}>
                  重新仿真（复诊）
                </Button>
              </div>
            </section>
          )}
          {stage === 'safeFallback' && (
            <InlineAlert tone="danger" title="已进入安全回退">
              AI 控制已退出，系统回退传统规则 / PID 兜底，需要人工介入；安全边界全程有效。
            </InlineAlert>
          )}

          {/* L3 永久禁止（真实审计记录） */}
          <L3BlockedCard entries={data.auditEntries} />
        </div>

        {/* 四级安全权限边界（始终可见） */}
        <div className={styles.securityStrip} aria-label="安全权限边界">
          {levels.map((level) => {
            const Icon = LEVEL_ICON[level.level];
            return (
              <div key={level.level} className={`${styles.levelCell} ${styles[`level-${level.state}`]}`} title={`${level.title}：${level.scope}\n${level.note}`}>
                <span className={styles.levelHead}>
                  <Icon size={12} aria-hidden />
                  <b>{level.level}</b>
                  <span className={styles.levelState}>{level.stateLabel}</span>
                </span>
                <span className={styles.levelTitle}>{level.title}</span>
              </div>
            );
          })}
        </div>

        {/* 辅助自然语言输入（降级为补充交互） */}
        <div className={styles.footer}>
          <Input
            placeholder="补充现场信息 / 询问决策原因 / 修改目标重新仿真…（回车进入完整工作台）"
            aria-label="辅助输入（进入完整工作台）"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goWorkbench()}
          />
          <button type="button" className={styles.sendBtn} onClick={goWorkbench} aria-label="进入完整工作台">
            <Send size={15} />
          </button>
          <button type="button" className={styles.workbenchLink} onClick={goWorkbench}>
            完整工作台 ›
          </button>
        </div>
      </div>

      {/* L2 二次确认 */}
      <ConfirmDialog
        open={confirm === 'approve'}
        title="确认批准并执行该控制方案？"
        confirmLabel="批准并执行"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void ac.approveAndExecute();
        }}
      >
        该操作为 L2 级别，将改变设备运行参数。批准后 Agent 立即自动下发结构化控制命令，并持续验证执行效果；方案版本变化将使本次审批自动失效。
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'reject'}
        title="驳回该控制方案？"
        confirmLabel="确认驳回"
        tone="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void ac.rejectPlan('人工驳回：首页二次确认');
        }}
      >
        驳回后 Agent 不会下发任何控制命令，可调整方案后重新仿真。
      </ConfirmDialog>
    </Panel>
  );
}
