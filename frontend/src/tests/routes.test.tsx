import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ECharts 在 jsdom 中不可靠，mock 掉图表组件（不影响业务断言）。
vi.mock('@/components/domain/MetricChart', () => ({
  MetricChart: () => <div data-testid="metric-chart" />,
}));
vi.mock('@/components/domain/EnergyBarChart', () => ({
  EnergyBarChart: () => <div data-testid="energy-chart" />,
}));
import { NAV_ITEMS, navItemForPath } from '@/app/navigation';
import { AppDataProvider } from '@/state/appData';
import CommandCenterPage from '@/pages/CommandCenterPage';
import MonitoringPage from '@/pages/MonitoringPage';
import EventsPage from '@/pages/EventsPage';
import DevicesPage from '@/pages/DevicesPage';
import InventoryPage from '@/pages/InventoryPage';
import EnergyPage from '@/pages/EnergyPage';
import ReportsAuditPage from '@/pages/ReportsAuditPage';
import SettingsPage from '@/pages/SettingsPage';

/** 全部 10 个导航路由均有定义且可前缀匹配。 */
describe('导航路由', () => {
  it('定义 10 个导航项', () => {
    expect(NAV_ITEMS).toHaveLength(10);
  });

  it('每个路由可解析为导航项', () => {
    NAV_ITEMS.forEach((item) => {
      expect(navItemForPath(item.to).to).toBe(item.to);
    });
  });

  it('根路径回退到指挥中心', () => {
    expect(navItemForPath('/').to).toBe('/command-center');
    expect(navItemForPath('/unknown').to).toBe('/command-center');
  });

  it('工作台子路径匹配 Agent 诊断', () => {
    expect(navItemForPath('/workbench/evt-1').to).toBe('/workbench');
  });
});

function renderPage(node: React.ReactElement, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppDataProvider>{node}</AppDataProvider>
    </MemoryRouter>,
  );
}

/** 各页面在 mock 数据模式下能加载并渲染核心区域。 */
describe('页面加载（mock 模式）', () => {
  it('指挥中心渲染核心区域', async () => {
    renderPage(<CommandCenterPage />);
    await waitFor(() => expect(screen.getByText('指挥中心')).toBeInTheDocument(), { timeout: 4000 });
    expect(await screen.findByText(/冷库概览/)).toBeInTheDocument();
    expect(screen.getByText(/Agent 中心/)).toBeInTheDocument();
    expect(screen.getByText(/今日能耗/)).toBeInTheDocument();
  });

  it('实时监控渲染指标与传感器状态', async () => {
    renderPage(<MonitoringPage />);
    await waitFor(() => expect(screen.getByText('实时监控')).toBeInTheDocument(), { timeout: 4000 });
    expect(await screen.findByText(/传感器状态/)).toBeInTheDocument();
  });

  it('异常事件渲染筛选与表格', async () => {
    renderPage(<EventsPage />);
    await waitFor(() => expect(screen.getByText('异常事件')).toBeInTheDocument(), { timeout: 4000 });
    expect((await screen.findAllByText('进入诊断', { exact: false })).length).toBeGreaterThan(0);
  });

  it('设备管理渲染设备表', async () => {
    renderPage(<DevicesPage />);
    await waitFor(() => expect(screen.getByText('设备管理')).toBeInTheDocument(), { timeout: 4000 });
    expect(await screen.findByText(/维护建议/)).toBeInTheDocument();
  });

  it('库存管理渲染批次与剩余窗口', async () => {
    renderPage(<InventoryPage />);
    await waitFor(() => expect(screen.getByText('库存管理')).toBeInTheDocument(), { timeout: 4000 });
    expect((await screen.findAllByText(/剩余窗口/)).length).toBeGreaterThan(0);
  });

  it('能耗分析渲染统计与演示标注', async () => {
    renderPage(<EnergyPage />);
    await waitFor(() => expect(screen.getByText('能耗分析')).toBeInTheDocument(), { timeout: 4000 });
    expect((await screen.findAllByText(/单位库存能耗/)).length).toBeGreaterThan(0);
  });

  it('报告与审计渲染两个标签', async () => {
    renderPage(<ReportsAuditPage />);
    await waitFor(() => expect(screen.getByText('报告与审计')).toBeInTheDocument(), { timeout: 4000 });
    expect(screen.getByRole('tab', { name: '事件报告' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '安全审计' })).toBeInTheDocument();
  });

  it('系统设置渲染安全规则', async () => {
    renderPage(<SettingsPage />);
    expect(screen.getByText('系统设置')).toBeInTheDocument();
    expect((await screen.findAllByText(/安全规则/)).length).toBeGreaterThan(0);
  });
});