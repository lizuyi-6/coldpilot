import { NavLink, Outlet } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  LayoutDashboard,
  ScrollText,
  Settings,
  Snowflake,
} from 'lucide-react';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import styles from './AppShell.module.css';

const NAV_ITEMS = [
  { to: '/command-center', label: '指挥中心', Icon: LayoutDashboard },
  { to: '/workbench', label: '异常事件', Icon: AlertTriangle },
  { to: '/assets', label: '设备与库存', Icon: Boxes },
  { to: '/reports', label: '报告与审计', Icon: ScrollText },
  { to: '/settings', label: '系统设置', Icon: Settings },
];

/** 应用外壳：全局导航 + 顶栏 + 内容出口。 */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <nav className={styles.rail} aria-label="全局导航">
        <div className={styles.logo} aria-hidden>
          <Snowflake size={26} strokeWidth={1.8} />
        </div>
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span className={styles.navLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.brandName}>鲜知 ColdPilot</span>
            <span className={styles.brandSub}>智能冷库工业智能体</span>
          </div>
          <div className={styles.topbarRight}>
            <DemoDataBadge kind="demo" />
          </div>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}