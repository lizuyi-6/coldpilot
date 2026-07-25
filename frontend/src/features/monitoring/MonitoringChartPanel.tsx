import { useMemo, useState } from 'react';
import { Download, Maximize2 } from 'lucide-react';
import type { MetricKey, RoomEventMarker, SensorSeries } from '@/domain/types';
import { METRIC_META, METRIC_ORDER } from '@/domain/constants/metrics';
import { latestValue } from '@/domain/viewModels';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricChart } from '@/components/domain/MetricChart';
import styles from './monitoring.module.css';

/** 事件类别 → 图例（与 MetricChart 事件符号一致）。 */
const MARKER_LEGEND: Record<RoomEventMarker['kind'], { label: string; color: string; shape: string }> = {
  door_open: { label: '库门开启', color: '#e7a13a', shape: 'triangle' },
  door_close: { label: '库门关闭', color: '#0fa978', shape: 'diamond' },
  inbound: { label: '入库', color: '#3478f6', shape: 'rect' },
  compressor_start: { label: '压缩机启动', color: '#0fa978', shape: 'circle' },
  compressor_stop: { label: '压缩机停机', color: '#8b97a8', shape: 'circle' },
};

function shapeStyle(shape: string, color: string): React.CSSProperties {
  const base: React.CSSProperties = { background: color };
  if (shape === 'triangle') {
    return {
      width: 0,
      height: 0,
      background: 'transparent',
      borderLeft: '5px solid transparent',
      borderRight: '5px solid transparent',
      borderBottom: `9px solid ${color}`,
    };
  }
  if (shape === 'diamond') return { ...base, transform: 'rotate(45deg)', borderRadius: 2 };
  if (shape === 'rect') return { ...base, borderRadius: 2 };
  return { ...base, borderRadius: '50%' };
}

/** 将当前展示序列导出为 CSV（前端导出当前已加载数据，后端无导出接口）。 */
function downloadSeriesCsv(roomName: string, series: SensorSeries): void {
  const header = 'timestamp_utc,value,unit\n';
  const body = series.points.map((p) => `${p.t},${p.value},${series.unit}`).join('\n');
  const blob = new Blob([`\uFEFF${header}${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${roomName}-${METRIC_META[series.metric].label}-${series.points[0]?.t.slice(0, 10) ?? 'export'}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface MonitoringChartPanelProps {
  roomName: string;
  telemetry: SensorSeries[];
  /** 已勾选（可展示）的指标集合。 */
  enabledMetrics: MetricKey[];
  activeMetric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
  markers: RoomEventMarker[];
  height?: number;
}

export function MonitoringChartPanel({
  roomName,
  telemetry,
  enabledMetrics,
  activeMetric,
  onMetricChange,
  markers,
  height = 300,
}: MonitoringChartPanelProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const series = telemetry.find((s) => s.metric === activeMetric);
  const current = latestValue(series);
  const target = series?.target;
  const outOfRange = current !== null && target ? current < target.min || current > target.max : false;

  const legendMarkers = useMemo(() => {
    const kinds = new Set(markers.map((m) => m.kind));
    return (Object.keys(MARKER_LEGEND) as RoomEventMarker['kind'][])
      .filter((kind) => kinds.has(kind))
      .map((kind) => MARKER_LEGEND[kind]);
  }, [markers]);

  const enabledSeries = METRIC_ORDER.filter(
    (metric) => enabledMetrics.includes(metric) && telemetry.some((s) => s.metric === metric),
  );

  const legendRow = (
    <div className={styles.legend}>
      {series && (
        <span className={styles.legendItem}>
          <span className={styles.legendLine} />
          {METRIC_META[activeMetric].label}（{series.unit}）
        </span>
      )}
      {target && (
        <span className={styles.legendItem}>
          <span className={styles.legendBand} />
          目标区间
        </span>
      )}
      {legendMarkers.map((item) => (
        <span key={item.label} className={styles.legendItem}>
          <span className={styles.legendMark} style={shapeStyle(item.shape, item.color)} />
          {item.label}
        </span>
      ))}
    </div>
  );

  return (
    <Panel
      title="多指标实时曲线"
      action={
        <>
          <IconButton
            aria-label="全屏查看图表"
            disabled={!series || series.points.length === 0}
            title={series ? '全屏查看' : '暂无可展示的数据'}
            onClick={() => setFullscreen(true)}
          >
            <Maximize2 size={15} />
          </IconButton>
          <Button
            variant="secondary"
            size="sm"
            disabled={!series || series.points.length === 0}
            title={series ? '导出当前已加载的指标序列为 CSV' : '暂无可导出的数据'}
            onClick={() => series && downloadSeriesCsv(roomName, series)}
          >
            <Download size={14} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
            导出
          </Button>
        </>
      }
    >
      <div className={styles.chartHead}>
        <div className={styles.metricTabs} role="tablist" aria-label="指标切换">
          {enabledSeries.map((metric) => (
            <button
              key={metric}
              role="tab"
              aria-selected={metric === activeMetric}
              className={`${styles.metricTab} ${metric === activeMetric ? styles.metricTabActive : ''}`}
              onClick={() => onMetricChange(metric)}
            >
              {METRIC_META[metric].label}
            </button>
          ))}
        </div>
        <div className={styles.chartStats}>
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>当前值</span>
            <span className={`${styles.statValue} ${outOfRange ? styles.statValueOut : ''}`}>
              {current === null ? '—' : current.toFixed(1)}
              <small>{series?.unit ?? ''}</small>
            </span>
          </div>
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>目标范围</span>
            <span className={styles.statTarget}>
              {target ? `${target.min} ~ ${target.max} ${target.unit}` : '暂无数据'}
            </span>
          </div>
        </div>
      </div>

      {legendRow}

      {series && series.points.length > 0 ? (
        <MetricChart
          series={series.points}
          unit={series.unit}
          target={target}
          markers={markers}
          height={height}
          showZoom
        />
      ) : (
        <EmptyState title="该指标暂无数据" description={`当前冷库未采集「${METRIC_META[activeMetric].label}」数据。`} />
      )}

      <Dialog
        open={fullscreen}
        title={`${roomName} · ${METRIC_META[activeMetric].label}实时曲线`}
        onClose={() => setFullscreen(false)}
        width={Math.min(1120, Math.round(window.innerWidth * 0.86))}
      >
        <div className={styles.fullscreenBody}>
          {legendRow}
          {series && (
            <MetricChart
              series={series.points}
              unit={series.unit}
              target={target}
              markers={markers}
              height={Math.round(window.innerHeight * 0.62)}
              showZoom
            />
          )}
        </div>
      </Dialog>
    </Panel>
  );
}
