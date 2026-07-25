import { DoorOpen, Fan, Gauge, Snowflake, Zap, type LucideIcon } from 'lucide-react';
import type { Device, DeviceKind } from '@/domain/types';
import type { TagTone } from '@/components/ui/Tag';

/** 设备类型 → 图标（全站统一）。 */
export const DEVICE_KIND_ICON: Record<DeviceKind, LucideIcon> = {
  compressor: Snowflake,
  fan: Fan,
  valve: Gauge,
  door: DoorOpen,
  meter: Zap,
};

/** 设备类型 → 中文名（全站统一）。 */
export const DEVICE_KIND_LABEL: Record<DeviceKind, string> = {
  compressor: '压缩机',
  fan: '冷风机',
  valve: '电子膨胀阀',
  door: '库门',
  meter: '电表',
};

/** 设备状态 → 标签色（全站统一）。 */
export function deviceStatusTagTone(status: Device['status']): TagTone {
  if (status === 'running') return 'accent';
  if (status === 'idle') return 'neutral';
  return 'danger';
}
