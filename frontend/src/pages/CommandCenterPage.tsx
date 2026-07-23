import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

/** 指挥中心（占位）：整体状态跳板，本阶段不实现完整业务。 */
export default function CommandCenterPage() {
  return (
    <EmptyState
      icon={<LayoutDashboard size={40} strokeWidth={1.4} />}
      title="指挥中心"
      description="跨冷库整体状态、优先级最高的异常与关键经营指标将在后续阶段接入。请先在“异常事件”工作台体验完整诊断闭环。"
    />
  );
}