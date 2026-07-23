/** 审批分级。 */
export type ApprovalLevel = 'L0' | 'L1' | 'L2' | 'L3';

/** 受控参数（白名单 + 边界）。 */
export interface ControlParam {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  bound?: { min: number; max: number };
}

/**
 * 候选控制方案。
 * 注意：L3 动作绝不出现在 ControlPlan（L3 单独建模为 SecurityAuditEntry）。
 * 本阶段所有候选方案均为 L2（需人工确认）。
 */
export interface ControlPlan {
  id: string;
  eventId: string;
  name: string;
  kind: 'recommended' | 'alternative';
  approvalLevel: 'L2';
  /** 控制思路，如“平滑逼近目标 / 快速降温”。 */
  approach: string;
  params: ControlParam[];
  rollbackConditions: string[];
  /** 方案版本：审批与执行均绑定版本，方案变化后旧审批失效。 */
  version: number;
}