# ColdPilot 前端交接文档（FRONTEND_HANDOFF）

> 读者：负责实现 ColdPilot **后端**的模型 / 工程师。
> 目的：让你在不读前端源码细节的前提下，正确理解前端已固化的边界、数据契约、状态机与
> 安全语义，并据此实现与之兼容的 HTTP API。**前端不依赖你未确认的实现细节；你也不应依赖前端未公开的内部。**

---

## 0. 一句话概览

前端是一个可独立运行的 React MVP，通过**唯一数据接口 `ColdPilotClient`** 消费后端能力。
当前该接口由进程内 Mock 实现（`VITE_DATA_MODE=mock`）。你实现的后端只需让这 13 个方法
对应的 HTTP 端点按 OpenAPI 结构 + api-behavior 语义工作，前端即可零改动切换。

---

## 1. 仓库目录树（仅与本阶段相关）

```
xianniu/
├─ frontend/                          # 前端唯一交付物
│  ├─ src/
│  │  ├─ api/                         # 数据边界（接口 + mock 实现 + 工厂）
│  │  │  ├─ coldPilotClient.ts        #   ★ ColdPilotClient 接口（唯一契约边界）
│  │  │  ├─ mockColdPilotClient.ts    #   Mock 实现（唯一读取 mock 数据之处）
│  │  │  ├─ apiErrors.ts              #   统一错误模型
│  │  │  └─ index.ts                  #   工厂：按 VITE_DATA_MODE 返回实现
│  │  ├─ domain/
│  │  │  │  ├─ types/                 #   领域类型（与 OpenAPI schemas 对应）
│  │  │  │  └─ constants/             #   枚举/常量（severity、审批级、任务状态、指标）
│  │  ├─ state/
│  │  │  │  ├─ workbenchMachine.ts    #   ★ 工作台状态机（转换 + 守卫）
│  │  │  │  └─ useWorkbench.ts        #   编排 hook（轮询、数据装配、动作）
│  │  ├─ features/                    #   业务组件（anomaly/diagnosis/simulation/approval/execution/report/inspector）
│  │  ├─ components/{ui,domain}/      #   通用与领域展示组件
│  │  ├─ layouts/                     #   AppShell / WorkbenchLayout（三栏，窄屏折叠）
│  │  ├─ pages/                       #   路由页（工作台为产品重心，其余占位）
│  │  └─ mocks/                       #   演示种子数据（仅被 MockClient 读取）
│  └─ package.json / vite.config.ts / vitest.config.ts
├─ docs/
│  ├─ product/coldpilot-prd-v1.0.pdf  # 产品需求
│  ├─ contracts/
│  │  ├─ openapi.frontend-draft.yaml  # ★ 接口结构契约
│  │  └─ api-behavior.md              # ★ 接口行为契约
│  └─ handoff/
│     ├─ FRONTEND_HANDOFF.md          # 本文档
│     └─ DECISIONS.md                 # 关键决策记录
└─ README.md
```

---

## 2. 技术栈与依赖

- **运行时**：React 18、TypeScript 5、Vite 6、React Router 6、Apache ECharts 5（按需引入）、lucide-react。
- **测试**：Vitest 2、@testing-library/react 16、jsdom。
- **样式**：CSS Variables（设计 Token）+ CSS Modules，无 UI 框架、无 Tailwind。
- **状态**：React `useReducer`（工作台状态机）+ `useState`（数据装配），无 Redux/Zustand。
- **包管理**：pnpm。

依赖白名单（`frontend/package.json`）即全部依赖；未引入 axios（http 实现时用原生 `fetch`）。

---

## 3. ColdPilotClient 接口（唯一契约边界）

前端所有数据访问收敛于 `frontend/src/api/coldPilotClient.ts` 的 13 个方法，
与 OpenAPI 的 operationId 一一对应：

| 方法 | OpenAPI operationId | 说明 |
|------|--------------------|------|
| `listAnomalyEvents()` | `listAnomalyEvents` | 事件列表 |
| `getAnomalyEvent(eventId)` | `getAnomalyEvent` | 事件详情（库房/设备/库存/时序/库房事件） |
| `startDiagnosis(eventId)` | `startDiagnosis` | 发起诊断（异步） |
| `getAgentTask(taskId)` | `getAgentTask` | 轮询诊断任务 |
| `getDiagnosisResult(taskId)` | `getDiagnosisResult` | 诊断结果（原因排序 + 正反证据） |
| `listControlPlans(eventId)` | `listControlPlans` | 候选控制方案（均 L2） |
| `runSimulation(planId)` | `runSimulation` | 仿真（预计指标 + 预测曲线） |
| `requestApproval(planId)` | `requestApproval` | 创建审批请求（仅 L2） |
| `submitApproval(requestId, decision)` | `submitApproval` | 批准 / 驳回 |
| `startExecution(planId)` | `startExecution` | 发起执行（异步） |
| `getExecutionTask(taskId)` | `getExecutionTask` | 轮询执行 + 验证 |
| `getEventReport(eventId)` | `getEventReport` | 事件报告 |
| `listSecurityAuditEntries(eventId)` | `listSecurityAuditEntries` | 安全审计（含 L3 拦截） |

