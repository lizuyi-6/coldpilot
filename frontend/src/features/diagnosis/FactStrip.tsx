import { DoorOpen, Fan, Gauge, Package, Plug, Zap } from 'lucide-react';
import type { UseWorkbench } from '@/state/useWorkbench';
import { formatTimeHM } from '@/utils/formatTime';
import { formatInt } from '@/utils/formatNumber';
import styles from './diagnosis.module.css';

/** 现场事实带：库门 / 入库 / 设备等关键事实，非独立卡片群。 */
export function FactStrip({ wb }: { wb: UseWorkbench }) {
  const detail = wb.data.eventDetail;
  if (!detail) return null;

  const compressor = detail.devices.find((d) => d.kind === 'compressor');
  const fan = detail.devices.find((d) => d.kind === 'fan');
  const valve = detail.devices.find((d) => d.kind === 'valve');
  const meter = detail.devices.find((d) => d.kind === 'meter');
  const inbound = detail.roomEvents.find((e) => e.kind === 'inbound');
  const doorOpen = detail.roomEvents.find((e) => e.kind === 'door_open');
  const doorClose = detail.roomEvents.find((e) => e.kind === 'door_close');

  const facts: { icon: React.ReactNode; label: React.ReactNode }[] = [];

  if (doorOpen) {
    facts.push({
      icon: <DoorOpen size={14} className={styles.factIcon} aria-hidden />,
      label: (
        <>
          库门 <b>{formatTimeHM(doorOpen.at)}{doorClose ? `–${formatTimeHM(doorClose.at)}` : ''} 开启</b>
        </>
      ),
    });
  }
  if (inbound) {
    facts.push({
      icon: <Package size={14} className={styles.factIcon} aria-hidden />,
      label: <>入库 <b>{inbound.detail ?? '新批次'}</b></>,
    });
  }
  if (compressor) {
    const eff = compressor.metrics?.efficiencyPct;
    facts.push({
      icon: <Zap size={14} className={styles.factIcon} aria-hidden />,
      label: <>压缩机 <b>{eff !== undefined ? `效率 ${formatInt(eff)}%${eff < 85 ? ' 偏低' : ''}` : '运行'}</b></>,
    });
  }
  if (fan) {
    facts.push({
      icon: <Fan size={14} className={styles.factIcon} aria-hidden />,
      label: <>风机 <b>{fan.status === 'running' ? '运行' : '停机'}</b></>,
    });
  }
  if (valve) {
    facts.push({
      icon: <Gauge size={14} className={styles.factIcon} aria-hidden />,
      label: <>阀门 <b>开度 {formatInt(valve.metrics?.openingPct ?? 0)}%</b></>,
    });
  }
  if (meter) {
    facts.push({
      icon: <Plug size={14} className={styles.factIcon} aria-hidden />,
      label: <>电表 <b>{formatInt(meter.metrics?.todayKwh ?? 0)} kWh</b></>,
    });
  }

  return (
    <section className={styles.section}>
      <div className={styles.factStrip}>
        {facts.map((f, i) => (
          <span key={i} className={styles.fact}>
            {f.icon}
            <span>{f.label}</span>
          </span>
        ))}
      </div>
    </section>
  );
}