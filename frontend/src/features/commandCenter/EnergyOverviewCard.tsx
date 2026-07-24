import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { EnergyPoint } from '@/domain/energy';
import { Panel } from '@/components/ui/Panel';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { formatInt } from '@/utils/formatNumber';
import styles from './commandCenter.module.css';

interface EnergyOverviewCardProps {
  todayKwh: number;
  deltaPct: number;
  curve: EnergyPoint[];
}

const PERIOD_COLOR = { peak: 'var(--color-danger)', flat: 'var(--color-info)', valley: 'var(--color-accent)' } as const;

/** 第二行：能耗概览（今日用电 + 同比 + 24h 迷你柱状）。 */
export function EnergyOverviewCard({ todayKwh, deltaPct, curve }: EnergyOverviewCardProps) {
  const max = Math.max(...curve.map((p) => p.kwh), 1);
  const down = deltaPct <= 0;

  return (
    <Panel
      title="能耗概览（今日）"
      className={styles.panelFill}
      action={
        <span className={styles.panelActions}>
          <DemoDataBadge kind="demo" />
          <Link to="/energy" className={styles.moreLink}>能耗分析 ›</Link>
        </span>
      }
    >
      <div className={styles.energyBody}>
        <div className={styles.energyTopRow}>
          <div>
            <div className={styles.energyCaption}>总用电量</div>
            <div>
              <span className={`${styles.energyValue} numeric`}>{formatInt(todayKwh)}</span>
              <span className={styles.energyUnit}>kWh</span>
            </div>
          </div>
          <span className={`${styles.energyDelta} ${down ? styles.energyDeltaDown : styles.energyDeltaUp}`}>
            {down ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
            {Math.abs(deltaPct).toFixed(1)}% 较昨日同期
          </span>
        </div>
        <div className={styles.energyBars} role="img" aria-label="24 小时用电趋势（演示派生）">
          {curve.map((p) => (
            <i
              key={p.hour}
              className={styles.energyBar}
              style={{ height: `${Math.max(6, (p.kwh / max) * 100)}%`, background: PERIOD_COLOR[p.period] }}
              title={`${p.hour}:00 · ${p.kwh} kWh`}
            />
          ))}
        </div>
        <div className={styles.energyAxis}>
          <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
        </div>
      </div>
    </Panel>
  );
}