import { InlineAlert } from '@/components/ui/InlineAlert';
import { Button } from '@/components/ui/Button';
import { ShieldAlert } from 'lucide-react';
import type { UseWorkbench } from '@/state/useWorkbench';
import { EventHeader } from './EventHeader';
import { TrendSection } from './TrendSection';
import { FactStrip } from './FactStrip';
import { ToolTraceList } from './ToolTraceList';
import { CauseRankingTable } from './CauseRankingTable';
import { TaskComposer } from './TaskComposer';
import { ExecutionMonitor } from '@/features/execution/ExecutionMonitor';
import { EventReportView } from '@/features/report/EventReportView';
import styles from './diagnosis.module.css';

/** 中栏：异常诊断主体（结构化呈现，非聊天流）。 */
export function DiagnosisPane({ wb }: { wb: UseWorkbench }) {
  const { status } = wb;

  return (
    <div className={styles.pane}>
      <EventHeader wb={wb} />

      {status === 'safeFallback' ? (
        <div className={styles.section}>
          <InlineAlert tone="danger" title="安全模式">
            <ShieldAlert size={14} aria-hidden style={{ verticalAlign: -2 }} />{' '}
            {wb.context.error ?? '已进入安全模式'}。AI 控制已置灰，系统回退传统规则 / PID 兜底，需要人工介入。
          </InlineAlert>
          <div style={{ marginTop: 12 }}>
            <Button variant="secondary" onClick={() => void wb.resetDemo()}>退出安全模式并重置演示</Button>
          </div>
        </div>
      ) : null}

      {status === 'diagnosisFailed' ? (
        <div className={styles.section}>
          <InlineAlert tone="danger" title="诊断失败">
            {wb.context.error ?? '诊断任务失败'}。可点击“重新诊断”重试。
          </InlineAlert>
        </div>
      ) : null}

      <TrendSection wb={wb} />
      <FactStrip wb={wb} />
      <ToolTraceList wb={wb} />
      <CauseRankingTable wb={wb} />
      <ExecutionMonitor wb={wb} />
      <EventReportView wb={wb} />

      <TaskComposer wb={wb} />
    </div>
  );
}