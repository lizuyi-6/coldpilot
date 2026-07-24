import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function EventsPage() {
  return <EmptyState icon={<AlertTriangle size={40} strokeWidth={1.4} />} title="异常事件" description="事件列表、筛选、搜索、排序与详情入口。" />;
}