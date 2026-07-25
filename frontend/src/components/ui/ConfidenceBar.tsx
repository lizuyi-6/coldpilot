import styles from './ConfidenceBar.module.css';

interface ConfidenceBarProps {
  value: number;
  /** 数值显示格式：decimal=0.68（默认，兼容既有用法）；percent=68%。 */
  format?: 'decimal' | 'percent';
}

/** 置信度：数值 + 条形双编码。 */
export function ConfidenceBar({ value, format = 'decimal' }: ConfidenceBarProps) {
  const pct = Math.round(value * 100);
  const level = value >= 0.6 ? 'high' : value >= 0.4 ? 'medium' : 'low';
  return (
    <span className={styles.wrap} title={`置信度 ${pct}%`}>
      <span className={styles.track}>
        <span className={`${styles.fill} ${styles[level]}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={styles.value}>{format === 'percent' ? `${pct}%` : value.toFixed(2)}</span>
    </span>
  );
}
