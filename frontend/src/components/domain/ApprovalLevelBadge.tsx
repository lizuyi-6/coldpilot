import type { ApprovalLevel } from '@/domain/types';
import { APPROVAL_LEVEL_META } from '@/domain/constants/approvalLevel';
import styles from './ApprovalLevelBadge.module.css';

/** 审批分级徽章：L0~L3，颜色 + 文字 + 描述（tooltip）。 */
export function ApprovalLevelBadge({ level, showDescription = false }: { level: ApprovalLevel; showDescription?: boolean }) {
  const meta = APPROVAL_LEVEL_META[level];
  return (
    <span className={`${styles.wrap}`} title={meta.description}>
      <span className={`${styles.badge} ${styles[meta.token]}`}>{meta.label}</span>
      {showDescription ? <span className={styles.desc}>{meta.description}</span> : null}
    </span>
  );
}