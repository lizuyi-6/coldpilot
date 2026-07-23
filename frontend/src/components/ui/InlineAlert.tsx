import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import styles from './InlineAlert.module.css';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };

/** 行内提示条：用于失败、回退、审批、延迟等状态说明。 */
export function InlineAlert({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  const Icon = ICONS[tone];
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={16} className={styles.icon} aria-hidden />
      <div className={styles.body}>
        {title ? <div className={styles.title}>{title}</div> : null}
        {children ? <div className={styles.content}>{children}</div> : null}
      </div>
    </div>
  );
}