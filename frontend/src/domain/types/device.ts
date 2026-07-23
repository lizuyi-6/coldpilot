/** 设备类型。 */
export type DeviceKind = 'compressor' | 'fan' | 'valve' | 'door' | 'meter';

export type DeviceStatus = 'running' | 'idle' | 'fault' | 'offline';

/** 设备。 */
export interface Device {
  id: string;
  roomId: string;
  kind: DeviceKind;
  name: string;
  status: DeviceStatus;
  /** 关键运行指标，如压缩机 { efficiencyPct, dischargeTempC }。 */
  metrics?: Record<string, number>;
}