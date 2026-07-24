import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}

export function Panel({ title, action, flush = false, className = '', children, ...rest }: PanelProps) {
  return (
    <section className={`${styles.panel} ${className}`} {...rest}>
      {(title || action) && (
        <header className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          {action && <div className={styles.action}>{action}</div>}
        </header>
      )}
      <div className={flush ? styles.bodyFlush : styles.body}>{children}</div>
    </section>
  );
}