import type { SensorSeries } from '@/domain/types';
import { Activity, WifiOff, Wrench } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { sensorHealthRows } from './monitoringView';
import styles from './monitoring.module.css';

interface SensorStatePanelProps {
  telemetry: SensorSeries[];
}

/** 传感器状态：在线 / 异常（漂移·延迟）/ 离线 三类计数（由 telemetry.status 聚合）。 */
export function SensorStatePanel({ telemetry }: SensorStatePanelProps) {
  if (telemetry.length === 0) {
    return (
      <Panel title="传感器状态">
        <EmptyState title="暂无数据" description="当前冷库没有传感器通道。" />
      </Panel>
    );
  }
  const rows = sensorHealthRows(telemetry);
  const total = rows.length || 1;
  const online = rows.filter((r) => r.status === 'online').length;
  const offline = rows.filter((r) => r.status === 'offline').length;
  const degraded = rows.length - online - offline;

  const items = [
    {
      key: 'online',
      name: '在线传感器',
      count: online,
      color: 'var(--color-accent)',
      bg: 'var(--color-accent-subtle)',
      Icon: Activity,
    },
    {
      key: 'degraded',
      name: '异常传感器',
      count: degraded,
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-subtle)',
      Icon: Wrench,
    },
    {
      key: 'offline',
      name: '离线传感器',
      count: offline,
      color: 'var(--color-danger)',
      bg: 'var(--color-danger-subtle)',
      Icon: WifiOff,
    },
  ];

  return (
    <Panel title="传感器状态">
      {items.map(({ key, name, count, color, bg, Icon }) => (
        <div key={key} className={styles.sensorCountRow}>
          <span className={styles.sensorCountIcon} style={{ color, background: bg }}>
            <Icon size={17} aria-hidden />
          </span>
          <span className={styles.sensorCountText}>
            <span className={styles.sensorCountName}>{name}</span>
            <span className={styles.sensorCountValue}>
              {count}
              <small>/ {rows.length}</small>
            </span>
          </span>
          <span className={styles.sensorCountPct}>{Math.round((count / total) * 100)}%</span>
        </div>
      ))}
    </Panel>
  );
}
