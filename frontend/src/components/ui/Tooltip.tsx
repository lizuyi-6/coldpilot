import { useState, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={styles.trigger}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {children}
      {open && (
        <span className={styles.bubble} role="tooltip">
          {content}
        </span>
      )}
    </span>
  );
}