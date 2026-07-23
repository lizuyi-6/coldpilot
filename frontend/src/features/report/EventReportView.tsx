import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { ApprovalLevelBadge } from '@/components/domain/ApprovalLevelBadge';
import { FileText } from 'lucide-react';
import type { UseWorkbench } from '@/state/useWorkbench';
import { formatDateTime } from '@/utils/formatTime';
import styles from '../diagnosis/diagnosis.module.css';

/** 事件报告（简化版）：证据 / 工具 / 审批 / 结果 / 复盘，标注演示数据。 */
export function EventReportView({ wb }: { wb: UseWorkbench }) {
  const report = wb.data.report;
  if (wb.status !== 'recovered' || !report) return null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        <span className={styles.sectionHeading}>
          <FileText size={15} aria-hidden /> 事件报告
        </span>
        <DemoDataBadge kind="demo" />
      </div>

      <p className={styles.sectionHint} style={{ marginBottom: 12 }}>{report.summary}</p>

      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <div className={styles.blockTitle} style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>原因结论</div>
          <ul style={{ paddingLeft: 18, listStyle: 'disc' }} className={styles.sectionHint}>
            {report.causeSummary.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
        <div>
          <div className={styles.blockTitle} style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>调用工具</div>
          <div className={styles.sectionHint}>{report.toolsUsed.join(' · ')}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ApprovalLevelBadge level={report.approval.level} />
          <span className={styles.sectionHint}>{report.approval.decision} · {report.approval.approver}</span>
        </div>
        <div>
          <div className={styles.blockTitle} style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>执行结果</div>
          <div className={styles.sectionHint}>{report.outcome}</div>
        </div>
        <div>
          <div className={styles.blockTitle} style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>后续观察项</div>
          <ul style={{ paddingLeft: 18, listStyle: 'disc' }} className={styles.sectionHint}>
            {report.followUps.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
        <div className={styles.sectionHint}>生成时间 {formatDateTime(report.generatedAt)}</div>
      </div>
    </section>
  );
}