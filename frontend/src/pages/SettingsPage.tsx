import { useMemo, useState } from 'react';
import {
  BookOpenText,
  Gauge,
  ListChecks,
  LockKeyhole,
  MonitorCog,
  ShieldAlert,
  SlidersHorizontal,
  Database,
} from 'lucide-react';
import { useAppData } from '@/state/appData';
import { getDataMode } from '@/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Tag } from '@/components/ui/Tag';
import { StatusDot } from '@/components/ui/StatusDot';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { dataSourceTags } from '@/features/settings/settingsView';
import {
  getNavCollapsed,
  getUiPrefs,
  setNavCollapsed,
  updateUiPrefs,
  type UiDensity,
  type UiNumberFormat,
  type UiThemeColor,
  type UiTimeFormat,
} from '@/utils/uiPrefs';
import { formatDateTimeISO } from '@/utils/formatTime';
import styles from '@/features/settings/settings.module.css';

/** 前端版本（与 package.json 同步维护）。 */
const APP_VERSION = '0.1.0';

/** 安全规则：系统内置安全模型的只读说明（与后端白名单/边界/变化率/审批/L3 拦截一致）。 */
const SAFETY_RULES = [
  {
    icon: ListChecks,
    tone: 'var(--color-info)',
    name: '参数白名单',
    desc: '仅允许调整下发方案中列出的受控参数（如目标温度、风机档位、化霜模式等），白名单外参数一律拒绝。',
  },
  {
    icon: Gauge,
    tone: 'var(--color-warning)',
    name: '阈值限制',
    desc: '每个受控参数带上下边界，越界目标值在安全校验阶段即被拒绝，不会进入审批。',
  },
  {
    icon: SlidersHorizontal,
    tone: 'var(--color-accent)',
    name: '变化率校验',
    desc: '单位时间允许的调整幅度受限，超限动作将被拦截执行。',
  },
  {
    icon: BookOpenText,
    tone: 'var(--color-warning)',
    name: 'L2 级审批',
    desc: '所有候选控制方案均为 L2：必须经人工批准后才会下发执行，全程留痕，可随时回退。',
  },
  {
    icon: LockKeyhole,
    tone: 'var(--color-danger)',
    name: 'L3 级永久禁止',
    desc: '联锁 / 越设备保护类动作永不执行，不产生审批与执行；被尝试时仅生成安全审计记录，管理员也不得绕过。',
  },
];

const AGENT_CONFIG_ROWS = ['Agent 模式', '模型名称', '工具注册表版本', '知识库版本', '提示词版本', '配置更新时间'];

const DENSITY_OPTIONS = [
  { value: 'comfortable' as UiDensity, label: '舒适（默认）' },
  { value: 'compact' as UiDensity, label: '紧凑' },
  { value: 'loose' as UiDensity, label: '宽松' },
];
const TIME_FORMAT_OPTIONS = [
  { value: '24h' as UiTimeFormat, label: '24 小时制（默认）' },
  { value: '12h' as UiTimeFormat, label: '12 小时制' },
];
const NUMBER_FORMAT_OPTIONS = [
  { value: 'auto' as UiNumberFormat, label: '自动' },
  { value: 'fixed2' as UiNumberFormat, label: '固定小数（2 位）' },
];
const THEME_OPTIONS = [
  { value: 'mint', label: '薄荷绿（默认）' },
  { value: 'blue', label: '海湾蓝' },
  { value: 'violet', label: '葡萄紫' },
];

