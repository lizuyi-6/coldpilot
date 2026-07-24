import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { AnomalyEventSummary, ControlPlan, SimulationResult } from '@/domain/types';
import type { EnergyPoint } from '@/domain/energy';
import { riskLevelLabel } from '@/domain/viewModels';
import { Panel } from '@/components/ui/Panel';
import { Tabs } from '@/components/ui/Tabs';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Sparkline } from '@/components/ui/Sparkline';
import { EmptyState } from '@/components/ui/EmptyState';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { formatInt, formatNumber } from '@/utils/formatNumber';
import styles from './commandCenter.module.css';

interface StrategySimPanelProps {
  event: AnomalyEventSummary | undefined;
  plans: ControlPlan[];
  simulations: Record<string, SimulationResult>;
  simulating: boolean;
  rerun: () => void;
  energyCurve: EnergyPoint[];
}

function planTargetTemp(plan: ControlPlan): number | null {
  const param = plan.params.find((p) => p.key === 'targetTemp');
  return typeof param?.value === 'number' ? param.value : null;
}

/** 第三行左侧：策略与仿真（温控策略 / 节能调度 / 仿真记录 / 策略库）。 */
export function StrategySimPanel({ event, plans, simulations, simulating, rerun, energyCurve }: StrategySimPanelProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('control');
  const recommended = plans.find((p) => p.kind === 'recommended') ?? plans[0];

  return (
    <Panel
      title="策略与仿真"
      className={styles.panelFill}
      action={
        <span className={styles.panelActions}>
          <DemoDataBadge kind="simulated" />
        </span>
      }
    >
      <Tabs
        ariaLabel="策略与仿真"
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'control', label: '温控策略' },
          { key: 'saving', label: '节能调度' },
          { key: 'records', label: '仿真记录' },
          { key: 'library', label: '策略库' },
        ]}
      />

      {!event || plans.length === 0 ? (
        <EmptyState title="暂无候选方案" description="诊断完成后将生成候选控制方案（均需 L2 人工审批）。" />
      ) : (
        <>
          {tab === 'control' && (
            <div className={styles.planTabBody}>
              <div className={styles.planCards}>
                {plans.map((plan) => {
                  const sim = simulations[plan.id];
                  const targetTemp = planTargetTemp(plan);
                  const curve = sim ? sim.predictedSeries.map((p) => p.value) : [];
                  return (
                    <div key={plan.id} className={styles.planCard}>
                      <div className={styles.planHead}>
                        <span className={styles.planName}>{plan.name}</span>
                        <Tag tone={plan.kind === 'recommended' ? 'accent' : 'neutral'}>
                          {plan.kind === 'recommended' ? '推荐' : '备选'}
                        </Tag>
                      </div>
                      <div className={styles.planApproach}>{plan.approach}</div>
                      <div className={styles.planStats}>
                        <div className={styles.planStat}>
                          <span className={styles.planStatLabel}>预计恢复时间</span>
                          <span className={`${styles.planStatValue} numeric`}>{sim ? `${formatNumber(sim.recoveryHours, 1)} h` : simulating ? '仿真中…' : '—'}</span>
                        </div>
                        <div className={styles.planStat}>
                          <span className={styles.planStatLabel}>预计能耗</span>
                          <span className={`${styles.planStatValue} numeric`}>{sim ? `${formatInt(sim.energyKWh)} kWh` : '—'}</span>
                        </div>
                        <div className={styles.planStat}>
                          <span className={styles.planStatLabel}>温度过冲风险</span>
                          <span className={styles.planStatValue}>{sim ? riskLevelLabel(sim.overshootRisk) : '—'}</span>
                        </div>
                        <div className={styles.planStat}>
                          <span className={styles.planStatLabel}>冻害风险</span>
                          <span className={styles.planStatValue}>{sim ? riskLevelLabel(sim.frostRisk) : '—'}</span>
                        </div>
                      </div>
                      <div className={styles.planCurve}>
                        {curve.length > 1 ? (
                          <Sparkline
                            data={curve}
                            width={210}
                            height={44}
                            band={targetTemp !== null ? [targetTemp - 0.4, targetTemp + 0.4] : undefined}
                          />
                        ) : (
                          <span className={styles.planCurveEmpty}>预测曲线生成中…</span>
                        )}
                        <div className={styles.planCurveAxis}>
                          <span>现在</span>
                          <span>{sim ? `${formatNumber(sim.recoveryHours, 0)}h 后` : ''}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {recommended && (
                <div className={styles.controlPlanRow}>
                  <div className={styles.controlPlanTableWrap}>
                    <div className={styles.controlPlanTitle}>控制计划（{recommended.name}）</div>
                    <table className={styles.controlPlanTable}>
                      <thead>
                        <tr><th>参数</th><th>设定值</th><th>边界</th></tr>
                      </thead>
                      <tbody>
                        {recommended.params.map((param) => (
                          <tr key={param.key}>
                            <td>{param.label}</td>
                            <td className="numeric">{param.value}{param.unit ?? ''}</td>
                            <td className="numeric">{param.bound ? `${param.bound.min} ~ ${param.bound.max}${param.unit ?? ''}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.controlPlanActions}>
                    <Button variant="secondary" size="sm" onClick={rerun} disabled={simulating}>
                      <Play size={13} /> {simulating ? '仿真中…' : '运行仿真'}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate('/strategy')}
                      title="审批需在策略与仿真页按状态机流程进行（L2 人工确认）"
                    >
                      提交审批
                    </Button>
                    <span className={styles.controlPlanHint}>所有方案均为 L2，需人工确认后执行</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'saving' && <SavingSchedule energyCurve={energyCurve} />}

          {tab === 'records' && (
            <table className={styles.controlPlanTable} style={{ marginTop: 10 }}>
              <thead>
                <tr><th>方案</th><th>恢复时间</th><th>预计能耗</th><th>过冲</th><th>冻害</th><th>压缩机启停</th><th>来源</th></tr>
              </thead>
              <tbody>
                {plans.map((plan) => {
                  const sim = simulations[plan.id];
                  return (
                    <tr key={plan.id}>
                      <td>{plan.name}</td>
                      <td className="numeric">{sim ? `${formatNumber(sim.recoveryHours, 1)} h` : '—'}</td>
                      <td className="numeric">{sim ? `${formatInt(sim.energyKWh)} kWh` : '—'}</td>
                      <td>{sim ? riskLevelLabel(sim.overshootRisk) : '—'}</td>
                      <td>{sim ? riskLevelLabel(sim.frostRisk) : '—'}</td>
                      <td className="numeric">{sim ? `${sim.compressorCycles} 次` : '—'}</td>
                      <td><Tag tone="info">仿真</Tag></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === 'library' && (
            <div className={styles.planTabBody}>
              {plans.map((plan) => (
                <div key={plan.id} className={styles.libraryItem}>
                  <div className={styles.planHead}>
                    <span className={styles.planName}>{plan.name}</span>
                    <Tag tone={plan.kind === 'recommended' ? 'accent' : 'neutral'}>{plan.kind === 'recommended' ? '推荐' : '备选'}</Tag>
                  </div>
                  <div className={styles.planApproach}>{plan.approach}</div>
                  <div className={styles.libraryRollback}>
                    回退条件：{plan.rollbackConditions.join('；')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/** 节能调度建议（由峰平谷时段派生，演示）。 */
function SavingSchedule({ energyCurve }: { energyCurve: EnergyPoint[] }) {
  const valley = energyCurve.filter((p) => p.period === 'valley').reduce((a, p) => a + p.kwh, 0);
  const peak = energyCurve.filter((p) => p.period === 'peak').reduce((a, p) => a + p.kwh, 0);
  const items = [
    { window: '23:00 – 07:00（谷段）', action: '预冷降温至目标下限，蓄冷削峰', saving: `谷段用电 ${formatInt(valley)} kWh` },
    { window: '08:00 – 11:00（峰段）', action: '压缩机降载 20%，风机保持中速循环', saving: `峰段用电 ${formatInt(peak)} kWh` },
    { window: '18:00 – 21:00（峰段）', action: '避免库门长时间开启，分批出入库', saving: '减少负荷扰动' },
  ];
  return (
    <div className={styles.planTabBody}>
      {items.map((item) => (
        <div key={item.window} className={styles.libraryItem}>
          <div className={styles.savingWindow}>{item.window}</div>
          <div className={styles.planApproach}>{item.action}</div>
          <div className={styles.libraryRollback}>{item.saving}（演示派生，非真实节能成果）</div>
        </div>
      ))}
    </div>
  );
}