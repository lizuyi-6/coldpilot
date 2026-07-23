import styles from './SkeletonLoader.module.css';

/** 骨架屏：加载占位。 */
export function SkeletonLoader({ lines = 3, height }: { lines?: number; height?: number }) {
  return (
    <div className={styles.wrap} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={styles.line}
          style={{ height: height ?? 14, width: i === lines - 1 ? '62%' : '100%' }}
        />
      ))}
    </div>
  );
}