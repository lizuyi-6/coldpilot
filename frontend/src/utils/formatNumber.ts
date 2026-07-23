/** 数字格式化：统一等宽数字场景使用。 */
export function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits);
}

/** 千分位整数（如能耗 1,246）。 */
export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('zh-CN');
}