import type { AnomalyEventSummary } from '@/domain/types';
import { minutesAgo } from './referenceTime';

/** 演示数据：异常事件列表。evt-1 为本演示主线（1 号辣椒库持续高温）。 */
export const ANOMALY_EVENTS: AnomalyEventSummary[] = [
  {
    id: 'evt-1',
    roomId: 'room-1',
    roomName: '1号辣椒库',
    type: 'sustained_high_temp',
    title: '持续高温',
    severity: 'critical',
    startedAt: minutesAgo(80),
    durationMinutes: 80,
    stage: 'detected',
    awaitingApproval: false,
  },
  {
    id: 'evt-2',
    roomId: 'room-2',
    roomName: '2号芒果库',
    type: 'humidity_high',
    title: '湿度偏高',
    severity: 'warning',
    startedAt: minutesAgo(25),
    durationMinutes: 25,
    stage: 'detected',
    awaitingApproval: false,
  },
  {
    id: 'evt-3',
    roomId: 'room-3',
    roomName: '3号葡萄库',
    type: 'pressure_fluctuation',
    title: '压差波动',
    severity: 'notice',
    startedAt: minutesAgo(300),
    durationMinutes: 40,
    stage: 'recovered',
    awaitingApproval: false,
  },
];