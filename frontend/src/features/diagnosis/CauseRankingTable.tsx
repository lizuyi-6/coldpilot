import { ConfidenceBar } from '@/components/ui/ConfidenceBar';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { ListOrdered } from 'lucide-react';
import type { UseWorkbench } from '@/state/useWorkbench';
import styles from './diagnosis.module.css';

/** 原因排序：置信度 + 正/反证据 + 排查顺序 + 不确定信息。 */
export function CauseRankingTable({ wb }: { wb: UseWorkbench }) {
  const { data, status } = wb;
  const diagnosis = data.diagnosis;

  if (status === 'detected' || status === 'diagnosing' || status === 'diagnosisFailed') return null;
  if (!diagnosis) return null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        <span className={styles.sectionHeading}>
          <ListOrdered size={15} aria-hidden /> 原因排序
        </span>
        <span className={styles.sectionHint}>{diagnosis.understanding}</span>
      </div>

      <table className={styles.causeTable}>
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th>
            <th>可能原因</th>
            <th style={{ width: 150 }}>置信度</th>
            <th>支持 / 反向证据</th>
            <th style={{ width: 90 }}>排查顺序</th>
          </tr>
        </thead>
        <tbody>
          {diagnosis.causes.map((cause, idx) => (
            <tr key={cause.id}>
              <td className={styles.causeLabel}>{idx + 1}</td>
              <td className={styles.causeLabel}>{cause.label}</td>
              <td>
                <ConfidenceBar value={cause.confidence} />
              </td>
              <td>
                <div className={styles.evidenceList}>
                  {cause.evidence.map((ev) => (
                    <div key={ev.id} className={`${styles.evidence} ${ev.kind === 'supporting' ? styles.evidenceSupport : styles.evidenceCounter}`}>
                      <span className={`${styles.evidenceTag} ${ev.kind === 'supporting' ? styles.tagSupport : styles.tagCounter}`}>
                        {ev.kind === 'supporting' ? '正' : '反'}
                      </span>
                      <span>{ev.summary}</span>
                    </div>
                  ))}
                </div>
              </td>
              <td>
                <span className={styles.triage}>{cause.triageOrder === 1 ? '先查' : cause.triageOrder === 2 ? '次查' : cause.triageOrder === 3 ? '三查' : '排除'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {diagnosis.uncertainties.length > 0 ? (
        <div className={styles.uncertain}>
          <InlineAlert tone="warning" title="尚不确定的信息">
            {diagnosis.uncertainties.join('；')}
          </InlineAlert>
        </div>
      ) : null}
    </section>
  );
}