import type { ColdRoom } from '@/domain/types';

/** 演示数据：冷库。 */
export const ROOMS: ColdRoom[] = [
  {
    id: 'room-1',
    name: '1号辣椒库',
    location: 'A区 · 东侧',
    volumeM3: 420,
    controlMode: 'ai_assisted',
    targetRange: { metric: 'temperature', min: 8, max: 10, unit: '℃' },
    deviceIds: ['dev-compressor-1', 'dev-fan-1', 'dev-valve-1', 'dev-door-1', 'dev-meter-1'],
    sensorIds: ['sen-temp-1', 'sen-hum-1', 'sen-o2-1', 'sen-co2-1', 'sen-pres-1'],
    safetyParams: { minTempC: 5, maxTempC: 12, maxRatePerHour: 0.5 },
  },
  {
    id: 'room-2',
    name: '2号芒果库',
    location: 'A区 · 西侧',
    volumeM3: 380,
    controlMode: 'ai_assisted',
    targetRange: { metric: 'temperature', min: 10, max: 13, unit: '℃' },
    deviceIds: ['dev-compressor-2', 'dev-fan-2', 'dev-door-2'],
    sensorIds: ['sen-temp-2', 'sen-hum-2'],
    safetyParams: { minTempC: 7, maxTempC: 15, maxRatePerHour: 0.5 },
  },
  {
    id: 'room-3',
    name: '3号葡萄库',
    location: 'B区 · 北侧',
    volumeM3: 350,
    controlMode: 'manual',
    targetRange: { metric: 'temperature', min: 0, max: 2, unit: '℃' },
    deviceIds: ['dev-compressor-3', 'dev-fan-3', 'dev-door-3'],
    sensorIds: ['sen-temp-3', 'sen-pres-3'],
    safetyParams: { minTempC: -2, maxTempC: 4, maxRatePerHour: 0.5 },
  },
];