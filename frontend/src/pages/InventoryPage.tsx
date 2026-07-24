import { Boxes } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function InventoryPage() {
  return <EmptyState icon={<Boxes size={40} strokeWidth={1.4} />} title="库存管理" description="批次、品类、入库时间、风险与剩余安全存储窗口。" />;
}