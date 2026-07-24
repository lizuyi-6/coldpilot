import type { Device, InventoryBatch } from '@/domain/types';
import styles from './ColdRoomDiagram.module.css';

interface ColdRoomDiagramProps {
  devices: Device[];
  inventory: InventoryBatch[];
  /** 是否有越界异常（决定异常高亮位置）。 */
  anomaly?: boolean;
  /** 冷库名。 */
  name?: string;
}

/* 2:1 等距投影参数：+x 右下、+y 左下、+z 上。 */
const SX = 23;
const SY = 13.3;
const SZ = 24;
const OX = 210;
const OY = 104;
const ROOM_W = 6;
const ROOM_D = 4;
const ROOM_H = 3;

function pt(x: number, y: number, z = 0): { cx: number; cy: number } {
  return { cx: OX + SX * (x - y), cy: OY + SY * (x + y) - SZ * z };
}
function poly(points: { cx: number; cy: number }[]): string {
  return points.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
}

/** 品类 → 货物配色（克制）。 */
const CATEGORY_HUES = [
  { top: '#dd8a80', left: '#c96a5f', right: '#b3564c' },   // 红（辣椒）
  { top: '#93bd8a', left: '#7aa874', right: '#648f5f' },   // 绿
  { top: '#e3c06f', left: '#d3ab54', right: '#bd9440' },   // 黄（芒果）
  { top: '#a68fc4', left: '#8f76b0', right: '#7a639b' },   // 紫（葡萄）
  { top: '#8fb3d9', left: '#769cc6', right: '#6187b0' },   // 蓝
  { top: '#d9a06f', left: '#c68a54', right: '#b07740' },   // 橙
];

interface IsoBoxProps {
  x: number; y: number; w: number; d: number; h: number;
  hue: { top: string; left: string; right: string };
  stroke?: string;
}

/** 等距立方体（顶/左/右三面）。 */
function IsoBox({ x, y, w, d, h, hue, stroke = 'rgba(23,32,51,0.14)' }: IsoBoxProps) {
  const t1 = pt(x, y, h); const t2 = pt(x + w, y, h);
  const t3 = pt(x + w, y + d, h); const t4 = pt(x, y + d, h);
  const b2 = pt(x + w, y, 0); const b3 = pt(x + w, y + d, 0); const b4 = pt(x, y + d, 0);
  return (
    <g>
      <polygon points={poly([t4, t3, b3, b4])} fill={hue.left} stroke={stroke} strokeWidth={0.6} />
      <polygon points={poly([t2, t3, b3, b2])} fill={hue.right} stroke={stroke} strokeWidth={0.6} />
      <polygon points={poly([t1, t2, t3, t4])} fill={hue.top} stroke={stroke} strokeWidth={0.6} />
    </g>
  );
}

const WOOD = { top: '#c9b596', left: '#b09c7c', right: '#9a8768' };
const METAL = { top: '#ccd5dd', left: '#b3bec9', right: '#9daab7' };

/** 库顶冷风机（墙面椭圆 + 叶片）。 */
function FanUnit({ y, running }: { y: number; running: boolean }) {
  const c = pt(0, y, 1.95);
  return (
    <g className={running ? styles.fanRunning : undefined}>
      <line x1={c.cx} y1={c.cy - 13} x2={c.cx} y2={c.cy - 21} className={styles.fanPipe} />
      <ellipse cx={c.cx} cy={c.cy} rx={14.5} ry={12.5} className={styles.fanBody} />
      <ellipse cx={c.cx} cy={c.cy} rx={10.5} ry={9} className={styles.fanInner} />
      <g className={styles.fanBlades} style={{ transformOrigin: `${c.cx}px ${c.cy}px` }}>
        {[0, 120, 240].map((deg) => (
          <line
            key={deg}
            x1={c.cx}
            y1={c.cy}
            x2={c.cx + 8}
            y2={c.cy + 3}
            transform={`rotate(${deg} ${c.cx} ${c.cy})`}
            className={styles.fanBlade}
          />
        ))}
      </g>
      <circle cx={c.cx} cy={c.cy} r={2.4} className={styles.fanHub} />
    </g>
  );
}

/**
 * 等距冷库示意图：库体、冷风机、库门、货物托盘（按品类配色）、设备与异常位置。
 * 纯本地 SVG，自适应容器宽度。
 */
