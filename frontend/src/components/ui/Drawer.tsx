import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import styles from './Drawer.module.css';

interface DrawerProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  side?: 'right' | 'left';
  width?: number;
}

export function Drawer({ open, title, children, onClose, side = 'right', width = 420 }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        ref={ref}
        className={`${styles.drawer} ${styles[side]}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <IconButton aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}