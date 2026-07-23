import type { ControlPlan } from '@/domain/types';

/** 模拟结果：候选控制方案（均为 L2，需人工确认）。L3 动作不在候选方案中。 */
export const CONTROL_PLANS: ControlPlan[] = [
  {
    id: 'plan-a',
    eventId: 'evt-1',
    name: '方案 A · 平滑逼近目标',
    kind: 'recommended',
    approvalLevel: 'L2',
    approach: '平滑逼近目标温度，减少急降、过冲与频繁启停',
    params: [
      { key: 'targetTemp', label: '目标温度', value: 8.0, unit: '℃', bound: { min: 7.5, max: 9.0 } },
      { key: 'rate', label: '变化速率', value: '≤0.5', unit: '℃/h' },
      { key: 'fanMode', label: '风机模式', value: '中速' },
      { key: 'valveOpening', label: '阀门开度', value: 60, unit: '%', bound: { min: 40, max: 80 } },
    ],
    rollbackConditions: ['温度过冲 > 0.8℃ 或 30 分钟未改善 → 回退 PID', 'AI 异常 / 数据中断 → 传统规则兜底'],
    version: 1,
  },
  {
    id: 'plan-b',
    eventId: 'evt-1',
    name: '方案 B · 快速强制降温',
    kind: 'alternative',
    approvalLevel: 'L2',
    approach: '优先快速恢复目标温度，恢复更快但过冲与冻害风险更高',
    params: [
      { key: 'targetTemp', label: '目标温度', value: 7.5, unit: '℃', bound: { min: 7.0, max: 8.5 } },
      { key: 'rate', label: '变化速率', value: '≤1.5', unit: '℃/h' },
      { key: 'fanMode', label: '风机模式', value: '高速' },
      { key: 'valveOpening', label: '阀门开度', value: 85, unit: '%', bound: { min: 60, max: 100 } },
    ],
    rollbackConditions: ['货物温度 < 7.0℃ → 立即回退', '压缩机连续启停异常 → 回退 PID'],
    version: 1,
  },
];