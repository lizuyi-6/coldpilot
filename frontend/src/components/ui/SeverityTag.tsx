import type { Severity } from '@/domain/types';
import { SEVERITY_META } from '@/domain/constants/severity';
import { AlertCircle, AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './SeverityTag.module.css';

const SEVERITY_ICON: Record<Severity, LucideIcon> = {
  notice: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
  emergency: AlertOctagon,
};

/** 告警等级标签：色块 + 图标 + 文字。 */
export function SeverityTag({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  const Icon = SEVERITY_ICON[severity];
  return (
    <span className={`${styles.tag} ${styles[meta.token]}`}>
      <Icon size={12} aria-hidden />
      <span>{meta.label}</span>
    </span>
  );
}