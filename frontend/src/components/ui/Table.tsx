import type { ReactNode } from 'react';
import styles from './Table.module.css';

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  rowLabel?: (row: T) => string;
}

export function Table<T>({ columns, rows, rowKey, empty, onRowClick, isRowSelected, rowLabel }: TableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }
  return (
    <div className={styles.scroll} role="region" aria-label="数据表" tabIndex={0}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ width: col.width, textAlign: col.align ?? 'left' }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const selected = isRowSelected?.(row) ?? false;
            const clickable = Boolean(onRowClick);
            return (
              <tr
                key={rowKey(row)}
                className={`${clickable ? styles.rowClickable : ''} ${selected ? styles.rowSelected : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={rowLabel ? rowLabel(row) : undefined}
                aria-selected={onRowClick ? selected : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align ?? 'left' }}>
                    {col.render(row, index)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}