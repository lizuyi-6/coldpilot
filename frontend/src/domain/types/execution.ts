import type { ISODateString } from './primitives';
import type { SensorReading } from './sensor';

/** 执行任务状态（轮询）。 */
export type ExecutionStatus = 'queued' | 'executing' | 'verifying' | 'recovered' | 'failed';

/** 执行与验证任务（仿真执行结果，恒为 simulated）。 */
export interface ExecutionTask {
  id: string;
  planId: string;
  planVersion: number;
  status: ExecutionStatus;
  /** 执行过程中的观测温度曲线。 */
  observedSeries: SensorReading[];
  startedAt: ISODateString;
  finishedAt?: ISODateString;
  /** 恢复用时（分钟），验证成功时给出。 */
  recoveryMinutes?: number;
  /** 执行失败时触发的回退条件。 */
  triggeredRollback?: string;
  provenance: 'simulated';
}