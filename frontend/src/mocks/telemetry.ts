import type { MetricKey, SensorReading, SensorSeries, SensorStatus } from '@/domain/types';
import { MOCK_NOW_MS, minutesAgo } from './referenceTime';

/** 确定性伪随机（mulberry32），保证演示数据每次渲染一致。 */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WINDOW_MINUTES = 24 * 60;
const STEP_MINUTES = 10;

interface ShapeOptions {
  seed: number;
  base: number;
  amplitude: number;
  /** 返回在时间 t（相对参考时间的分钟偏移，0=现在，负=过去）上的异常抬升量。 */
  lift?: (minuteOffset: number) => number;
}

/** 生成一条 24h、每 10 分钟一个点的时序。 */
function buildPoints(opts: ShapeOptions): SensorReading[] {
  const rand = mulberry32(opts.seed);
  const points: SensorReading[] = [];
  for (let offset = -WINDOW_MINUTES; offset <= 0; offset += STEP_MINUTES) {
    const wave = Math.sin((offset / 60) * 1.3) * opts.amplitude;
    const noise = (rand() - 0.5) * opts.amplitude * 0.6;
    const lift = opts.lift ? opts.lift(offset) : 0;
    const value = round2(opts.base + wave + noise + lift);
    points.push({ t: new Date(MOCK_NOW_MS + offset * 60_000).toISOString(), value });
  }
  return points;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function series(
  roomId: string,
  metric: MetricKey,
  unit: string,
  opts: ShapeOptions,
  status: SensorStatus = 'online',
  target?: SensorSeries['target'],
): SensorSeries {
  const points = buildPoints(opts);
  return {
    roomId,
    metric,
    unit,
    points,
    target,
    status,
    lastSampleAt: minutesAgo(2),
  };
}

/** 1 号辣椒库：09:15 起温度持续爬升越界（演示数据）。 */
function chiliLift(offset: number): number {
  // offset 单位：分钟；0=现在(10:35)，-80=09:15。
  if (offset >= 0) return 1.8; // 现在已明显高于基线
  const minutesSinceOnset = offset + 80; // 09:15 为 0
  if (minutesSinceOnset >= 0) {
    // 09:15 -> 现在，从 0 平滑升至 ~1.8
    const progress = Math.min(minutesSinceOnset / 80, 1);
    return round2(1.8 * progress);
  }
  // 08:45 入库 / 08:50-09:05 开门前的预热小幅抬升
  if (offset > -110) {
    return round2(0.3 * ((offset + 110) / 30));
  }
  return 0;
}

/** 2 号芒果库：湿度偏高（演示数据）。 */
function humidLift(offset: number): number {
  const minutesSinceOnset = offset + 25; // 25 分钟前开始抬升
  return minutesSinceOnset >= 0 ? Math.min(minutesSinceOnset / 25, 1) * 8 : 0;
}

const ROOM1_TARGET = { metric: 'temperature' as const, min: 8, max: 10, unit: '℃' };
const ROOM2_TARGET = { metric: 'temperature' as const, min: 10, max: 13, unit: '℃' };
const ROOM3_TARGET = { metric: 'temperature' as const, min: 0, max: 2, unit: '℃' };

/** 各库房多指标时序。 */
export const TELEMETRY: Record<string, SensorSeries[]> = {
  'room-1': [
    series('room-1', 'temperature', '℃', { seed: 11, base: 8.8, amplitude: 0.4, lift: chiliLift }, 'online', ROOM1_TARGET),
    series('room-1', 'humidity', '%RH', { seed: 12, base: 90, amplitude: 2.5 }),
    series('room-1', 'o2', '%', { seed: 13, base: 3.1, amplitude: 0.4 }),
    series('room-1', 'co2', '%', { seed: 14, base: 8.5, amplitude: 0.8 }),
    series('room-1', 'pressureDiff', 'Pa', { seed: 15, base: 12, amplitude: 1.5 }),
  ],
  'room-2': [
    series('room-2', 'temperature', '℃', { seed: 21, base: 11.5, amplitude: 0.5 }, 'online', ROOM2_TARGET),
    series('room-2', 'humidity', '%RH', { seed: 22, base: 82, amplitude: 2, lift: humidLift }, 'online'),
  ],
  'room-3': [
    series('room-3', 'temperature', '℃', { seed: 31, base: 1, amplitude: 0.3 }, 'online', ROOM3_TARGET),
    series('room-3', 'pressureDiff', 'Pa', { seed: 32, base: 8, amplitude: 1 }),
  ],
};