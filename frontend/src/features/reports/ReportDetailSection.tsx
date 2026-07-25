import { useMemo } from 'react';
import { X } from 'lucide-react';
import type { AnomalyEventDetail, SecurityAuditEntry } from '@/domain/types';
import type { ReportRow } from './reportsView';
import { executionResultOf, recoveryResultOf } from './reportsView';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { Tag } from '@/components/ui/Tag';
import { IconButton } from '@/components/ui/IconButton';
import { ApprovalLevelBadge } from '@/components/domain/ApprovalLevelBadge';
import { formatDateTimeISO, formatDuration, formatTimeHM } from '@/utils/formatTime';
import styles from './reports.module.css';

interface ReportDetailSectionProps {
  row: ReportRow;
  /** 事件详情（库房事件 + 遥测），加载失败为 null。 */
  detail: AnomalyEventDetail | null;
  /** 该事件的 L3 拦截记录。 */
  auditEntries: SecurityAuditEntry[];
  onViewAudit: () => void;
  onClose: () => void;
}

interface TimelineItem {
  at: string;
  label: string;
  detail?: string;
}

/** 最大温度偏差：由事件遥测相对目标区间真实计算（估算）。 */
function maxDeviation(detail: AnomalyEventDetail | null): string | null {
  const series = detail?.telemetry.find((item) => item.metric === 'temperature' && item.target);
  if (!series || !series.target) return null;
  let peak = 0;
  for (const point of series.points) {
    const above = point.value - series.target.max;
    const below = series.target.min - point.value;
    peak = Math.max(peak, above, below);
  }
  return peak > 0 ? `+${peak.toFixed(1)} ℃（估算）` : '未越限';
}

/** 报告详情区：摘要 / 时间线 / 后续观察 / 审计预览 四列。 */
export function ReportDetailSection({ row, detail, auditEntries, onViewAudit, onClose }: ReportDetailSectionProps) {
  const { event, report } = row;
  const execution = executionResultOf(event.stage);
  const recovery = recoveryResultOf(event.stage);
  const deviation = maxDeviation(detail);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [{ at: event.startedAt, label: '异常触发', detail: event.title }];
    for (const marker of detail?.roomEvents ?? []) {
      items.push({ at: marker.at, label: marker.label, detail: marker.detail });
    }
    if (report) {
      items.push({
        at: report.generatedAt,
        label: '处置报告生成',
        detail: `审批 ${report.approval.decision} · ${report.approval.approver}（${report.approval.level}）`,
      });
    }
    return items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }, [event, detail, report]);

  return (
    <div className={styles.detailGrid}>
      {/* 摘要 */}
      <section className={styles.detailCol} aria-label="报告摘要">
        <h4 className={styles.detailColTitle}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {event.title}
            <SeverityTag severity={event.severity} />
          </span>
          <IconButton aria-label="关闭详情" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </h4>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>事件 ID</span>
            <span className={styles.summaryValue}>{event.id}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>冷库</span>
            <span className={styles.summaryValue}>{event.roomName}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>发生时间</span>
            <span className={styles.summaryValue}>{formatDateTimeISO(event.startedAt)}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>持续时长</span>
            <span className={styles.summaryValue}>{formatDuration(event.durationMinutes)}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>最大温度偏差</span>
            <span className={styles.summaryValue}>{deviation ?? '暂无数据'}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>经济影响</span>
            <span className={styles.summaryValue}>暂无数据</span>
          </div>
        </div>
        <div className={styles.summaryBlock}>
          <span className={styles.summaryLabel}>原因结论</span>
          {report ? (
            <ul className={styles.observeList}>
              {report.causeSummary.map((cause, index) => (
                <li key={index}>{cause}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.summaryText}>报告未生成，原因结论暂无数据。</p>
          )}
        </div>
        <div className={styles.summaryBlock}>
          <span className={styles.summaryLabel}>处理方案</span>
          <p className={styles.summaryText}>{report?.summary ?? '报告未生成，处理方案暂无数据。'}</p>
        </div>
        <div className={styles.summaryBlock}>
          <span className={styles.summaryLabel}>执行 / 恢复结果</span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <Tag tone={execution.tone}>{execution.label}</Tag>
            <Tag tone={recovery.tone}>{recovery.label}</Tag>
          </span>
        </div>
        {report && (
          <div className={styles.summaryBlock}>
            <span className={styles.summaryLabel}>审批</span>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <ApprovalLevelBadge level={report.approval.level} />
              <span className={styles.summaryText}>
                {report.approval.decision} · {report.approval.approver}
              </span>
            </span>
          </div>
        )}
      </section>

      {/* 事件时间线 */}
      <section className={styles.detailCol} aria-label="事件时间线">
        <h4 className={styles.detailColTitle}>事件时间线</h4>
        <ol className={styles.timeline}>
          {timeline.map((item, index) => (
            <li key={index} className={styles.timelineItem}>
              <span className={styles.timelineTime}>{formatTimeHM(item.at)}</span>
              <span className={styles.timelineDot} aria-hidden />
              <span className={styles.timelineBody}>
                <span className={styles.timelineLabel}>{item.label}</span>
                {item.detail && <span className={styles.timelineDetail}>{item.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
        <p className={styles.note}>仅展示后端记录的时间节点；告警通知、审批与恢复完成时间未单独记录。</p>
      </section>

      {/* 后续观察 */}
      <section className={styles.detailCol} aria-label="后续观察">
        <h4 className={styles.detailColTitle}>后续观察</h4>
        <div className={styles.summaryBlock}>
          <span className={styles.summaryLabel}>建议措施</span>
          {report && report.followUps.length > 0 ? (
            <ul className={styles.observeList}>
              {report.followUps.map((followUp, index) => (
                <li key={index}>{followUp}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.summaryText}>暂无数据</p>
          )}
        </div>
        <div className={styles.summaryBlock}>
          <span className={styles.summaryLabel}>观察时长 / 结论</span>
          <p className={styles.summaryText}>暂无数据（后端未记录观察期信息）</p>
        </div>
        <div className={styles.summaryBlock}>
          <span className={styles.summaryLabel}>附件</span>
          <p className={styles.summaryText}>暂无数据（无附件接口；如下发仅展示文件信息，不提供下载）</p>
        </div>
      </section>

      {/* 审计日志预览 */}
      <section className={styles.detailCol} aria-label="审计日志预览">
        <h4 className={styles.detailColTitle}>
          审计日志（预览）
          <button type="button" className={styles.detailLink} onClick={onViewAudit}>
            查看更多
          </button>
        </h4>
        {auditEntries.length === 0 ? (
          <p className={styles.summaryText}>该事件无 L3 拦截记录。L3（联锁 / 越设备保护）动作被尝试时将在此留痕。</p>
        ) : (
          <div className={styles.auditPreviewList}>
            {auditEntries.map((entry) => (
              <div key={entry.id} className={styles.auditPreviewItem}>
                <span className={styles.auditPreviewTime}>{formatTimeHM(entry.attemptedAt)}</span>
                <span className={styles.auditPreviewAction} title={entry.action}>
                  {entry.action}
                </span>
                <Tag tone="danger">已拦截</Tag>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
