import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/** 模态确认框：用于 L2 人工确认等关键操作。 */
export function ConfirmDialog({ open, title, children, confirmLabel = '确认', cancelLabel = '取消', tone = 'primary', onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className={styles.overlay} role="presentation" onClick={onCancel}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{title}</h3>
        {children ? <div className={styles.body}>{children}</div> : null}
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}