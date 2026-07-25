import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from './Select';
import styles from './Pagination.module.css';

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

/** 页码序列：页数较多时折叠为 1 … 当前±1 … N。 */
function pageSequence(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const window = new Set<number>([1, totalPages, current - 1, current, current + 1]);
  const pages = Array.from(window).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const seq: (number | 'ellipsis')[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) seq.push('ellipsis');
    seq.push(p);
  });
  return seq;
}

export function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const [jump, setJump] = useState(String(safePage));

  useEffect(() => {
    setJump(String(safePage));
  }, [safePage]);

  const commitJump = () => {
    const target = Number.parseInt(jump, 10);
    if (Number.isFinite(target)) onPageChange(Math.min(Math.max(1, target), totalPages));
    else setJump(String(safePage));
  };

  return (
    <div className={styles.bar}>
      <span className={styles.info}>共 {total} 条</span>
      <nav className={styles.pages} aria-label="分页">
        <button
          type="button"
          className={styles.pageBtn}
          aria-label="上一页"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft size={14} aria-hidden />
        </button>
        {pageSequence(safePage, totalPages).map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className={styles.ellipsis} aria-hidden>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`${styles.pageBtn} ${item === safePage ? styles.current : ''}`}
              aria-label={`第 ${item} 页`}
              aria-current={item === safePage ? 'page' : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className={styles.pageBtn}
          aria-label="下一页"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          <ChevronRight size={14} aria-hidden />
        </button>
      </nav>
      {onPageSizeChange && (
        <Select
          ariaLabel="每页条数"
          options={pageSizeOptions.map((n) => ({ value: String(n), label: `${n} 条/页` }))}
          value={String(pageSize)}
          onChange={(v) => onPageSizeChange(Number.parseInt(v, 10))}
        />
      )}
      <label className={styles.jump}>
        跳至
        <input
          className={styles.jumpInput}
          type="number"
          min={1}
          max={totalPages}
          value={jump}
          aria-label="跳转页码"
          onChange={(e) => setJump(e.target.value)}
          onBlur={commitJump}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitJump();
          }}
        />
        页
      </label>
    </div>
  );
}
