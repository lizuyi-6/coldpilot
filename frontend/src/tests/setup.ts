import '@testing-library/jest-dom/vitest';

// jsdom 不提供 ResizeObserver（ECharts 容器自适应依赖），提供最小 polyfill。
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}