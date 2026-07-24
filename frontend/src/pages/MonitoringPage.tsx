import { Activity } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function MonitoringPage() {
  return <EmptyState icon={<Activity size={40} strokeWidth={1.4} />} title="实时监控" description="多指标实时趋势、目标区间、事件标记与传感器在线状态。" />;
}