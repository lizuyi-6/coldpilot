import { ScrollText } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

/** 报告与审计（占位）。 */
export default function ReportsAuditPage() {
  return (
    <EmptyState
      icon={<ScrollText size={40} strokeWidth={1.4} />}
      title="报告与审计"
      description="事件报告、工具调用日志、审批记录与控制记录将在后续阶段汇总于此。当前可在异常事件工作台查看单事件报告。"
    />
  );
}