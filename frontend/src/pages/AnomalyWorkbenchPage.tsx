import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AnomalyEventSummary } from '@/domain/types';
import { getColdPilotClient } from '@/api';
import { useWorkbench } from '@/state/useWorkbench';
import { useIsWideLayout, useMediaQuery } from '@/utils/useMediaQuery';
import { WorkbenchLayout } from '@/layouts/WorkbenchLayout';
import { Drawer } from '@/components/ui/Drawer';
import { EventListPane } from '@/features/anomaly/EventListPane';
import { DiagnosisPane } from '@/features/diagnosis/DiagnosisPane';
import { InspectorPane } from '@/features/inspector/InspectorPane';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

const DEFAULT_EVENT_ID = 'evt-1';

/** 异常事件工作台：三栏诊断闭环（产品重心）。宽屏检查器默认展开；≤1023px 转为抽屉。 */
export default function AnomalyWorkbenchPage() {
  const wb = useWorkbench();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<AnomalyEventSummary[] | null>(null);
  const isWide = useIsWideLayout();
  // ≤1023px：检查器转为覆盖式抽屉（不占栏宽）。
  const isCompact = useMediaQuery('(max-width: 1023px)');
  // 用户手动偏好（null = 跟随断点默认：宽屏展开 / 窄屏折叠）。
  const [inspectorOverride, setInspectorOverride] = useState<boolean | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inspectorCollapsed = inspectorOverride ?? !isWide;

  // 加载事件列表。
  useEffect(() => {
    let cancelled = false;
    void getColdPilotClient()
      .listAnomalyEvents()
      .then((list) => {
        if (!cancelled) setEvents(list);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 依据路由参数或默认事件选中并加载详情。
  const targetEventId = eventId ?? DEFAULT_EVENT_ID;
  useEffect(() => {
    if (targetEventId && wb.selectedEventId !== targetEventId) {
      void wb.selectEvent(targetEventId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetEventId]);

  const handleSelect = (id: string) => {
    navigate(`/workbench/${id}`, { replace: true });
  };

  if (!events) {
    return (
      <div style={{ padding: 24 }}>
        <SkeletonLoader lines={6} />
      </div>
    );
  }

  return (
    <>
      <WorkbenchLayout
        list={<EventListPane events={events} selectedEventId={wb.selectedEventId} onSelect={handleSelect} />}
        main={<DiagnosisPane wb={wb} />}
        inspector={<InspectorPane wb={wb} />}
        inspectorCollapsed={isCompact ? true : inspectorCollapsed}
        onToggleInspector={() => {
          if (isCompact) {
            setDrawerOpen(true);
          } else {
            setInspectorOverride(inspectorCollapsed ? true : false);
          }
        }}
      />
      <Drawer open={isCompact && drawerOpen} title="方案检查器" onClose={() => setDrawerOpen(false)} width={360}>
        <InspectorPane wb={wb} />
      </Drawer>
    </>
  );
}