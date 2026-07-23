import type { ISODateString } from './primitives';
import type { TaskStatus } from './workbench';
import type { ColdRoom } from './coldRoom';
import type { Device } from './device';
import type { InventoryBatch } from './inventory';
import type { SensorSeries } from './sensor';

/** 告警等级。 */
export type Severity = 'notice' | 'warning' | 'critical' | 'emergency';

/** 事件列表项（摘要）。 */
export interface AnomalyEventSummary {
  id: string;
  roomId: string;
  roomName: string;
  type: string;
  title: string;
  severity: Severity;
  startedAt: ISODateString;
  durationMinutes: number;
  stage: TaskStatus;
  awaitingApproval: boolean;
}

/** 库房事件标记（叠加在趋势图上）。 */
export interface RoomEventMarker {
  id: string;
  roomId: string;
  kind: 'door_open' | 'door_close' | 'inbound' | 'compressor_start' | 'compressor_stop';
  at: ISODateString;
  label: string;
  detail?: string;
}

/** 异常事件详情：工作台一次加载所需的完整上下文。 */
export interface AnomalyEventDetail extends AnomalyEventSummary {
  room: ColdRoom;
  devices: Device[];
  inventory: InventoryBatch[];
  /** 多指标时序，主控指标带目标区间。 */
  telemetry: SensorSeries[];
  roomEvents: RoomEventMarker[];
}