import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Plus } from 'lucide-react';
import type { MetricKey } from '@/domain/types';
import { useAppData } from '@/state/appData';
import { METRIC_META, METRIC_ORDER } from '@/domain/constants/metrics';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Tag } from '@/components/ui/Tag';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { OfflineState } from '@/components/ui/OfflineState';
import { IconButton } from '@/components/ui/IconButton';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { MonitoringChartPanel } from '@/features/monitoring/MonitoringChartPanel';
import { DataQualityPanel } from '@/features/monitoring/DataQualityPanel';
import { SensorStatePanel } from '@/features/monitoring/SensorStatePanel';
import { DeviceStatePanel } from '@/features/monitoring/DeviceStatePanel';
import { SensorHealthPanel } from '@/features/monitoring/SensorHealthPanel';
import { RoomEventsPanel } from '@/features/monitoring/RoomEventsPanel';
import { AlertTimelinePanel } from '@/features/monitoring/AlertTimelinePanel';
import { formatTimeHM } from '@/utils/formatTime';
import styles from '@/features/monitoring/monitoring.module.css';

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

const REFRESH_OPTIONS = [
  { value: '5000', label: '5s' },
  { value: '10000', label: '10s' },
  { value: '30000', label: '30s' },
];

type RangeKey = '1h' | '6h' | '12h' | '24h';

