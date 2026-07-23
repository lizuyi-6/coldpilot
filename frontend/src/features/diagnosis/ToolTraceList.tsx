import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, Wrench, XCircle } from 'lucide-react';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import type { UseWorkbench } from '@/state/useWorkbench';
import styles from './diagnosis.module.css';

/** Agent 工具调用轨迹：默认精简，渐进式披露输入/输出/耗时。 */
export function ToolTraceList({ wb }: { wb: UseWorkbench }) {
  const { data, status } = wb;
  const [expanded, setExpanded] = useState(false);
  const tools = data.agentTask?.tools ?? [];
  const running = status === 'diagnosing';

  if (status === 'detected') return null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        <span className={styles.sectionHeading}>
          <Wrench size={15} aria-hidden /> Agent 工具调用
        </span>
        {tools.length > 0 ? (
          <button className={styles.sectionHint} onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            {expanded ? '收起' : '展开输入/输出'}
          </button>
        ) : null}
      </div>

      {running && tools.length === 0 ? <SkeletonLoader lines={3} /> : null}

      {tools.map((tool) => (
        <div key={tool.id} className={styles.toolRow}>
          <div className={styles.toolMain}>
            {tool.status === 'succeeded' ? (
              <CheckCircle2 size={15} color="var(--color-success)" aria-hidden />
            ) : tool.status === 'failed' ? (
              <XCircle size={15} color="var(--color-danger)" aria-hidden />
            ) : (
              <Loader2 size={15} aria-hidden />
            )}
            <span className={styles.toolLabel}>{tool.label}</span>
            <span className={styles.toolMeta}>{tool.name} · {tool.durationMs}ms</span>
          </div>
          {expanded ? (
            <div className={styles.toolDetail}>
              <div><span>输入：</span>{tool.inputSummary}</div>
              <div><span>输出：</span>{tool.outputSummary}</div>
            </div>
          ) : null}
        </div>
      ))}
      {running ? <div className={styles.sectionHint}>诊断进行中，正在调用工具…</div> : null}
    </section>
  );
}