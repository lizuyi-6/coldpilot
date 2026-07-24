import { useEffect, useMemo, useState } from 'react';
import type { EventReport, SecurityAuditEntry } from '@/domain/types';
import { useAppData } from '@/state/appData';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { Tag } from '@/components/ui/Tag';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { ApprovalLevelBadge } from '@/components/domain/ApprovalLevelBadge';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { formatDateTime } from '@/utils/formatTime';
import { isApiError } from '@/api/apiErrors';
import { ShieldAlert } from 'lucide-react';
import styles from './ReportsAuditPage.module.css';

export default function ReportsAuditPage() {
  const { client, events, loading } = useAppData();
  const [tab, setTab] = useState<'reports' | 'audit'>('reports');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [report, setReport] = useState<EventReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [audit, setAudit] = useState<SecurityAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const recoveredEvents = useMemo(() => events.filter((e) => e.stage === 'recovered'), [events]);
  const eventOptions = events.map((e) => ({ value: e.id, label: `${e.roomName} · ${e.title}` }));

  // 默认选中首个已恢复事件。
  useEffect(() => {
    if (!selectedEventId && recoveredEvents.length > 0) setSelectedEventId(recoveredEvents[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveredEvents]);

  // 加载报告。
  useEffect(() => {
    if (!selectedEventId) return;
    let cancelled = false;
    setReportLoading(true);
    setReportError(null);
    setReport(null);
    void (async () => {
      try {
        const r = await client.getEventReport(selectedEventId);
        if (!cancelled) setReport(r);
      } catch (e) {
        if (!cancelled) setReportError(isApiError(e) ? e.message : '报告不存在或尚未生成');
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, selectedEventId]);

  // 加载审计。
  useEffect(() => {
    if (tab !== 'audit' || !selectedEventId) return;
    let cancelled = false;
    setAuditLoading(true);
    void (async () => {
      try {
        const list = await client.listSecurityAuditEntries(selectedEventId);
        if (!cancelled) setAudit(list);
      } catch {
        if (!cancelled) setAudit([]);
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, tab, selectedEventId]);

  if (loading && events.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonLoader lines={2} />
        <SkeletonLoader lines={4} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="报告与审计"
        description="事件处置报告与安全审计留痕"
        actions={<DemoDataBadge kind="demo" />}
      />

      <div className={styles.toolbar}>
        <Tabs
          items={[{ key: 'reports', label: '事件报告' }, { key: 'audit', label: '安全审计' }]}
          activeKey={tab}
          onChange={(k) => setTab(k as 'reports' | 'audit')}
          ariaLabel="报告与审计切换"
        />
        <span className={styles.toolbarSpacer} />
        <Select ariaLabel="选择事件" options={eventOptions} value={selectedEventId ?? ''} onChange={setSelectedEventId} />
      </div>

      {tab === 'reports' ? (
        reportLoading ? (
          <SkeletonLoader lines={6} />
        ) : reportError ? (
          <EmptyState title="报告不可用" description={reportError + '。事件恢复后将自动生成处置报告。'} />
        ) : report ? (
          <Panel
            title="事件处置报告"
            action={
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <ApprovalLevelBadge level={report.approval.level} />
                <Tag tone="neutral">{formatDateTime(report.generatedAt)}</Tag>
              </span>
            }
          >
            <div className={styles.detailStack}>
              <div>
                <h4 className={styles.sectionTitle}>摘要</h4>
                <p className={styles.note} style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)' }}>{report.summary}</p>
              </div>
              <div>
                <h4 className={styles.sectionTitle}>根因结论</h4>
                <ul className={styles.listPlain}>
                  {report.causeSummary.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className={styles.sectionTitle}>处置结果</h4>
                <p className={styles.note} style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)' }}>{report.outcome}</p>
              </div>
              <div>
                <h4 className={styles.sectionTitle}>审批</h4>
                <DescriptionList
                  items={[
                    { label: '审批等级', value: <ApprovalLevelBadge level={report.approval.level} /> },
                    { label: '决定', value: report.approval.decision },
                    { label: '审批人', value: report.approval.approver },
                  ]}
                />
              </div>
              <div>
                <h4 className={styles.sectionTitle}>后续建议</h4>
                <ul className={styles.listPlain}>
                  {report.followUps.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>
        ) : (
          <EmptyState title="选择一个事件" description="选择已恢复的事件以查看处置报告。" />
        )
      ) : auditLoading ? (
        <SkeletonLoader lines={4} />
      ) : audit.length === 0 ? (
        <EmptyState
          title="无安全审计记录"
          description="该事件未触发 L3 拦截。L3（关联锁 / 越设备保护）动作被尝试时将在此留痕，管理员也不得绕过。"
        />
      ) : (
        <div className={styles.detailStack}>
          {audit.map((entry) => (
            <div key={entry.id} className={styles.auditCard}>
              <div className={styles.auditHead}>
                <span className={styles.auditAction}>
                  <ShieldAlert size={15} style={{ verticalAlign: -2, color: 'var(--color-danger)' }} /> {entry.action}
                </span>
                <Tag tone="danger">已拦截</Tag>
              </div>
              <DescriptionList
                items={[
                  { label: '来源', value: entry.source === 'agent' ? 'Agent' : entry.source === 'user' ? '用户' : '外部' },
                  { label: '尝试时间', value: formatDateTime(entry.attemptedAt) },
                  { label: '触发规则', value: entry.triggeredRule },
                  { label: '原因', value: entry.reason },
                  { label: '审批等级', value: <ApprovalLevelBadge level={entry.approvalLevel} /> },
                  { label: '结果', value: 'blocked（未执行）' },
                  { label: '记录编号', value: entry.id },
                ]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}