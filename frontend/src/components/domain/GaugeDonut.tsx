import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { GaugeChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([GaugeChart, CanvasRenderer]);

interface GaugeDonutProps {
  /** 0~100 的百分比。 */
  percent: number;
  /** 中心副标题（如“优秀”）。 */
  caption?: string;
  size?: number;
}

function colorFor(percent: number): string {
  if (percent >= 90) return '#0fa978';
  if (percent >= 70) return '#e7a13a';
  return '#ef4444';
}

/** 数据质量环形仪表：中心显示百分比与评级。 */
export function GaugeDonut({ percent, caption, size = 132 }: GaugeDonutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const clamped = Math.min(100, Math.max(0, percent));
    const color = colorFor(clamped);
    chart.setOption(
      {
        animation: false,
        series: [
          {
            type: 'gauge',
            startAngle: 90,
            endAngle: -270,
            min: 0,
            max: 100,
            radius: '100%',
            center: ['50%', '50%'],
            progress: {
              show: true,
              roundCap: true,
              width: 10,
              itemStyle: { color },
            },
            axisLine: {
              roundCap: true,
              lineStyle: { width: 10, color: [[1, '#eef2f5']] },
            },
            pointer: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            title: {
              show: Boolean(caption),
              offsetCenter: [0, '32%'],
              fontSize: 11,
              color: '#8b97a8',
            },
            detail: {
              valueAnimation: false,
              offsetCenter: [0, '-6%'],
              formatter: (value: number) => `{value|${Math.round(value)}}{unit|%}`,
              rich: {
                value: { fontSize: 26, fontWeight: 600, color, fontFamily: 'inherit' },
                unit: { fontSize: 13, color, padding: [0, 0, 0, 1] },
              },
            },
            data: [{ value: clamped, name: caption ?? '' }],
          },
        ],
      },
      { notMerge: true },
    );
  }, [percent, caption]);

  return (
    <div
      ref={ref}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`数据完整度 ${Math.round(percent)}%${caption ? `，${caption}` : ''}`}
    />
  );
}
