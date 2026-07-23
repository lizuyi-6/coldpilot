import type { RoomEventMarker } from '@/domain/types';
import { minutesAgo } from './referenceTime';

/** 演示数据：库房事件标记（叠加在趋势图上）。时间线：08:45 入库 → 08:50-09:05 开门 → 09:15 越界。 */
export const ROOM_EVENTS: Record<string, RoomEventMarker[]> = {
  'room-1': [
    { id: 'rev-1', roomId: 'room-1', kind: 'inbound', at: minutesAgo(110), label: '入库', detail: '0.8t 常温辣椒入库' },
    { id: 'rev-2', roomId: 'room-1', kind: 'door_open', at: minutesAgo(105), label: '库门开启', detail: '库门开启' },
    { id: 'rev-3', roomId: 'room-1', kind: 'door_close', at: minutesAgo(90), label: '库门关闭', detail: '开门约 15 分钟' },
    { id: 'rev-4', roomId: 'room-1', kind: 'compressor_start', at: minutesAgo(70), label: '压缩机启动', detail: '压缩机启动' },
    { id: 'rev-5', roomId: 'room-1', kind: 'compressor_stop', at: minutesAgo(20), label: '压缩机停机', detail: '压缩机停机' },
  ],
  'room-2': [
    { id: 'rev-6', roomId: 'room-2', kind: 'door_open', at: minutesAgo(30), label: '库门开启', detail: '短时开门' },
  ],
  'room-3': [],
};