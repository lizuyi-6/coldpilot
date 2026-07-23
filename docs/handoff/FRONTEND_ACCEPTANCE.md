# ColdPilot 前端验收文档（FRONTEND_ACCEPTANCE）

> 本文档是前端 MVP 的**冻结验收快照**。后端模型据此确认前端边界、验证结果与交接就绪状态。
> 配套阅读：`FRONTEND_HANDOFF.md`（如何对接）、`DECISIONS.md`（取舍缘由）、
> `../contracts/openapi.frontend-draft.yaml` + `../contracts/api-behavior.md`（契约）。

## 1. 验收日期
2026-07-23

## 2. 最终 commit hash
`9a1f982794e699f472003b3358a4c59a8952a804`（验收后冻结提交见文末「最终提交」）

## 3. Git 工作区状态
干净（`git status --short` 无输出）。无未提交的源码 / 文档 / 截图。
未跟踪 / 误提交检查：无 `node_modules`、`dist`、缓存、密钥；`frontend/.env` 仅含非机密 `VITE_DATA_MODE=mock`（刻意保留的运行模板），`.env.local`/`.env.*.local` 已被 `.gitignore` 排除。

## 4. Node / pnpm 版本
- Node：`v24.13.1`
- pnpm：`10.30.1`

## 5. typecheck 结果
`pnpm typecheck`（`tsc --noEmit`）→ **通过，0 错误**。

## 6. build 结果
`pnpm build`（`tsc --noEmit && vite build`）→ **通过**（`built in ~50s`）。
仅有 chunk 体积提示（ECharts 打入主包，~778 kB / gzip ~257 kB），非错误，MVP 不处理。

## 7. test 结果
`pnpm test`（`vitest run`）→ **19 通过 / 3 文件**：
- `workbenchMachine.test.ts`（12）：状态机主链路、各失败分支、守卫、安全回退、重置。
- `workbenchFlow.test.tsx`（6）：经真实 `useWorkbench` + 零时序 mock 的端到端流程（含失败注入、守卫、重置）。
- `smoke.test.tsx`（1）：渲染冒烟。

## 8. lint 状态
**N/A — 未配置 lint 脚本**（`package.json` 无 `lint`）。按收尾要求未临时安装 lint 工具。

## 9. 当前已完成页面
- **异常事件工作台**（`/workbench`，产品重心，完整实现）：
  事件列表（筛选/严重度/状态）→ 诊断主体（事件头、多指标趋势图、现场事实带、工具调用轨迹、
  原因排序+正反证据、追问输入）→ 方案检查器（A/B 方案、仿真指标、控制参数、回退条件、
  安全审计、L2 审批操作、失败注入）→ A/B 对比模态 → 执行监视 → 事件报告。
  全闭环：检测→诊断→仿真→审批→执行→验证→恢复→报告；失败/重试/驳回/安全回退/L3 拦截/重置均可演示。
- App 外壳与路由（全局导航 + 顶栏 + 7 条路由）。

## 10. 当前未完成页面（均为占位 `EmptyState`）
- 指挥中心（`/command-center`）
- 设备与库存（`/assets`）
- 报告与审计（`/reports`）
- 系统设置（`/settings`）

## 11. ColdPilotClient 文件位置
`frontend/src/api/coldPilotClient.ts`（13 个方法的接口，前端唯一数据边界）。

## 12. Mock Client 文件位置
`frontend/src/api/mockColdPilotClient.ts`（实现 `ColdPilotClient` + `DemoControls`；唯一读取 `src/mocks/` 之处）。

## 13. OpenAPI 文件位置
`docs/contracts/openapi.frontend-draft.yaml`（OpenAPI 3.1，13 paths / 37 schemas，已校验并标记 `x-contract-status: agreed-for-backend-implementation`）。

## 14. api-behavior 文件位置
`docs/contracts/api-behavior.md`（轮询、错误模型、审批与安全语义、provenance）。

## 15. FRONTEND_HANDOFF 文件位置
`docs/handoff/FRONTEND_HANDOFF.md`

## 16. DECISIONS 文件位置
`docs/handoff/DECISIONS.md`

## 17. 截图位置
- 1440px（三栏展开）：`docs/screenshots/workbench-1440.png`
- 1024px（检查器折叠为把手）：`docs/screenshots/workbench-1024.png`

## 18. L2 审批实现结论
候选方案均 `approvalLevel=L2`。链路：仿真 → `requestApproval`（返回 5 项安全校验，全部通过）→ 前端二次确认 → `submitApproval(approved)` → 状态 `approved` → 方允许 `startExecution`。驳回走 `rejected`，可改方案重新仿真再审批。**结论：L2 人工把关链路完整实现并经浏览器 + 集成测试验证。**

## 19. L3 拦截实现结论
L3（示例「关闭压缩机联锁保护以强制满负荷降温」）**无任何执行入口**，仅以 `SecurityAuditEntry{decision:'blocked', ruleId:'RULE-SAFETY-001'}` 在检查器「安全审计」块展示「系统已拦截」。**结论：L3 永久禁止执行，仅产生拦截审计，符合安全设计。**

## 20. Mock 替换为真实后端的入口
工厂 `frontend/src/api/index.ts` 的 `getColdPilotClient()`。接入步骤（详见 HANDOFF §9）：
新增 `HttpColdPilotClient implements ColdPilotClient`（原生 `fetch` 按 OpenAPI 调用）→ 在工厂 http 分支实例化（读 `VITE_API_BASE_URL`）→ 设 `VITE_DATA_MODE=http`。**页面组件与状态机零改动。**
当前 http 分支显式抛错「尚未实现」，不会静默回退到 mock。

## 21. 已知限制
- 仅工作台为完整实现，其余四个一级页为占位。
- 无真实后端 / 数据库 / WebSocket / 认证 / PLC；无真实数字孪生 / 真实 AI Agent。
- 仿真曲线、预计指标、模拟执行恢复过程均为 `simulated`，非真实物理仿真成果。
- 演示时序基于固定 UTC 参考时间；时间统一按 UTC 渲染。
- http 数据模式为占位（显式抛错），待后端就绪后按 HANDOFF §9 实现。
- ECharts 打入主包致首屏 JS 较大，可后续代码分割（非本阶段目标）。
- 未配置 lint；无 CI。

## 22. 是否具备交接给后端模型的条件
**是。** 前端边界（`ColdPilotClient`）、结构契约（OpenAPI）、行为契约（api-behavior）、
对接指南（HANDOFF）、取舍记录（DECISIONS）与本验收快照齐备；
隔离边界经核查成立（见下「边界核查」），后端可据此独立实现并零改动对接前端。

---

## 边界核查（验收时实测）
- 页面 / 组件 / 布局 / 状态机**均未** import `@/mocks`（检索为空）。
- `MockColdPilotClient` 仅被 `api/index.ts`（工厂）、自身实现、接口文档注释、集成测试引用 —— 无生产页面 / 组件直接依赖。
- UI 与状态机只依赖 `ColdPilotClient` 接口或注入实例。
- UI 中**无** `setTimeout` 模拟后端：仅 Mock Client 的 `delay()`（受许可）、`useWorkbench` 的轮询循环、`DemoControlsBar` 的 2 秒提示清除（纯视觉反馈）。
- 无真实 `fetch` / Axios / WebSocket / XMLHttpRequest / EventSource / 后端服务。
- Mock 数据只由 Mock Client 读取。
- http 模式显式抛错，不静默回退 mock；未创建 `HttpColdPilotClient` 空壳。

---

## 最终提交
本文件提交于 `chore(frontend): freeze frontend handoff`（本地，不推送远程）。