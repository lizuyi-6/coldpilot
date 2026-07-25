import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, X } from 'lucide-react';
import type { AnomalyEventSummary, Device } from '@/domain/types';
import { DEVICE_KIND_ICON, DEVICE_KIND_LABEL, deviceStatusTagTone } from '@/components/domain/deviceMeta';
import { deviceStatusLabel } from '@/domain/viewModels';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { deviceMetricEntries, maintenanceAdvice } from './devicesView';
import { formatDateTimeShort } from '@/utils/formatTime';
import styles from './devices.module.css';

type DetailTab = 'detail' | 'trend' | 'maintenance' | 'events';

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'detail', label: '设备详情' },
  { key: 'trend', label: '运行趋势' },
  { key: 'maintenance', label: '维护记录' },
  { key: 'events', label: '事件记录' },
];

interface DeviceDetailPanelProps {
  device: Device;
  roomName: string;
  /** 所在库房的异常事件（设备级事件接口未接入，展示同库房事件并明确标注）。 */
  roomEvents: AnomalyEventSummary[];
  onClose: () => void;
}

/**
 * 设备详情（Tabs：设备详情 / 运行趋势 / 维护记录 / 事件记录）。
 * 运行趋势与维护记录后端未接入，显示暂无数据；维护建议为基于真实指标的只读规则建议。
 */
export function DeviceDetailPanel({ device, roomName, roomEvents, onClose }: DeviceDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('detail');
  const navigate = useNavigate();
  const KindIcon = DEVICE_KIND_ICON[device.kind];
  const metrics = deviceMetricEntries(device);
  const advice = maintenanceAdvice(device);

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHead}>
        <div className={styles.detailTitle}>
          <span className={styles.detailName}>
            <KindIcon size={17} aria-hidden style={{ color: 'var(--color-accent)' }} />
            {device.name}
            <Tag tone={deviceStatusTagTone(device.status)}>{deviceStatusLabel(device.status)}</Tag>
          </span>
          <span className={styles.detailId}>
            {device.id} · {DEVICE_KIND_LABEL[device.kind]} · {roomName}
          </span>
        </div>
        <button className={styles.detailClose} onClick={onClose} aria-label="关闭设备详情">
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className={styles.detailTabs} role="tablist" aria-label="设备详情视图">
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`${styles.detailTab} ${activeTab === tab.key ? styles.detailTabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'detail' && (
        <>
          <div>
            <div className={styles.sectionTitle} style={{ marginBottom: 8 }}>运行参数</div>
            {metrics.length > 0 ? (
              <div className={styles.paramsGrid}>
                {metrics.map((metric) => (
                  <div key={metric.key} className={styles.paramItem}>
                    <span className={styles.paramLabel}>{metric.label}</span>
                    <span className={styles.paramValue}>
                      {metric.value.toLocaleString('zh-CN')}
                      {metric.unit ? <small>{metric.unit}</small> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.note}>暂无运行参数。</p>
            )}
          </div>

          <div className={styles.adviceBox}>
            <div className={styles.sectionTitle}>
              <Lightbulb size={13} aria-hidden style={{ verticalAlign: -2, marginRight: 4 }} />
              维护建议（基于运行指标的只读规则建议）
            </div>
            <ul className={styles.adviceList}>
              {advice.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <div className={styles.adviceActions}>
              <Button variant="primary" size="sm" disabled title="建议采纳接口未接入，无法回写设备">
                采纳建议
              </Button>
              <span className={styles.note}>采纳接口未接入</span>
            </div>
          </div>
        </>
      )}

      {activeTab === 'trend' && (
        <EmptyState title="暂无数据" description="设备级历史运行趋势接口未接入，当前仅支持库房级指标趋势（见实时监控页）。" />
      )}

      {activeTab === 'maintenance' && (
        <EmptyState title="暂无数据" description="维护记录（保养/维修工单）接口未接入。" />
      )}

      {activeTab === 'events' && (
        <>
          {roomEvents.length > 0 ? (
            <>
              <p className={styles.note}>以下为设备所在库房「{roomName}」的异常事件（设备级事件接口未接入）：</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {roomEvents.map((event) => (
                  <button key={event.id} className={styles.relatedItem} onClick={() => navigate(`/workbench/${event.id}?view=agent`)}>
                    <SeverityTag severity={event.severity} />
                    <span className="title">{event.title}</span>
                    <time>{formatDateTimeShort(event.startedAt)}</time>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="暂无相关事件" description="该设备所在库房当前没有异常事件。" />
          )}
        </>
      )}
    </div>
  );
}
