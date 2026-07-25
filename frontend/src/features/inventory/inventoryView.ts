import type { InventoryBatch } from '@/domain/types';
import { remainingHours } from '@/domain/viewModels';

/**
 * 库存管理页 ViewModel：KPI、适宜性与处置建议全部由真实批次字段与库房遥测派生。
 * 湿度/CO₂ 推荐区间、批次级历史曲线与处置单写接口后端未接入，页面相应位置显示“暂无数据”或禁用。
 */

export interface InventoryKpi {
  totalKg: number;
  batches: number;
  riskBatches: number;
  riskPct: number;
  avgRemainingDays: number | null;
}

/** 顶部汇总：总量 / 批次 / 风险批次 / 平均剩余窗口（天）。较昨日对比后端未提供，不展示。 */
export function inventoryKpi(inventory: InventoryBatch[], nowMs: number): InventoryKpi {
  const totalKg = inventory.reduce((sum, batch) => sum + batch.quantityKg, 0);
  const riskBatches = inventory.filter((batch) => batch.risk !== 'none').length;
  const remainingValues = inventory.map((batch) => remainingHours(batch, nowMs));
  const avgRemainingHours =
    remainingValues.length > 0 ? remainingValues.reduce((sum, value) => sum + value, 0) / remainingValues.length : null;
  return {
    totalKg,
    batches: inventory.length,
    riskBatches,
    riskPct: inventory.length > 0 ? Math.round((riskBatches / inventory.length) * 100) : 0,
    avgRemainingDays: avgRemainingHours !== null ? Math.round((avgRemainingHours / 24) * 10) / 10 : null,
  };
}

/** 剩余窗口（天，1 位小数）。 */
export function remainingDays(batch: InventoryBatch, nowMs: number): number {
  return Math.round((remainingHours(batch, nowMs) / 24) * 10) / 10;
}

export type SuitabilityLevel = 'ok' | 'warn' | 'unknown';

export interface SuitabilityRow {
  key: string;
  label: string;
  currentText: string;
  level: SuitabilityLevel;
  levelText: string;
}

/**
 * 存储适宜性：温度对比批次推荐温区（真实遥测 + 真实推荐区间）；
 * 湿度 / CO₂ 无推荐区间（暂无数据）；成熟度为批次文本字段（仅展示）。
 */
export function suitabilityRows(
  batch: InventoryBatch,
  current: { temperature?: number; humidity?: number; co2?: number },
): SuitabilityRow[] {
  const rows: SuitabilityRow[] = [];
  if (current.temperature !== undefined) {
    const inRange = current.temperature >= batch.recommendedRange.min && current.temperature <= batch.recommendedRange.max;
    rows.push({
      key: 'temperature',
      label: '温度',
      currentText: `${current.temperature.toFixed(1)} ℃`,
      level: inRange ? 'ok' : 'warn',
      levelText: inRange ? '适宜' : '偏离',
    });
  } else {
    rows.push({ key: 'temperature', label: '温度', currentText: '暂无数据', level: 'unknown', levelText: '—' });
  }
  rows.push({
    key: 'humidity',
    label: '湿度',
    currentText: current.humidity !== undefined ? `${current.humidity.toFixed(1)} %RH` : '暂无数据',
    level: 'unknown',
    levelText: '无推荐区间',
  });
  rows.push({
    key: 'co2',
    label: 'CO₂',
    currentText: current.co2 !== undefined ? `${current.co2.toFixed(1)} %` : '暂无数据',
    level: 'unknown',
    levelText: '无推荐区间',
  });
  rows.push({ key: 'maturity', label: '成熟度', currentText: batch.maturity, level: 'unknown', levelText: '仅展示' });
  return rows;
}

/** 推荐处置（只读规则，基于风险等级与温度偏离；处置单写接口未接入）。 */
export function disposalAdvice(batch: InventoryBatch, currentTemperature: number | undefined, nowMs: number): string[] {
  const advice: string[] = [];
  const range = batch.recommendedRange;
  if (currentTemperature !== undefined && currentTemperature > range.max) {
    advice.push(`将库温下调至 ${range.min} ~ ${range.max} ${range.unit} 推荐区间，维持稳定运行。`);
  } else if (currentTemperature !== undefined && currentTemperature < range.min) {
    advice.push(`库温低于推荐区间，适度回升至 ${range.min} ~ ${range.max} ${range.unit}，避免冷害。`);
  } else if (currentTemperature !== undefined) {
    advice.push(`维持 ${range.min} ~ ${range.max} ${range.unit} 推荐区间运行。`);
  }
  const days = remainingDays(batch, nowMs);
  if (batch.risk === 'high') {
    advice.push(`剩余安全窗口约 ${days} 天，建议 48 小时内优先出库或加工处理。`);
  } else if (batch.risk === 'watch') {
    advice.push(`剩余安全窗口约 ${days} 天，建议尽早安排出库计划。`);
  } else {
    advice.push('按先进先出原则安排出库，持续关注成熟度变化。');
  }
  return advice;
}

export interface WindowTrendPoint {
  label: string;
  actualDays: number | null;
  forecastDays: number | null;
}

/**
 * 剩余窗口趋势（估算）：自入库起按 maxStorageHours 线性递减，
 * 今日之后为线性外推（与剩余窗口定义一致，非模型预测，页面标注“估算”）。
 */
export function windowTrend(batch: InventoryBatch, nowMs: number): WindowTrendPoint[] {
  const inboundMs = Date.parse(batch.inboundAt);
  const totalDays = batch.maxStorageHours / 24;
  const points: WindowTrendPoint[] = [];
  const stepDays = Math.max(1, Math.round(totalDays / 6));
  const todayIndex = Math.ceil((nowMs - inboundMs) / (24 * 3_600_000));
  for (let day = 0; day <= totalDays + stepDays; day += stepDays) {
    const atMs = inboundMs + day * 24 * 3_600_000;
    const remaining = Math.max(0, totalDays - day);
    const date = new Date(atMs);
    const label = `${date.getUTCMonth() + 1}-${String(date.getUTCDate()).padStart(2, '0')}`;
    const isPast = atMs <= nowMs;
    points.push({
      label,
      actualDays: isPast ? Math.round(remaining * 10) / 10 : day <= todayIndex ? Math.round(remaining * 10) / 10 : null,
      forecastDays: isPast ? null : Math.round(remaining * 10) / 10,
    });
  }
  return points;
}
