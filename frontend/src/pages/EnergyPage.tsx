import { Snowflake } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function EnergyPage() {
  return <EmptyState icon={<Snowflake size={40} strokeWidth={1.4} />} title="能耗分析" description="今日/昨日/本周能耗、峰谷分布、设备构成与节能对比。" />;
}