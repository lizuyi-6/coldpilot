import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import CommandCenterPage from '@/pages/CommandCenterPage';
import MonitoringPage from '@/pages/MonitoringPage';
import EventsPage from '@/pages/EventsPage';
import AnomalyWorkbenchPage from '@/pages/AnomalyWorkbenchPage';
import StrategyPage from '@/pages/StrategyPage';
import DevicesPage from '@/pages/DevicesPage';
import InventoryPage from '@/pages/InventoryPage';
import EnergyPage from '@/pages/EnergyPage';
import ReportsAuditPage from '@/pages/ReportsAuditPage';
import SettingsPage from '@/pages/SettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';

/** 应用路由：默认进入指挥中心（全局驾驶舱）。 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/command-center" replace />} />
        <Route path="/command-center" element={<CommandCenterPage />} />
        <Route path="/monitoring" element={<MonitoringPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/workbench" element={<AnomalyWorkbenchPage />} />
        <Route path="/workbench/:eventId" element={<AnomalyWorkbenchPage />} />
        <Route path="/strategy" element={<StrategyPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/energy" element={<EnergyPage />} />
        <Route path="/reports" element={<ReportsAuditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}