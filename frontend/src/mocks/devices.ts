import type { Device } from '@/domain/types';

/** 演示数据：设备。压缩机效率下降是 1 号库高温的可疑因素之一。 */
export const DEVICES: Device[] = [
  {
    id: 'dev-compressor-1', roomId: 'room-1', kind: 'compressor', name: '压缩机 A',
    status: 'running', metrics: { efficiencyPct: 78, dischargeTempC: 86, suctionPressureKpa: 320 },
  },
  { id: 'dev-fan-1', roomId: 'room-1', kind: 'fan', name: '冷风机', status: 'running', metrics: { airflowPct: 92 } },
  { id: 'dev-valve-1', roomId: 'room-1', kind: 'valve', name: '电子膨胀阀', status: 'running', metrics: { openingPct: 60 } },
  { id: 'dev-door-1', roomId: 'room-1', kind: 'door', name: '库门', status: 'idle', metrics: { openPct: 0 } },
  { id: 'dev-meter-1', roomId: 'room-1', kind: 'meter', name: '电表', status: 'running', metrics: { todayKwh: 1246 } },

  { id: 'dev-compressor-2', roomId: 'room-2', kind: 'compressor', name: '压缩机 B', status: 'running', metrics: { efficiencyPct: 88 } },
  { id: 'dev-fan-2', roomId: 'room-2', kind: 'fan', name: '冷风机', status: 'running', metrics: { airflowPct: 90 } },
  { id: 'dev-door-2', roomId: 'room-2', kind: 'door', name: '库门', status: 'idle', metrics: { openPct: 0 } },

  { id: 'dev-compressor-3', roomId: 'room-3', kind: 'compressor', name: '压缩机 C', status: 'running', metrics: { efficiencyPct: 91 } },
  { id: 'dev-fan-3', roomId: 'room-3', kind: 'fan', name: '冷风机', status: 'running', metrics: { airflowPct: 95 } },
  { id: 'dev-door-3', roomId: 'room-3', kind: 'door', name: '库门', status: 'idle', metrics: { openPct: 0 } },
];