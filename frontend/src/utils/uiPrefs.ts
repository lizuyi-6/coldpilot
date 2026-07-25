/**
 * 界面设置（纯前端偏好）：仅保存到本机 localStorage，立即生效，不写入任何后端配置。
 * - density：界面密度（通过 data-density 覆盖间距 token）
 * - timeFormat：时间显示 24/12 小时制（formatTime 系列函数读取）
 * - numberFormat：数字小数位（formatNumber 读取）
 * - themeColor：主题色（通过 data-theme-color 覆盖主色 token）
 * 导航折叠沿用 AppShell 的 coldpilot.nav.collapsed，单一事实来源。
 */

export type UiDensity = 'comfortable' | 'compact' | 'loose';
export type UiTimeFormat = '24h' | '12h';
export type UiNumberFormat = 'auto' | 'fixed2';
export type UiThemeColor = 'mint' | 'blue' | 'violet';

export interface UiPrefs {
  density: UiDensity;
  timeFormat: UiTimeFormat;
  numberFormat: UiNumberFormat;
  themeColor: UiThemeColor;
}

export const UI_PREFS_KEY = 'coldpilot.ui.prefs';
export const NAV_COLLAPSE_KEY = 'coldpilot.nav.collapsed';
/** 偏好变更事件：AppShell 等跨组件消费者监听后同步自身状态。 */
export const UI_PREFS_EVENT = 'coldpilot:ui-prefs-changed';

const DEFAULT_PREFS: UiPrefs = {
  density: 'comfortable',
  timeFormat: '24h',
  numberFormat: 'auto',
  themeColor: 'mint',
};

function load(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<UiPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

let current: UiPrefs = load();

export function getUiPrefs(): UiPrefs {
  return current;
}

/** 把偏好落到 documentElement（启动与变更时各调用一次）。 */
export function applyUiPrefs(prefs: UiPrefs): void {
  const root = document.documentElement;
  root.dataset.density = prefs.density;
  if (prefs.themeColor === 'mint') {
    delete root.dataset.themeColor;
  } else {
    root.dataset.themeColor = prefs.themeColor;
  }
}

export function updateUiPrefs(patch: Partial<UiPrefs>): UiPrefs {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(current));
  } catch {
    /* 隐私模式等场景写入失败时仅本会话生效 */
  }
  applyUiPrefs(current);
  window.dispatchEvent(new CustomEvent(UI_PREFS_EVENT, { detail: current }));
  return current;
}

/** 导航折叠：写入 AppShell 的 localStorage 键并广播，导航即时响应。 */
export function setNavCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(NAV_COLLAPSE_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(UI_PREFS_EVENT));
}

export function getNavCollapsed(): boolean {
  try {
    return localStorage.getItem(NAV_COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}
