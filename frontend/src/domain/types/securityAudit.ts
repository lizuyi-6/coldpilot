import type { ISODateString } from './primitives';

/**
 * 安全审计记录。
 * L3（关联锁 / 越设备保护）动作不是 ControlPlan，不产生审批与执行，
 * 仅在被尝试时生成一条 SecurityAuditEntry。管理员也不得绕过。
 */
export interface SecurityAuditEntry {
  id: string;
  eventId: string;
  category: 'blocked_action';
  /** 被拦截的动作描述，如“关闭压缩机联锁”。 */
  action: string;
  source: 'agent' | 'user' | 'external';
  attemptedAt: ISODateString;
  approvalLevel: 'L3';
  /** 触发的安全规则。 */
  triggeredRule: string;
  reason: string;
  outcome: 'blocked';
}