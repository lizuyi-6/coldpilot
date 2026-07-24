import { WifiOff } from 'lucide-react';
import styles from './OfflineState.module.css';

interface OfflineStateProps {
  lastUpdated?: string;
  description?: string;
}

export function OfflineState({ lastUpdated, description }: OfflineStateProps) {
  return (
    <div className={styles.bar} role="status">
      <WifiOff size={15} strokeWidth={2} aria-hidden />
      <span>
        {description ?? '数据连接中断，显示最后已知值。'}
        {lastUpdated && <span className={styles.time}>（最后更新 {lastUpdated}）</span>}
      </span>
    </div>
  );
}