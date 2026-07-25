import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnomalyEventSummary, Severity } from '@/domain/types';
import { ArrowRight } from 'lucide-react';
import { TASK_STATUS_META } from '@/domain/constants/taskStatus';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDuration, formatTimeHM } from '@/utils/formatTime';
import styles from './monitoring.module.css';

const SEVERITY_OPTIONS = [
  { value: 'all', label: '全部级别' },
  { value: 'critical', label: '严重' },
  { value: 'warning', label: '警告' },
  { value: 'notice', label: '提示' },
];

const MAX_ITEMS = 6;

function borderClass(severity: Severity): string {
  if (severity === 'critical' || severity === 'emergency') return styles.alertItemCritical;
  if (severity === 'warning') return styles.alertItemWarning;
  return styles.alertItemNotice;
}

interface AlertTimelinePanelProps {
  events: AnomalyEventSummary[];
}

/** 告警时间线：异常告警按触发时间倒序（来自异常事件接口）。 */
export function AlertTimelinePanel({ events }: AlertTimelinePanelProps) {
  const navigate = useNavigate();
  const [severity, setSeverity] = useState('all');

  const items = useMemo(() => {
    return events
      .filter((event) => severity === 'all' || event.severity === severity)
      .slice()
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
      .slice(0, MAX_ITEMS);
  }, [events, severity]);

  return (
    <Panel
      title="告警时间线"
      action={
        <Select ariaLabel="告警级别筛选" options={SEVERITY_OPTIONS} value={severity} onChange={setSeverity} />
      }
    >
      {items.length === 0 ? (
        <EmptyState title="暂无数据" description="该级别下没有告警。" />
      ) : (
        <div className={styles.timeline}>
          {items.map((event) => (
            <div key={event.id} className={styles.timelineItem}>
              <div className={`${styles.timelineBody} ${styles.alertItem} ${borderClass(event.severity)}`}>
                <div className={styles.timelineTop}>
                  <span className={styles.timelineTitle}>
                    <SeverityTag severity={event.severity} /> {event.title}
                  </span>
                  <span className={styles.timelineTime}>{formatTimeHM(event.startedAt)}</span>
                </div>
                <span className={styles.timelineDetail}>
                  {event.roomName} · {TASK_STATUS_META[event.stage].label} · 持续 {formatDuration(event.durationMinutes)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={styles.panelFooter}>
        <span>共 {events.length} 条告警</span>
        <button type="button" className={styles.footerLink} onClick={() => navigate('/events')}>
          查看全部告警
          <ArrowRight size={13} aria-hidden />
        </button>
      </div>
    </Panel>
  );
}
