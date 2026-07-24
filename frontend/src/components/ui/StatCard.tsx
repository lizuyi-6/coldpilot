import type { ReactNode } from 'react';
import { StatusDot, type DotTone } from './StatusDot';
import styles from './StatCard.module.css';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  target?: string;
  tone?: DotTone;
  statusLabel?: string;
  trend?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
}

export function StatCard({ label, value, unit, target, tone = 'muted', statusLabel, trend, icon, footer }: StatCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.label}>
          {icon && <span className={styles.labelIcon}>{icon}</span>}
          {label}
        </span>
        <StatusDot tone={tone} label={statusLabel} />
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value}>
          {value}
          {unit && <span className={styles.unit}>{unit}</span>}
        </span>
      </div>
      {target && <div className={styles.target}>目标 {target}</div>}
      {trend && <div className={styles.trend}>{trend}</div>}
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}