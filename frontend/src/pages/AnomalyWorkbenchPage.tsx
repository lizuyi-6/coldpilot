import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ListTodo, PanelsTopLeft } from 'lucide-react';
import type { AnomalyEventSummary } from '@/domain/types';
import { getColdPilotClient } from '@/api';
import { useWorkbench } from '@/state/useWorkbench';
import { useMediaQuery } from '@/utils/useMediaQuery';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { AgentTaskPane } from '@/features/agent/AgentTaskPane';
import { AgentConversationPane } from '@/features/agent/AgentConversationPane';
import { AgentContextPane } from '@/features/agent/AgentContextPane';
import styles from '@/features/agent/agent.module.css';

const DEFAULT_EVENT_ID = 'evt-1';

/**
 * Agent 对话与分析页（三栏：任务 / 对话与分析 / 上下文）。
 * 状态机与 L2/L3 流程由 useWorkbench 承载；≤1280px 时左右栏转为 Drawer，中栏优先。
 */
export default function AnomalyWorkbenchPage() {
  const wb = useWorkbench();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<AnomalyEventSummary[] | null>(null);
  // ≤1280px：左任务栏 / 右上下文栏转为抽屉（任务书响应式要求）。
  const isCompact = useMediaQuery('(max-width: 1280px)');
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);

  // 加载事件列表。
  useEffect(() => {
    let cancelled = false;
    void getColdPilotClient()
      .listAnomalyEvents()
      .then((list) => {
        if (!cancelled) setEvents(list);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 依据路由参数或默认事件选中并加载详情。
  const targetEventId = eventId ?? DEFAULT_EVENT_ID;
  useEffect(() => {
    if (targetEventId && wb.selectedEventId !== targetEventId) {
      void wb.selectEvent(targetEventId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetEventId]);

  // 选中事件且处于待诊断时自动发起一次诊断（诊断即本页入口动作；每个事件仅自动一次）。
  const wbRef = useRef(wb);
  useEffect(() => {
    wbRef.current = wb;
  });
  const autoStartedRef = useRef<string | null>(null);
  useEffect(() => {
    const current = wbRef.current;
    if (current.status !== 'detected' || !current.selectedEventId) return;
    if (autoStartedRef.current === current.selectedEventId) return;
    // 仅后端仍处于 detected 的事件自动诊断；已进入诊断后阶段的事件由 selectEvent 水合恢复。
    const backendStage = events?.find((event) => event.id === current.selectedEventId)?.stage;
    if (backendStage !== 'detected') return;
    autoStartedRef.current = current.selectedEventId;
    void current.startDiagnosis();
  }, [wb.status, wb.selectedEventId, events]);

  const handleSelect = (id: string) => {
    setTaskDrawerOpen(false);
    setContextDrawerOpen(false);
    navigate(`/workbench/${id}`, { replace: true });
  };

  const selectedEvent = events?.find((event) => event.id === wb.selectedEventId) ?? null;

  if (!events) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonLoader lines={2} />
        <SkeletonLoader lines={4} />
        <SkeletonLoader lines={4} />
      </div>
    );
  }

  const taskPane = (
    <AgentTaskPane events={events} selectedEventId={wb.selectedEventId} activeTask={wb.data.agentTask} onSelect={handleSelect} />
  );
  const contextPane = <AgentContextPane wb={wb} events={events} selectedEventId={wb.selectedEventId} onSelect={handleSelect} />;

  return (
    <div className={styles.mainCol}>
      {isCompact && (
        <div className={styles.chatHead}>
          <Button variant="secondary" size="sm" onClick={() => setTaskDrawerOpen(true)}>
            <ListTodo size={14} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
            任务列表
          </Button>
          <DemoDataBadge kind="demo" />
          <Button variant="secondary" size="sm" onClick={() => setContextDrawerOpen(true)}>
            <PanelsTopLeft size={14} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
            上下文信息
          </Button>
        </div>
      )}

      <div className={styles.agentGrid}>
        <div className={styles.sideCol}>{taskPane}</div>
        <div className={styles.mainCol}>
          <AgentConversationPane wb={wb} event={selectedEvent} />
        </div>
        <div className={styles.sideCol}>{contextPane}</div>
      </div>

      <Drawer open={isCompact && taskDrawerOpen} title="任务列表" side="left" width={320} onClose={() => setTaskDrawerOpen(false)}>
        <div className={styles.sideCol}>{taskPane}</div>
      </Drawer>
      <Drawer open={isCompact && contextDrawerOpen} title="上下文信息" width={360} onClose={() => setContextDrawerOpen(false)}>
        <div className={styles.sideCol}>{contextPane}</div>
      </Drawer>
    </div>
  );
}
