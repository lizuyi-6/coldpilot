import { Zap } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DevicesPage() {
  return <EmptyState icon={<Zap size={40} strokeWidth={1.4} />} title="设备管理" description="压缩机/风机/阀门/库门/电表/传感器状态与维护建议。" />;
}