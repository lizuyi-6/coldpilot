import styles from './StatusDot.module.css';

export type DotTone = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

interface StatusDotProps {
  tone?: DotTone;
  label?: string;
  pulse?: boolean;
}

export function StatusDot({ tone = 'muted', label, pulse = false }: StatusDotProps) {
  return (
    <span className={styles.wrap}>
      <span className={`${styles.dot} ${styles[tone]} ${pulse ? styles.pulse : ''}`} aria-hidden />
      {label && <span className={styles.label}>{label}</span>}
    </span>
  );
}