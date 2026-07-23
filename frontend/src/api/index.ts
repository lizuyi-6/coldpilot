import type { ColdPilotClient } from './coldPilotClient';
import { MockColdPilotClient } from './mockColdPilotClient';
import { HttpColdPilotClient } from './httpColdPilotClient';
import type { DemoControls } from './mockColdPilotClient';

export type { ColdPilotClient } from './coldPilotClient';
export type { DemoControls } from './mockColdPilotClient';
export { ApiError, isApiError } from './apiErrors';

const mode = (import.meta.env.VITE_DATA_MODE ?? 'mock') as 'mock' | 'http';
const httpBaseUrl = (import.meta.env.VITE_COLDPILOT_API_BASE_URL ?? '') as string;

let clientInstance: ColdPilotClient | null = null;
let demoControlsInstance: DemoControls | null = null;

/**
 * 按 VITE_DATA_MODE 切换实现：
 * - mock：内置演示数据（失败注入、场景重置）。
 * - http：调用 ColdPilot 后端（FastAPI），base URL 由 VITE_COLDPILOT_API_BASE_URL 提供。
 * 页面组件与状态机无需任何改动。
 */
function createClient(): ColdPilotClient {
  if (mode === 'mock') {
    const mock = new MockColdPilotClient();
    demoControlsInstance = mock;
    return mock;
  }
  return new HttpColdPilotClient(httpBaseUrl);
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