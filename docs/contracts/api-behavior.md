# ColdPilot 接口行为说明（前端草案配套）

> 与 `openapi.frontend-draft.yaml` 配套使用。OpenAPI 定义「结构」，本文档定义「行为」：
> 异步任务如何推进、前端如何轮询、错误如何表达、审批与安全的语义、数据归属（provenance）。
> 后端实现时**结构以 OpenAPI 为准，行为以本文档为准**；二者冲突请联系前端对齐，不得擅自变更。

## 1. 通用约定

| 项 | 约定 |
|----|------|
| Base URL | `/api/v1`（示意，由部署决定） |
| 时间格式 | ISO-8601 UTC 字符串，如 `2026-07-23T09:15:00Z` |
| 字符编码 | UTF-8，JSON |
| 数据归属 | 所有响应含 `provenance`: `demo` \| `simulated` \| `real`，后端必须透传 |
| 幂等 | 创建类 POST（diagnosis / approval-requests / execution）对同一输入应幂等或返回冲突 |

## 2. 异步任务与轮询

诊断、执行 + 验证为异步任务，统一采用「创建 → 轮询」两段式：

```
POST 创建任务        → 返回任务句柄（含 id、初始 status）
GET  轮询任务状态    → 返回当前快照（status 逐步推进，附渐进数据）
直至 status 进入终态  → 前端再 GET 关联结果资源
```

### 2.1 状态机（任务级）

诊断任务 `AgentTask.status`：`pending → running → succeeded | failed`
执行任务 `ExecutionTask.status`：`pending → executing → verifying → recovered | failed`

- 前端按建议频率轮询（mock 用 320ms，生产建议 1s）。
- 任务快照可携带**渐进揭示**的数据（如诊断的 `toolCalls` 逐条出现、执行的 `observedSeries` 逐步填充）。
- 进入终态后，前端额外拉取结果：
  - 诊断 `succeeded` → `GET /agent-tasks/{taskId}/diagnosis-result` + `GET /anomaly-events/{eventId}/control-plans`
  - 执行 `recovered` → `GET /anomaly-events/{eventId}/report`

### 2.2 时序语义

- 后端应保证 `startedAt` / `finishedAt` 与状态一致（终态必有 `finishedAt`）。
- 轮询是**幂等只读**，可安全重试；前端对轮询失败静默重试。

## 3. 错误模型

错误响应用统一结构：

```json
{ "error": { "code": "INVALID_STATE", "message": "…", "details": {} } }
```

| code | HTTP | 含义 | 前端处理 |
|------|------|------|----------|
| `NOT_FOUND` | 404 | 资源不存在 |  toast / 空态 |
| `INVALID_STATE` | 409 | 当前状态不允许该操作（如未仿真即审批、未批准即执行） | 前端守卫已拦截，理论上不出现；出现时提示并保持现状 |
| `VALIDATION` | 400 | 参数校验失败 | 展示 `message` |
| `FORBIDDEN` | 403 | 越权（如 L3 动作） | 提示禁止 |
| `CONFLICT` | 409 | 幂等冲突（重复创建） | 复用已有资源 |
| `INTERNAL` | 500 | 服务内部错误 | 提示重试 |

前端在「状态守卫」层先拦截非法操作（按钮禁用），因此 `INVALID_STATE` 正常路径不触发；
后端仍**必须**独立校验，不能依赖前端守卫。

## 4. 审批与安全语义

- **L0**：只读观察，前端无写操作。
- **L1**：建议性操作，不进入执行链路（本 MVP 不涉及）。
- **L2**：参数调整类，**必须** `requestApproval` → `submitApproval(approved)` 后才能 `startExecution`。
- **L3**：危险动作（如关闭安全联锁）。**永久禁止执行**，仅产生 `SecurityAuditEntry`（`decision: blocked`），
  用于在 UI 展示「系统拦截了 L3」。后端不应对 L3 提供任何可执行端点。

执行失败或验证未通过时，系统进入**安全回退**（`safeFallback`）：回退到传统规则 / PID 控制，
等待人工接管。前端对此是一等状态，不是错误页。

## 5. provenance（数据归属）

前端据此在界面标注「演示数据 / 仿真结果 / 真实数据」：

- `demo`：演示种子数据（事件、库房、设备、遥测）。
- `simulated`：仿真 / 模拟计算结果（仿真曲线、预计指标、模拟执行的恢复过程）。
- `real`：真实接入后才有；MVP 阶段不出现。

后端**不得**把 `demo`/`simulated` 标记为 `real`，也不得省略该字段。

## 6. 与前端 `ColdPilotClient` 的映射

前端通过唯一接口 `ColdPilotClient`（`frontend/src/api/coldPilotClient.ts`）访问后端，
13 个方法与本文档 operationId 一一对应。替换 mock 为 http 时，仅需为该接口提供 HTTP 实现。
详见 `docs/handoff/FRONTEND_HANDOFF.md`。