> 类型定义见 `frontend/src/domain/types/`，与 OpenAPI `components/schemas` 对齐。

---

## 4. Mock 行为说明（后端的「参照实现」）

`MockColdPilotClient` 是后端的可运行参照。其关键行为，后端应保持一致语义：

- **异步任务时间驱动**：诊断 / 执行任务以 `createdAt` + 时长推进状态；GET 轮询按 `elapsed`
  计算当前状态并**渐进揭示**（诊断工具调用逐条出现、执行观测序列逐步填充）。
- **守卫同后端**：`requestApproval` 在方案未仿真时抛 `INVALID_STATE(409)`；
  `startExecution` 在方案未批准时抛 `INVALID_STATE(409)`。后端必须独立校验，不得依赖前端守卫。
- **失败注入（仅演示/测试，不属于数据契约）**：`DemoControls.armFailureOnce(kind)` 让下一次
  诊断/仿真/执行失败一次；`resetScenario()` 复位。`getDemoControls()` 仅在 mock 模式返回，http 模式为 `null`。
- **构造器可注入时序**：`new MockColdPilotClient({ latencyMs, diagnosisMs, executionMs, verificationMs }, now)`，
  测试用零时序保证确定性。

---

## 5. 工作台状态机（前端业务真相）

`frontend/src/state/workbenchMachine.ts`。15 个状态 / 16 个事件；**非法转换返回 `null` 被 reducer 拒绝**，
保证不可能状态组合。核心链路与守卫：

```
detected → diagnosing → diagnosisCompleted
  → simulating → simulationCompleted
  → awaitingApproval → approved
  → executing → verifying → recovered
```

- 失败分支：`diagnosisFailed`（可重试）、`simulationFailed`（可重跑）、`rejected`（可改方案重跑）、
  `executionFailed`（可进入安全回退）。
- **守卫**：
  - 未仿真（`simulationCompleted` 且当前方案已仿真）不得 `REQUEST_APPROVAL`；
  - 非 L2 方案不得进入审批（L3 永不审批）；
  - 未 `approved` 不得 `START_EXECUTION`；
  - 执行/验证失败不得直接 `recovered`；
  - `ENTER_SAFE_FALLBACK` 与 `RESET` 在任意状态可达。
- `canTransition(state, event)` 供 UI 禁用按钮（守卫前置）。

后端无需复制该状态机，但**必须**保证与之对应的资源状态转换合法（见 api-behavior.md §2/§4）。

---

## 6. L2 审批实现（前端视角）

- 候选方案均 `approvalLevel: 'L2'`。
- 流程：`runSimulation`（得预计指标）→ `requestApproval`（返回含 5 项安全校验 `safetyChecks`，全部 `passed`）
  → 前端二次确认 → `submitApproval({decision:'approved'})` → 状态 `approved` → 允许 `startExecution`。
- 驳回：`submitApproval({decision:'rejected', reason})` → `rejected`，可改方案重新仿真再审批。
- 安全校验 5 项：参数白名单、上下限、变化速率、冲突检测、权限校验（见 OpenAPI `SafetyCheckItem`）。

---

## 7. L3 拦截

- L3 = 危险动作（示例：「关闭压缩机联锁保护以强制满负荷降温」）。
- 前端**不提供**任何 L3 执行入口；仅以 `SecurityAuditEntry{ decision:'blocked', ruleId:'RULE-SAFETY-001' }`
  在检查器「安全审计」块展示「系统已拦截 L3」。
- 后端不应为 L3 提供可执行端点；只需能产生相应审计记录。

---

## 8. OpenAPI 契约位置

`docs/contracts/openapi.frontend-draft.yaml`（OpenAPI 3.1，13 paths / 37 schemas，已通过 YAML 校验）。
**结构以此为准**。行为（轮询、错误、审批、安全、provenance）以 `docs/contracts/api-behavior.md` 为准。

---

