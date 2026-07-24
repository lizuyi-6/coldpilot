import type { Device, InventoryBatch } from '@/domain/types';
import styles from './ColdRoomDiagram.module.css';

interface ColdRoomDiagramProps {
  devices: Device[];
  inventory: InventoryBatch[];
  /** 是否有越界异常（决定异常高亮）。 */
  anomaly?: boolean;
  /** 冷库名。 */
  name?: string;
}

/**
 * 简洁冷库示意（SVG）：库体、库存堆垛、关键设备位置、异常高亮。
 * 不用整图切片，纯矢量。
 */
export function ColdRoomDiagram({ devices, inventory, anomaly = false, name }: ColdRoomDiagramProps) {
  const compressor = devices.find((d) => d.kind === 'compressor');
  const fan = devices.find((d) => d.kind === 'fan');
  const door = devices.find((d) => d.kind === 'door');
  const stackCount = Math.min(6, inventory.length * 2);

  return (
    <div className={styles.wrap} role="img" aria-label={name ? `${name} 冷库示意` : '冷库示意'}>
      <svg viewBox="0 0 320 200" className={styles.svg}>
        {/* 库体 */}
        <rect x="10" y="20" width="300" height="160" rx="6" className={styles.roomBody} />
        {/* 地面网格 */}
        {[60, 100, 140].map((y) => (
          <line key={y} x1="14" y1={y} x2="306" y2={y} className={styles.gridLine} />
        ))}
        {/* 库门 */}
        <rect x="286" y="70" width="18" height="60" rx="2" className={door?.status === 'idle' ? styles.doorClosed : styles.doorOpen} />
        {/* 库存堆垛 */}
        {Array.from({ length: stackCount }).map((_, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          return (
            <rect
              key={i}
              x={40 + col * 50}
              y={130 - row * 42}
              width="40"
              height="34"
              rx="3"
              className={styles.stack}
            />
          );
        })}
        {/* 风机（库顶） */}
        {fan && (
          <g className={styles.deviceGroup}>
            <circle cx="160" cy="42" r="14" className={styles.fan} />
            <path d="M160 30 L160 54 M148 42 L172 42" className={styles.fanBlade} />
          </g>
        )}
        {/* 压缩机（库底角） */}
        {compressor && (
          <rect x="20" y="150" width="26" height="24" rx="3" className={styles.compressor} />
        )}
        {/* 异常位置高亮（脉冲圈） */}
        {anomaly && <circle cx="160" cy="90" r="30" className={styles.anomaly} />}
      </svg>
      <div className={styles.legend}>
        {compressor && <span className={styles.legendItem}><i className={styles.swComp} />压缩机</span>}
        {fan && <span className={styles.legendItem}><i className={styles.swFan} />风机</span>}
        {door && <span className={styles.legendItem}><i className={styles.swDoor} />库门</span>}
        <span className={styles.legendItem}><i className={styles.swStack} />库存</span>
      </div>
    </div>
  );
}