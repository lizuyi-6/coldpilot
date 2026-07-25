import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { AnomalyEventSummary, MetricKey } from '@/domain/types';
import type { UseWorkbench } from '@/state/useWorkbench';
import { METRIC_META } from '@/domain/constants/metrics';
import { deviceStatusLabel, latestValue } from '@/domain/viewModels';
import { DEVICE_KIND_ICON } from '@/components/domain/deviceMeta';
import { Sparkline } from '@/components/domain/Sparkline';
import { Panel } from '@/components/ui/Panel';
import { Tag } from '@/components/ui/Tag';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDuration, formatTimeHM } from '@/utils/formatTime';
import styles from './agent.module.css';

/** 环境概览卡片顺序（参照效果图：库温 / 湿度 / CO₂ / 压差）。 */
const ENV_METRICS: MetricKey[] = ['temperature', 'humidity', 'co2', 'pressureDiff'];

const CONTROL_MODE_LABEL: Record<string, string> = {
  ai_assisted: 'AI 辅助运行',
  manual: '人工运行',
  safe_fallback: '安全回退',
};

interface AgentContextPaneProps {
  wb: UseWorkbench;
  events: AnomalyEventSummary[];
  selectedEventId: string | null;
  onSelect: (eventId: string) => void;
}

/** 右栏：冷库与环境概览 + 当前所诊冷库 + 近 7 天关联异常。 */
export function AgentContextPane({ wb, events, selectedEventId, onSelect }: AgentContextPaneProps) {
  const navigate = useNavigate();
  const detail = wb.data.eventDetail;
  const telemetry = useMemo(() => detail?.telemetry ?? [], [detail]);
  const room = detail?.room;
  const devices = detail?.devices ?? [];

  const envCards = ENV_METRICS.map((metric) => {
    const series = telemetry.find((s) => s.metric === metric);
    if (!series) return null;
    const value = latestValue(series);
    const outOfRange = value !== null && series.target ? value < series.target.min || value > series.target.max : false;
    return { metric, series, value, outOfRange };
  }).filter((card) => card !== null);

  const related = useMemo(
    () => [...events].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, 6),
    [events],
  );

  return (
    <>
      <Panel title="冷库与环境概览">
        {envCards.length === 0 ? (
          <EmptyState title="暂无环境数据" description="事件详情加载后展示环境指标。" />
        ) : (
          <div className={styles.envGrid}>
            {envCards.map((card) => (
              <div key={card.metric} className={styles.envCard}>
                <span className={styles.envLabel}>{card.metric === 'temperature' ? '库温' : METRIC_META[card.metric].label}</span>
                <span className={styles.envValueRow}>
                  <span className={`${styles.envValue} ${card.outOfRange ? styles.envValueOut : ''}`}>
                    {card.value === null ? '—' : card.value.toFixed(1)}
                  </span>
                  <span className={styles.envUnit}>{card.series.unit}</span>
                </span>
                <span className={styles.envTarget}>
                  {card.series.target ? `目标 ${card.series.target.min}~${card.series.target.max} ${card.series.target.unit}` : '目标暂无数据'}
                </span>
                <span className={styles.envSpark}>
                  <Sparkline points={card.series.points} width={96} height={20} />
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="当前所诊冷库"
        action={room ? <Tag tone={room.controlMode === 'safe_fallback' ? 'danger' : 'accent'}>{CONTROL_MODE_LABEL[room.controlMode] ?? room.controlMode}</Tag> : undefined}
      >
        {!room ? (
          <EmptyState title="暂无冷库信息" />
        ) : (
          <>
            <div className={styles.roomFactRow}>
              <span className={styles.roomFactLabel}>名称</span>
              <span className={styles.roomFactValue}>{room.name}</span>
            </div>
            <div className={styles.roomFactRow}>
              <span className={styles.roomFactLabel}>库容</span>
              <span className={styles.roomFactValue}>{room.volumeM3} m³</span>
            </div>
            <div className={styles.roomFactRow}>
              <span className={styles.roomFactLabel}>位置</span>
              <span className={styles.roomFactValue}>{room.location}</span>
            </div>
            <div className={styles.roomFactRow}>
              <span className={styles.roomFactLabel}>建库时间</span>
              <span className={styles.roomFactValue} title="建库时间暂未由后端提供">暂无数据</span>
            </div>
            <h4 className={styles.blockTitle} style={{ marginTop: 'var(--space-3)' }}>
              设备运行状态
            </h4>
            <div className={styles.deviceChipRow}>
              {devices.map((device) => {
                const Icon = DEVICE_KIND_ICON[device.kind];
                return (
                  <span key={device.id} className={styles.deviceChip} title={`${device.name} · ${deviceStatusLabel(device.status)}`}>
                    <Icon size={12} aria-hidden />
                    {device.name} · {deviceStatusLabel(device.status)}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="关联异常（近7天）"
        action={
          <button type="button" className={styles.paneFooterLink} onClick={() => navigate('/events')}>
            查看全部
            <ArrowRight size={12} aria-hidden />
          </button>
        }
      >
        {related.length === 0 ? (
          <EmptyState title="暂无关联异常" />
        ) : (
          <div className={styles.relatedList}>
            {related.map((event) => (
              <button
                key={event.id}
                type="button"
                className={`${styles.relatedItem} ${
                  event.severity === 'critical' || event.severity === 'emergency'
                    ? styles.relatedCritical
                    : event.severity === 'warning'
                      ? styles.relatedWarning
                      : styles.relatedNotice
                }`}
                aria-current={event.id === selectedEventId}
                onClick={() => onSelect(event.id)}
              >
                <span className={styles.relatedTop}>
                  <SeverityTag severity={event.severity} />
                  <span className={styles.relatedTitle}>{event.title}</span>
                </span>
                <span className={styles.relatedMetaRow}>
                  <span className={styles.relatedMeta}>
                    {event.roomName} · {formatTimeHM(event.startedAt)} 起 · 持续{formatDuration(event.durationMinutes)}
                  </span>
                  <StatusBadge status={event.stage} size="sm" />
                </span>
              </button>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
