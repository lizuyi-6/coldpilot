import type { RoomEventMarker } from '@/domain/types';
import { DoorClosed, DoorOpen, Download, Power, PowerOff } from 'lucide-react';
import { formatTimeHM } from '@/utils/formatTime';
import { Tooltip } from '@/components/ui/Tooltip';
import styles from './EventTimeline.module.css';

const KIND_META: Record<RoomEventMarker['kind'], { label: string; Icon: typeof DoorOpen; cls: string }> = {
  door_open: { label: '库门开启', Icon: DoorOpen, cls: 'warn' },
  door_close: { label: '库门关闭', Icon: DoorClosed, cls: 'ok' },
  inbound: { label: '入库', Icon: Download, cls: 'info' },
  compressor_start: { label: '压缩机启动', Icon: Power, cls: 'accent' },
  compressor_stop: { label: '压缩机停机', Icon: PowerOff, cls: 'muted' },
};

interface EventTimelineProps {
  events: RoomEventMarker[];
  /** 时间轴窗口 [startMs, endMs]。 */
  windowMs: [number, number];
}

/**
 * 事件带：沿时间轴分布的事件图标（不全部堆在右侧）。
 * 图标位置按时间比例水平分布，Tooltip 显示详情。
 */
export function EventTimeline({ events, windowMs }: EventTimelineProps) {
  const [start, end] = windowMs;
  const span = end - start || 1;
  return (
    <div className={styles.track} role="img" aria-label="事件时间轴">
      {events.map((e) => {
        const ms = Date.parse(e.at);
        const pct = Math.min(100, Math.max(0, ((ms - start) / span) * 100));
        const meta = KIND_META[e.kind];
        const Icon = meta.Icon;
        return (
          <div key={e.id} className={styles.marker} style={{ left: `${pct}%` }}>
            <Tooltip content={`${meta.label} · ${formatTimeHM(e.at)}${e.detail ? ' · ' + e.detail : ''}`}>
              <span className={`${styles.icon} ${styles[meta.cls]}`}>
                <Icon size={13} />
              </span>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}