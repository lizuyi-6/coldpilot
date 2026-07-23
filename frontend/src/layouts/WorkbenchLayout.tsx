import type { ReactNode } from 'react';
import styles from './WorkbenchLayout.module.css';

interface WorkbenchLayoutProps {
  list: ReactNode;
  main: ReactNode;
  inspector: ReactNode;
  /** 检查器是否折叠（1024px 默认折叠）。 */
  inspectorCollapsed?: boolean;
}

/** 工作台三段布局：事件列表 / 诊断主体 / 方案检查器。 */
export function WorkbenchLayout({ list, main, inspector, inspectorCollapsed = false }: WorkbenchLayoutProps) {
  return (
    <div className={styles.layout}>
      <aside className={styles.list} aria-label="事件列表">
        {list}
      </aside>
      <section className={styles.main} aria-label="诊断主体">
        {main}
      </section>
      {!inspectorCollapsed && (
        <aside className={styles.inspector} aria-label="方案检查器">
          {inspector}
        </aside>
      )}
    </div>
  );
}