import type { SafetyCheckItem } from '@/domain/types';

/** 模拟结果：安全规则校验项（对方案 A/B 均通过）。 */
export const SAFETY_CHECKS: SafetyCheckItem[] = [
  { key: 'whitelist', label: '参数白名单', passed: true, detail: '全部参数在白名单内' },
  { key: 'bounds', label: '上下限校验', passed: true, detail: '目标温度在 7.5~9.0℃ 允许区间' },
  { key: 'rate', label: '变化速率校验', passed: true, detail: '变化速率 ≤ 0.5℃/h' },
  { key: 'conflict', label: '冲突检测', passed: true, detail: '无冲突控制指令' },
  { key: 'permission', label: '权限校验', passed: true, detail: '当前角色具备 L2 审批权限' },
];