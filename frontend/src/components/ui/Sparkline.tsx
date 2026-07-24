import { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  band?: [number, number];
}

export function Sparkline({ data, width = 96, height = 28, stroke = 'var(--color-accent)', band }: SparklineProps) {
  const { path, bandRect } = useMemo(() => {
    if (data.length < 2) return { path: '', bandRect: null as null | { y: number; h: number } };
    const min = Math.min(...data, band?.[0] ?? Infinity);
    const max = Math.max(...data, band?.[1] ?? -Infinity);
    const span = max - min || 1;
    const px = width / (data.length - 1);
    const toY = (v: number) => height - ((v - min) / span) * (height - 4) - 2;
    let d = '';
    data.forEach((v, i) => {
      const x = i * px;
      const y = toY(v);
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    const br = band ? { y: toY(band[1]), h: Math.abs(toY(band[0]) - toY(band[1])) } : null;
    return { path: d, bandRect: br };
  }, [data, width, height, band]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {bandRect && (
        <rect x={0} y={bandRect.y} width={width} height={bandRect.h} fill="var(--color-accent-subtle)" opacity={0.5} />
      )}
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}