import styles from './ConfidenceBar.module.css';

/** 置信度：数值 + 条形双编码。 */
export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const level = value >= 0.6 ? 'high' : value >= 0.4 ? 'medium' : 'low';
  return (
    <span className={styles.wrap} title={`置信度 ${pct}%`}>
      <span className={styles.track}>
        <span className={`${styles.fill} ${styles[level]}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={styles.value}>{value.toFixed(2)}</span>
    </span>
  );
}