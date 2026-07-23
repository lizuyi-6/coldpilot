import type { MetricKey } from '../types/sensor';

interface MetricMeta {
  label: string;
  unit: string;
}

export const METRIC_META: Record<MetricKey, MetricMeta> = {
  temperature: { label: '温度', unit: '℃' },
  humidity: { label: '湿度', unit: '%RH' },
  o2: { label: 'O₂', unit: '%' },
  co2: { label: 'CO₂', unit: '%' },
  pressureDiff: { label: '压差', unit: 'Pa' },
};

export const METRIC_ORDER: MetricKey[] = ['temperature', 'humidity', 'o2', 'co2', 'pressureDiff'];