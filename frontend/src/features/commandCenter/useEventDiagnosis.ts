import { useEffect, useState } from 'react';
import type { DiagnosisResult } from '@/domain/types';
import type { ColdPilotClient } from '@/api';

interface DiagnosisState {
  result: DiagnosisResult | null;
  /** running / done / failed */
  phase: 'idle' | 'running' | 'done' | 'failed';
  /** 已完成的工具步数（进度提示）。 */
  stepsDone: number;
  stepsTotal: number;
}

const TOTAL_STEPS = 5;
const POLL_MS = 450;

/**
 * 指挥中心 Agent 面板：对指定事件发起诊断并轮询至完成，返回结构化诊断结果。
 * 仅通过 ColdPilotClient 异步任务接口读取，不触碰状态机与审批。
 */
export function useEventDiagnosis(client: ColdPilotClient, eventId: string | undefined): DiagnosisState {
  const [state, setState] = useState<DiagnosisState>({ result: null, phase: 'idle', stepsDone: 0, stepsTotal: TOTAL_STEPS });

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    setState({ result: null, phase: eventId ? 'running' : 'idle', stepsDone: 0, stepsTotal: TOTAL_STEPS });
    if (!eventId) return;

    void (async () => {
      try {
        const task = await client.startDiagnosis(eventId);
        if (cancelled) return;
        const poll = async () => {
          if (cancelled) return;
          try {
            const snapshot = await client.getAgentTask(task.id);
            if (cancelled) return;
            setState((s) => ({ ...s, stepsDone: snapshot.tools.length }));
            if (snapshot.status === 'succeeded') {
              const result = await client.getDiagnosisResult(task.id);
              if (!cancelled) setState((s) => ({ ...s, result, phase: 'done' }));
              return;
            }
            if (snapshot.status === 'failed') {
              setState((s) => ({ ...s, phase: 'failed' }));
              return;
            }
            timer = window.setTimeout(() => void poll(), POLL_MS);
          } catch {
            if (!cancelled) setState((s) => ({ ...s, phase: 'failed' }));
          }
        };
        await poll();
      } catch {
        if (!cancelled) setState((s) => ({ ...s, phase: 'failed' }));
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [client, eventId]);

  return state;
}