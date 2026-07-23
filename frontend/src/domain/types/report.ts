import type { ISODateString } from './primitives';
import type { ApprovalLevel } from './control';

/** 事件报告（简化版，演示数据）。 */
export interface EventReport {
  id: string;
  eventId: string;
  generatedAt: ISODateString;
  summary: string;
  causeSummary: string[];
  toolsUsed: string[];
  approval: {
    level: ApprovalLevel;
    decision: string;
    approver: string;
  };
  outcome: string;
  followUps: string[];
  provenance: 'demo';
}