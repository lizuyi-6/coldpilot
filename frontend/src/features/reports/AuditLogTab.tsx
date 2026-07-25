import { useMemo, useState } from 'react';
import { Download, ShieldAlert } from 'lucide-react';
import type { AuditFilters, AuditRow } from './reportsView';
import { EMPTY_AUDIT_FILTERS, SOURCE_LABEL, downloadAuditCsv, filterAuditRows } from './reportsView';
import { Panel } from '@/components/ui/Panel';
import { Table, type TableColumn } from '@/components/ui/Table';
import { Search } from '@/components/ui/Search';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { Drawer } from '@/components/ui/Drawer';
import { DescriptionList } from '@/components/ui/DescriptionList';
import { ApprovalLevelBadge } from '@/components/domain/ApprovalLevelBadge';
import { formatDateTimeISO } from '@/utils/formatTime';
import styles from './reports.module.css';

const PAGE_SIZE = 10;

const SOURCE_OPTIONS = [
  { value: 'all', label: '全部操作者' },
  { value: 'agent', label: 'Agent' },
  { value: 'user', label: '用户' },
  { value: 'external', label: '外部' },
];

const RESULT_OPTIONS = [
  { value: 'all', label: '全部结果' },
  { value: 'blocked', label: '已拦截（blocked）' },
];

interface AuditLogTabProps {
  rows: AuditRow[];
}

/** 审计日志 Tab：跨事件聚合的 L3 拦截留痕（后端无通用操作审计接口）。 */
export function AuditLogTab({ rows }: AuditLogTabProps) {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const patch = (partial: Partial<AuditFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setPage(1);
  };

  const filtered = useMemo(() => filterAuditRows(rows, filters), [rows, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const columns: TableColumn<AuditRow>[] = [
    { key: 'time', header: '时间', width: '150px', render: (row) => formatDateTimeISO(row.entry.attemptedAt) },
    { key: 'source', header: '主体', width: '80px', render: (row) => SOURCE_LABEL[row.entry.source] },
    {
      key: 'category',
      header: '操作类型',
      width: '110px',
      render: () => (
        <Tag tone="danger">
          <ShieldAlert size={11} aria-hidden style={{ marginRight: 3, verticalAlign: -1 }} />
          L3 拦截
        </Tag>
      ),
    },
    { key: 'action', header: '被拦截动作', render: (row) => row.entry.action },
    {
      key: 'event',
      header: '关联事件',
      width: '180px',
      render: (row) => (
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <span>{row.eventTitle}</span>
          <small className={styles.note}>{row.roomName}</small>
        </span>
      ),
    },
    { key: 'rule', header: '触发安全规则', width: '180px', render: (row) => row.entry.triggeredRule },
    { key: 'result', header: '结果', width: '90px', render: () => <Tag tone="danger">已拦截</Tag> },
  ];

  return (
    <>
      <div className={styles.auditNote} role="note">
        <ShieldAlert size={15} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-warning)' }} />
        <span>
          通用操作审计（登录 / 审批 / 执行等）尚未由后端接口提供，当前仅展示 L3 安全拦截留痕（全部事件聚合）。
          requestId / correlationId 未由接口下发；L3 拦截为永久禁止，不产生审批与执行，管理员也不得绕过。
        </span>
      </div>

      <div className={styles.toolbar}>
        <input
          type="date"
          className={styles.dateInput}
          aria-label="开始日期"
          value={filters.dateFrom}
          onChange={(e) => patch({ dateFrom: e.target.value })}
        />
        <span className={styles.dateSep}>至</span>
        <input
          type="date"
          className={styles.dateInput}
          aria-label="结束日期"
          value={filters.dateTo}
          onChange={(e) => patch({ dateTo: e.target.value })}
        />
        <Select ariaLabel="操作者" options={SOURCE_OPTIONS} value={filters.source} onChange={(value) => patch({ source: value })} />
        <Select ariaLabel="结果" options={RESULT_OPTIONS} value={filters.result} onChange={(value) => patch({ result: value })} />
        <div style={{ width: 220 }}>
          <Search value={filters.query} onChange={(value) => patch({ query: value })} placeholder="搜索动作 / 规则 / 事件" />
        </div>
        <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_AUDIT_FILTERS)}>
          重置
        </Button>
        <span className={styles.toolbarSpacer} />
        <Button variant="secondary" size="sm" onClick={() => downloadAuditCsv(filtered)}>
          <Download size={13} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
          导出
        </Button>
      </div>

      <Panel flush>
        {pageRows.length === 0 ? (
          <EmptyState
            title="无 L3 拦截记录"
            description="当前筛选条件下没有安全审计记录。L3（联锁 / 越设备保护）动作被尝试时会在此留痕。"
          />
        ) : (
          <>
            <Table
              columns={columns}
              rows={pageRows}
              rowKey={(row) => row.entry.id}
              onRowClick={(row) => setSelected(row)}
              rowLabel={(row) => `审计记录 ${row.entry.id}`}
              minWidth={1080}
            />
            <div className={styles.pagerRow}>
              <Pagination total={filtered.length} page={safePage} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          </>
        )}
      </Panel>

      <Drawer open={selected !== null} title="审计记录详情" onClose={() => setSelected(null)} width={440}>
        {selected && (
          <div className={styles.drawerStack}>
            <DescriptionList
              items={[
                { label: '记录编号', value: selected.entry.id },
                { label: '尝试时间', value: formatDateTimeISO(selected.entry.attemptedAt) },
                { label: '主体', value: SOURCE_LABEL[selected.entry.source] },
                { label: '操作类型', value: 'blocked_action（L3 拦截）' },
                { label: '关联事件', value: `${selected.eventTitle}（${selected.entry.eventId}）` },
                { label: '审批等级', value: <ApprovalLevelBadge level={selected.entry.approvalLevel} /> },
                { label: '结果', value: <Tag tone="danger">blocked（未执行）</Tag> },
                { label: 'requestId', value: '未由接口下发' },
                { label: 'correlationId', value: '未由接口下发' },
              ]}
            />
            <div className={styles.drawerSection}>
              <h4 className={styles.drawerSectionTitle}>被拦截动作</h4>
              <p className={styles.reasonBox}>{selected.entry.action}</p>
            </div>
            <div className={styles.drawerSection}>
              <h4 className={styles.drawerSectionTitle}>触发安全规则</h4>
              <p className={styles.reasonBox}>{selected.entry.triggeredRule}</p>
            </div>
            <div className={styles.drawerSection}>
              <h4 className={styles.drawerSectionTitle}>拦截原因</h4>
              <p className={styles.reasonBox}>{selected.entry.reason}</p>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
