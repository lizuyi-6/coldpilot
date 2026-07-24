import { Link } from 'react-router-dom';
import type { AnomalyEventSummary } from '@/domain/types';
import { Panel } from '@/components/ui/Panel';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDuration } from '@/utils/formatTime';
import styles from './commandCenter.module.css';

interface AlertsOverviewCardProps {
  alerts: AnomalyEventSummary[];
}

/** 第二行：当前告警（未处理告警 + 查看全部）。 */
export function AlertsOverviewCard({ alerts }: AlertsOverviewCardProps) {
  const top = alerts.slice(0, 3);
  return (
    <Panel title="当前告警" className={styles.panelFill} action={<Link to="/events" className={styles.moreLink}>查看全部 ›</Link>}>
      {top.length === 0 ? (
        <div className={styles.agentEmpty}>当前无未处理告警。</div>
      ) : (
        <ul className={styles.alertList}>
          {top.map((event) => (
            <li key={event.id} className={styles.alertItem}>
              <SeverityTag severity={event.severity} />
              <span className={styles.alertName}>{event.title}（{event.roomName}）</span>
              <span className={styles.alertMeta}>持续 {formatDuration(event.durationMinutes)}</span>
              <StatusBadge status={event.stage} size="sm" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}