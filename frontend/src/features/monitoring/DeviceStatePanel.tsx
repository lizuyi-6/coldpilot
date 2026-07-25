import { useNavigate } from 'react-router-dom';
import type { Device } from '@/domain/types';
import { ArrowRight } from 'lucide-react';
import { deviceStatusLabel } from '@/domain/viewModels';
import { DEVICE_KIND_ICON, deviceStatusTagTone } from '@/components/domain/deviceMeta';
import { Panel } from '@/components/ui/Panel';
import { Tag } from '@/components/ui/Tag';
import { EmptyState } from '@/components/ui/EmptyState';
import { deviceOperationalHint } from './monitoringView';
import styles from './monitoring.module.css';

interface DeviceStatePanelProps {
  devices: Device[];
  updatedAt: string | null;
}

/** 设备实时状态：名称 + 运行要点 + 状态标签；入口跳转设备管理。 */
export function DeviceStatePanel({ devices, updatedAt }: DeviceStatePanelProps) {
  const navigate = useNavigate();
  return (
    <Panel title="设备实时状态">
      {devices.length === 0 ? (
        <EmptyState title="暂无数据" description="当前冷库没有设备。" />
      ) : (
        devices.map((device) => {
          const Icon = DEVICE_KIND_ICON[device.kind];
          const hint = deviceOperationalHint(device);
          return (
            <div key={device.id} className={styles.deviceRow}>
              <span className={styles.deviceIcon}>
                <Icon size={15} aria-hidden />
              </span>
              <span className={styles.deviceName} title={device.name}>
                {device.name}
              </span>
              {hint && <span className={styles.deviceHint}>{hint}</span>}
              <Tag tone={deviceStatusTagTone(device.status)}>{deviceStatusLabel(device.status)}</Tag>
            </div>
          );
        })
      )}
      <div className={styles.panelFooter}>
        <span>{updatedAt ? `更新于 ${updatedAt}` : '等待数据刷新'}</span>
        <button type="button" className={styles.footerLink} onClick={() => navigate('/devices')}>
          查看设备详情
          <ArrowRight size={13} aria-hidden />
        </button>
      </div>
    </Panel>
  );
}
