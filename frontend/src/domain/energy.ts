import type { Device, SensorSeries } from '@/domain/types';

/**
 * 能耗 ViewModel（演示/仿真派生，绝不表达为真实节能成果）。
 * 基础数据来自可得领域：电表 todayKwh（设备 metrics）+ 温度曲线负荷形态。
 * 峰谷划分按华东工业电价时段（演示假设）。
 */

/** 从某库房设备中取电表今日电量。 */
export function todayKwh(devices: Device[]): number {
  const meter = devices.find((d) => d.kind === 'meter');
  return meter?.metrics?.todayKwh ?? 0;
}

export interface EnergyPoint {
  hour: number;
  kwh: number;
  /** 峰 / 平 / 谷。 */
  period: 'peak' | 'flat' | 'valley';
}

/** 峰平谷时段（演示假设：峰 8-11/18-21，谷 23-7，其余平）。 */
export function periodOf(hour: number): 'peak' | 'flat' | 'valley' {
  if ((hour >= 8 && hour < 11) || (hour >= 18 && hour < 21)) return 'peak';
  if (hour >= 23 || hour < 7) return 'valley';
  return 'flat';
}

/**
 * 由今日总电量与温度曲线负荷形态派生 24h 能耗曲线（演示）。
 * 温度越高（负荷越大），单位时段电耗越高；用温度偏离目标的程度加权。
 */
export function dailyCurve(todayKwhValue: number, tempSeries: SensorSeries | undefined): EnergyPoint[] {
  const points: EnergyPoint[] = [];
  const temps = tempSeries?.points ?? [];
  // 取 24h 内的 24 个代表点（每小时），计算权重。
  const weights: number[] = [];
  for (let h = 0; h < 24; h++) {
    const idx = temps.length ? Math.floor((h / 24) * temps.length) : 0;
    const t = temps[idx]?.value ?? 9;
    // 权重：偏离 8℃ 越多，负荷越大（制冷需求）。
    weights.push(1 + Math.abs(t - 8) * 0.12);
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  for (let h = 0; h < 24; h++) {
    points.push({
      hour: h,
      kwh: Math.round(((todayKwhValue * weights[h]) / totalWeight) * 10) / 10,
      period: periodOf(h),
    });
  }
  return points;
}

/** 峰平谷电量分布汇总。 */
export function periodBreakdown(curve: EnergyPoint[]): { peak: number; flat: number; valley: number } {
  const sum = { peak: 0, flat: 0, valley: 0 };
  curve.forEach((p) => {
    sum[p.period] += p.kwh;
  });
  return {
    peak: Math.round(sum.peak * 10) / 10,
    flat: Math.round(sum.flat * 10) / 10,
    valley: Math.round(sum.valley * 10) / 10,
  };
}

/** 昨日同期（演示：今日 ±6% 的确定性偏移）。 */
export function yesterdayKwh(todayKwhValue: number): number {
  return Math.round(todayKwhValue * 1.06 * 10) / 10;
}

/** 高耗能设备（演示：压缩机为主，风机次之；按可得 efficiency 加权）。 */
export function deviceBreakdown(devices: Device[], totalKwh: number): { name: string; kwh: number; pct: number }[] {
  const compressor = devices.filter((d) => d.kind === 'compressor');
  const fans = devices.filter((d) => d.kind === 'fan');
  const others = devices.filter((d) => d.kind !== 'compressor' && d.kind !== 'fan' && d.kind !== 'meter');
  const shares: { name: string; ratio: number }[] = [];
  compressor.forEach((d) => shares.push({ name: d.name, ratio: 0.62 / Math.max(1, compressor.length) }));
  fans.forEach((d) => shares.push({ name: d.name, ratio: 0.24 / Math.max(1, fans.length) }));
  others.forEach((d) => shares.push({ name: d.name, ratio: 0.14 / Math.max(1, others.length) }));
  return shares
    .map((s) => ({ name: s.name, kwh: Math.round(totalKwh * s.ratio * 10) / 10, pct: Math.round(s.ratio * 100) }))
    .sort((a, b) => b.kwh - a.kwh);
}