import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { SensorReading, TargetRange } from '@/domain/types';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, CanvasRenderer]);

export interface PredictionSeries {
  /** 序列名（图例），如「方案 A 预测」。 */
  name: string;
  points: SensorReading[];
  color: string;
}

interface PredictionChartProps {
  /** 实测温度序列（实线）。 */
  actual: SensorReading[];
  /** 各方案预测序列（虚线）。 */
  predictions: PredictionSeries[];
  target?: TargetRange;
  unit: string;
  height?: number;
}

function toPairs(points: SensorReading[]): [number, number][] {
  return points.map((p) => [Date.parse(p.t), p.value]);
}

/** 时间轴统一按 UTC 渲染（与全局时间规范一致）。 */
function utcHM(ms: number): string {
  const date = new Date(ms);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * 温度预测对比：实测线 + 多方案预测虚线 + 目标区间带 + 预测起点标线。
 * 预测值恒为仿真结果（调用方负责在面板标注 provenance）。
 */
export function PredictionChart({ actual, predictions, target, unit, height = 300 }: PredictionChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);

    const predictionStartMs = predictions.length > 0 && predictions[0].points.length > 0 ? Date.parse(predictions[0].points[0].t) : null;

    chart.setOption({
      animation: false,
      grid: { left: 44, right: 16, top: 34, bottom: 28 },
      legend: {
        top: 0,
        icon: 'roundRect',
        itemWidth: 14,
        itemHeight: 3,
        textStyle: { fontSize: 11, color: '#536176' },
      },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: number) => (typeof value === 'number' ? `${value.toFixed(1)} ${unit}` : value),
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          fontSize: 11,
          color: '#8b97a8',
          formatter: (value: number) => utcHM(value),
        },
        axisLine: { lineStyle: { color: '#e4e9ef' } },
      },
      yAxis: {
        type: 'value',
        name: unit,
        nameTextStyle: { fontSize: 11, color: '#8b97a8' },
        scale: true,
        splitLine: { lineStyle: { color: '#eef1f5' } },
        axisLabel: { fontSize: 11, color: '#8b97a8' },
      },
      series: [
        {
          name: '实测温度',
          type: 'line',
          data: toPairs(actual),
          showSymbol: false,
          lineStyle: { width: 2, color: '#172033' },
          itemStyle: { color: '#172033' },
          markArea: target
            ? {
                silent: true,
                itemStyle: { color: 'rgba(15, 169, 120, 0.08)' },
                data: [[{ yAxis: target.min }, { yAxis: target.max }]],
              }
            : undefined,
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              ...(target
                ? [
                    { yAxis: target.max, lineStyle: { type: 'dashed' as const, color: 'rgba(15,169,120,0.45)' }, label: { show: false } },
                    { yAxis: target.min, lineStyle: { type: 'dashed' as const, color: 'rgba(15,169,120,0.45)' }, label: { show: false } },
                  ]
                : []),
              ...(predictionStartMs !== null
                ? [
                    {
                      xAxis: predictionStartMs,
                      lineStyle: { type: 'solid' as const, color: '#8b97a8', width: 1 },
                      label: { show: true, formatter: '预测起点', fontSize: 10, color: '#8b97a8' },
                    },
                  ]
                : []),
            ],
          },
        },
        ...predictions.map((prediction) => ({
          name: prediction.name,
          type: 'line' as const,
          data: toPairs(prediction.points),
          showSymbol: false,
          lineStyle: { width: 2, type: 'dashed' as const, color: prediction.color },
          itemStyle: { color: prediction.color },
        })),
      ],
    });

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [actual, predictions, target, unit]);

  return <div ref={ref} style={{ width: '100%', height }} role="img" aria-label="温度预测对比图" />;
}
