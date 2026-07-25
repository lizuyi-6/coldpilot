import { useEffect, useState } from 'react';

/**
 * 响应式断点 hook：监听 CSS 媒体查询。
 * matchMedia 不可用（如 jsdom 测试环境）时恒为 false，保证测试确定性。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQueryList = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', onChange);
    return () => mediaQueryList.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** 宽屏布局断点（≥1280px）：侧栏详情/检查器默认展开。 */
export function useIsWideLayout(): boolean {
  return useMediaQuery('(min-width: 1280px)');
}
