import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send } from 'lucide-react';
import type { AnomalyEventSummary } from '@/domain/types';
import { useEventDiagnosis } from './useEventDiagnosis';
import { useAppData } from '@/state/appData';
import { Panel } from '@/components/ui/Panel';
import { Tag } from '@/components/ui/Tag';
import { Input } from '@/components/ui/Input';
import { formatTimeHM } from '@/utils/formatTime';
import styles from './commandCenter.module.css';

interface AgentCenterPanelProps {
  event: AnomalyEventSummary | undefined;
}

/** 第一行右侧：Agent 对话中心（结构化诊断结果 + 追问入口）。 */
export function AgentCenterPanel({ event }: AgentCenterPanelProps) {
  const navigate = useNavigate();
  const { client, lastUpdated } = useAppData();
  const { result, phase, stepsDone, stepsTotal } = useEventDiagnosis(client, event?.id);
  const [question, setQuestion] = useState('');

  const goWorkbench = () => {
    if (event) navigate(`/workbench/${event.id}`);
  };

  const causes = result?.causes.slice().sort((a, b) => b.confidence - a.confidence) ?? [];
  const suggestions = causes
    .flatMap((cause) => cause.recommendedChecks.slice(0, 1))
    .filter((text, i, arr) => arr.indexOf(text) === i)
    .slice(0, 3);

  return (
    <Panel
      title="Agent 对话中心"
      className={styles.panelFill}
      action={
        <span className={styles.panelActions}>
          {phase === 'running' && <Tag tone="accent">分析中 {stepsDone}/{stepsTotal}</Tag>}
          {phase === 'done' && <Tag tone="success">已完成分析</Tag>}
          {phase === 'failed' && <Tag tone="danger">分析失败</Tag>}
          {lastUpdated && <span className={styles.agentUpdated}>{formatTimeHM(lastUpdated)}</span>}
        </span>
      }
    >
      {!event ? (
        <div className={styles.agentEmpty}>当前冷库运行平稳，暂无待诊断异常。</div>
      ) : (
        <div className={styles.agentBody}>
          {/* 用户提问 */}
          <div className={styles.userMsgRow}>
            <div className={styles.userBubble}>
              请分析{event.roomName}{event.title}的原因，并给出处理建议
            </div>
            <span className={styles.userAvatar}>管</span>
          </div>

          {/* Agent 结构化回复 */}
          <div className={styles.agentMsgRow}>
            <span className={styles.agentAvatar}><Bot size={15} /></span>
            <div className={styles.agentCard}>
              {phase === 'running' && (
                <div className={styles.agentProgress}>
                  <span className={styles.agentProgressDot} />
                  正在分析 {event.roomName} 实时数据、库门记录与设备日志…（{stepsDone}/{stepsTotal}）
                </div>
              )}
              {phase === 'failed' && (
                <div className={styles.agentProgress}>诊断任务失败，可进入诊断工作台重试。</div>
              )}
              {phase === 'done' && result && (
                <>
                  <div className={styles.agentUnderstanding}>
                    <strong className={styles.agentLeadInline}>已完成分析。</strong>
                    {result.understanding}
                  </div>

                  <div className={styles.agentSectionTitle}>可能原因（按可能性排序）</div>
                  <table className={styles.causeTable}>
                    <thead>
                      <tr>
                        <th className={styles.causeColIdx}>#</th>
                        <th>原因</th>
                        <th className={styles.causeColConf}>置信度</th>
                        <th>证据摘要</th>
                      </tr>
                    </thead>
                    <tbody>
                      {causes.map((cause, i) => (
                        <tr key={cause.id}>
                          <td className={styles.causeColIdx}>{i + 1}</td>
                          <td className={styles.causeName}>{cause.label}</td>
                          <td className={`${styles.causeConf} numeric`}>{cause.confidence.toFixed(2)}</td>
                          <td className={styles.causeEvidence}>{cause.evidence[0]?.summary ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {suggestions.length > 0 && (
                    <>
                      <div className={styles.agentSectionTitle}>处理建议</div>
                      <ol className={styles.suggestList}>
                        {suggestions.map((text, i) => (
                          <li key={i}>{text}</li>
                        ))}
                      </ol>
                    </>
                  )}

                  <div className={styles.riskNote} title={`风险提示：${result.uncertainties.join('；')}。所有控制动作均需 L2 人工审批，L3 高风险动作由安全层拦截。`}>
                    风险提示：{result.uncertainties.join('；')} · 控制动作需 L2 人工审批，L3 由安全层拦截
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={styles.agentFooter}>
        <Input
          placeholder={event ? '追问：该异常如何处理？' : '当前无异常，可先查看监控'}
          aria-label="向 Agent 提问"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && goWorkbench()}
          disabled={!event}
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={goWorkbench}
          disabled={!event}
          aria-label="发送并进入诊断工作台"
        >
          <Send size={15} />
        </button>
        <button type="button" className={styles.detailLink} onClick={goWorkbench} disabled={!event}>
          详细诊断 ›
        </button>
      </div>
    </Panel>
  );
}