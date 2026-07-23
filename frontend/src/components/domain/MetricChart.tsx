import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { RoomEventMarker, SensorReading, TargetRange } from '@/domain/types';

echarts.use([LineChart, GridComponent, TooltipComponent, MarkAreaComponent, MarkLineComponent, DataZoomComponent, CanvasRenderer]);

export interface MetricChartProps {
  /** 实测序列。 */
  series: SensorReading[];
  unit: string;
  target?: TargetRange;
  /** 库房事件标记（库门/入库/启停）。 */
  markers?: RoomEventMarker[];
  /** 预测/执行序列（虚线叠加）。 */
  predictedSeries?: SensorReading[];
  height?: number;
}

function toPairs(points: SensorReading[]): [number, number][] {
  return points.map((p) => [Date.parse(p.t), p.value]);
}

/** 趋势图：实测线 + 目标带 + 事件标记 + 可选预测线。直接融入内容区，无卡片包裹。 */
export function MetricChart({ series, unit, target, markers = [], predictedSeries, height = 240 }: MetricChartProps) {
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

    const markAreaData = target
      ? [[{ yAxis: target.min, itemStyle: { color: 'rgba(15,118,110,0.07)' } }, { yAxis: target.max }]]
      : undefined;

    const markLineData = markers.map((m) => ({
      xAxis: Date.parse(m.at),
      label: {
        formatter: m.label,
        fontSize: 10,
        color: '#52606d',
        position: 'insideEndTop' as const,
      },
      lineStyle: { color: '#9aa5b1', type: 'dashed' as const, width: 1 },
    }));

    const actualSeries: Record<string, unknown> = {
      name: '实测',
      type: 'line',
      data: toPairs(series),
      showSymbol: false,
      smooth: true,
      lineStyle: { color: '#0f766e', width: 2 },
      itemStyle: { color: '#0f766e' },
      markArea: markAreaData ? { silent: true, data: markAreaData } : undefined,
      markLine: markLineData.length
        ? { silent: true, symbol: 'none', data: markLineData, animation: false }
        : undefined,
    };

    const predicted = predictedSeries
      ? {
          name: '仿真预测',
          type: 'line',
          data: toPairs(predictedSeries),
          showSymbol: false,
          smooth: true,
          lineStyle: { color: '#2f6fdb', width: 2, type: 'dashed' as const },
          itemStyle: { color: '#2f6fdb' },
        }
      : null;

    chart.setOption(
      {
        animation: false,
        grid: { left: 44, right: 16, top: 24, bottom: 28 },
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v: unknown) => `${v} ${unit}`,
          textStyle: { fontSize: 12 },
        },
        xAxis: {
          type: 'time',
          axisLine: { lineStyle: { color: '#cbd2d9' } },
          axisLabel: { color: '#52606d', fontSize: 11, hideOverlap: true },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          scale: true,
          name: unit,
          nameTextStyle: { color: '#9aa5b1', fontSize: 11 },
          axisLabel: { color: '#52606d', fontSize: 11 },
          splitLine: { lineStyle: { color: '#f0f2f4' } },
        },
        series: predicted ? [actualSeries, predicted] : [actualSeries],
      },
      { notMerge: true },
    );
  }, [series, unit, target, markers, predictedSeries]);

  return <div ref={ref} style={{ width: '100%', height }} role="img" aria-label="趋势图" />;
}