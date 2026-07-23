import type { AgentTask, DiagnosisResult, ToolInvocation } from '@/domain/types';
import { minutesAgo } from './referenceTime';

/** 模拟结果：Agent 诊断工具调用序列（演示主线）。 */
export const DIAGNOSIS_TOOLS: ToolInvocation[] = [
  { id: 'tool-1', name: 'telemetry.query', label: '读取实时数据', inputSummary: 'room-1 · 温度/湿度/气体 · 近24h', outputSummary: '温度自 09:15 由 9.0℃ 升至 10.6℃，超出目标上限', durationMs: 320, status: 'succeeded' },
  { id: 'tool-2', name: 'doorlog.query', label: '查询库门记录', inputSummary: 'room-1 · 库门开关事件', outputSummary: '08:50–09:05 库门开启约 15 分钟', durationMs: 180, status: 'succeeded' },
  { id: 'tool-3', name: 'devicelog.query', label: '查询设备日志', inputSummary: 'room-1 · 压缩机/风机/阀门', outputSummary: '压缩机效率 78%（偏低），排气温度 86℃ 偏高', durationMs: 260, status: 'succeeded' },
  { id: 'tool-4', name: 'knowledge.search', label: '检索知识库', inputSummary: '辣椒保鲜 · 高温处置 SOP', outputSummary: '匹配 3 条：入库热量 / 库门扰动 / 制冷效率下降', durationMs: 410, status: 'succeeded' },
  { id: 'tool-5', name: 'cases.search', label: '检索历史案例', inputSummary: '相似高温事件 · 近90天', outputSummary: '相似案例 2 起，主因均为入库热量 + 库门扰动', durationMs: 350, status: 'succeeded' },
];

/** 模拟结果：1 号辣椒库持续高温原因诊断（含正/反证据与不确定项）。 */
export const DIAGNOSIS_RESULT: DiagnosisResult = {
  eventId: 'evt-1',
  understanding: '分析 1 号辣椒库温度持续高于目标区间的原因，并给出安全、节能的处理方向。',
  dataSources: ['实时传感器', '库门记录', '设备日志', '冷库知识库', '历史案例'],
  causes: [
    {
      id: 'cause-1',
      label: '入库热量负荷',
      confidence: 0.68,
      triageOrder: 1,
      evidence: [
        { id: 'ev-1a', kind: 'supporting', summary: '08:45 入库 0.8t 常温辣椒，库温随后开始上升', sourceRef: 'telemetry.query' },
        { id: 'ev-1b', kind: 'supporting', summary: '入库后 30 分钟内库温上升约 0.8℃', sourceRef: 'cases.search' },
      ],
      recommendedChecks: ['确认入库货物预冷情况', '评估是否分批入库'],
    },
    {
      id: 'cause-2',
      label: '库门长时间开启',
      confidence: 0.55,
      triageOrder: 2,
      evidence: [
        { id: 'ev-2a', kind: 'supporting', summary: '08:50–09:05 库门开启约 15 分钟，与升温时段重合', sourceRef: 'doorlog.query' },
        { id: 'ev-2b', kind: 'counter', summary: '开门时长在该库属常见作业范围', sourceRef: 'knowledge.search' },
      ],
      recommendedChecks: ['检查库门密封条与闭门器'],
    },
    {
      id: 'cause-3',
      label: '压缩机效率下降',
      confidence: 0.32,
      triageOrder: 3,
      evidence: [
        { id: 'ev-3a', kind: 'supporting', summary: '压缩机效率 78%，排气温度 86℃ 偏高', sourceRef: 'devicelog.query' },
        { id: 'ev-3b', kind: 'counter', summary: '功率与制冷量仍在安全边界内', sourceRef: 'telemetry.query' },
      ],
      recommendedChecks: ['核对吸气/排气压力', '必要时安排维保'],
    },
    {
      id: 'cause-4',
      label: '风机风量不足',
      confidence: 0.21,
      triageOrder: 4,
      evidence: [
        { id: 'ev-4a', kind: 'counter', summary: '风机运行正常，送风均匀，风量无明显异常', sourceRef: 'devicelog.query' },
      ],
      recommendedChecks: ['暂无需处理，可排除'],
    },
  ],
  uncertainties: ['传感器上次校准时间未知，需人工确认', '入库货物初始温度未记录'],
};

/** 生成一个初始的 Agent 诊断任务（running）。 */
export function buildAgentTask(taskId: string, eventId: string): AgentTask {
  return {
    id: taskId,
    eventId,
    goal: '分析 1 号辣椒库温度升高的原因，给出安全、节能的处理方案',
    status: 'running',
    tools: [],
    startedAt: minutesAgo(0),
  };
}