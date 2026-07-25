import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoomEventMarker } from '@/domain/types';
import { ArrowRight, DoorClosed, DoorOpen, Download, Power, PowerOff, type LucideIcon } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatTimeHM } from '@/utils/formatTime';
import { filterRoomEvents, type RoomEventGroup } from './monitoringView';
import styles from './monitoring.module.css';

const KIND_META: Record<RoomEventMarker['kind'], { Icon: LucideIcon; color: string; bg: string }> = {
  door_open: { Icon: DoorOpen, color: 'var(--color-warning)', bg: 'var(--color-warning-subtle)' },
  door_close: { Icon: DoorClosed, color: 'var(--color-accent)', bg: 'var(--color-accent-subtle)' },
  inbound: { Icon: Download, color: 'var(--color-info)', bg: 'var(--color-info-subtle)' },
  compressor_start: { Icon: Power, color: 'var(--color-accent)', bg: 'var(--color-accent-subtle)' },
  compressor_stop: { Icon: PowerOff, color: 'var(--color-text-muted)', bg: 'var(--color-neutral-100)' },
};

const GROUP_OPTIONS = [
  { value: 'all', label: '全部事件' },
  { value: 'door', label: '库门' },
  { value: 'inbound', label: '入库' },
  { value: 'compressor', label: '压缩机' },
];

const MAX_ITEMS = 6;

interface RoomEventsPanelProps {
  events: RoomEventMarker[];
}

/** 事件时间线：库房现场事件（库门/入库/压缩机启停），按时间倒序。 */
export function RoomEventsPanel({ events }: RoomEventsPanelProps) {
  const navigate = useNavigate();
  const [group, setGroup] = useState<RoomEventGroup>('all');

  const items = useMemo(() => {
    const filtered = filterRoomEvents(events, group);
    return filtered
      .slice()
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, MAX_ITEMS);
  }, [events, group]);

  return (
    <Panel
      title="事件时间线"
      action={
        <Select
          ariaLabel="事件类型筛选"
          options={GROUP_OPTIONS}
          value={group}
          onChange={(v) => setGroup(v as RoomEventGroup)}
        />
      }
    >
      {items.length === 0 ? (
        <EmptyState title="暂无数据" description="该筛选条件下没有库房事件。" />
      ) : (
        <div className={styles.timeline}>
          {items.map((event) => {
            const meta = KIND_META[event.kind];
            const Icon = meta.Icon;
            return (
              <div key={event.id} className={styles.timelineItem}>
                <span className={styles.timelineRail} aria-hidden />
                <span className={styles.timelineIcon} style={{ color: meta.color, background: meta.bg }}>
                  <Icon size={14} aria-hidden />
                </span>
                <div className={styles.timelineBody}>
                  <div className={styles.timelineTop}>
                    <span className={styles.timelineTitle}>{event.label}</span>
                    <span className={styles.timelineTime}>{formatTimeHM(event.at)}</span>
                  </div>
                  {event.detail && <span className={styles.timelineDetail} title={event.detail}>{event.detail}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className={styles.panelFooter}>
        <span>共 {events.length} 条现场事件</span>
        <button type="button" className={styles.footerLink} onClick={() => navigate('/events')}>
          查看全部事件
          <ArrowRight size={13} aria-hidden />
        </button>
      </div>
    </Panel>
  );
}
