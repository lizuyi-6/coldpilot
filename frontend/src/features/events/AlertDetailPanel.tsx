import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnomalyEventSummary, EventReport } from '@/domain/types';
import { X } from 'lucide-react';
import { useAppData, type RoomBundle } from '@/state/appData';
import { TASK_STATUS_META } from '@/domain/constants/taskStatus';
import { isApiError } from '@/api/apiErrors';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { Tag, type TagTone } from '@/components/ui/Tag';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { MetricChart } from '@/components/domain/MetricChart';
import { formatDateTimeISO, formatDuration, formatTimeHM } from '@/utils/formatTime';
import { alertReading, approvalState, readingAtStart, STAGE_GROUP_LABEL, stageGroup } from './eventsView';
import styles from './events.module.css';

interface TimelineNode {
  key: string;
  title: string;
  time: string;
  detail?: string;
  color: string;
}

/** 详情时间线：告警触发（含触发读数）→ 现场事件 → 当前阶段。全部由真实数据派生。 */
function buildTimeline(event: AnomalyEventSummary, bundle: RoomBundle | undefined): TimelineNode[] {
  const nodes: TimelineNode[] = [];
  const triggerReading = readingAtStart(event, bundle);
  nodes.push({
    key: 'trigger',
    title: '告警触发',
    time: formatTimeHM(event.startedAt),
    detail: triggerReading ? `${event.title} · ${triggerReading}` : event.title,
    color: 'var(--color-danger)',
  });

  const startMs = Date.parse(event.startedAt);
  const endMs = startMs + event.durationMinutes * 60_000;
  const related = (bundle?.roomEvents ?? [])
    .filter((roomEvent) => {
      const at = Date.parse(roomEvent.at);
      return at >= startMs - 30 * 60_000 && at <= Math.max(endMs, startMs);
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  related.forEach((roomEvent) => {
    nodes.push({
      key: roomEvent.id,
      title: roomEvent.label,
      time: formatTimeHM(roomEvent.at),
      detail: roomEvent.detail,
      color: 'var(--color-info)',
    });
  });

  nodes.push({
    key: 'stage',
    title: `当前阶段：${TASK_STATUS_META[event.stage].label}`,
    time: '至今',
    detail: event.awaitingApproval ? 'L2 控制方案等待人工审批' : undefined,
    color: event.stage === 'recovered' ? 'var(--color-success)' : 'var(--color-warning)',
  });
  return nodes;
}

/** 处理建议：已恢复事件可读取事件报告（真实接口）；否则说明来源，不伪造建议内容。 */
function useReportAdvice(event: AnomalyEventSummary | null) {
  const { client } = useAppData();
  const [report, setReport] = useState<EventReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    setReport(null);
    setReportError(null);
    if (!event || event.stage !== 'recovered') return;
    let cancelled = false;
    setLoadingReport(true);
    client
      .getEventReport(event.id)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setReportError(isApiError(error) ? error.message : '报告读取失败');
      })
      .finally(() => {
        if (!cancelled) setLoadingReport(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, event]);

  return { report, reportError, loadingReport };
}

function approvalTone(event: AnomalyEventSummary): TagTone {
  const state = approvalState(event);
  if (state === 'pending') return 'warning';
  if (state === 'approved') return 'success';
  if (state === 'rejected') return 'danger';
  return 'neutral';
}

interface AlertDetailContentProps {
  event: AnomalyEventSummary;
  bundle: RoomBundle | undefined;
}

/** 详情内容（不含 Panel/Drawer 外壳），供侧栏与窄屏 Drawer 两种容器复用。 */
export function AlertDetailContent({ event, bundle }: AlertDetailContentProps) {
  const navigate = useNavigate();
  const { report, reportError, loadingReport } = useReportAdvice(event);
  const timeline = useMemo(() => buildTimeline(event, bundle), [event, bundle]);
  const reading = alertReading(event, bundle);
  const approval = approvalState(event);

  return (
    <div className={styles.detail}>
      <div className={styles.detailTitle}>
        <SeverityTag severity={event.severity} />
        {event.title}
        <Tag tone={approvalTone(event)}>
          {approval === 'pending' ? '待审批' : STAGE_GROUP_LABEL[stageGroup(event.stage)]}
        </Tag>
      </div>

        <DescriptionList
          labelWidth={64}
          items={[
            { label: '库房', value: event.roomName },
            {
              label: '设备',
              value: (
                <span className={styles.unavailable} title="事件与设备的关联暂未由后端提供">
                  暂无数据
                </span>
              ),
            },
            { label: '开始时间', value: <span className="numeric">{formatDateTimeISO(event.startedAt)}</span> },
            { label: '持续时长', value: formatDuration(event.durationMinutes) },
            { label: '告警ID', value: <span className="numeric">{event.id}</span> },
            {
              label: '责任人',
              value: (
                <span className={styles.unavailable} title="责任人模块待接入用户权限系统">
                  暂无数据
                </span>
              ),
            },
          ]}
        />

        <section aria-label="当前读数">
          <h4 className={styles.sectionTitle}>当前读数</h4>
          <div className={styles.readingRow}>
            <span className={`${styles.readingValue} ${reading.outOfRange ? styles.readingValueOut : ''}`}>
              {reading.valueText}
            </span>
            <span
              className={styles.readingTarget}
              title={reading.targetFromBackend ? '目标区间来自后端下发' : '经验参考区间（非后端下发）'}
            >
              目标范围：{reading.targetText}
              {reading.targetFromBackend ? '' : '（参考）'}
            </span>
          </div>
          {reading.series && reading.series.points.length > 0 && (
            <MetricChart
              series={reading.series.points.slice(-36)}
              unit={reading.series.unit}
              target={reading.series.target}
              height={120}
            />
          )}
        </section>

        <section aria-label="告警时间线">
          <h4 className={styles.sectionTitle}>告警时间线</h4>
          <div className={styles.timeline}>
            {timeline.map((node) => (
              <div key={node.key} className={styles.timelineItem}>
                <span className={styles.timelineRail} aria-hidden />
                <span className={styles.timelineDot} style={{ background: node.color }} aria-hidden />
                <div className={styles.timelineBody}>
                  <div className={styles.timelineTop}>
                    <span className={styles.timelineTitle}>{node.title}</span>
                    <span className={styles.timelineTime}>{node.time}</span>
                  </div>
                  {node.detail && <span className={styles.timelineDetail}>{node.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="处理建议">
          <h4 className={styles.sectionTitle}>处理建议</h4>
          {event.stage === 'recovered' ? (
            loadingReport ? (
              <p className={styles.unavailable}>报告读取中…</p>
            ) : reportError ? (
              <InlineAlert tone="danger" title="报告读取失败">
                {reportError}
              </InlineAlert>
            ) : report ? (
              <ol className={styles.adviceList}>
                {report.followUps.map((followUp) => (
                  <li key={followUp}>{followUp}</li>
                ))}
              </ol>
            ) : (
              <p className={styles.unavailable}>暂无数据</p>
            )
          ) : (
            <p className={styles.unavailable}>
              处理建议由 Agent 诊断生成。进入诊断工作台完成原因诊断后，将给出候选处理方案（L2，需人工审批）。
            </p>
          )}
        </section>

        <div className={styles.detailActions}>
          <Button variant="primary" size="md" onClick={() => navigate(`/workbench/${event.id}`)}>
            处理
          </Button>
          <Button
            variant="secondary"
            size="md"
            disabled
            title="确认并转交流程暂未接入后端接口，暂不可用"
          >
            确认并转交
          </Button>
          <Button
            variant="secondary"
            size="md"
            disabled
            title="误报关闭接口暂未接入后端，暂不可用"
          >
            误报关闭
          </Button>
        </div>
    </div>
  );
}

interface AlertDetailPanelProps {
  event: AnomalyEventSummary | null;
  bundle: RoomBundle | undefined;
  onClose: () => void;
}

/** 侧栏详情（宽屏容器）：Panel 外壳 + 关闭按钮。 */
export function AlertDetailPanel({ event, bundle, onClose }: AlertDetailPanelProps) {
  if (!event) {
    return (
      <Panel title="告警详情">
        <EmptyState title="选择一条告警" description="点击列表中的告警查看详情与处理入口。" />
      </Panel>
    );
  }
  return (
    <Panel
      title="告警详情"
      action={
        <IconButton aria-label="关闭详情" onClick={onClose}>
          <X size={16} />
        </IconButton>
      }
    >
      <AlertDetailContent event={event} bundle={bundle} />
    </Panel>
  );
}
