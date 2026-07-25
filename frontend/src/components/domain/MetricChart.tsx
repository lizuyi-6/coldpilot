import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, ScatterChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { RoomEventMarker, SensorReading, TargetRange } from '@/domain/types';

echarts.use([
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

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
  /** 是否显示底部缩略刷（dataZoom slider）与内置缩放。 */
  showZoom?: boolean;
}

function toPairs(points: SensorReading[]): [number, number][] {
  return points.map((p) => [Date.parse(p.t), p.value]);
}

/** 事件类别 → 颜色 / 图形（与图例、事件时间线一致）。 */
const MARKER_META: Record<RoomEventMarker['kind'], { color: string; symbol: string }> = {
  door_open: { color: '#e7a13a', symbol: 'triangle' },
  door_close: { color: '#0fa978', symbol: 'diamond' },
  inbound: { color: '#3478f6', symbol: 'rect' },
  compressor_start: { color: '#0fa978', symbol: 'circle' },
  compressor_stop: { color: '#8b97a8', symbol: 'circle' },
};

/** 序列中最接近时刻 t 的值（事件符号贴合曲线）。 */
function nearestValue(points: SensorReading[], tMs: number): number | null {
  if (points.length === 0) return null;
  let closest = points[0];
  for (const point of points) {
    if (Math.abs(Date.parse(point.t) - tMs) < Math.abs(Date.parse(closest.t) - tMs)) closest = point;
  }
  return closest.value;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 时间轴统一按 UTC 渲染（与全局时间规范一致）。 */
function utcHM(ms: number): string {
  const date = new Date(ms);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function utcAxisLabel(ms: number, spanMs: number): string {
  if (spanMs > 36 * 3_600_000) {
    const date = new Date(ms);
    return `${date.getUTCMonth() + 1}-${String(date.getUTCDate()).padStart(2, '0')} ${utcHM(ms)}`;
  }
  return utcHM(ms);
}

/** 趋势图：实测线 + 当前采样点 + 目标带 + 事件符号标记 + 可选预测线 + 可选缩略刷。 */
export function MetricChart({ series, unit, target, markers = [], predictedSeries, height = 240, showZoom = false }: MetricChartProps) {
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
      ? [[{ yAxis: target.min, itemStyle: { color: 'rgba(15,169,120,0.06)' } }, { yAxis: target.max }]]
      : undefined;

    // 目标区间上下限虚线。
    const targetMarkLines = target
      ? [target.min, target.max].map((y) => ({
          yAxis: y,
          label: { show: false },
          lineStyle: { color: 'rgba(15,169,120,0.45)', type: 'dashed' as const, width: 1 },
        }))
      : [];

    const lastPoint = series.length > 0 ? series[series.length - 1] : null;

    const actualSeries: Record<string, unknown> = {
      name: '实测',
      type: 'line',
      data: toPairs(series),
      showSymbol: false,
      smooth: true,
      lineStyle: { color: '#0fa978', width: 2 },
      itemStyle: { color: '#0fa978' },
      areaStyle: { color: 'rgba(15,169,120,0.05)' },
      markArea: markAreaData ? { silent: true, data: markAreaData } : undefined,
      markLine: targetMarkLines.length
        ? { silent: true, symbol: 'none', data: targetMarkLines, animation: false }
        : undefined,
      markPoint: lastPoint
        ? {
            silent: true,
            symbol: 'circle',
            symbolSize: 9,
            itemStyle: { color: '#0fa978', borderColor: '#ffffff', borderWidth: 2 },
            label: { show: false },
            data: [{ coord: [Date.parse(lastPoint.t), lastPoint.value] }],
          }
        : undefined,
    };

    const predicted = predictedSeries
      ? {
          name: '仿真预测',
          type: 'line',
          data: toPairs(predictedSeries),
          showSymbol: false,
          smooth: true,
          lineStyle: { color: '#3478f6', width: 2, type: 'dashed' as const },
          itemStyle: { color: '#3478f6' },
        }
      : null;

    // 事件符号：不直接堆叠文字，图标落在曲线上，详情经 Tooltip 展示。
    const eventPoints = markers
      .map((marker) => {
        const tMs = Date.parse(marker.at);
        const value = nearestValue(series, tMs);
        return value === null ? null : { value: [tMs, value], marker };
      })
      .filter((p): p is { value: [number, number]; marker: RoomEventMarker } => p !== null);

    const eventScatter =
      eventPoints.length > 0
        ? {
            name: '现场事件',
            type: 'scatter',
            data: eventPoints,
            symbol: (_value: unknown, params: { data: { marker: RoomEventMarker } }) =>
              MARKER_META[params.data.marker.kind]?.symbol ?? 'circle',
            symbolSize: 11,
            itemStyle: {
              color: (params: { data: { marker: RoomEventMarker } }) =>
                MARKER_META[params.data.marker.kind]?.color ?? '#8b97a8',
              borderColor: '#ffffff',
              borderWidth: 1.5,
            },
            z: 10,
          }
        : null;

    const seriesList = [actualSeries, predicted, eventScatter].filter(Boolean) as Record<string, unknown>[];

    const spanMs =
      series.length > 1 ? Date.parse(series[series.length - 1].t) - Date.parse(series[0].t) : 0;

    chart.setOption(
      {
        animation: false,
        grid: { left: 44, right: 16, top: 24, bottom: showZoom ? 46 : 28 },
        dataZoom: showZoom
          ? [
              { type: 'inside', filterMode: 'none' },
              {
                type: 'slider',
                height: 18,
                bottom: 8,
                filterMode: 'none',
                borderColor: 'transparent',
                backgroundColor: 'rgba(15,169,120,0.05)',
                fillerColor: 'rgba(15,169,120,0.12)',
                handleStyle: { color: '#0fa978' },
                moveHandleStyle: { color: '#0fa978' },
                dataBackground: {
                  lineStyle: { color: 'rgba(15,169,120,0.4)' },
                  areaStyle: { color: 'rgba(15,169,120,0.08)' },
                },
                selectedDataBackground: {
                  lineStyle: { color: '#0fa978' },
                  areaStyle: { color: 'rgba(15,169,120,0.12)' },
                },
                textStyle: { fontSize: 10, color: '#8b97a8' },
              },
            ]
          : undefined,
        tooltip: {
          trigger: 'axis',
          textStyle: { fontSize: 12 },
          formatter: (params: unknown) => {
            const items = params as {
              seriesName: string;
              axisValueLabel: string;
              marker: string;
              value: [number, number];
              data: { marker?: RoomEventMarker };
            }[];
            if (!Array.isArray(items) || items.length === 0) return '';
            const lines: string[] = [];
            let timeLabel = '';
            items.forEach((item) => {
              if (item.seriesName === '现场事件' && item.data.marker) {
                const event = item.data.marker;
                const meta = MARKER_META[event.kind];
                lines.push(
                  `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${meta?.color ?? '#8b97a8'};margin-right:6px"></span>${escapeHtml(event.label)}${event.detail ? ` · ${escapeHtml(event.detail)}` : ''}`,
                );
              } else {
                if (!timeLabel) timeLabel = utcHM(item.value[0]);
                lines.push(`${item.marker} ${item.seriesName}：${item.value[1]} ${unit}`);
              }
            });
            return [timeLabel, ...lines].join('<br/>');
          },
        },
        xAxis: {
          type: 'time',
          axisLine: { lineStyle: { color: '#cbd2d9' } },
          axisLabel: {
            color: '#536176',
            fontSize: 11,
            hideOverlap: true,
            formatter: (value: number) => utcAxisLabel(value, spanMs),
          },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          scale: true,
          name: unit,
          nameTextStyle: { color: '#8b97a8', fontSize: 11 },
          axisLabel: { color: '#536176', fontSize: 11 },
          splitLine: { lineStyle: { color: '#f0f2f4' } },
        },
        series: seriesList,
      },
      { notMerge: true },
    );
  }, [series, unit, target, markers, predictedSeries, showZoom]);

  return <div ref={ref} style={{ width: '100%', height }} role="img" aria-label="趋势图" />;
}
