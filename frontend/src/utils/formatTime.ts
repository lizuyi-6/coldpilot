/**
 * 时间格式化工具。
 * 演示数据基于固定 UTC 参考时间，统一按 UTC 渲染，
 * 保证任何时区下显示均与演示叙事一致（如 09:15 起）。
 */

/** HH:mm（UTC）。 */
export function formatTimeHM(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** M月d日 HH:mm（UTC）。 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${formatTimeHM(iso)}`;
}

/** YYYY-MM-DD HH:mm（UTC），表格场景。 */
export function formatDateTimeISO(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${formatTimeHM(iso)}`;
}

/** MM-DD HH:mm（UTC），紧凑表格场景。 */
export function formatDateTimeShort(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${formatTimeHM(iso)}`;
}

/** 持续时长：如 “1小时20分” / “25分钟”。 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}小时` : `${h}小时${m}分`;
}