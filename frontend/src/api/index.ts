import type { ColdPilotClient } from './coldPilotClient';
import { MockColdPilotClient } from './mockColdPilotClient';
import type { DemoControls } from './mockColdPilotClient';

export type { ColdPilotClient } from './coldPilotClient';
export type { DemoControls } from './mockColdPilotClient';
export { ApiError, isApiError } from './apiErrors';

const mode = (import.meta.env.VITE_DATA_MODE ?? 'mock') as 'mock' | 'http';

let clientInstance: ColdPilotClient | null = null;
let demoControlsInstance: DemoControls | null = null;

/**
 * 当前仅实现 mock 模式。后续接入后端时：
 * 1. 新增 HttpColdPilotClient implements ColdPilotClient；
 * 2. 在此按 VITE_DATA_MODE=http 实例化；
 * 3. 页面组件与状态机无需任何改动。
 */
function createClient(): ColdPilotClient {
  if (mode === 'mock') {
    const mock = new MockColdPilotClient();
    demoControlsInstance = mock;
    return mock;
  }
  throw new Error(
    `VITE_DATA_MODE=http 尚未实现。本阶段仅支持 mock。请新增 HttpColdPilotClient 后再切换。`,
  );
}

/** 获取前端唯一数据边界（单例）。 */
export function getColdPilotClient(): ColdPilotClient {
  if (!clientInstance) clientInstance = createClient();
  return clientInstance;
}

/** 演示/测试用控制（失败注入、场景重置）。仅 mock 提供。 */
export function getDemoControls(): DemoControls {
  if (mode !== 'mock' || !demoControlsInstance) {
    throw new Error('DemoControls 仅在 mock 模式下可用。');
  }
  return demoControlsInstance;
}