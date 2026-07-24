import { AlertCircle } from 'lucide-react';
import { Button } from './Button';
import styles from './ErrorState.module.css';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ title = '加载失败', description, onRetry, retryLabel = '重试' }: ErrorStateProps) {
  return (
    <div className={styles.wrap} role="alert">
      <AlertCircle size={36} strokeWidth={1.4} className={styles.icon} aria-hidden />
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}