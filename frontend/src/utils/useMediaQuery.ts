import { useSyncExternalStore } from 'react';

/** 订阅 CSS 媒体查询（SSR 安全，初始按不匹配处理）。 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  };
  const getSnapshot = () => window.matchMedia(query).matches;
  const getServerSnapshot = () => false;
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 宽屏（≥1440px）：检查器默认展开。 */
export function useIsWideLayout(): boolean {
  return useMediaQuery('(min-width: 1440px)');
}