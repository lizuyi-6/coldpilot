import { useState } from 'react';
import { getDemoControls } from '@/api';
import { FlaskConical } from 'lucide-react';
import styles from './inspector.module.css';

/** 演示控制：注入一次性失败以演示“失败与重试”分支（仅 mock）。 */
export function DemoControlsBar() {
  const [armed, setArmed] = useState<string | null>(null);
  let controls: ReturnType<typeof getDemoControls> | null = null;
  try {
    controls = getDemoControls();
  } catch {
    controls = null;
  }
  if (!controls) return null;

  const arm = (kind: 'diagnosis' | 'simulation' | 'execution', label: string) => {
    controls!.armFailureOnce(kind);
    setArmed(label);
    setTimeout(() => setArmed(null), 2000);
  };

  return (
    <div className={styles.block}>
      <div className={styles.blockTitle}>
        <FlaskConical size={13} aria-hidden style={{ verticalAlign: -2 }} /> 演示控制 · 失败注入
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className={styles.note} style={{ border: '1px solid var(--color-border-strong)', borderRadius: 4, padding: '3px 8px' }} onClick={() => arm('diagnosis', '诊断')}>
          下次诊断失败
        </button>
        <button className={styles.note} style={{ border: '1px solid var(--color-border-strong)', borderRadius: 4, padding: '3px 8px' }} onClick={() => arm('simulation', '仿真')}>
          下次仿真失败
        </button>
        <button className={styles.note} style={{ border: '1px solid var(--color-border-strong)', borderRadius: 4, padding: '3px 8px' }} onClick={() => arm('execution', '执行')}>
          下次执行失败
        </button>
      </div>
      {armed ? <div className={styles.note} style={{ marginTop: 6, color: 'var(--color-warning)' }}>已注入：下次{armed}将失败，可用于演示重试</div> : null}
    </div>
  );
}