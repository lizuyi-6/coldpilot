import type { AnomalyEventSummary } from '@/domain/types';
import { Bell, ClipboardCheck, Clock, ShieldAlert, type LucideIcon } from 'lucide-react';
import { formatDuration } from '@/utils/formatTime';
import { alertKpis } from './eventsView';
import styles from './events.module.css';

interface KpiSpec {
  key: string;
  label: string;
  value: string;
  sub: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
}

interface AlertKpiCardsProps {
  events: AnomalyEventSummary[];
}

/** KPI 卡片：告警总数 / 严重告警 / 待响应 / 待审批（全部由事件列表聚合）。 */
export function AlertKpiCards({ events }: AlertKpiCardsProps) {
  const kpis = alertKpis(events);
  const cards: KpiSpec[] = [
    {
      key: 'total',
      label: '告警总数',
      value: String(kpis.total),
      sub: `今日新增 ${kpis.todayNew}`,
      Icon: Bell,
      color: 'var(--color-danger)',
      bg: 'var(--color-danger-subtle)',
    },
    {
      key: 'critical',
      label: '严重告警',
      value: String(kpis.critical),
      sub: `占比 ${kpis.criticalPct}%`,
      Icon: ShieldAlert,
      color: 'var(--color-danger)',
      bg: 'var(--color-danger-subtle)',
    },
    {
      key: 'pending',
      label: '待响应',
      value: String(kpis.pending),
      sub: kpis.pendingOldestMinutes === null ? '无待响应告警' : `最早已持续 ${formatDuration(kpis.pendingOldestMinutes)}`,
      Icon: Clock,
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-subtle)',
    },
    {
      key: 'approval',
      label: '待审批',
      value: String(kpis.awaitingApproval),
      sub: 'L2 方案待人工审批',
      Icon: ClipboardCheck,
      color: 'var(--color-info)',
      bg: 'var(--color-info-subtle)',
    },
  ];

  return (
    <div className={styles.kpiGrid}>
      {cards.map(({ key, label, value, sub, Icon, color, bg }) => (
        <div key={key} className={styles.kpiCard}>
          <span className={styles.kpiIcon} style={{ color, background: bg }}>
            <Icon size={20} aria-hidden />
          </span>
          <span className={styles.kpiText}>
            <span className={styles.kpiLabel}>{label}</span>
            <span className={styles.kpiValueRow}>
              <span className={styles.kpiValue}>{value}</span>
              <span className={styles.kpiSub} title={sub}>
                {sub}
              </span>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