export default function MonitoringPage() {
  const { events, rooms, loading, error, roomId, setRoomId, online, lastUpdated, reload } = useAppData();
  const bundle = rooms[roomId];
  const room = bundle?.room;

  const [range, setRange] = useState<RangeKey>('1h');
  const [enabledMetrics, setEnabledMetrics] = useState<MetricKey[]>(['temperature', 'humidity', 'o2']);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('temperature');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshMs, setRefreshMs] = useState('5000');

  const telemetry = useMemo(() => bundle?.telemetry ?? [], [bundle]);
  const devices = bundle?.devices ?? [];
  const roomEvents = bundle?.roomEvents ?? [];

  const roomOptions = Object.values(rooms).map((b) => ({ value: b.room.id, label: b.room.name }));
  const collectedMetrics = useMemo(() => new Set(telemetry.map((s) => s.metric)), [telemetry]);

  // 切换库房后剔除新库房未采集的指标勾选（未采集 chip 保持禁用，不残留勾选态）。
  useEffect(() => {
    setEnabledMetrics((current) => {
      const pruned = current.filter((metric) => collectedMetrics.has(metric));
      if (pruned.length === current.length) return current;
      if (pruned.length > 0) return pruned;
      const fallback = METRIC_ORDER.find((metric) => collectedMetrics.has(metric));
      return fallback ? [fallback] : current;
    });
  }, [collectedMetrics]);

  // 实时刷新：按选定间隔轮询 ColdPilotClient（数据语义不变，仅触发 reload）。
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = Number.parseInt(refreshMs, 10);
    const timer = window.setInterval(() => {
      void reload();
    }, interval);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refreshMs, reload]);

  // 演示数据锚定在数据自身的最近采样时刻（而非真实当前时间）。
  const anchorMs = useMemo(() => {
    const stamps = telemetry.map((s) => Date.parse(s.lastSampleAt)).filter((t) => Number.isFinite(t));
    return stamps.length ? Math.max(...stamps) : Date.now();
  }, [telemetry]);
  const windowStartMs = anchorMs - RANGE_MS[range];

  const clippedTelemetry = useMemo(
    () =>
      telemetry.map((series) => ({
        ...series,
        points: series.points.filter((p) => Date.parse(p.t) >= windowStartMs),
      })),
    [telemetry, windowStartMs],
  );
  const clippedEvents = useMemo(
    () => roomEvents.filter((e) => Date.parse(e.at) >= windowStartMs),
    [roomEvents, windowStartMs],
  );

  const offlineCount = telemetry.filter((s) => s.status === 'offline').length;

  // 当前激活指标在新库房未采集时，回退到该库房首个已采集指标。
  const resolvedActiveMetric: MetricKey = collectedMetrics.has(activeMetric)
    ? activeMetric
    : (METRIC_ORDER.find((metric) => collectedMetrics.has(metric)) ?? 'temperature');

  const toggleMetric = (metric: MetricKey) => {
    setEnabledMetrics((current) => {
      const isOn = current.includes(metric);
      if (isOn && current.length === 1) return current; // 至少保留一个指标
      const next = isOn ? current.filter((m) => m !== metric) : [...current, metric];
      if (!next.includes(activeMetric)) {
        const fallback = METRIC_ORDER.find((m) => next.includes(m) && collectedMetrics.has(m));
        if (fallback) setActiveMetric(fallback);
      }
      return next;
    });
  };

  if (loading && !bundle) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonLoader lines={2} />
        <SkeletonLoader lines={4} />
        <SkeletonLoader lines={4} />
      </div>
    );
  }
  // 后端请求失败且无任何缓存数据：错误态 + 重试（区别于“无数据”）。
  if (error && !bundle) {
    return <ErrorState title="监控数据加载失败" description={error} onRetry={() => void reload()} />;
  }
  if (!room || !bundle) {
    return <EmptyState title="暂无监控数据" description="当前冷库没有实时数据。" />;
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="实时监控"
        description={`${room.name} · 多指标实时趋势 · 目标区间 · 事件标记`}
        actions={
          <>
            {loading && <Tag tone="neutral">更新中…</Tag>}
            <div className={styles.refreshGroup}>
              <span className={styles.filterLabel}>实时刷新</span>
              <Select ariaLabel="刷新间隔" options={REFRESH_OPTIONS} value={refreshMs} onChange={setRefreshMs} />
              <Switch checked={autoRefresh} onChange={setAutoRefresh} ariaLabel="实时刷新开关" />
            </div>
            <DemoDataBadge kind="demo" />
          </>
        }
      />

      {!online && <OfflineState lastUpdated={lastUpdated ? formatTimeHM(lastUpdated) : undefined} />}

      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>冷库选择</span>
          <Select ariaLabel="选择冷库" options={roomOptions} value={roomId} onChange={setRoomId} />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>时间范围</span>
          <Segmented
            options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={range}
            onChange={(v) => setRange(v as RangeKey)}
            ariaLabel="时间范围"
          />
          <IconButton aria-label="按日历选择（暂未接入）" disabled title="自定义时间范围暂未接入后端，暂不可用">
            <CalendarDays size={15} />
          </IconButton>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>指标选择</span>
          <div className={styles.metricChips}>
            {METRIC_ORDER.map((metric) => {
              const collected = collectedMetrics.has(metric);
              const enabled = enabledMetrics.includes(metric);
              return (
                <button
                  key={metric}
                  type="button"
                  className={`${styles.chip} ${enabled ? styles.chipOn : ''}`}
                  disabled={!collected}
                  title={collected ? undefined : '当前库房未采集该指标'}
                  aria-pressed={enabled}
                  onClick={() => toggleMetric(metric)}
                >
                  {enabled ? <Check size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
                  {METRIC_META[metric].label}
                </button>
              );
            })}
          </div>
        </div>
        {offlineCount > 0 && <Tag tone="warning">{offlineCount} 个传感器离线</Tag>}
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.leftStack}>
          <MonitoringChartPanel
            roomName={room.name}
            telemetry={clippedTelemetry}
            enabledMetrics={enabledMetrics}
            activeMetric={resolvedActiveMetric}
            onMetricChange={setActiveMetric}
            markers={clippedEvents}
            height={320}
          />
          <div className={styles.bottomPair}>
            <SensorHealthPanel telemetry={telemetry} />
            <RoomEventsPanel events={roomEvents} />
          </div>
        </div>
        <div className={styles.sideStack}>
          <DataQualityPanel telemetry={telemetry} />
          <SensorStatePanel telemetry={telemetry} />
          <DeviceStatePanel devices={devices} updatedAt={lastUpdated ? formatTimeHM(lastUpdated) : null} />
          <AlertTimelinePanel events={events} />
        </div>
      </div>
    </div>
  );
}
