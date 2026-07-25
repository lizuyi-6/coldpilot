import { FlaskConical } from 'lucide-react';
import type { ControlPlan, SimulationResult } from '@/domain/types';
import { riskLevelLabel } from '@/domain/viewModels';
import { Tag } from '@/components/ui/Tag';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { formatInt, formatNumber } from '@/utils/formatNumber';
import styles from './strategy.module.css';

interface PlanSummaryCardsProps {
  plans: ControlPlan[];
  simulations: Record<string, SimulationResult>;
  /** 全部方案仿真加载中（首次）。 */
  simulating: boolean;
}

function PlanStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className={styles.planStat}>
      <span className={styles.planStatLabel}>{label}</span>
      <span className={styles.planStatValue}>
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
    </div>
  );
}

/** 方案摘要 A/B：恢复时间 / 能耗 / 过冲 / 冻害 / 启停 + 方案特点（仿真为预测，非真实成效）。 */
export function PlanSummaryCards({ plans, simulations, simulating }: PlanSummaryCardsProps) {
  const sorted = [...plans].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'recommended' ? -1 : 1));
  return (
    <div className={styles.planGrid}>
      {sorted.map((plan) => {
        const simulation = simulations[plan.id] ?? null;
        const recommended = plan.kind === 'recommended';
        return (
          <div key={plan.id} className={`${styles.planCard} ${recommended ? styles.planCardRecommended : ''}`}>
            <div className={styles.planCardHead}>
              <span className={styles.planCardName}>{plan.name}</span>
              <Tag tone={recommended ? 'accent' : 'neutral'}>{recommended ? '推荐' : '备选'}</Tag>
            </div>
            {simulation ? (
              <div className={styles.planCardStats}>
                <PlanStat label="总预计恢复时间" value={formatNumber(simulation.recoveryHours, 1)} unit="h" />
                <PlanStat label="预计能耗" value={formatInt(simulation.energyKWh)} unit="kWh" />
                <PlanStat label="过冲风险" value={riskLevelLabel(simulation.overshootRisk)} />
                <PlanStat label="冻害风险" value={riskLevelLabel(simulation.frostRisk)} />
                <PlanStat label="启停次数" value={String(simulation.compressorCycles)} unit="次" />
              </div>
            ) : (
              <div className={styles.planApproach}>
                <FlaskConical size={13} aria-hidden style={{ verticalAlign: -2, marginRight: 4 }} />
                {simulating ? '仿真计算中…' : '暂无仿真数据'}
              </div>
            )}
            <div className={styles.planApproach}>
              特点：{plan.approach}
              <span style={{ marginLeft: 8 }}>
                <DemoDataBadge kind="simulated" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
