import type { ISODateString } from '@/domain/types';

/**
 * 演示参考时间：所有演示时序以此为“现在”，保证数据稳定可复现。
 * 真实运行任务时间戳仍使用 Date.now()。
 */
export const MOCK_NOW: ISODateString = '2026-07-23T10:35:00Z';
export const MOCK_NOW_MS = Date.parse(MOCK_NOW);

/** 相对参考时间偏移分钟数，返回 ISO 字符串。 */
export function minutesAgo(minutes: number): ISODateString {
  return new Date(MOCK_NOW_MS - minutes * 60_000).toISOString();
}