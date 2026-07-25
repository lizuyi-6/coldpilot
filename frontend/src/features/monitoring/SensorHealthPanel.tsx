import { useNavigate } from 'react-router-dom';
import type { SensorSeries } from '@/domain/types';
import { ArrowRight } from 'lucide-react';
import { sensorStatusLabel, sensorStatusTone } from '@/domain/viewModels';
import { Panel } from '@/components/ui/Panel';
import { Table, type TableColumn } from '@/components/ui/Table';
import { StatusDot } from '@/components/ui/StatusDot';
import { EmptyState } from '@/components/ui/EmptyState';
import { sensorHealthRows, type SensorHealthRow } from './monitoringView';
import styles from './monitoring.module.css';

function healthColor(pct: number): string {
  if (pct >= 90) return 'var(--color-accent)';
  if (pct >= 60) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

interface SensorHealthPanelProps {
  telemetry: SensorSeries[];
}

/** 传感器健康度：逐通道列出采样数、健康度、采样滞后与状态。 */
export function SensorHealthPanel({ telemetry }: SensorHealthPanelProps) {
  const navigate = useNavigate();
  const rows = sensorHealthRows(telemetry);

  const columns: TableColumn<SensorHealthRow>[] = [
    {
      key: 'metric',
      header: '传感器',
      render: (row) => <span className={styles.sensorNameCell}>{row.metricLabel}传感器</span>,
    },
    {
      key: 'location',
      header: '位置',
      width: '76px',
      render: () => (
        <span className={styles.unavailableCell} title="传感器物理位置暂未由后端提供">
          暂无数据
        </span>
      ),
    },
    {
      key: 'unit',
      header: '指标',
      width: '84px',
      render: (row) => <span className={styles.unitCell}>{`${row.metricLabel}（${row.unit}）`}</span>,
    },
    {
      key: 'health',
      header: '健康度',
      width: '118px',
      render: (row) => (
        <span className={styles.healthCell}>
          <span className={styles.healthBar}>
            <span
              className={styles.healthFill}
              style={{ width: `${row.healthPct}%`, background: healthColor(row.healthPct) }}
            />
          </span>
          {row.healthPct}%
        </span>
      ),
    },
    {
      key: 'lag',
      header: '延迟',
      width: '72px',
      align: 'right',
      render: (row) => (row.lagMinutes === 0 ? '实时' : `${row.lagMinutes} 分钟`),
    },
    {
      key: 'status',
      header: '状态',
      width: '76px',
      render: (row) => <StatusDot tone={sensorStatusTone(row.status)} label={sensorStatusLabel(row.status)} />,
    },
  ];

  return (
    <Panel title="传感器健康度" flush>
      {rows.length === 0 ? (
        <div style={{ padding: 'var(--space-4)' }}>
          <EmptyState title="暂无数据" description="当前冷库没有传感器通道。" />
        </div>
      ) : (
        <Table columns={columns} rows={rows} rowKey={(row) => row.key} />
      )}
      <div className={styles.panelFooter} style={{ margin: '0 var(--space-4)', paddingBottom: 'var(--space-3)' }}>
        <span>共 {rows.length} 个传感器通道</span>
        <button type="button" className={styles.footerLink} onClick={() => navigate('/devices')}>
          查看全部
          <ArrowRight size={13} aria-hidden />
        </button>
      </div>
    </Panel>
  );
}
