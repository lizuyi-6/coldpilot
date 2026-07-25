import { useNavigate } from 'react-router-dom';
import { ClipboardList, X } from 'lucide-react';
import type { AnomalyEventSummary, InventoryBatch } from '@/domain/types';
import { riskLabel } from '@/domain/viewModels';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { disposalAdvice, remainingDays, suitabilityRows, windowTrend } from './inventoryView';
import { formatDateTime, formatDateTimeShort } from '@/utils/formatTime';
import { formatInt } from '@/utils/formatNumber';
import styles from './inventory.module.css';

interface BatchDetailPanelProps {
  batch: InventoryBatch;
  roomName: string;
  /** 当前库房遥测最新值（温度用于适宜性判定；湿度/CO₂ 仅展示）。 */
  current: { temperature?: number; humidity?: number; co2?: number };
  /** 所在库房的异常事件（批次级关联接口未接入，展示同库房事件并明确标注）。 */
  roomEvents: AnomalyEventSummary[];
  nowMs: number;
  onClose: () => void;
}

const SUIT_TONE: Record<string, 'accent' | 'warning' | 'neutral'> = {
  ok: 'accent',
  warn: 'warning',
  unknown: 'neutral',
};

/** 剩余窗口趋势迷你图（实线=已消耗估算，虚线=线性外推）。 */
function WindowTrendChart({ batch, nowMs }: { batch: InventoryBatch; nowMs: number }) {
  const points = windowTrend(batch, nowMs);
  const width = 240;
  const height = 96;
  const padX = 26;
  const padY = 14;
  const maxValue = Math.max(1, ...points.map((point) => point.actualDays ?? 0), ...points.map((point) => point.forecastDays ?? 0));
  const xAt = (index: number) => padX + (index / Math.max(1, points.length - 1)) * (width - padX - 6);
  const yAt = (value: number) => padY + (1 - value / maxValue) * (height - padY - 18);
  const actualPoints = points.map((point, index) => (point.actualDays !== null ? `${xAt(index)},${yAt(point.actualDays)}` : null)).filter(Boolean).join(' ');
  const forecastPoints = points.map((point, index) => (point.forecastDays !== null ? `${xAt(index)},${yAt(point.forecastDays)}` : null)).filter(Boolean).join(' ');
  const firstLabel = points[0]?.label ?? '';
  const lastLabel = points[points.length - 1]?.label ?? '';

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="剩余窗口趋势估算">
        <line x1={padX} y1={height - 18} x2={width - 6} y2={height - 18} stroke="var(--color-border-subtle)" />
        <text x={2} y={yAt(maxValue) + 4} fontSize="9" fill="var(--color-text-muted)">{maxValue}天</text>
        <text x={2} y={height - 16} fontSize="9" fill="var(--color-text-muted)">0</text>
        <polyline points={actualPoints} fill="none" stroke="var(--color-accent)" strokeWidth="1.6" />
        <polyline points={forecastPoints} fill="none" stroke="var(--color-danger)" strokeWidth="1.6" strokeDasharray="4 3" />
        <text x={padX} y={height - 4} fontSize="9" fill="var(--color-text-muted)">{firstLabel}</text>
        <text x={width - 6} y={height - 4} fontSize="9" fill="var(--color-text-muted)" textAnchor="end">{lastLabel}</text>
      </svg>
      <div className={styles.trendLegend}>
        <span><i />已消耗窗口（估算）</span>
        <span className={styles.forecast}><i />线性外推</span>
      </div>
    </div>
  );
}

/** 批次详情底部区：批次信息 / 存储适宜性 / 关联异常 / 趋势与预测 / 推荐处置。 */
export function BatchDetailPanel({ batch, roomName, current, roomEvents, nowMs, onClose }: BatchDetailPanelProps) {
  const navigate = useNavigate();
  const advice = disposalAdvice(batch, current.temperature, nowMs);
  const suitability = suitabilityRows(batch, current);

  return (
    <div className={styles.batchDetail}>
      <div className={styles.batchDetailHead}>
        <span className={styles.batchDetailTitle}>{batch.id}</span>
        <Tag tone={batch.risk === 'high' ? 'danger' : batch.risk === 'watch' ? 'warning' : 'accent'}>{riskLabel(batch.risk)}</Tag>
        <button className={styles.batchDetailClose} onClick={onClose} aria-label="关闭批次详情">
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className={styles.batchGrid}>
        {/* 批次信息 */}
        <div className={styles.batchCol}>
          <div className={styles.batchColTitle}>批次信息</div>
          <div className={styles.batchFactRow}><span className="label">品类</span>{batch.category}</div>
          <div className={styles.batchFactRow}><span className="label">数量</span><span className="numeric">{formatInt(batch.quantityKg)} kg</span></div>
          <div className={styles.batchFactRow}><span className="label">冷库</span>{roomName}</div>
          <div className={styles.batchFactRow}><span className="label">来源</span>{batch.source}</div>
          <div className={styles.batchFactRow}><span className="label">入库</span><span className="numeric">{formatDateTime(batch.inboundAt)}</span></div>
          <div className={styles.batchFactRow}>
            <span className="label">推荐</span>
            <span className="numeric">{batch.recommendedRange.min} ~ {batch.recommendedRange.max} {batch.recommendedRange.unit}</span>
          </div>
        </div>

        {/* 存储适宜性 */}
        <div className={styles.batchCol}>
          <div className={styles.batchColTitle}>存储适宜性</div>
          {suitability.map((row) => (
            <div key={row.key} className={styles.suitRow}>
              <span className="name">{row.label}</span>
              <span className="value">{row.currentText}</span>
              <Tag tone={SUIT_TONE[row.level]}>{row.levelText}</Tag>
            </div>
          ))}
        </div>

        {/* 关联异常 */}
        <div className={styles.batchCol}>
          <div className={styles.batchColTitle}>关联异常（同库房）</div>
          {roomEvents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {roomEvents.slice(0, 3).map((event) => (
                <button key={event.id} className={styles.relatedItem} onClick={() => navigate(`/workbench/${event.id}?view=agent`)}>
                  <SeverityTag severity={event.severity} />
                  <span className="title">{event.title}</span>
                  <time>{formatDateTimeShort(event.startedAt)}</time>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.note}>所在库房当前没有异常事件。</p>
          )}
        </div>

        {/* 趋势与预测 */}
        <div className={styles.batchCol}>
          <div className={styles.batchColTitle}>剩余窗口趋势（估算）</div>
          <WindowTrendChart batch={batch} nowMs={nowMs} />
          <p className={styles.note}>剩余 {remainingDays(batch, nowMs)} 天 / 共 {Math.round(batch.maxStorageHours / 24)} 天；按入库时间与最长存储时长线性估算，非模型预测。</p>
        </div>

        {/* 推荐处置 */}
        <div className={styles.batchCol}>
          <div className={styles.batchColTitle}>推荐处置</div>
          <ul className={styles.adviceList}>
            {advice.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <div className={styles.adviceActions}>
            <Button variant="primary" size="sm" disabled title="处置单创建接口未接入，无法下发">
              <ClipboardList size={13} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
              生成处置单
            </Button>
            <span className={styles.note}>处置单接口未接入</span>
          </div>
        </div>
      </div>
    </div>
  );
}
