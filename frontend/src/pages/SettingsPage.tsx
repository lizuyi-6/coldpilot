import { useEffect, useState } from 'react';
import { useAppData } from '@/state/appData';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Tag } from '@/components/ui/Tag';
import { StatusDot } from '@/components/ui/StatusDot';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { DemoDataBadge } from '@/components/domain/DemoDataBadge';
import { ShieldAlert } from 'lucide-react';
import { getDataMode } from '@/api';
import styles from './SettingsPage.module.css';

const SAFETY_RULES = [
  'L0 监测：只读，不产生任何控制动作。',
  'L1 建议：仅生成建议，需人工确认后才进入执行。',
  'L2 受限执行：控制方案须经人工审批，全程留痕，可随时回退。',
  'L3 禁止：关联锁 / 越设备保护类动作永不执行，管理员也不得绕过；被尝试时仅生成安全审计记录。',
];

const AGENT_CONFIG = [
  { label: '诊断模型', value: '鲜知 ColdPilot 诊断引擎（演示）' },
  { label: '仿真引擎', value: '库房热力学降阶模型（演示）' },
  { label: '最大并发诊断任务', value: '3' },
  { label: '审批超时', value: '30 分钟未审批自动转为人工处理' },
];

export default function SettingsPage() {
  const { online, roomId, rooms } = useAppData();
  const mode = getDataMode();
  const [defaultRoom, setDefaultRoom] = useState(roomId);

  useEffect(() => {
    setDefaultRoom(roomId);
  }, [roomId]);

  return (
    <div className={styles.page}>
      <PageHeader title="系统设置" description="数据源 / 安全规则 / Agent 配置 / 界面" actions={<DemoDataBadge kind="demo" />} />

      <div className={styles.stack}>
        <Panel title="数据源">
          <div className={styles.rowBetween}>
            <div className={styles.rowLabel}>
              <span className={styles.rowTitle}>当前模式</span>
              <span className={styles.rowDesc}>通过环境变量 VITE_DATA_MODE 切换</span>
            </div>
            <Tag tone={mode === 'http' ? 'accent' : 'neutral'}>{mode === 'http' ? 'HTTP（真实后端）' : 'Mock（演示数据）'}</Tag>
          </div>
          <div className={styles.rowBetween}>
            <div className={styles.rowLabel}>
              <span className={styles.rowTitle}>连接状态</span>
              <span className={styles.rowDesc}>数据通道实时性</span>
            </div>
            <StatusDot tone={online ? 'ok' : 'danger'} label={online ? '在线' : '离线'} />
          </div>
          <InlineAlert tone="info" title="演示说明">
            当前多数页面使用演示/仿真数据。接入真实计量与控制通道后，将切换为 HTTP 模式并显示实测数据。
          </InlineAlert>
        </Panel>

        <Panel title="安全规则（只读）">
          <ul className={styles.ruleList}>
            {SAFETY_RULES.map((rule, i) => (
              <li key={i} className={styles.ruleItem}>
                <ShieldAlert size={15} className={styles.ruleIcon} />
                {rule}
              </li>
            ))}
          </ul>
          <InlineAlert tone="warning" title="不可修改">
            安全规则为系统内置，管理员也不得修改或绕过。L3 动作被尝试时将生成安全审计记录。
          </InlineAlert>
        </Panel>

        <Panel title="Agent 配置（只读）">
          {AGENT_CONFIG.map((c) => (
            <div key={c.label} className={styles.rowBetween}>
              <span className={styles.rowTitle}>{c.label}</span>
              <span className={styles.rowDesc}>{c.value}</span>
            </div>
          ))}
          <p className={styles.note}>模型密钥等敏感配置不在前端展示与编辑。</p>
        </Panel>

        <Panel title="界面设置">
          <div className={styles.rowBetween}>
            <div className={styles.rowLabel}>
              <span className={styles.rowTitle}>默认冷库</span>
              <span className={styles.rowDesc}>进入系统后默认展示的冷库</span>
            </div>
            <select
              value={defaultRoom}
              onChange={(e) => setDefaultRoom(e.target.value)}
              aria-label="默认冷库"
              style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-strong)' }}
            >
              {Object.values(rooms).map((b) => (
                <option key={b.room.id} value={b.room.id}>
                  {b.room.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.rowBetween}>
            <div className={styles.rowLabel}>
              <span className={styles.rowTitle}>侧边导航</span>
              <span className={styles.rowDesc}>可通过导航底部按钮收起 / 展开</span>
            </div>
            <Tag tone="neutral">跟随用户偏好</Tag>
          </div>
        </Panel>
      </div>
    </div>
  );
}