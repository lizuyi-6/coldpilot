import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { X } from 'lucide-react';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import type { ControlPlan, SimulationResult } from '@/domain/types';
import type { UseWorkbench } from '@/state/useWorkbench';
import { formatInt } from '@/utils/formatNumber';
import styles from './SimulationCompareView.module.css';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const RISK_LABEL = { low: '低', medium: '中', high: '高' } as const;

function CompareChart({ a, b, unit }: { a: SimulationResult; b: SimulationResult; unit: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const toPairs = (pts: { t: string; value: number }[]) => pts.map((p) => [Date.parse(p.t), p.value]);
    chart.setOption({
      animation: false,
      grid: { left: 44, right: 16, top: 16, bottom: 28 },
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => `${v} ${unit}` },
      xAxis: { type: 'time', axisLabel: { color: '#52606d', fontSize: 11 } },
      yAxis: { type: 'value', scale: true, name: unit, axisLabel: { color: '#52606d', fontSize: 11 }, splitLine: { lineStyle: { color: '#f0f2f4' } } },
      series: [
        { name: '方案 A', type: 'line', data: toPairs(a.predictedSeries), showSymbol: false, smooth: true, lineStyle: { color: '#0f766e', width: 2 } },
        { name: '方案 B', type: 'line', data: toPairs(b.predictedSeries), showSymbol: false, smooth: true, lineStyle: { color: '#2f6fdb', width: 2, type: 'dashed' } },
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [a, b, unit]);
  return <div ref={ref} style={{ width: '100%', height: 260 }} role="img" aria-label="方案对比曲线" />;
}

interface SimulationCompareViewProps {
  wb: UseWorkbench;
  open: boolean;
  onClose: () => void;
}

/** 方案 A/B 并排对比：指标 + 预测曲线（仿真结果）。 */
export function SimulationCompareView({ wb, open, onClose }: SimulationCompareViewProps) {
  if (!open) return null;
  const plans = wb.context.plans;
  const planA = plans.find((p) => p.kind === 'recommended');
  const planB = plans.find((p) => p.kind === 'alternative');
  const simA = planA ? wb.data.simulations[planA.id] : undefined;
  const simB = planB ? wb.data.simulations[planB.id] : undefined;
  if (!planA || !planB || !simA || !simB) return null;

  const renderCol = (plan: ControlPlan, sim: SimulationResult) => (
    <div className={`${styles.planCol} ${plan.kind === 'recommended' ? styles.planColRecommended : ''}`}>
      <div className={styles.planName}>
        {plan.name}
        {plan.kind === 'recommended' ? <span className={styles.recommend}>● 推荐</span> : null}
      </div>
      <div className={styles.row}><span className={styles.rowLabel}>恢复时间</span><span className={styles.rowValue}>{sim.recoveryHours} h</span></div>
      <div className={styles.row}><span className={styles.rowLabel}>预计能耗</span><span className={styles.rowValue}>{formatInt(sim.energyKWh)} kWh</span></div>
      <div className={styles.row}><span className={styles.rowLabel}>温度过冲风险</span><span className={styles.rowValue}>{RISK_LABEL[sim.overshootRisk]}</span></div>
      <div className={styles.row}><span className={styles.rowLabel}>冻害风险</span><span className={styles.rowValue}>{RISK_LABEL[sim.frostRisk]}</span></div>
      <div className={styles.row}><span className={styles.rowLabel}>压缩机启停</span><span className={styles.rowValue}>{sim.compressorCycles} 次</span></div>
    </div>
  );

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="方案对比" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>方案对比 <DemoDataBadge kind="simulated" /></div>
          <button className={styles.close} onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        <div className={styles.grid}>
          {renderCol(planA, simA)}
          {renderCol(planB, simB)}
        </div>
        <div className={styles.chartWrap}>
          <div className={styles.legend}>
            <span className={styles.legendItem}><span className={styles.swatch} style={{ background: '#0f766e' }} /> 方案 A</span>
            <span className={styles.legendItem}><span className={styles.swatch} style={{ background: '#2f6fdb' }} /> 方案 B</span>
          </div>
          <CompareChart a={simA} b={simB} unit="℃" />
        </div>
      </div>
    </div>
  );
}