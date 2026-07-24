import { Link } from 'react-router-dom';
import type { InventoryBatch } from '@/domain/types';
import { Panel } from '@/components/ui/Panel';
import { formatNumber } from '@/utils/formatNumber';
import styles from './commandCenter.module.css';

const DONUT_COLORS = ['#0fa978', '#3478f6', '#e7a13a', '#a68fc4', '#8fb3d9', '#d9a06f'];

interface InventoryOverviewCardProps {
  inventory: InventoryBatch[];
}

interface Slice {
  category: string;
  kg: number;
  pct: number;
  color: string;
}

/** 第二行：库存概览（环形占比 + 品类明细）。 */
export function InventoryOverviewCard({ inventory }: InventoryOverviewCardProps) {
  const totalKg = inventory.reduce((acc, batch) => acc + batch.quantityKg, 0);

  const byCategory = new Map<string, number>();
  inventory.forEach((batch) => {
    const key = batch.category.replace(/（.*）/, '');
    byCategory.set(key, (byCategory.get(key) ?? 0) + batch.quantityKg);
  });
  const slices: Slice[] = Array.from(byCategory.entries())
    .map(([category, kg], i) => ({
      category,
      kg,
      pct: totalKg > 0 ? (kg / totalKg) * 100 : 0,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }))
    .sort((a, b) => b.kg - a.kg);

  /* SVG 圆环分段。 */
  const R = 34;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = slices.map((slice) => {
    const len = (slice.pct / 100) * C;
    const arc = { ...slice, dasharray: `${Math.max(0, len - 1.5)} ${C - len + 1.5}`, dashoffset: -offset };
    offset += len;
    return arc;
  });

  return (
    <Panel title="库存概览" className={styles.panelFill} action={<Link to="/inventory" className={styles.moreLink}>库存管理 ›</Link>}>
      <div className={styles.invBody}>
        <div className={styles.donutWrap}>
          <svg viewBox="0 0 96 96" className={styles.donut}>
            <circle cx="48" cy="48" r={R} fill="none" stroke="var(--color-neutral-200)" strokeWidth="11" />
            {arcs.map((arc) => (
              <circle
                key={arc.category}
                cx="48"
                cy="48"
                r={R}
                fill="none"
                stroke={arc.color}
                strokeWidth="11"
                strokeDasharray={arc.dasharray}
                strokeDashoffset={arc.dashoffset}
                transform="rotate(-90 48 48)"
              />
            ))}
          </svg>
          <div className={styles.donutCenter}>
            <span className={styles.donutLabel}>总库存</span>
            <span className={`${styles.donutValue} numeric`}>{formatNumber(totalKg / 1000, 1)}</span>
            <span className={styles.donutUnit}>吨</span>
          </div>
        </div>
        <ul className={styles.invList}>
          {slices.map((slice) => (
            <li key={slice.category} className={styles.invItem}>
              <i className={styles.invDot} style={{ background: slice.color }} />
              <span className={styles.invName}>{slice.category}</span>
              <span className={`${styles.invKg} numeric`}>{formatNumber(slice.kg / 1000, 1)} 吨</span>
              <span className={`${styles.invPct} numeric`}>{Math.round(slice.pct)}%</span>
            </li>
          ))}
          <li className={styles.invMeta}>共 {inventory.length} 批次 · {inventory.filter((b) => b.risk !== 'none').length} 批关注</li>
        </ul>
      </div>
    </Panel>
  );
}