## 9. Mock → HTTP 切换步骤

前端只暴露一个工厂 `frontend/src/api/index.ts`：

```ts
export function getColdPilotClient(): ColdPilotClient {
  if (import.meta.env.VITE_DATA_MODE === 'http') {
    // TODO: return new HttpColdPilotClient(fetch, baseUrl)
    throw new Error('http 模式尚未实现');
  }
  return mockSingleton;
}
```

接入步骤：
1. 新增 `frontend/src/api/httpColdPilotClient.ts`：`class HttpColdPilotClient implements ColdPilotClient`，
   用原生 `fetch` 按 OpenAPI 调用各端点，把 HTTP/JSON 映射为领域类型，把错误映射为 `ApiError`。
2. 在 `getColdPilotClient()` 的 http 分支返回该实例（读 `VITE_API_BASE_URL`）。
3. 设 `VITE_DATA_MODE=http` 运行。**页面组件与状态机零改动**。

> 组件从不直接 import mock；异步只发生在 Client 内，UI 不用 `setTimeout` 模拟后端。

---

## 10. 构建 / 类型检查 / 测试

| 命令 | 结果 |
|------|------|
| `pnpm typecheck` | ✅ 通过（`tsc --noEmit`，无错误） |
| `pnpm build` | ✅ 通过（typecheck + vite build，产出 `dist/`） |
| `pnpm test` | ✅ 19 通过（3 个测试文件） |

测试构成：
- `workbenchMachine.test.ts`（12）：状态机主链路、各失败分支、守卫、安全回退、重置。
- `workbenchFlow.test.tsx`（6）：经真实 `useWorkbench` + 零时序 mock 的端到端流程（含失败注入、守卫、重置）。
- `smoke.test.tsx`（1）：渲染冒烟。

---

## 11. 响应式

- **≥1440px**：三栏（事件列表 260 / 诊断主体弹性 / 检查器 360）。
- **1024–1439px**：检查器默认折叠为右侧把手，可点击展开/收起（用户偏好本次会话内记忆）。
- **≤1100px**：事件列表收窄至 200px，保证诊断主体可读。
- 断点逻辑：`frontend/src/utils/useMediaQuery.ts` + `layouts/WorkbenchLayout.*`。

---

## 12. 已知限制（MVP 边界）

- 仅「异常事件工作台」为完整实现；指挥中心 / 设备与库存 / 报告与审计 / 系统设置为占位页（`EmptyState`）。
- 无真实后端 / 数据库 / WebSocket / 认证 / PLC 连接；无真实数字孪生 / 真实 AI Agent。
- 仿真曲线、预计指标、模拟执行恢复过程均为 `simulated`（仿真结果），非真实物理仿真。
- 演示时序数据基于固定 UTC 参考时间生成；时间展示统一按 UTC 渲染，保证跨时区一致。
- `http` 数据模式为占位（抛错），待后端就绪后按 §9 实现。
- ECharts 打入主包，首屏 JS ~778 kB（gzip ~257 kB）；如需可做代码分割（非本阶段目标）。

---

## 13. 运行命令

```bash
cd frontend
pnpm install
pnpm dev         # http://localhost:5173 （默认 mock，工作台在 /workbench）
pnpm build
pnpm test
pnpm typecheck
```

演示动线（评委脚本）：异常已发现 → 开始诊断 → 工具调用逐步展示 → 原因排序 + 正反证据
→ 选方案 → 仿真 → A/B 对比 → 安全校验 → L2 审批（批准/驳回）→ 模拟执行 → 验证恢复 → 生成报告。
分支可演示：诊断失败重试、仿真失败重试、驳回后切换方案、执行失败→安全回退、L3 拦截、重置演示。

---

## 14. 给后端的「不要假设」清单

- 不要假设前端会传 `planId` 之外的身份/权限信息；审批人当前固定为演示值，真实接入后由认证提供。
- 不要依赖前端守卫替代后端校验；所有 `INVALID_STATE`/`FORBIDDEN` 后端必须独立判断。
- 不要把 `demo`/`simulated` 数据当真实成果返回（provenance 必须如实透传）。
- 不要为 L3 动作开放任何可执行端点。
- 不要修改前端已确认的请求/响应结构；如需变更，先更新 OpenAPI 并与前端对齐。

---

## 15. 最后提交

见 git 历史（`git log --oneline`）。本阶段以多次本地提交推进（脚手架 → 契约/Mock → 状态机 →
外壳路由 → 诊断工作台 → 仿真审批执行 → 集成测试 → 响应式 → 文档）。未推送远程。