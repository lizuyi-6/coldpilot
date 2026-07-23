import type { ISODateString } from './primitives';

/** Agent 任务状态（轮询）。 */
export type AgentTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** 一次工具调用。 */
export interface ToolInvocation {
  id: string;
  name: string;
  label: string;
  inputSummary: string;
  outputSummary: string;
  durationMs: number;
  status: 'succeeded' | 'failed';
}

/** Agent 诊断任务。 */
export interface AgentTask {
  id: string;
  eventId: string;
  goal: string;
  status: AgentTaskStatus;
  tools: ToolInvocation[];
  startedAt: ISODateString;
  finishedAt?: ISODateString;
}