import {
  Activity,
  BellRing,
  Boxes,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  ScrollText,
  Settings,
  MessagesSquare,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  title: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/command-center', label: '首页看板', Icon: LayoutDashboard, title: '指挥中心' },
  { to: '/monitoring', label: '实时监控', Icon: Activity, title: '实时监控' },
  { to: '/events', label: '异常告警', Icon: BellRing, title: '异常事件' },
  { to: '/workbench', label: 'Agent 对话', Icon: MessagesSquare, title: 'Agent 诊断工作台' },
  { to: '/strategy', label: '策略与仿真', Icon: ClipboardList, title: '策略与仿真' },
  { to: '/devices', label: '设备管理', Icon: Gauge, title: '设备管理' },
  { to: '/inventory', label: '库存管理', Icon: Boxes, title: '库存管理' },
  { to: '/energy', label: '能耗分析', Icon: Zap, title: '能耗分析' },
  { to: '/reports', label: '报告中心', Icon: ScrollText, title: '报告与审计' },
  { to: '/settings', label: '系统管理', Icon: Settings, title: '系统设置' },
];

export function navItemForPath(pathname: string): NavItem {
  const match = NAV_ITEMS.find((item) => pathname === item.to || pathname.startsWith(item.to + '/'));
  return match ?? NAV_ITEMS[0];
}