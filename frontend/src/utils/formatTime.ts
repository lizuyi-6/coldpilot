/** 时间格式化工具（演示数据基于 UTC ISO 字符串）。 */

/** HH:mm（本地时区）。 */
export function formatTimeHM(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** M月d日 HH:mm。 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${formatTimeHM(iso)}`;
}

/** 持续时长：如 “1小时20分” / “25分钟”。 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}小时` : `${h}小时${m}分`;
}