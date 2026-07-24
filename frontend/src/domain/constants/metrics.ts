import { CloudDrizzle, CloudRain, Droplets, Gauge, Thermometer, Wind, type LucideIcon } from 'lucide-react';
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

/** 露点（由温湿度推算的派生指标）显示元数据。 */
export const DEW_POINT_META: MetricMeta = { label: '露点', shortUnit: '℃', Icon: CloudDrizzle };

export const METRIC_ORDER: MetricKey[] = ['temperature', 'humidity', 'o2', 'co2', 'pressureDiff'];

/**
 * 非主控指标的经验参考区间（仅展示用；真实目标以后端下发为准）。
 * 温度目标区间来自 ColdRoom.targetRange，不在此列。
 */
export const RECOMMENDED_BANDS: Record<MetricKey | 'dewPoint', string> = {
  temperature: '',
  humidity: '目标 88 ~ 95 %RH',
  o2: '目标 2 ~ 5 %',
  co2: '目标 5 ~ 10 %',
  pressureDiff: '目标 5 ~ 20 Pa',
  dewPoint: '参考 ≤ 7 ℃',
};