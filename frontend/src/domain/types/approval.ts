import type { ISODateString } from './primitives';
import type { ApprovalLevel } from './control';

/** 安全规则校验项。 */
export interface SafetyCheckItem {
  key: 'whitelist' | 'bounds' | 'rate' | 'conflict' | 'permission';
  label: string;
  passed: boolean;
  detail?: string;
}

/** 审批决定。 */
export interface ApprovalDecision {
  decision: 'approved' | 'rejected';
  approverId: string;
  reason?: string;
}

/** 审批请求（仅 L2 产生）。 */
export interface ApprovalRequest {
  id: string;
  planId: string;
  planVersion: number;
  level: ApprovalLevel;
  safetyChecks: SafetyCheckItem[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: ISODateString;
  decidedBy?: string;
  decidedAt?: ISODateString;
  reason?: string;
}

/** 审批结果。 */
export interface ApprovalResult {
  requestId: string;
  decision: 'approved' | 'rejected';
  decidedBy: string;
  decidedAt: ISODateString;
}