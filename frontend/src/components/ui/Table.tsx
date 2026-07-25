import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import styles from './Table.module.css';

export type SortDirection = 'asc' | 'desc';

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  /** 可排序列：需配合 Table 的 sortKey / sortDirection / onSort 使用，实际排序由调用方完成。 */
  sortable?: boolean;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  rowLabel?: (row: T) => string;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (columnKey: string) => void;
  /** 表格最小宽度（px）：容器不足时局部横向滚动，而不是挤压换行。 */
  minWidth?: number;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  isRowSelected,
  rowLabel,
  sortKey = null,
  sortDirection = 'asc',
  onSort,
  minWidth,
}: TableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }
  return (
    <div className={styles.scroll} role="region" aria-label="数据表" tabIndex={0}>
      <table className={styles.table} style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr>
            {columns.map((col) => {
              const sorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align ?? 'left' }}
                  aria-sort={sorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      className={`${styles.sortButton} ${sorted ? styles.sortButtonActive : ''}`}
                      onClick={() => onSort(col.key)}
                    >
                      {col.header}
                      {sorted ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp size={12} aria-hidden />
                        ) : (
                          <ArrowDown size={12} aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown size={12} className={styles.sortHint} aria-hidden />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
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
