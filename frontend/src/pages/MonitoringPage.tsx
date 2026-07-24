import { useMemo, useState } from 'react';
import type { MetricKey } from '@/domain/types';
import { useAppData } from '@/state/appData';
import { METRIC_META } from '@/domain/constants/metrics';
import {
  deviceStatusLabel,
  deviceStatusTone,
  latestValue,
  metricSeries,
  sensorStatusLabel,
  sensorStatusTone,
} from '@/domain/viewModels';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { StatusDot } from '@/components/ui/StatusDot';
import { Tag } from '@/components/ui/Tag';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import { OfflineState } from '@/components/ui/OfflineState';
import { MetricChart } from '@/components/domain/MetricChart';
import { EventTimeline } from '@/components/domain/EventTimeline';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { formatTimeHM } from '@/utils/formatTime';
import { formatNumber } from '@/utils/formatNumber';
import styles from './MonitoringPage.module.css';

const RANGE_OPTIONS = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '12h', label: '12h' },
  { value: '24h', label: '24h' },
] as const;

const RANGE_MS: Record<string, number> = {
  '1h': 3_600_000,
  '6h': 6 * 3_600_000,
  '12h': 12 * 3_600_000,
  '24h': 24 * 3_600_000,
};

export default function MonitoringPage() {
  const { rooms, loading, roomId, setRoomId, online } = useAppData();
  const bundle = rooms[roomId];
  const room = bundle?.room;
  const [metric, setMetric] = useState<MetricKey>('temperature');
  const [range, setRange] = useState<'1h' | '6h' | '12h' | '24h'>('6h');

  const telemetry = bundle?.telemetry ?? [];
  const devices = bundle?.devices ?? [];
  const roomEvents = bundle?.roomEvents ?? [];

  const roomOptions = Object.values(rooms).map((b) => ({ value: b.room.id, label: b.room.name }));
  const metricOptions = Object.entries(METRIC_META).map(([value, meta]) => ({ value, label: meta.label }));

  const nowMs = useMemo(() => Date.now(), []);
  const windowMs = useMemo<[number, number]>(() => [nowMs - RANGE_MS[range], nowMs], [nowMs, range]);

  const series = metricSeries(telemetry, metric);
  const tempSeries = metricSeries(telemetry, 'temperature');
  const offlineCount = telemetry.filter((s) => s.status === 'offline').length;

  // 依据时间范围裁剪数据点。
  const clippedSeries = useMemo(() => {
    if (!series) return [];
    return series.points.filter((p) => Date.parse(p.t) >= windowMs[0]);
  }, [series, windowMs]);

  const clippedEvents = useMemo(
    () => roomEvents.filter((e) => Date.parse(e.at) >= windowMs[0]),
    [roomEvents, windowMs],
  );

  if (loading && !bundle) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonLoader lines={2} />
        <SkeletonLoader lines={4} />
      </div>
    );
  }
  if (!room || !bundle) {
    return <EmptyState title="暂无监控数据" description="当前冷库没有实时数据。" />;
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="实时监控"
        description={`${room.name} · 多指标实时趋势 · 目标区间 · 事件标记`}
        actions={<DemoDataBadge kind="demo" />}
      />

      {!online && <OfflineState lastUpdated={tempSeries ? formatTimeHM(tempSeries.lastSampleAt) : undefined} />}

      <div className={styles.toolbar}>
        <Select ariaLabel="选择冷库" options={roomOptions} value={roomId} onChange={setRoomId} />
        <Segmented
          options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={range}
          onChange={(v) => setRange(v as typeof range)}
          ariaLabel="时间范围"
        />
        <span className={styles.toolbarSpacer} />
        <Select ariaLabel="主指标" options={metricOptions} value={metric} onChange={(v) => setMetric(v as MetricKey)} />
        {offlineCount > 0 && <Tag tone="warning">{offlineCount} 个传感器离线</Tag>}
      </div>

      <div className={styles.grid}>
        <div className={styles.colStack}>
          <Panel
            title={`${METRIC_META[metric].label}趋势（${range}）`}
            action={
              series && (
                <StatusDot tone={sensorStatusTone(series.status)} label={sensorStatusLabel(series.status)} />
              )
            }
          >
            <div className={styles.chartPanel}>
              {series ? (
                <>
                  <MetricChart
                    series={clippedSeries}
                    unit={series.unit}
                    target={metric === 'temperature' ? room.targetRange : undefined}
                    markers={[]}
                    height={280}
                  />
                  <div className={styles.note}>
                    当前 {latestValue(series) !== null ? formatNumber(latestValue(series)!, metric === 'pressureDiff' ? 0 : 1) : '—'} {series.unit}
                    {metric === 'temperature' && ` · 目标 ${room.targetRange.min}~${room.targetRange.max} ${room.targetRange.unit}`}
                    {' · '}更新 {formatTimeHM(series.lastSampleAt)}
                  </div>
                </>
              ) : (
                <EmptyState title="该指标无数据" description={`当前冷库未采集 ${METRIC_META[metric].label}。`} />
              )}
            </div>
          </Panel>

          <Panel title="事件时间轴">
            {clippedEvents.length === 0 ? (
              <EmptyState title="该时间范围内无事件" description="库门/入库/压缩机启停事件将显示于此。" />
            ) : (
              <EventTimeline events={clippedEvents} windowMs={windowMs} />
            )}
            <div className={styles.eventList}>
              {clippedEvents.map((e) => (
                <div key={e.id} className={styles.eventItem}>
                  <span className={styles.eventTime}>{formatTimeHM(e.at)}</span>
                  <span>{e.label}</span>
                  {e.detail && <span className={styles.note}>{e.detail}</span>}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className={styles.colStack}>
          <Panel title="传感器状态">
            {telemetry.length === 0 ? (
              <EmptyState title="无传感器" />
            ) : (
              telemetry.map((s) => (
                <div key={s.metric} className={styles.sensorRow}>
                  <span className={styles.sensorName}>
                    <StatusDot tone={sensorStatusTone(s.status)} />
                    {METRIC_META[s.metric].label}
                  </span>
                  <span className={styles.sensorMeta}>
                    {sensorStatusLabel(s.status)} · {formatTimeHM(s.lastSampleAt)}
                  </span>
                </div>
              ))
            )}
          </Panel>

          <Panel title="设备实时状态">
            {devices.length === 0 ? (
              <EmptyState title="无设备" />
            ) : (
              devices.map((d) => (
                <div key={d.id} className={styles.sensorRow}>
                  <span className={styles.sensorName}>
                    <StatusDot tone={deviceStatusTone(d.status)} />
                    {d.name}
                  </span>
                  <span className={styles.sensorMeta}>{deviceStatusLabel(d.status)}</span>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}