import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Bell, ChevronsLeft, ChevronsRight, Droplets, Snowflake, Sun } from 'lucide-react';
import { NAV_ITEMS } from '@/app/navigation';
import { useAlertCount, useAppData } from '@/state/appData';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { StatusDot } from '@/components/ui/StatusDot';
import { Select } from '@/components/ui/Select';
import { useMediaQuery } from '@/utils/useMediaQuery';
import styles from './AppShell.module.css';

const COLLAPSE_KEY = 'coldpilot.nav.collapsed';

/** 顶部栏时钟（演示叙事按 UTC 渲染）。 */
function useUtcClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

/** 应用外壳：浅色侧边导航 + 轻量顶部栏 + 内容出口。 */
export function AppShell() {
  const { open: openAlerts, awaitingApproval } = useAlertCount();
  const { online, roomId, setRoomId, rooms } = useAppData();
  const isNarrow = useMediaQuery('(max-width: 1279px)');
  const clock = useUtcClock();

  const [collapsedPref, setCollapsedPref] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  // 1280px 以下默认收起为图标栏（用户仍可手动展开）。
  const collapsed = isNarrow ? collapsedPref || true : collapsedPref;

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsedPref ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsedPref]);

  const roomOptions = Object.values(rooms).map((b) => ({ value: b.room.id, label: b.room.name }));

  return (
    <div className={styles.shell}>
      <nav
        className={`${styles.rail} ${collapsed ? styles.railCollapsed : styles.railExpanded}`}
        aria-label="全局导航"
      >
        <div className={styles.brand}>
          <span className={styles.brandIcon}>
            <Snowflake size={20} strokeWidth={2} />
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>鲜知 ColdPilot</span>
            <span className={styles.brandSub}>智能冷库工业智能体</span>
          </span>
        </div>

        <div className={styles.nav}>
          {NAV_ITEMS.map(({ to, label, Icon }) => {
            const isAlerts = to === '/events';
            const item = (
              <NavLink
                key={to}
                to={to}
                end={to !== '/workbench'}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
              >
                <span className={styles.navIcon}>
                  <Icon size={18} strokeWidth={1.9} />
                </span>
                <span className={styles.navLabel}>{label}</span>
                {isAlerts && openAlerts > 0 && <span className={styles.badge}>{openAlerts}</span>}
              </NavLink>
            );
            return collapsed ? (
              <Tooltip key={to} content={label}>
                {item}
              </Tooltip>
            ) : (
              item
            );
          })}
        </div>

        <div className={styles.railFooter}>
          <div className={styles.user}>
            <span className={styles.avatar}>管</span>
            <span className={styles.userText}>
              <span className={styles.userName}>管理员</span>
              <span className={styles.userRole}>超级管理员</span>
            </span>
          </div>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setCollapsedPref((c) => !c)}
            aria-label={collapsed ? '展开导航' : '收起侧边栏'}
            aria-expanded={!collapsed}
          >
            <span className={styles.navIcon}>
              {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </span>
            <span className={styles.navLabel}>收起侧边栏</span>
          </button>
        </div>
      </nav>

      <div className={styles.main}>
        <header className={styles.topbar}>
          {roomOptions.length > 0 && (
            <Select
              ariaLabel="选择冷库"
              options={roomOptions}
              value={roomId}
              onChange={setRoomId}
            />
          )}
          <span className={styles.topbarSpacer} />
          <div className={styles.topbarGroup}>
            <span className={styles.weather} title="外部环境数据（演示）">
              <Sun size={15} className={styles.weatherIconWarm} />
              <span className="numeric">28.7℃</span>
            </span>
            <span className={styles.weather} title="外部环境数据（演示）">
              <Droplets size={15} className={styles.weatherIconCool} />
              <span className="numeric">62%</span>
            </span>
            <span className={`${styles.clock} numeric`}>{clock}</span>
            <span className={styles.connDot}>
              <StatusDot tone={online ? 'ok' : 'danger'} pulse={online} />
              <span>{online ? '已连接' : '离线'}</span>
            </span>
            <DemoDataBadge kind="demo" />
            <span className={styles.bell}>
              <Tooltip content={awaitingApproval > 0 ? `${openAlerts} 条未处理，其中 ${awaitingApproval} 条待审批` : `${openAlerts} 条未处理`}>
                <IconButton aria-label={`通知，${openAlerts} 条未处理`}>
                  <Bell size={17} />
                </IconButton>
              </Tooltip>
              {openAlerts > 0 && <span className={styles.bellBadge}>{openAlerts}</span>}
            </span>
          </div>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}