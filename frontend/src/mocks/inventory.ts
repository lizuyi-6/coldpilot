import type { InventoryBatch } from '@/domain/types';
import { minutesAgo } from './referenceTime';

/** 演示数据：库存批次。1 号库 08:45 入库 0.8t 常温辣椒是高温主因。 */
export const INVENTORY: InventoryBatch[] = [
  {
    id: 'batch-1', roomId: 'room-1', category: '辣椒（线椒）', quantityKg: 800,
    inboundAt: minutesAgo(110), maturity: '完熟', source: '本地合作社',
    recommendedRange: { metric: 'temperature', min: 8, max: 10, unit: '℃' },
    maxStorageHours: 240, risk: 'watch',
  },
  {
    id: 'batch-2', roomId: 'room-1', category: '辣椒（彩椒）', quantityKg: 1200,
    inboundAt: minutesAgo(60 * 30), maturity: '八成熟', source: '寿光基地',
    recommendedRange: { metric: 'temperature', min: 8, max: 10, unit: '℃' },
    maxStorageHours: 300, risk: 'none',
  },
  {
    id: 'batch-3', roomId: 'room-2', category: '芒果（台农）', quantityKg: 950,
    inboundAt: minutesAgo(60 * 20), maturity: '七成熟', source: '海南',
    recommendedRange: { metric: 'temperature', min: 10, max: 13, unit: '℃' },
    maxStorageHours: 360, risk: 'none',
  },
  {
    id: 'batch-4', roomId: 'room-3', category: '葡萄（巨峰）', quantityKg: 600,
    inboundAt: minutesAgo(60 * 48), maturity: '完熟', source: '云南',
    recommendedRange: { metric: 'temperature', min: 0, max: 2, unit: '℃' },
    maxStorageHours: 480, risk: 'none',
  },
];