export function ColdRoomDiagram({ devices, inventory, anomaly = false, name }: ColdRoomDiagramProps) {
  const fan = devices.find((d) => d.kind === 'fan');
  const door = devices.find((d) => d.kind === 'door');
  const compressor = devices.find((d) => d.kind === 'compressor');
  const doorClosed = !door || door.status === 'idle';

  /* 托盘：按品类批次铺开，最多 6 组。 */
  const palletSlots: { x: number; y: number }[] = [
    { x: 0.7, y: 0.7 }, { x: 2.6, y: 0.7 }, { x: 4.5, y: 0.9 },
    { x: 0.7, y: 2.3 }, { x: 2.6, y: 2.3 }, { x: 4.5, y: 2.4 },
  ];
  const pallets = palletSlots.map((slot, i) => {
    const batch = inventory.length > 0 ? inventory[i % inventory.length] : undefined;
    return { ...slot, hue: CATEGORY_HUES[i % CATEGORY_HUES.length], batch };
  });

  const wallLeft = [pt(0, 0, 0), pt(0, ROOM_D, 0), pt(0, ROOM_D, ROOM_H), pt(0, 0, ROOM_H)];
  const wallRight = [pt(0, 0, 0), pt(ROOM_W, 0, 0), pt(ROOM_W, 0, ROOM_H), pt(0, 0, ROOM_H)];
  const floor = [pt(0, 0, 0), pt(ROOM_W, 0, 0), pt(ROOM_W, ROOM_D, 0), pt(0, ROOM_D, 0)];

  /* 库门（右墙 y=0 平面）。 */
  const doorPts = [pt(3.7, 0, 0), pt(5.1, 0, 0), pt(5.1, 0, 2.1), pt(3.7, 0, 2.1)];
  const doorInner = [pt(3.82, 0, 0.12), pt(4.98, 0, 0.12), pt(4.98, 0, 2.0), pt(3.82, 0, 2.0)];

  /* 异常位置（库中心偏门侧）。 */
  const ac = pt(3.1, 1.7, 0);

  return (
    <div className={styles.wrap} role="img" aria-label={name ? `${name} 冷库示意` : '冷库示意'}>
      <svg viewBox="92 18 296 234" className={styles.svg}>
        {/* 墙体 */}
        <polygon points={poly(wallLeft)} className={styles.wallLeft} />
        <polygon points={poly(wallRight)} className={styles.wallRight} />
        {/* 墙面保温板缝 */}
        {[1, 2, 3].map((i) => (
          <line key={`wl${i}`} x1={pt(0, i, 0).cx} y1={pt(0, i, 0).cy} x2={pt(0, i, ROOM_H).cx} y2={pt(0, i, ROOM_H).cy} className={styles.wallSeam} />
        ))}
        {[1.5, 3, 4.5].map((i) => (
          <line key={`wr${i}`} x1={pt(i, 0, 0).cx} y1={pt(i, 0, 0).cy} x2={pt(i, 0, ROOM_H).cx} y2={pt(i, 0, ROOM_H).cy} className={styles.wallSeam} />
        ))}
        {/* 地板 */}
        <polygon points={poly(floor)} className={styles.floor} />
        {[1, 2, 3, 4, 5].map((i) => (
          <line key={`fx${i}`} x1={pt(i, 0, 0).cx} y1={pt(i, 0, 0).cy} x2={pt(i, ROOM_D, 0).cx} y2={pt(i, ROOM_D, 0).cy} className={styles.floorGrid} />
        ))}
        {[1, 2, 3].map((j) => (
          <line key={`fy${j}`} x1={pt(0, j, 0).cx} y1={pt(0, j, 0).cy} x2={pt(ROOM_W, j, 0).cx} y2={pt(ROOM_W, j, 0).cy} className={styles.floorGrid} />
        ))}

        {/* 库门 + 门前坡道 */}
        <polygon points={poly([pt(3.6, 0, 0), pt(5.2, 0, 0), pt(5.2, 0.55, 0), pt(3.6, 0.55, 0)])} className={styles.doorRamp} />
        <polygon points={poly(doorPts)} className={doorClosed ? styles.doorClosed : styles.doorOpen} />
        <polygon points={poly(doorInner)} className={styles.doorInner} />
        <line x1={pt(4.35, 0, 0.1).cx} y1={pt(4.35, 0, 0.1).cy} x2={pt(4.35, 0, 2.02).cx} y2={pt(4.35, 0, 2.02).cy} className={styles.doorSeam} />

        {/* 冷风机（左墙高位） */}
        {[0.9, 2.0, 3.1].map((y) => (
          <FanUnit key={y} y={y} running={fan?.status === 'running'} />
        ))}

        {/* 货物托盘 */}
        {pallets.map((p, i) => (
          <g key={i}>
            <IsoBox x={p.x} y={p.y} w={1.45} d={1.15} h={0.14} hue={WOOD} />
            <IsoBox x={p.x + 0.08} y={p.y + 0.08} w={1.29} d={0.99} h={0.62} hue={p.hue} />
            <IsoBox x={p.x + 0.14} y={p.y + 0.14} w={1.17} d={0.87} h={1.08} hue={p.hue} />
          </g>
        ))}

        {/* 压缩机（库内右前角机组） */}
        {compressor && (
          <g>
            <IsoBox x={5.35} y={2.7} w={0.6} d={0.75} h={0.95} hue={METAL} />
            {[0.3, 0.5, 0.7].map((z) => (
              <line key={z} x1={pt(5.35, 3.42, z).cx} y1={pt(5.35, 3.42, z).cy} x2={pt(5.95, 3.42, z).cx} y2={pt(5.95, 3.42, z).cy} className={styles.grille} />
            ))}
          </g>
        )}

        {/* 传感点（墙面） */}
        {[1.2, 4.8].map((x) => (
          <circle key={x} cx={pt(x, 0, 2.2).cx} cy={pt(x, 0, 2.2).cy} r={2.2} className={styles.sensorDot} />
        ))}

        {/* 异常位置 */}
        {anomaly && (
          <g>
            <ellipse cx={ac.cx} cy={ac.cy} rx={46} ry={22} className={styles.anomalyRing} />
            <ellipse cx={ac.cx} cy={ac.cy} rx={46} ry={22} className={styles.anomalyPulse} />
            <g className={styles.anomalyTag}>
              <rect x={ac.cx - 27} y={ac.cy - 52} width={54} height={20} rx={10} className={styles.anomalyBadge} />
              <text x={ac.cx} y={ac.cy - 38.5} textAnchor="middle" className={styles.anomalyText}>温度异常</text>
              <line x1={ac.cx} y1={ac.cy - 32} x2={ac.cx} y2={ac.cy - 20} className={styles.anomalyLine} />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}