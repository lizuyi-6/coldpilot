import type { Device, SensorSeries } from '@/domain/types';

/**
 * 数据源标签：由已加载的遥测指标、设备类型与事件真实推导，
 * 不写死固定标签；无数据时返回空数组（页面显示暂无数据）。
 */
export function dataSourceTags(
  bundles: { telemetry: SensorSeries[]; devices: Device[] }[],
  eventCount: number,
): string[] {
  const metrics = new Set<string>();
  const kinds = new Set<string>();
  for (const bundle of bundles) {
    for (const series of bundle.telemetry) metrics.add(series.metric);
    for (const device of bundle.devices) kinds.add(device.kind);
  }
  const tags: string[] = [];
  if (metrics.has('temperature') || metrics.has('humidity')) tags.push('温湿度');
  if (metrics.has('co2') || metrics.has('o2')) tags.push('气体');
  if (metrics.has('pressureDiff')) tags.push('压差');
  if (kinds.has('meter')) tags.push('电表');
  if (kinds.has('compressor')) tags.push('压缩机');
  if (kinds.has('fan')) tags.push('风机');
  if (kinds.has('door')) tags.push('库门');
  if (eventCount > 0) tags.push('告警');
  return tags;
}
