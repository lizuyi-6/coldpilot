import { ClipboardList } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function StrategyPage() {
  return <EmptyState icon={<ClipboardList size={40} strokeWidth={1.4} />} title="策略与仿真" description="方案 A/B 对比、预测曲线、恢复/能耗/风险与安全校验。" />;
}