import { Boxes } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

/** 设备与库存（占位）。 */
export default function DevicesInventoryPage() {
  return (
    <EmptyState
      icon={<Boxes size={40} strokeWidth={1.4} />}
      title="设备与库存"
      description="冷库、设备、传感器与库存批次的风险状态将在后续阶段接入，用于区分环境扰动与设备故障。"
    />
  );
}