import { useMemo, useState } from 'react';
import type { AnomalyEventSummary } from '@/domain/types';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Segmented } from '@/components/ui/Segmented';
import { Hourglass } from 'lucide-react';
import { formatDuration, formatTimeHM } from '@/utils/formatTime';
import styles from './EventListPane.module.css';

type FilterKey = 'all' | 'open' | 'approval' | 'recovered';

const FILTER_OPTIONS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'open', label: '待处理' },
  { value: 'approval', label: '待审批' },
  { value: 'recovered', label: '已恢复' },
];

interface EventListPaneProps {
  events: AnomalyEventSummary[];
  selectedEventId: string | null;
  onSelect: (eventId: string) => void;
}

/** 左栏：当前模块内的异常事件列表（非全局导航）。 */
export function EventListPane({ events, selectedEventId, onSelect }: EventListPaneProps) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    switch (filter) {
      case 'open':
        return events.filter((e) => e.stage !== 'recovered' && e.stage !== 'safeFallback');
      case 'approval':
        return events.filter((e) => e.awaitingApproval);
      case 'recovered':
        return events.filter((e) => e.stage === 'recovered');
      default:
        return events;
    }
  }, [events, filter]);

  return (
    <div className={styles.pane}>
      <div className={styles.header}>
        <span className={styles.title}>异常事件</span>
      </div>
      <div className={styles.filter}>
        <Segmented options={FILTER_OPTIONS} value={filter} onChange={setFilter} ariaLabel="事件筛选" />
      </div>
      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>该筛选下暂无事件</div>
        ) : (
          filtered.map((evt) => {
            const active = evt.id === selectedEventId;
            return (
              <button
                key={evt.id}
                className={`${styles.item} ${active ? styles.itemActive : ''}`}
                onClick={() => onSelect(evt.id)}
                aria-current={active}
              >
                <div className={styles.rowTop}>
                  <SeverityTag severity={evt.severity} />
                  <span className={styles.itemTitle}>{evt.title}</span>
                </div>
                <div className={styles.room}>{evt.roomName}</div>
                <div className={styles.rowMeta}>
                  <span className={styles.meta}>
                    {formatTimeHM(evt.startedAt)} 起 · 持续{formatDuration(evt.durationMinutes)}
                  </span>
                  <StatusBadge status={evt.stage} size="sm" />
                  {evt.awaitingApproval ? (
                    <span className={styles.approvalFlag}>
                      <Hourglass size={11} aria-hidden /> 待审批
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}