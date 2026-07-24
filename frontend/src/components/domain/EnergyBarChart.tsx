import type { EnergyPoint } from '@/domain/energy';
import styles from './EnergyBarChart.module.css';

interface EnergyBarChartProps {
  curve: EnergyPoint[];
  height?: number;
}

const PERIOD_COLOR: Record<EnergyPoint['period'], string> = {
  peak: 'var(--color-danger)',
  flat: 'var(--color-info)',
  valley: 'var(--color-accent)',
};

/** 24h 能耗柱状图（峰平谷着色）。 */
export function EnergyBarChart({ curve, height = 140 }: EnergyBarChartProps) {
  const max = Math.max(...curve.map((p) => p.kwh), 1);
  return (
    <div className={styles.wrap}>
      <div className={styles.chart} style={{ height }} role="img" aria-label="24 小时能耗柱状图">
        {curve.map((p) => (
          <div key={p.hour} className={styles.col} title={`${p.hour}:00 · ${p.kwh} kWh`}>
            <div
              className={styles.bar}
              style={{ height: `${(p.kwh / max) * 100}%`, background: PERIOD_COLOR[p.period] }}
            />
          </div>
        ))}
      </div>
      <div className={styles.axis}>
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}><i style={{ background: PERIOD_COLOR.peak }} />峰</span>
        <span className={styles.legendItem}><i style={{ background: PERIOD_COLOR.flat }} />平</span>
        <span className={styles.legendItem}><i style={{ background: PERIOD_COLOR.valley }} />谷</span>
      </div>
    </div>
  );
}