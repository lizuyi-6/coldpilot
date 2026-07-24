import { Link } from 'react-router-dom';
import { Cog, DoorClosed, Fan, PlugZap, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import type { ColdRoom, Device, DeviceKind, InventoryBatch, SensorSeries } from '@/domain/types';
import { DEW_POINT_META, METRIC_META, METRIC_ORDER, RECOMMENDED_BANDS } from '@/domain/constants/metrics';
import {
  dewPointC,
  deviceStatusLabel,
  latestValue,
  metricSeries,
  metricTone,
  recentValues,
  sensorStatusLabel,
  sensorStatusTone,
} from '@/domain/viewModels';
import { Panel } from '@/components/ui/Panel';
import { Tag } from '@/components/ui/Tag';
import { StatusDot } from '@/components/ui/StatusDot';
import { Sparkline } from '@/components/ui/Sparkline';
import { ColdRoomDiagram } from '@/components/domain/ColdRoomDiagram';
import { formatNumber } from '@/utils/formatNumber';
import styles from './commandCenter.module.css';

const DEVICE_ICON: Record<DeviceKind, LucideIcon> = {
  compressor: Cog,
  fan: Fan,
  door: DoorClosed,
  valve: SlidersHorizontal,
  meter: PlugZap,
};
const DEVICE_ORDER: DeviceKind[] = ['compressor', 'fan', 'door', 'valve', 'meter'];

interface ColdRoomOverviewPanelProps {
  room: ColdRoom;
  telemetry: SensorSeries[];
  devices: Device[];
  inventory: InventoryBatch[];
  overall: { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' };
}

interface MetricCell {
  key: string;
  label: string;
  Icon: LucideIcon;
  valueText: string;
  unit: string;
  band: string;
  tone: 'ok' | 'warn' | 'danger' | 'muted';
  statusText: string;
  trend: number[];
  bandRange?: [number, number];
}

/** 第一行左侧组合面板：冷库示意 + 环境监测 3×2 + 设备状态条。 */
export function ColdRoomOverviewPanel({ room, telemetry, devices, inventory, overall }: ColdRoomOverviewPanelProps) {
  const tempSeries = metricSeries(telemetry, 'temperature');
  const humiditySeries = metricSeries(telemetry, 'humidity');
  const anomaly = metricTone(tempSeries, room.targetRange) === 'danger';

  const tempNow = latestValue(tempSeries);
  const humidityNow = latestValue(humiditySeries);
  const dewPoint = tempNow !== null && humidityNow !== null ? dewPointC(tempNow, humidityNow) : null;

  const metricCells: MetricCell[] = METRIC_ORDER.map((metric) => {
    const series = metricSeries(telemetry, metric);
    const meta = METRIC_META[metric];
    const value = latestValue(series);
    const digits = metric === 'pressureDiff' ? 0 : 1;
    const target = metric === 'temperature' ? room.targetRange : undefined;
    const tone = metric === 'temperature' ? metricTone(series, target) : series ? sensorStatusTone(series.status) : 'muted';
    return {
      key: metric,
      label: meta.label,
      Icon: meta.Icon,
      valueText: value !== null ? formatNumber(value, digits) : '—',
      unit: meta.shortUnit,
      band: target ? `目标 ${target.min} ~ ${target.max} ${target.unit}` : RECOMMENDED_BANDS[metric],
      tone,
      statusText: series ? sensorStatusLabel(series.status) : '无数据',
      trend: recentValues(series, 14),
      bandRange: target ? ([target.min, target.max] as [number, number]) : undefined,
    };
  });
  metricCells.push({
    key: 'dewPoint',
    label: DEW_POINT_META.label,
    Icon: DEW_POINT_META.Icon,
    valueText: dewPoint !== null ? formatNumber(dewPoint, 1) : '—',
    unit: DEW_POINT_META.shortUnit,
    band: RECOMMENDED_BANDS.dewPoint,
    tone: 'ok',
    statusText: dewPoint !== null ? '推算' : '无数据',
    trend: [],
    bandRange: undefined,
  });

  const orderedDevices = DEVICE_ORDER.map((kind) => devices.find((d) => d.kind === kind)).filter(
    (d): d is Device => Boolean(d),
  );

  return (
    <Panel
      title="冷库概览"
      className={styles.panelFill}
      action={
        <span className={styles.panelActions}>
          <Tag tone={overall.tone === 'danger' ? 'danger' : overall.tone === 'warn' ? 'warning' : 'success'}>
            {overall.label}
          </Tag>
          <Link to="/monitoring" className={styles.moreLink}>查看全部 ›</Link>
        </span>
      }
    >
      <div className={styles.overviewBody}>
        <div className={styles.overviewTop}>
          <div className={styles.diagramCol}>
            <ColdRoomDiagram devices={devices} inventory={inventory} anomaly={anomaly} name={room.name} />
          </div>
          <div className={styles.metricCol}>
            <div className={styles.metricSectionTitle}>环境监测</div>
            <div className={styles.metricGrid}>
              {metricCells.map((cell) => (
                <div key={cell.key} className={styles.metricCell}>
                  <div className={styles.metricHead}>
                    <cell.Icon size={13} className={styles.metricIcon} />
                    <span className={styles.metricLabel}>{cell.label}</span>
                    <span className={styles.metricStatus}>
                      <StatusDot tone={cell.tone} />
                      {cell.statusText}
                    </span>
                  </div>
                  <div className={styles.metricValueRow}>
                    <span className={`${styles.metricValue} numeric`}>{cell.valueText}</span>
                    <span className={styles.metricUnit}>{cell.unit}</span>
                  </div>
                  <div className={styles.metricBand}>{cell.band}</div>
                  {cell.trend.length > 1 && (
                    <div className={styles.metricTrend}>
                      <Sparkline data={cell.trend} width={120} height={22} band={cell.bandRange} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.deviceStrip}>
          <div className={styles.metricSectionTitle}>设备状态</div>
          <div className={styles.deviceRow}>
            {orderedDevices.map((device) => {
              const Icon = DEVICE_ICON[device.kind];
              const running = device.status === 'running';
              const faulty = device.status === 'fault' || device.status === 'offline';
              return (
                  <div key={device.id} className={styles.deviceItem}>
                  <span className={`${styles.deviceIcon} ${running ? styles.deviceIconOn : ''}`}>
                    <Icon size={16} />
                  </span>
                  <span className={styles.deviceText}>
                    <span className={styles.deviceName}>{device.name}</span>
                    <span className={`${styles.deviceStatus} ${faulty ? styles.deviceStatusBad : running ? styles.deviceStatusOn : ''}`}>
                      {deviceStatusLabel(device.status)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}