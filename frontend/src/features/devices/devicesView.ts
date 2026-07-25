import type { Device, DeviceStatus } from '@/domain/types';

/**
 * 设备管理页 ViewModel：KPI、健康度与维护建议全部由真实设备状态与指标派生。
 * 设备级历史趋势、维护记录与事件记录后端未接入，页面相应位置显示“暂无数据”。
 */

/** 指标键 → 中文名与单位（后端 metrics 为 Record<string, number>，键集合见演示数据）。 */
export const DEVICE_METRIC_META: Record<string, { label: string; unit: string }> = {
  efficiencyPct: { label: '效率', unit: '%' },
  dischargeTempC: { label: '排气温度', unit: '℃' },
  suctionPressureKpa: { label: '吸气压力', unit: 'kPa' },
  airflowPct: { label: '风量', unit: '%' },
  openingPct: { label: '开度', unit: '%' },
  openPct: { label: '开门幅度', unit: '%' },
  todayKwh: { label: '今日电耗', unit: 'kWh' },
};

export interface DeviceMetricEntry {
  key: string;
  label: string;
  value: number;
  unit: string;
}

/** 设备指标列表（未知键回退原始键名，单位省略）。 */
export function deviceMetricEntries(device: Device): DeviceMetricEntry[] {
  return Object.entries(device.metrics ?? {}).map(([key, value]) => {
    const meta = DEVICE_METRIC_META[key];
    return { key, label: meta?.label ?? key, value, unit: meta?.unit ?? '' };
  });
}

export type DeviceHealth = 'healthy' | 'attention' | 'fault';

/** 健康度：故障/离线 → 异常；指标越界 → 关注；其余健康。 */
export function deviceHealth(device: Device): DeviceHealth {
  if (device.status === 'fault' || device.status === 'offline') return 'fault';
  const efficiency = device.metrics?.efficiencyPct;
  if (efficiency !== undefined && efficiency < 80) return 'attention';
  const dischargeTemp = device.metrics?.dischargeTempC;
  if (dischargeTemp !== undefined && dischargeTemp > 90) return 'attention';
  return 'healthy';
}

export const HEALTH_META: Record<DeviceHealth, { label: string; tone: 'accent' | 'warning' | 'danger' }> = {
  healthy: { label: '健康', tone: 'accent' },
  attention: { label: '关注', tone: 'warning' },
  fault: { label: '异常', tone: 'danger' },
};

/** 维护建议（只读规则，基于真实状态与指标；无后端建议接口）。 */
export function maintenanceAdvice(device: Device): string[] {
  const advice: string[] = [];
  if (device.status === 'fault') advice.push('设备故障，需人工检修后方可恢复自动运行。');
  if (device.status === 'offline') advice.push('设备离线，请检查供电与通讯链路。');
  if (device.kind === 'compressor') {
    const efficiency = device.metrics?.efficiencyPct;
    if (efficiency !== undefined && efficiency < 80) advice.push(`压缩机效率 ${efficiency}% 偏低，建议检查制冷剂充注量与冷凝器清洁度。`);
    const dischargeTemp = device.metrics?.dischargeTempC;
    if (dischargeTemp !== undefined && dischargeTemp > 90) advice.push(`排气温度 ${dischargeTemp}℃ 偏高，建议检查油位与冷却。`);
    advice.push('建议按计划巡检压缩机油位、皮带与振动。');
  }
  if (device.kind === 'fan') advice.push('建议定期清理风机叶片积霜，检查轴承润滑。');
  if (device.kind === 'door') advice.push('建议检查库门密封条完整性，减少冷气泄漏。');
  if (device.kind === 'valve') advice.push('建议校验膨胀阀开度与感温包。');
  if (device.kind === 'meter') advice.push('电表用于能耗计量，建议定期校验精度。');
  if (advice.length === 0) advice.push('设备运行正常，按计划例行巡检。');
  return advice;
}

export interface DeviceKpi {
  total: number;
  online: number;
  onlinePct: number;
  alarm: number;
  alarmPct: number;
  adviceCount: number;
}

const ONLINE_STATUSES: DeviceStatus[] = ['running', 'idle'];

/** 顶部汇总：总数 / 在线（运行+待机）/ 告警（故障+离线）/ 需维护（健康度非健康）。 */
export function deviceKpi(devices: Device[]): DeviceKpi {
  const total = devices.length;
  const online = devices.filter((device) => ONLINE_STATUSES.includes(device.status)).length;
  const alarm = devices.filter((device) => device.status === 'fault' || device.status === 'offline').length;
  const adviceCount = devices.filter((device) => deviceHealth(device) !== 'healthy').length;
  return {
    total,
    online,
    onlinePct: total > 0 ? Math.round((online / total) * 1000) / 10 : 0,
    alarm,
    alarmPct: total > 0 ? Math.round((alarm / total) * 1000) / 10 : 0,
    adviceCount,
  };
}
