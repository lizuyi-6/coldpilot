import type { ApprovalLevel } from '../types/control';

interface ApprovalLevelMeta {
  label: string;
  description: string;
  /** 对应 tokens.css 中的 --level-* 变量名后缀。 */
  token: 'l0' | 'l1' | 'l2' | 'l3';
}

export const APPROVAL_LEVEL_META: Record<ApprovalLevel, ApprovalLevelMeta> = {
  L0: { label: 'L0', description: '读取数据 / 查询知识 / 生成报告 · 自动执行并记录', token: 'l0' },
  L1: { label: 'L1', description: '运行仿真 / 调整非关键展示参数 · 自动执行并记录', token: 'l1' },
  L2: { label: 'L2', description: '调整目标温度 / 风机模式 / 阀门开度 · 必须人工确认', token: 'l2' },
  L3: { label: 'L3', description: '关联锁 / 越设备保护范围 · 系统永久禁止执行', token: 'l3' },
};