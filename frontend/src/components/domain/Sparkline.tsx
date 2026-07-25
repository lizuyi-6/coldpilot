import type { SensorReading } from '@/domain/types';

interface SparklineProps {
  points: SensorReading[];
  width?: number;
  height?: number;
  stroke?: string;
  /** 最多采用的末尾点数（默认 24）。 */
  maxPoints?: number;
}

/** 迷你趋势线（无坐标轴），用于上下文卡片的“微型趋势”。 */
export function Sparkline({
  points,
  width = 72,
  height = 22,
  stroke = 'var(--color-accent)',
  maxPoints = 24,
}: SparklineProps) {
  const samples = points.slice(-maxPoints);
  if (samples.length < 2) {
    return <span style={{ display: 'inline-block', width, height }} aria-hidden />;
  }
  const values = samples.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const padding = 1.5;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const path = samples
    .map((point, index) => {
      const x = padding + (index / (samples.length - 1)) * innerWidth;
      const y = padding + (1 - (point.value - min) / span) * innerHeight;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastX = padding + innerWidth;
  const lastY = padding + (1 - (values[values.length - 1] - min) / span) * innerHeight;
  return (
    <svg width={width} height={height} role="img" aria-label="近期趋势" style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={stroke} />
    </svg>
  );
}
