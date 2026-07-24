import type { ReactNode } from 'react';
import styles from './DescriptionList.module.css';

export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
}

interface DescriptionListProps {
  items: DescriptionItem[];
  labelWidth?: number;
}

export function DescriptionList({ items, labelWidth = 120 }: DescriptionListProps) {
  return (
    <dl className={styles.list}>
      {items.map((item, index) => (
        <div key={index} className={styles.row}>
          <dt className={styles.label} style={{ width: labelWidth }}>
            {item.label}
          </dt>
          <dd className={styles.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}