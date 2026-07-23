import { useMemo, useState } from 'react';
import type { MetricKey } from '@/domain/types';
import { METRIC_META } from '@/domain/constants/metrics';
import { Segmented } from '@/components/ui/Segmented';
import { MetricChart } from '@/components/domain/MetricChart';
import type { UseWorkbench } from '@/state/useWorkbench';
import { Clock } from 'lucide-react';
import { formatTimeHM } from '@/utils/formatTime';
import styles from './diagnosis.module.css';

/** 趋势区：指标切换 + 24h 曲线（目标带 + 事件标记 + 可选预测线）。 */
export function TrendSection({ wb }: { wb: UseWorkbench }) {
  const { data, status } = wb;
  const detail = data.eventDetail;
  const [metric, setMetric] = useState<MetricKey>('temperature');

  const seriesList = useMemo(() => detail?.telemetry ?? [], [detail]);
  const active = seriesList.find((s) => s.metric === metric);

  const metricOptions = seriesList.map((s) => ({ value: s.metric, label: METRIC_META[s.metric].label }));

  // 仿真预测线（simulationCompleted 及之后）或执行观测线（executing/verifying）。
  const activeSim = wb.context.activePlanId ? data.simulations[wb.context.activePlanId] : undefined;
  const predicted =
    status === 'executing' || status === 'verifying' || status === 'recovered'
      ? data.execution?.observedSeries
      : activeSim?.predictedSeries;

  if (!detail) return null;

  return (
    <section className={styles.section}>
      <div className={styles.trendControls}>
        <div className={styles.sectionHeading}>
          趋势
          {active?.status === 'stale' ? (
            <span className={styles.sectionHint}><Clock size={12} aria-hidden /> 数据延迟</span>
          ) : null}
        </div>
        <Segmented options={metricOptions} value={metric} onChange={(v) => setMetric(v as MetricKey)} ariaLabel="指标切换" />
      </div>
      {active ? (
        <>
          <MetricChart
            series={active.points}
            unit={active.unit}
            target={active.target}
            markers={detail.roomEvents}
            predictedSeries={metric === 'temperature' ? predicted : undefined}
          />
          <div className={styles.sectionHint} style={{ marginTop: 4 }}>
            {active.target ? `目标区间 ${active.target.min}~${active.target.max}${active.target.unit} · ` : ''}
            最近采样 {formatTimeHM(active.lastSampleAt)}
            {predicted && metric === 'temperature' ? ' · 虚线为仿真/执行预测' : ''}
          </div>
        </>
      ) : (
        <div className={styles.sectionHint}>该指标暂无数据</div>
      )}
    </section>
  );
}