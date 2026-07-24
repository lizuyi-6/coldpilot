import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AnomalyEventDetail, AnomalyEventSummary, ColdRoom } from '@/domain/types';
import { getColdPilotClient, type ColdPilotClient } from '@/api';
import { isApiError } from '@/api/apiErrors';

export interface RoomBundle {
  room: ColdRoom;
  devices: AnomalyEventDetail['devices'];
  inventory: AnomalyEventDetail['inventory'];
  telemetry: AnomalyEventDetail['telemetry'];
  roomEvents: AnomalyEventDetail['roomEvents'];
}

interface AppDataValue {
  client: ColdPilotClient;
  events: AnomalyEventSummary[];
  rooms: Record<string, RoomBundle>;
  loading: boolean;
  error: string | null;
  online: boolean;
  lastUpdated: string | null;
  reload: () => Promise<void>;
  roomId: string;
  setRoomId: (id: string) => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

function roomIdsFromEvents(events: AnomalyEventSummary[]): string[] {
  const ids = new Set<string>();
  events.forEach((e) => ids.add(e.roomId));
  return Array.from(ids);
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const client = getColdPilotClient();
  const [events, setEvents] = useState<AnomalyEventSummary[]>([]);
  const [rooms, setRooms] = useState<Record<string, RoomBundle>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>('room-1');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await client.listAnomalyEvents();
      setEvents(list);
      const bundles: Record<string, RoomBundle> = {};
      await Promise.all(
        roomIdsFromEvents(list).map(async (rid) => {
          const anyEvent = list.find((e) => e.roomId === rid);
          if (!anyEvent) return;
          try {
            const detail = await client.getAnomalyEvent(anyEvent.id);
            bundles[rid] = {
              room: detail.room,
              devices: detail.devices,
              inventory: detail.inventory,
              telemetry: detail.telemetry,
              roomEvents: detail.roomEvents,
            };
          } catch {
            // 单库失败不阻塞整体。
          }
        }),
      );
      setRooms(bundles);
      setOnline(true);
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      setOnline(false);
      setError(isApiError(e) ? e.message : '数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<AppDataValue>(
    () => ({ client, events, rooms, loading, error, online, lastUpdated, reload: load, roomId, setRoomId }),
    [client, events, rooms, loading, error, online, lastUpdated, load, roomId],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData 必须在 AppDataProvider 内使用');
  return ctx;
}

export function useAlertCount(): { open: number; awaitingApproval: number } {
  const { events } = useAppData();
  return useMemo(() => {
    const open = events.filter((e) => e.stage !== 'recovered').length;
    const awaitingApproval = events.filter((e) => e.awaitingApproval).length;
    return { open, awaitingApproval };
  }, [events]);
}