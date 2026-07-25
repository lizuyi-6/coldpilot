import { formatInt } from '@/utils/formatNumber';
import styles from './energy.module.css';

export interface DonutSlice {
  label: string;
  kwh: number;
  color: string;
}

interface PeriodDonutProps {
  slices: DonutSlice[];
  /** 中心主值（如 1,246）。 */
  centerValue: string;
  centerLabel: string;
}

const DONUT_R = 34;
const DONUT_C = 2 * Math.PI * DONUT_R;

/** 占比环图 + 明细列表（峰平谷分布 / 设备能耗构成共用）。 */
export function PeriodDonut({ slices, centerValue, centerLabel }: PeriodDonutProps) {
  const total = slices.reduce((sum, slice) => sum + slice.kwh, 0);
  const cumulative = slices.map((_, index) => slices.slice(0, index).reduce((sum, slice) => sum + (total > 0 ? slice.kwh / total : 0) * DONUT_C, 0));

  return (
    <div className={styles.donutWrap}>
      <div className={styles.donutChart}>
        <svg viewBox="0 0 96 96" style={{ width: '100%', height: 'auto' }} role="img" aria-label="占比环图">
          <circle cx="48" cy="48" r={DONUT_R} fill="none" stroke="var(--color-neutral-200)" strokeWidth="11" />
          {slices.map((slice, index) => {
            const fraction = total > 0 ? slice.kwh / total : 0;
            const length = fraction * DONUT_C;
            return (
              <circle
                key={slice.label}
                cx="48"
                cy="48"
                r={DONUT_R}
                fill="none"
                stroke={slice.color}
                strokeWidth="11"
                strokeDasharray={`${Math.max(0, length - 1.5)} ${DONUT_C - length + 1.5}`}
                strokeDashoffset={-cumulative[index]}
                transform="rotate(-90 48 48)"
              />
            );
          })}
        </svg>
        <div className={styles.donutCenter}>
          <span className={styles.donutValue}>{centerValue}</span>
          <span className={styles.donutLabel}>{centerLabel}</span>
        </div>
      </div>
      <ul className={styles.donutList}>
        {slices.map((slice) => (
          <li key={slice.label} className={styles.donutItem}>
            <i className={styles.donutDot} style={{ background: slice.color }} />
            <span className={styles.donutName}>{slice.label}</span>
            <span className={`${styles.donutPct} numeric`}>{total > 0 ? Math.round((slice.kwh / total) * 1000) / 10 : 0}%</span>
            <span className={`${styles.donutKwh} numeric`}>{formatInt(slice.kwh)} kWh</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
