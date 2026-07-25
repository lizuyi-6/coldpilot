/** 数字格式化：统一等宽数字场景使用。固定 2 位小数读取界面设置（uiPrefs，纯前端）。 */

import { getUiPrefs } from './uiPrefs';

export function formatNumber(value: number, digits = 1): string {
  const effectiveDigits = getUiPrefs().numberFormat === 'fixed2' ? 2 : digits;
  return value.toFixed(effectiveDigits);
}

/** 千分位整数（如能耗 1,246）。 */
export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('zh-CN');
}
