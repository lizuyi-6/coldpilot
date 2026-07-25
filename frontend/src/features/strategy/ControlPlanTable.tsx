import type { ControlPlan } from '@/domain/types';
import { planShortName } from './strategyView';
import styles from './strategy.module.css';

interface ControlPlanTableProps {
  plans: ControlPlan[];
}

/**
 * 控制计划：按参数键横向对比各方案的受控目标（值 + 白名单边界）。
 * 后端未提供分时段（逐小时）控制计划，页面明确标注该限制，不编造时段数据。
 */
export function ControlPlanTable({ plans }: ControlPlanTableProps) {
  const sorted = [...plans].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'recommended' ? -1 : 1));
  const paramKeys = Array.from(
    new Map(sorted.flatMap((plan) => plan.params.map((param) => [param.key, param.label]))).entries(),
  );

  return (
    <div>
      <table className={styles.controlTable} aria-label="控制计划参数对比">
        <thead>
          <tr>
            <th>控制参数</th>
            {sorted.map((plan) => (
              <th key={plan.id}>{planShortName(plan)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paramKeys.map(([key, label]) => (
            <tr key={key}>
              <td className={styles.controlParamName}>{label}</td>
              {sorted.map((plan) => {
                const param = plan.params.find((p) => p.key === key);
                return (
                  <td key={plan.id}>
                    {param ? (
                      <>
                        <span className="numeric">
                          {param.value}
                          {param.unit ?? ''}
                        </span>
                        {param.bound ? (
                          <span className={styles.controlBound}>
                            边界 {param.bound.min}~{param.bound.max}
                            {param.unit ?? ''}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.chartNote}>以上为方案受控目标值与白名单边界；分时段（逐小时）控制计划暂未由后端下发。</p>
    </div>
  );
}
