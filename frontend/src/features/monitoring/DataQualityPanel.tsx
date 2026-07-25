import type { SensorSeries } from '@/domain/types';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { GaugeDonut } from '@/components/domain/GaugeDonut';
import { dataQualityView } from './monitoringView';
import styles from './monitoring.module.css';

interface DataQualityPanelProps {
  telemetry: SensorSeries[];
}

/** 数据质量：完整度环 + 派生统计（在线数、采样间隔、越界采样点）。 */
export function DataQualityPanel({ telemetry }: DataQualityPanelProps) {
  if (telemetry.length === 0) {
    return (
      <Panel title="数据质量">
        <EmptyState title="暂无数据" description="当前冷库没有传感器通道。" />
      </Panel>
    );
  }
  const quality = dataQualityView(telemetry);
  return (
    <Panel title="数据质量">
      <div className={styles.qualityBody}>
        <GaugeDonut percent={quality.completenessPct} caption={quality.rating} />
        <div className={styles.qualityStats}>
          <div className={styles.qualityRow}>
            <span className={styles.qualityName}>数据完整度</span>
            <span className={styles.qualityValue}>{quality.completenessPct}%</span>
          </div>
          <div className={styles.qualityRow}>
            <span className={styles.qualityName}>平均延迟</span>
            <span className={styles.qualityValue}>
              {quality.avgLagMinutes === 0 ? '实时' : `${quality.avgLagMinutes} 分钟`}
            </span>
          </div>
          <div className={styles.qualityRow}>
            <span className={styles.qualityName}>异常数据点</span>
            <span className={styles.qualityValue}>
              {quality.anomalousPoints === null ? '暂无数据' : `${quality.anomalousPoints} 个`}
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
