import type { EventReport } from '@/domain/types';
import { minutesAgo } from './referenceTime';

/** 演示数据：事件报告（简化版）。 */
export const EVENT_REPORTS: Record<string, EventReport> = {
  'evt-1': {
    id: 'report-evt-1',
    eventId: 'evt-1',
    generatedAt: minutesAgo(0),
    summary: '1 号辣椒库持续高温事件已完成处置：定位为入库热量负荷为主因，经人工审批执行平滑逼近方案后恢复至目标区间。',
    causeSummary: ['入库热量负荷（置信度 0.68）', '库门长时间开启（置信度 0.55）', '压缩机效率下降（置信度 0.32）'],
    toolsUsed: ['读取实时数据', '查询库门记录', '查询设备日志', '检索知识库', '检索历史案例'],
    approval: { level: 'L2', decision: '已批准', approver: '冷库管理员' },
    outcome: '温度恢复至 8.0℃，未发生过冲与冻害，恢复用时约 6.2 小时（仿真结果）。',
    followUps: ['入库货物建议预冷后入库', '安排压缩机效率检查', '确认传感器校准时间'],
    provenance: 'demo',
  },
};