/** 系统管理页：数据源 / 安全规则（只读） / Agent 配置（脱敏） / 界面设置（纯前端） + 页脚。 */
export default function SettingsPage() {
  const { online, lastUpdated, rooms, events } = useAppData();
  const mode = getDataMode();

  const [prefs, setPrefs] = useState(getUiPrefs);
  const [navCollapsed, setNavCollapsedState] = useState(getNavCollapsed);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [docDialog, setDocDialog] = useState<string | null>(null);

  const sourceTags = useMemo(() => dataSourceTags(Object.values(rooms), events.length), [rooms, events.length]);

  const patchPrefs = (patch: Parameters<typeof updateUiPrefs>[0]) => {
    setPrefs(updateUiPrefs(patch));
  };
  const toggleNav = (collapsed: boolean) => {
    setNavCollapsed(collapsed);
    setNavCollapsedState(collapsed);
  };

  return (
    <div className={styles.page}>
      <PageHeader title="系统管理" description="系统配置、数据源管理与权限安全设置" actions={<DemoDataBadge kind="demo" />} />

      <div className={styles.grid2x2}>
        {/* 数据源 */}
        <Panel
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Database size={16} aria-hidden /> 数据源
            </span>
          }
        >
          <div className={styles.rowBetween}>
            <span className={styles.rowTitle}>当前模式</span>
            <Tag tone={mode === 'http' ? 'accent' : 'neutral'}>
              {mode === 'http' ? '实时数据模式（HTTP）' : '演示数据模式（Mock）'}
            </Tag>
          </div>
          <div className={styles.rowBetween}>
            <span className={styles.rowTitle}>后端连接</span>
            <StatusDot tone={online ? 'ok' : 'danger'} label={online ? '连接正常' : '离线'} />
          </div>
          <div className={styles.rowBetween}>
            <span className={styles.rowTitle}>最后更新</span>
            <span className={styles.rowValue}>{lastUpdated ? formatDateTimeISO(lastUpdated) : '暂无数据'}</span>
          </div>
          <div className={styles.rowBetween}>
            <span className={styles.rowTitle}>数据源标签</span>
            {sourceTags.length > 0 ? (
              <span className={styles.tagRow} style={{ justifyContent: 'flex-end', padding: 0 }}>
                {sourceTags.map((tag) => (
                  <Tag key={tag} tone="neutral">
                    {tag}
                  </Tag>
                ))}
              </span>
            ) : (
              <span className={styles.rowValueMuted}>暂无数据</span>
            )}
          </div>
          <p className={styles.note}>
            {mode === 'http'
              ? '数据来源于本地 ColdPilot 后端（演示种子数据），接入真实边缘网关后将替换为实测数据。'
              : '当前为内置演示数据。通过环境变量 VITE_DATA_MODE=http 可切换到真实后端。'}
          </p>
        </Panel>

        {/* 安全规则（只读） */}
        <Panel
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} aria-hidden /> 安全规则
            </span>
          }
          action={
            <button type="button" className={styles.linkButton} onClick={() => setRulesDialogOpen(true)}>
              查看规则说明
            </button>
          }
        >
          <ul className={styles.ruleList}>
            {SAFETY_RULES.map((rule) => (
              <li key={rule.name} className={styles.ruleItem}>
                <rule.icon size={15} className={styles.ruleIcon} style={{ color: rule.tone }} aria-hidden />
                <span className={styles.ruleBody}>
                  <span className={styles.ruleName}>{rule.name}</span>
                  <span className={styles.ruleDesc}>{rule.desc}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            安全规则为系统内置，只读展示；不提供关闭规则、修改 L3、管理员绕过或跳过审批的入口。
          </p>
        </Panel>

        {/* Agent 配置（只读，脱敏） */}
        <Panel
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <MonitorCog size={16} aria-hidden /> Agent 配置
            </span>
          }
        >
          {AGENT_CONFIG_ROWS.map((label) => (
            <div key={label} className={styles.rowBetween}>
              <span className={styles.rowTitle}>{label}</span>
              <span className={styles.rowValueMuted}>暂无数据（未由后端下发）</span>
            </div>
          ))}
          <p className={styles.note}>
            Agent 运行配置尚未由后端接口下发；API Key、Secret、完整系统提示词与敏感连接参数不在前端展示。
          </p>
        </Panel>

        {/* 界面设置（纯前端） */}
        <Panel title="界面设置">
          <div className={styles.rowBetween}>
            <div className={styles.rowLabel}>
              <span className={styles.rowTitle}>界面密度</span>
            </div>
            <Segmented ariaLabel="界面密度" options={DENSITY_OPTIONS} value={prefs.density} onChange={(value) => patchPrefs({ density: value })} />
          </div>
          <div className={styles.rowBetween}>
            <div className={styles.rowLabel}>
              <span className={styles.rowTitle}>导航栏折叠</span>
              <span className={styles.rowDesc}>启用后将自动折叠侧边导航栏</span>
            </div>
            <Switch ariaLabel="导航栏折叠" checked={navCollapsed} onChange={toggleNav} />
          </div>
          <div className={styles.rowBetween}>
            <span className={styles.rowTitle}>时间格式</span>
            <Segmented ariaLabel="时间格式" options={TIME_FORMAT_OPTIONS} value={prefs.timeFormat} onChange={(value) => patchPrefs({ timeFormat: value })} />
          </div>
          <div className={styles.rowBetween}>
            <span className={styles.rowTitle}>数字格式</span>
            <Segmented
              ariaLabel="数字格式"
              options={NUMBER_FORMAT_OPTIONS}
              value={prefs.numberFormat}
              onChange={(value) => patchPrefs({ numberFormat: value })}
            />
          </div>
          <div className={styles.rowBetween}>
            <span className={styles.rowTitle}>主题色</span>
            <Select
              ariaLabel="主题色"
              options={THEME_OPTIONS}
              value={prefs.themeColor}
              onChange={(value) => patchPrefs({ themeColor: value as UiThemeColor })}
            />
          </div>
          <p className={styles.note}>界面设置仅保存在本机浏览器（localStorage），立即生效；不会写入任何后端配置。</p>
        </Panel>
      </div>

      {/* 页脚 */}
      <footer className={styles.footer}>
        <span>
          鲜知 ColdPilot © 2026 鲜知科技
          <span className={styles.footerLinks} style={{ marginLeft: 12 }}>
            {['隐私政策', '服务条款', '帮助文档'].map((doc) => (
              <button key={doc} type="button" className={styles.linkButton} onClick={() => setDocDialog(doc)}>
                {doc}
              </button>
            ))}
          </span>
        </span>
        <span className={styles.footerVersion}>当前版本：v{APP_VERSION}</span>
      </footer>

      {/* 安全规则说明（只读 Dialog） */}
      <Dialog open={rulesDialogOpen} title="安全规则说明" onClose={() => setRulesDialogOpen(false)} width={620}>
        <p className={styles.dialogText}>系统按审批分级约束一切控制动作，规则内置、不可修改：</p>
        <ul className={styles.dialogList}>
          <li>L0 监测：只读，不产生任何控制动作。</li>
          <li>L1 建议：仅生成建议，需人工确认后才进入执行。</li>
          <li>L2 受限执行：控制方案须经人工审批，审批绑定方案版本，全程留痕，可随时回退。</li>
          <li>L3 永久禁止：联锁 / 越设备保护类动作永不执行，不产生审批与执行；被尝试时仅生成安全审计记录。</li>
        </ul>
        <p className={styles.dialogText}>
          所有下发参数经过白名单、阈值边界与变化率三重校验；校验不通过的动作在安全校验阶段即被拒绝。
        </p>
      </Dialog>

      {/* 页脚文档占位（演示环境无实际文档） */}
      <Dialog open={docDialog !== null} title={docDialog ?? ''} onClose={() => setDocDialog(null)}>
        <p className={styles.dialogText}>演示环境未提供「{docDialog}」的实际文档内容。接入正式部署后，此处将链接到对应文档。</p>
      </Dialog>
    </div>
  );
}
