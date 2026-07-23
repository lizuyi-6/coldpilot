import type { SecurityAuditEntry } from '@/domain/types';
import { minutesAgo } from './referenceTime';

/**
 * 演示数据：安全审计记录。
 * L3 动作（关联锁 / 越设备保护）被安全规则引擎拦截，仅生成审计记录，不产生审批或执行。
 */
export const SECURITY_AUDIT: Record<string, SecurityAuditEntry[]> = {
  'evt-1': [
    {
      id: 'audit-1',
      eventId: 'evt-1',
      category: 'blocked_action',
      action: '关闭压缩机联锁保护以强制满负荷降温',
      source: 'agent',
      attemptedAt: minutesAgo(50),
      approvalLevel: 'L3',
      triggeredRule: 'RULE-SAFETY-001 · 禁止越过设备保护范围',
      reason: '该动作试图越过 PLC 联锁与设备保护机制，属于 L3 永久禁止项',
      outcome: 'blocked',
    },
  ],
};