import type { Severity } from '../types/anomaly';

interface SeverityMeta {
  label: string;
  /** 对应 tokens.css 中的 --sev-* 变量名后缀。 */
  token: 'notice' | 'warning' | 'critical' | 'emergency';
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  notice: { label: '提醒', token: 'notice' },
  warning: { label: '警告', token: 'warning' },
  critical: { label: '严重', token: 'critical' },
  emergency: { label: '紧急', token: 'emergency' },
};