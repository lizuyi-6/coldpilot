import type { ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  key: string;
  label: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
}

export function Tabs({ items, activeKey, onChange, ariaLabel }: TabsProps) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}