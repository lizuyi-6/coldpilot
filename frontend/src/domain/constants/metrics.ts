import { CloudRain, Droplets, Gauge, Thermometer, Wind, type LucideIcon } from 'lucide-react';
import type { MetricKey } from '@/domain/types';

export interface MetricMeta {
  label: string;
  shortUnit: string;
  Icon: LucideIcon;
}

/** 指标显示元数据（指挥中心 / 监控页共用）。 */
export const METRIC_META: Record<MetricKey, MetricMeta> = {
  temperature: { label: '温度', shortUnit: '℃', Icon: Thermometer },
  humidity: { label: '湿度', shortUnit: '%RH', Icon: Droplets },
  o2: { label: 'O₂', shortUnit: '%', Icon: Wind },
  co2: { label: 'CO₂', shortUnit: '%', Icon: CloudRain },
  pressureDiff: { label: '压差', shortUnit: 'Pa', Icon: Gauge },
};

export const METRIC_ORDER: MetricKey[] = ['temperature', 'humidity', 'o2', 'co2', 'pressureDiff'];