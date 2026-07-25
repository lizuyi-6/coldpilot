import { Activity, AlertTriangle, CheckCircle2, Cpu, Snowflake, XCircle } from 'lucide-react';
import type { ApprovalRequest, ControlPlan, SimulationResult } from '@/domain/types';
import { riskLevelLabel } from '@/domain/viewModels';
import { Tag } from '@/components/ui/Tag';
import { planShortName } from './strategyView';
import styles from './strategy.module.css';

interface SafetyCheckPanelProps {
  plans: ControlPlan[];
  simulations: Record<string, SimulationResult>;
  /** 状态机中的审批请求（含安全规则校验），未请求审批时为 null。 */
  approval: ApprovalRequest | null;
}

function riskTone(level: SimulationResult['overshootRisk'] | undefined): 'accent' | 'warning' | 'danger' | 'neutral' {
  if (level === 'low') return 'accent';
  if (level === 'medium') return 'warning';
  if (level === 'high') return 'danger';
  return 'neutral';
}

/** 安全校验：过冲/冻害为仿真真实值；温度波动与设备负荷后端未提供，显示暂无数据；规则校验来自审批请求。 */
export function SafetyCheckPanel({ plans, simulations, approval }: SafetyCheckPanelProps) {
  const sorted = [...plans].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'recommended' ? -1 : 1));

  const riskColumn = (
    title: string,
    icon: React.ReactNode,
    pick: (simulation: SimulationResult) => SimulationResult['overshootRisk'],
  ) => (
    <div className={styles.safetyCol}>
      <div className={styles.safetyColTitle}>
        {icon}
        {title}
      </div>
      <div className={styles.safetyCompare}>
        {sorted.map((plan) => {
          const simulation = simulations[plan.id];
          return (
            <div key={plan.id} className={styles.safetyCompareRow}>
              <span>{planShortName(plan)}</span>
              <Tag tone={riskTone(simulation ? pick(simulation) : undefined)}>
                {simulation ? riskLevelLabel(pick(simulation)) : '—'}
              </Tag>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <div className={styles.safetyGrid}>
        {riskColumn('过冲风险', <AlertTriangle size={13} aria-hidden />, (s) => s.overshootRisk)}
        {riskColumn('冻害风险', <Snowflake size={13} aria-hidden />, (s) => s.frostRisk)}
        <div className={styles.safetyCol}>
          <div className={styles.safetyColTitle}>
            <Activity size={13} aria-hidden />
            温度波动
          </div>
          <div className={styles.note}>暂无数据</div>
        </div>
        <div className={styles.safetyCol}>
          <div className={styles.safetyColTitle}>
            <Cpu size={13} aria-hidden />
            设备负荷
          </div>
          <div className={styles.note}>暂无数据</div>
        </div>
      </div>

      <div className={styles.safetyRuleRows}>
        {approval ? (
          approval.safetyChecks.map((check) => (
            <div key={check.key} className={styles.safetyRuleRow}>
              {check.passed ? (
                <CheckCircle2 size={14} color="var(--color-accent)" aria-hidden />
              ) : (
                <XCircle size={14} color="var(--color-danger)" aria-hidden />
              )}
              <span>
                安全规则 · {check.label}：{check.passed ? '通过' : '未通过'}
              </span>
              {check.detail ? <span className={styles.detail}>{check.detail}</span> : null}
            </div>
          ))
        ) : (
          <p className={styles.note}>安全规则校验（白名单 / 上下限 / 变化率 / 冲突 / 权限）将在请求审批时由后端生成。</p>
        )}
      </div>
    </div>
  );
}
