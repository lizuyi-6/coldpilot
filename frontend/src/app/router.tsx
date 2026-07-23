import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import CommandCenterPage from '@/pages/CommandCenterPage';
import AnomalyWorkbenchPage from '@/pages/AnomalyWorkbenchPage';
import DevicesInventoryPage from '@/pages/DevicesInventoryPage';
import ReportsAuditPage from '@/pages/ReportsAuditPage';
import SettingsPage from '@/pages/SettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';

/** 应用路由：默认进入异常事件工作台（产品重心）。 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/workbench" replace />} />
        <Route path="/command-center" element={<CommandCenterPage />} />
        <Route path="/workbench" element={<AnomalyWorkbenchPage />} />
        <Route path="/workbench/:eventId" element={<AnomalyWorkbenchPage />} />
        <Route path="/assets" element={<DevicesInventoryPage />} />
        <Route path="/reports" element={<ReportsAuditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}