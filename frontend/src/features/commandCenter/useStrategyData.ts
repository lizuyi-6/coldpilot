import { useEffect, useState } from 'react';
import type { ControlPlan, SimulationResult } from '@/domain/types';
import type { ColdPilotClient } from '@/api';

interface StrategyData {
  plans: ControlPlan[];
  simulations: Record<string, SimulationResult>;
  loading: boolean;
  /** 重新运行全部方案仿真。 */
  rerun: () => void;
  simulating: boolean;
}

/** 指挥中心策略摘要：候选方案 + 各方案仿真结果（只读取，不触碰审批/执行）。 */
export function useStrategyData(client: ColdPilotClient, eventId: string | undefined): StrategyData {
  const [plans, setPlans] = useState<ControlPlan[]>([]);
  const [simulations, setSimulations] = useState<Record<string, SimulationResult>>({});
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [runSeq, setRunSeq] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPlans([]);
    setSimulations({});
    if (!eventId) return;
    void (async () => {
      setLoading(true);
      try {
        const list = await client.listControlPlans(eventId);
        if (cancelled) return;
        setPlans(list);
      } catch {
        /* 无方案 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, eventId]);

  useEffect(() => {
    let cancelled = false;
    if (plans.length === 0) return;
    void (async () => {
      setSimulating(true);
      const sims: Record<string, SimulationResult> = {};
      await Promise.all(
        plans.map(async (plan) => {
          try {
            sims[plan.id] = await client.runSimulation(plan.id);
          } catch {
            /* 单方案仿真失败留空 */
          }
        }),
      );
      if (!cancelled) {
        setSimulations(sims);
        setSimulating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, plans, runSeq]);

  return {
    plans,
    simulations,
    loading,
    simulating,
    rerun: () => setRunSeq((n) => n + 1),
  };
}