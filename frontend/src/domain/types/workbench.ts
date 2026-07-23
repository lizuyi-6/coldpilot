/**
 * 工作台任务状态机的全部状态。
 * 事件列表阶段徽章、诊断主体、方案检查器三处共用，禁止使用独立 boolean 表达。
 */
export type TaskStatus =
  | 'detected'
  | 'diagnosing'
  | 'diagnosisCompleted'
  | 'simulating'
  | 'simulationCompleted'
  | 'awaitingApproval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'verifying'
  | 'recovered'
  | 'diagnosisFailed'
  | 'simulationFailed'
  | 'executionFailed'
  | 'safeFallback';