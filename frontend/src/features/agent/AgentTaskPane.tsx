import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ListTodo } from 'lucide-react';
import type { AgentTask, AnomalyEventSummary } from '@/domain/types';
import { Panel } from '@/components/ui/Panel';
import { Tag, type TagTone } from '@/components/ui/Tag';
import { agentTaskListItems, type AgentTaskItemState } from './agentView';
import { formatTimeHM } from '@/utils/formatTime';
import styles from './agent.module.css';

const STATE_TONE: Record<AgentTaskItemState, TagTone> = {
  running: 'accent',
  done: 'neutral',
  pending: 'warning',
};

interface AgentTaskPaneProps {
  events: AnomalyEventSummary[];
  selectedEventId: string | null;
  activeTask: AgentTask | null;
  onSelect: (eventId: string) => void;
}

/** 左栏：当前诊断任务 + 最近任务（由异常事件派生，选中切换工作台上下文）。 */
export function AgentTaskPane({ events, selectedEventId, activeTask, onSelect }: AgentTaskPaneProps) {
  const navigate = useNavigate();
  const items = useMemo(() => agentTaskListItems(events, activeTask), [events, activeTask]);
  const current = items.find((item) => item.eventId === selectedEventId) ?? null;
  const recent = items.filter((item) => item.eventId !== selectedEventId);

  return (
    <>
      <Panel
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ListTodo size={15} aria-hidden />
            当前任务
          </span>
        }
        action={current ? <Tag tone={STATE_TONE[current.state]}>{current.stateLabel}</Tag> : undefined}
      >
        {current ? (
          <div className={styles.currentTaskBody}>
            <div className={styles.currentTaskGoal}>{current.goal}</div>
            <div className={styles.taskMetaRow}>
              <span>发起时间</span>
              <span className="numeric">{formatTimeHM(current.startedAt)}</span>
            </div>
            <div className={styles.taskMetaRow}>
              <span>任务ID</span>
              <span className="numeric" title={current.taskId ?? '任务尚未发起，发起后由后端分配任务 ID'}>
                {current.taskId ?? '未发起'}
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.taskMetaRow}>从下方选择一项诊断任务。</div>
        )}
      </Panel>

      <Panel title="最近任务">
        <div className={styles.taskList}>
          {recent.length === 0 ? (
            <div className={styles.taskMetaRow}>暂无其他任务</div>
          ) : (
            recent.map((item) => (
              <button
                key={item.eventId}
                type="button"
                className={styles.taskItem}
                onClick={() => onSelect(item.eventId)}
              >
                <span className={styles.taskItemGoal}>{item.goal}</span>
                <span className={styles.taskItemMeta}>
                  <span>{formatTimeHM(item.startedAt)}</span>
                  <Tag tone={STATE_TONE[item.state]}>{item.stateLabel}</Tag>
                </span>
              </button>
            ))
          )}
        </div>
        <button type="button" className={styles.paneFooterLink} onClick={() => navigate('/events')}>
          查看全部任务
          <ArrowRight size={13} aria-hidden />
        </button>
      </Panel>
    </>
  );
}
