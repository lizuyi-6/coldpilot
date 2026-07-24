import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, ChevronsLeft, ChevronsRight, Snowflake } from 'lucide-react';
import { NAV_ITEMS, navItemForPath } from '@/app/navigation';
import { useAlertCount, useAppData } from '@/state/appData';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { StatusDot } from '@/components/ui/StatusDot';
import { Select } from '@/components/ui/Select';
import { formatTimeHM } from '@/utils/formatTime';
import { useMediaQuery } from '@/utils/useMediaQuery';
import styles from './AppShell.module.css';

const COLLAPSE_KEY = 'coldpilot.nav.collapsed';

/** 应用外壳：深色侧边导航 + 顶栏 + 内容出口。 */
export function AppShell() {
  const location = useLocation();
  const current = navItemForPath(location.pathname);
  const { open: openAlerts, awaitingApproval } = useAlertCount();
  const { online, lastUpdated, roomId, setRoomId, rooms } = useAppData();
  const isNarrow = useMediaQuery('(max-width: 1279px)');

  const [collapsedPref, setCollapsedPref] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  // 1280px 以下强制收起（用户仍可展开覆盖到 1024px 之下自动抽屉化的边界）。
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
            <Snowflake size={24} strokeWidth={1.8} />
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
                  <Icon size={20} strokeWidth={1.8} />
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
              <span className={styles.userName}>冷库管理员</span>
              <span className={styles.userRole}>操作员</span>
            </span>
          </div>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setCollapsedPref((c) => !c)}
            aria-label={collapsed ? '展开导航' : '收起导航'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            <span className={styles.collapseLabel}>{collapsed ? '展开' : '收起侧边栏'}</span>
          </button>
        </div>
      </nav>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <span className={styles.pageTitle}>{current.title}</span>
          <span className={styles.topbarSpacer} />
          <div className={styles.topbarGroup}>
            {roomOptions.length > 0 && (
              <Select
                ariaLabel="选择冷库"
                options={roomOptions}
                value={roomId}
                onChange={setRoomId}
              />
            )}
            <span className={styles.connDot}>
              <StatusDot tone={online ? 'ok' : 'danger'} pulse={online} />
              <span>{online ? '已连接' : '离线'}</span>
            </span>
            {lastUpdated && <span className={styles.updated}>更新 {formatTimeHM(lastUpdated)}</span>}
            <DemoDataBadge kind="demo" />
            <span className={styles.bell}>
              <Tooltip content={awaitingApproval > 0 ? `${openAlerts} 条未处理，其中 ${awaitingApproval} 条待审批` : `${openAlerts} 条未处理`}>
                <IconButton aria-label={`通知，${openAlerts} 条未处理`}>
                  <Bell size={18} />
                </IconButton>
              </Tooltip>
              {openAlerts > 0 && <span className={styles.bellBadge}>{openAlerts}</span>}
            </span>
            <span className={styles.userChip}>冷库管理员</span>
          </div>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}