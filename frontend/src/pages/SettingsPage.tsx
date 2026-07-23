import { Settings } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

/** 系统设置（占位）。 */
export default function SettingsPage() {
  return (
    <EmptyState
      icon={<Settings size={40} strokeWidth={1.4} />}
      title="系统设置"
      description="数据源、规则、权限、安全边界与模型知识库配置将在后续阶段提供。"
    />
  );
}