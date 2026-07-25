import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EnergyPoint } from '@/domain/energy';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface EnergyTrendChartProps {
  /** 今日 24h 曲线（演示派生）。 */
  today: EnergyPoint[];
  /** 昨日同期曲线（确定性偏移，演示）。 */
  yesterday: EnergyPoint[];
  height?: number;
}

/** 能耗趋势：今日（实线+面积）vs 昨日（虚线），24 小时。 */
export function EnergyTrendChart({ today, yesterday, height = 260 }: EnergyTrendChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);

    chart.setOption({
      animation: false,
      grid: { left: 44, right: 16, top: 34, bottom: 26 },
      legend: { top: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 3, textStyle: { fontSize: 11, color: '#536176' } },
      tooltip: { trigger: 'axis', valueFormatter: (value: number) => (typeof value === 'number' ? `${value.toFixed(1)} kWh` : value) },
      xAxis: {
        type: 'category',
        data: today.map((point) => `${String(point.hour).padStart(2, '0')}:00`),
        axisLabel: { fontSize: 11, color: '#8b97a8', interval: 3 },
        axisLine: { lineStyle: { color: '#e4e9ef' } },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        name: 'kWh',
        nameTextStyle: { fontSize: 11, color: '#8b97a8' },
        splitLine: { lineStyle: { color: '#eef1f5' } },
        axisLabel: { fontSize: 11, color: '#8b97a8' },
      },
      series: [
        {
          name: '今日',
          type: 'line',
          data: today.map((point) => point.kwh),
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 2, color: '#0fa978' },
          itemStyle: { color: '#0fa978' },
          areaStyle: { color: 'rgba(15, 169, 120, 0.12)' },
        },
        {
          name: '昨日',
          type: 'line',
          data: yesterday.map((point) => point.kwh),
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 1.6, type: 'dashed', color: '#8b97a8' },
          itemStyle: { color: '#8b97a8' },
        },
      ],
    });

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [today, yesterday]);

  return <div ref={ref} style={{ width: '100%', height }} role="img" aria-label="能耗趋势图" />;
}
