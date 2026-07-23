import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFoundPage() {
  return (
    <EmptyState
      title="页面不存在"
      description="您访问的页面不存在或已移动。"
      action={<Link to="/workbench">返回异常事件工作台</Link>}
    />
  );
}