import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import type { AnomalyEventSummary, Severity } from '@/domain/types';
import { SEVERITY_META } from '@/domain/constants/severity';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { SeverityTag } from '@/components/ui/SeverityTag';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Tooltip } from '@/components/ui/Tooltip';
import { formatDuration, formatTimeHM } from '@/utils/formatTime';
import styles from './commandCenter.module.css';

const PAGE_SIZE = 5;

type StatusFilter = 'all' | 'open' | 'awaiting' | 'recovered';

interface AlertsTablePanelProps {
  events: AnomalyEventSummary[];
}

/** 第三行右侧：异常告警表格（筛选 + 分页 + 查看/处理）。 */
export function AlertsTablePanel({ events }: AlertsTablePanelProps) {
  const navigate = useNavigate();
  const [sevFilter, setSevFilter] = useState<'all' | Severity>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (sevFilter !== 'all' && event.severity !== sevFilter) return false;
      const open = event.stage !== 'recovered';
      if (onlyOpen && !open) return false;
      if (statusFilter === 'open' && !open) return false;
      if (statusFilter === 'recovered' && open) return false;
      if (statusFilter === 'awaiting' && !event.awaitingApproval) return false;
      return true;
    });
  }, [events, sevFilter, statusFilter, onlyOpen]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: TableColumn<AnomalyEventSummary>[] = [
    { key: 'sev', header: '等级', width: '58px', render: (e) => <SeverityTag severity={e.severity} /> },
    { key: 'title', header: '告警内容', render: (e) => e.title },
    { key: 'room', header: '库房', width: '96px', render: (e) => e.roomName },
    { key: 'start', header: '开始', width: '52px', render: (e) => <span className="numeric" title={e.startedAt}>{formatTimeHM(e.startedAt)}</span> },
    { key: 'dur', header: '持续时长', width: '64px', render: (e) => formatDuration(e.durationMinutes) },
    { key: 'stage', header: '状态', width: '80px', render: (e) => <StatusBadge status={e.stage} size="sm" /> },
    {
      key: 'ops',
      header: '操作',
      width: '84px',
      render: (e) => (
        <span className={styles.tableOps}>
          <button type="button" className={styles.opLink} onClick={() => navigate('/events')}>查看</button>
          <button type="button" className={`${styles.opLink} ${styles.opLinkPrimary}`} onClick={() => navigate(`/workbench/${e.id}`)}>处理</button>
        </span>
      ),
    },
  ];

  return (
    <Panel
      title="异常告警"
      className={styles.panelFill}
      action={
        <Tooltip content="只读演示：告警规则配置暂无写接口">
          <button type="button" className={styles.configBtn} disabled aria-disabled>
            <Settings2 size={13} /> 告警配置
          </button>
        </Tooltip>
      }
    >
      <div className={styles.alertFilters}>
        <Select
          ariaLabel="按等级筛选"
          value={sevFilter}
          onChange={(v) => { setSevFilter(v as 'all' | Severity); setPage(1); }}
          options={[
            { value: 'all', label: '全部等级' },
            ...(Object.keys(SEVERITY_META) as Severity[]).map((sev) => ({ value: sev, label: SEVERITY_META[sev].label })),
          ]}
        />
        <Select
          ariaLabel="按状态筛选"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'open', label: '未处理' },
            { value: 'awaiting', label: '待审批' },
            { value: 'recovered', label: '已处理' },
          ]}
        />
        <label className={styles.onlyOpen}>
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) => { setOnlyOpen(e.target.checked); setPage(1); }}
          />
          只看未处理
        </label>
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        empty={<div className={styles.agentEmpty}>没有符合筛选条件的告警。</div>}
      />

      <div className={styles.pager}>
        <span className={styles.pagerTotal}>共 {filtered.length} 条</span>
        <span className={styles.pagerBtns}>
          <button type="button" className={styles.pageBtn} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="上一页">‹</button>
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.pageBtn} ${currentPage === i + 1 ? styles.pageBtnActive : ''}`}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button type="button" className={styles.pageBtn} disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} aria-label="下一页">›</button>
        </span>
        <span className={styles.pagerSize}>{PAGE_SIZE} 条/页</span>
      </div>
    </Panel>
  );
}