import type { Device, InventoryBatch } from '@/domain/types';
import { dailyCurve, periodBreakdown, todayKwh, yesterdayKwh } from '@/domain/energy';

/**
 * 能耗分析页 ViewModel：全部由电表读数与温度负荷形态派生（演示/仿真估算，页面持续标注 provenance）。
 * 真实分项计量与电费账单后端未接入；周/月尺度为确定性放大估算。
 */

export interface EnergyKpi {
  todayKwh: number;
  yesterdayKwh: number;
  dayOverDayPct: number;
  weekKwh: number;
  weekOverWeekPct: number;
  peakPowerKw: number;
  yesterdayPeakPowerKw: number;
  unitKwhPerTon: number | null;
  unitDayOverDayPct: number | null;
}

/** 顶部汇总（演示派生：昨日 ×1.06、本周 ×6.8、峰值功率取 24h 曲线峰值小时电量）。 */
export function energyKpi(devices: Device[], inventory: InventoryBatch[], tempSeries: Parameters<typeof dailyCurve>[1]): EnergyKpi {
  const today = todayKwh(devices);
  const yesterday = yesterdayKwh(today);
  const curve = dailyCurve(today, tempSeries);
  const yesterdayCurve = dailyCurve(yesterday, tempSeries);
  const peak = Math.max(...curve.map((point) => point.kwh), 0);
  const yesterdayPeak = Math.max(...yesterdayCurve.map((point) => point.kwh), 0);
  const totalKg = inventory.reduce((sum, batch) => sum + batch.quantityKg, 0);
  const unit = totalKg > 0 ? today / (totalKg / 1000) : null;
  const yesterdayUnit = totalKg > 0 ? yesterday / (totalKg / 1000) : null;
  return {
    todayKwh: today,
    yesterdayKwh: yesterday,
    dayOverDayPct: yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 1000) / 10 : 0,
    weekKwh: Math.round(today * 6.8 * 10) / 10,
    weekOverWeekPct: 6.2,
    peakPowerKw: Math.round(peak * 10) / 10,
    yesterdayPeakPowerKw: Math.round(yesterdayPeak * 10) / 10,
    unitKwhPerTon: unit !== null ? Math.round(unit * 100) / 100 : null,
    unitDayOverDayPct: unit !== null && yesterdayUnit ? Math.round(((unit - yesterdayUnit) / yesterdayUnit) * 1000) / 10 : null,
  };
}

export interface SavingsRow {
  label: string;
  demo: string;
  simulated: string;
  pilot: string;
}

/** 估算电价（演示假设，页面展示该假设）。 */
export const ASSUMED_PRICE_PER_KWH = 0.6;

/**
 * 策略节能效果对比：
 * - 演示结果：确定性估算（人工经验 ×1.14 对比）；
 * - 仿真结果：方案 A 仿真能耗对比（真实仿真返回值，标注仿真）；
 * - 待真实试点验证：无数据（—）。
 */
export function savingsRows(todayKwhValue: number, simulatedPlanKwh: number | null): SavingsRow[] {
  const manual = todayKwhValue * 1.14;
  const demoSavingPct = manual > 0 ? ((manual - todayKwhValue) / manual) * 100 : 0;
  const demoSavedKwh = manual - todayKwhValue;

  const simulatedSavingPct = simulatedPlanKwh !== null && manual > 0 ? ((manual - simulatedPlanKwh) / manual) * 100 : null;
  const simulatedSavedKwh = simulatedPlanKwh !== null ? manual - simulatedPlanKwh : null;

  return [
    {
      label: '今日节能率',
      demo: `↓ ${demoSavingPct.toFixed(1)}%`,
      simulated: simulatedSavingPct !== null ? `↓ ${simulatedSavingPct.toFixed(1)}%` : '—',
      pilot: '—',
    },
    {
      label: '节省电量',
      demo: `${Math.round(demoSavedKwh)} kWh`,
      simulated: simulatedSavedKwh !== null ? `${Math.round(simulatedSavedKwh)} kWh` : '—',
      pilot: '—',
    },
    {
      label: `节省电费（按 ${ASSUMED_PRICE_PER_KWH} 元/kWh 估算）`,
      demo: `${(demoSavedKwh * ASSUMED_PRICE_PER_KWH).toFixed(1)} 元`,
      simulated: simulatedSavedKwh !== null ? `${(simulatedSavedKwh * ASSUMED_PRICE_PER_KWH).toFixed(1)} 元` : '—',
      pilot: '—',
    },
  ];
}

/** 能耗洞察（关键发现由真实派生数字生成，标注演示）。 */
export function energyInsights(devices: Device[], inventory: InventoryBatch[], tempSeries: Parameters<typeof dailyCurve>[1]): string[] {
  const kpi = energyKpi(devices, inventory, tempSeries);
  const curve = dailyCurve(kpi.todayKwh, tempSeries);
  const periods = periodBreakdown(curve);
  const peakPct = kpi.todayKwh > 0 ? Math.round((periods.peak / kpi.todayKwh) * 1000) / 10 : 0;
  const findings: string[] = [];
  findings.push(
    `今日能耗较昨日${kpi.dayOverDayPct <= 0 ? '下降' : '上升'} ${Math.abs(kpi.dayOverDayPct)}%（演示派生对比）。`,
  );
  findings.push(`峰段（8-11 / 18-21 时）用电占比 ${peakPct}%，建议继续优化压缩机启停与库温预冷。`);
  if (kpi.unitKwhPerTon !== null) {
    findings.push(`单位库存能耗 ${kpi.unitKwhPerTon} kWh/吨（按当前库存 ${Math.round(inventory.reduce((s, b) => s + b.quantityKg, 0) / 1000)} 吨计）。`);
  }
  return findings;
}
