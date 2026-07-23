import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpColdPilotClient } from '@/api/httpColdPilotClient';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({ error: { code, message, requestId: 'req-1', retryable: false } }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

function lastCallUrl(mock: FetchMock): string {
  const calls = mock.mock.calls as [string, ...unknown[]][];
  return calls[calls.length - 1][0];
}

function lastCallInit(mock: FetchMock): RequestInit | undefined {
  const calls = mock.mock.calls as [string, RequestInit | undefined][];
  return calls[calls.length - 1][1];
}

describe('HttpColdPilotClient', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('prefixes paths with baseUrl + /api/v1', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonOk([{ id: 'evt-1' }])) as unknown as FetchMock;
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const client = new HttpColdPilotClient('http://localhost:8000/');
    const events = await client.listAnomalyEvents();
    expect(events).toEqual([{ id: 'evt-1' }]);
    expect(lastCallUrl(fetchMock)).toBe('http://localhost:8000/api/v1/anomaly-events');
  });

  it('uses same-origin when baseUrl is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonOk({ id: 'evt-1' })) as unknown as FetchMock;
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const client = new HttpColdPilotClient('');
    await client.getAnomalyEvent('evt-1');
    expect(lastCallUrl(fetchMock)).toBe('/api/v1/anomaly-events/evt-1');
  });

  it('POSTs diagnosis and returns parsed body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonOk({ id: 'task-1', status: 'queued', startedAt: '2026-07-23T10:35:00Z' }),
    ) as unknown as FetchMock;
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const client = new HttpColdPilotClient();
    const task = await client.startDiagnosis('evt-1');
    expect(task.id).toBe('task-1');
    expect(lastCallInit(fetchMock)?.method).toBe('POST');
    expect(lastCallUrl(fetchMock)).toBe('/api/v1/anomaly-events/evt-1/diagnosis');
  });

  it('serializes ApprovalDecision as JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonOk({ requestId: 'apr-1', decision: 'approved', decidedBy: '冷库管理员' }),
    ) as unknown as FetchMock;
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const client = new HttpColdPilotClient();
    await client.submitApproval('apr-1', { decision: 'approved', approverId: 'x' });
    const init = lastCallInit(fetchMock);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ decision: 'approved', approverId: 'x' }));
  });

  it('maps the error envelope to ApiError (code + status)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonError(409, 'INVALID_STATE', '未完成仿真不得申请审批')) as unknown as FetchMock;
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const client = new HttpColdPilotClient();
    await expect(client.requestApproval('plan-a')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_STATE',
      status: 409,
    });
  });

  it('falls back to INTERNAL on a non-JSON error body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('upstream down', { status: 502 })) as unknown as FetchMock;
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const client = new HttpColdPilotClient();
    await expect(client.listAnomalyEvents()).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INTERNAL',
      status: 502,
    });
  });

  it('encodes path parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonOk([])) as unknown as FetchMock;
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const client = new HttpColdPilotClient();
    await client.listSecurityAuditEntries('evt 1/weird');
    expect(lastCallUrl(fetchMock)).toBe('/api/v1/anomaly-events/evt%201%2Fweird/security-audit');
  });
});
