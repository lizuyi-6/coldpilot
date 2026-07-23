import type { ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import styles from './WorkbenchLayout.module.css';

interface WorkbenchLayoutProps {
  list: ReactNode;
  main: ReactNode;
  inspector: ReactNode;
  /** 检查器是否折叠为把手。 */
  inspectorCollapsed?: boolean;
  /** 切换检查器折叠。 */
  onToggleInspector?: () => void;
}

/** 工作台三段布局：事件列表 / 诊断主体 / 方案检查器（窄屏可折叠为把手）。 */
export function WorkbenchLayout({ list, main, inspector, inspectorCollapsed = false, onToggleInspector }: WorkbenchLayoutProps) {
  return (
    <div className={styles.layout} data-inspector-collapsed={inspectorCollapsed || undefined}>
      <aside className={styles.list} aria-label="事件列表">
        {list}
      </aside>
      <section className={styles.main} aria-label="诊断主体">
        {main}
      </section>
      {inspectorCollapsed ? (
        <button
          type="button"
          className={styles.inspectorHandle}
          onClick={onToggleInspector}
          aria-label="展开方案检查器"
          title="展开方案检查器"
        >
          <PanelRightOpen size={16} aria-hidden />
          <span className={styles.handleLabel}>方案检查器</span>
        </button>
      ) : (
        <aside className={styles.inspector} aria-label="方案检查器">
          {onToggleInspector ? (
            <button
              type="button"
              className={styles.collapseBtn}
              onClick={onToggleInspector}
              aria-label="收起方案检查器"
              title="收起方案检查器"
            >
              <PanelRightClose size={15} aria-hidden />
            </button>
          ) : null}
          {inspector}
        </aside>
      )}
    </div>
  );
}