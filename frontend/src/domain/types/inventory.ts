import type { ISODateString, TargetRange } from './primitives';

/** 库存批次。 */
export interface InventoryBatch {
  id: string;
  roomId: string;
  category: string;
  quantityKg: number;
  inboundAt: ISODateString;
  maturity: string;
  source: string;
  recommendedRange: TargetRange;
  maxStorageHours: number;
  risk: 'none' | 'watch' | 'high';
}