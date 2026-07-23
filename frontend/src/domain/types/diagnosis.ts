/** 诊断证据（正/反）。 */
export interface DiagnosticEvidence {
  id: string;
  kind: 'supporting' | 'counter';
  summary: string;
  /** 证据来源（工具 / 数据引用）。 */
  sourceRef: string;
}

/** 单个候选原因。 */
export interface DiagnosticCause {
  id: string;
  label: string;
  /** 置信度 0~1。 */
  confidence: number;
  evidence: DiagnosticEvidence[];
  /** 排查顺序（1 最优先）。 */
  triageOrder: number;
  recommendedChecks: string[];
}

/** 原因诊断结果。 */
export interface DiagnosisResult {
  eventId: string;
  /** 任务理解。 */
  understanding: string;
  /** 使用的数据源。 */
  dataSources: string[];
  causes: DiagnosticCause[];
  /** 尚不确定的信息。 */
  uncertainties: string[];
}