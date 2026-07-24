import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  width?: number;
}

export function Dialog({ open, title, children, onClose, footer, width = 560 }: DialogProps) {
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
        className={styles.dialog}
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
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>
  );
}