# 鲜知 ColdPilot 前端页面交付报告

日期：2026-07-24 ｜ 范围：按《ColdPilot_前端页面实现任务书》完成 9 个页面的重构与统一验收

## 1. Commit Hash

工作区未初始化 git 仓库（`X:\xianniu` 非 git repo），无 commit hash。交付以文件系统状态为准。

## 2. 页面路由与组件清单

| 页面 | 路由 | 页面组件 | 主要特性组件 |
| --- | --- | --- | --- |
| 首页看板 | `/command-center` | `pages/CommandCenterPage.tsx` | `features/commandCenter/*` |
| 实时监控 | `/monitoring` | `pages/MonitoringPage.tsx` | `features/monitoring/*` |
| 异常告警 | `/events` | `pages/EventsPage.tsx` | `features/events/*` |
| Agent 对话 | `/workbench` | `pages/AnomalyWorkbenchPage.tsx` | `features/agent/*`、`state/workbenchMachine*`（含 HYDRATE 水合） |
| 策略与仿真 | `/strategy` | `pages/StrategyPage.tsx` | `features/strategy/*`（PlanSummaryCards / ControlPlanTable / SafetyCheckPanel / StrategyApprovalPanel）、`components/domain/PredictionChart` |
| 设备管理 | `/devices` | `pages/DevicesPage.tsx` | `features/devices/*`（DeviceDetailPanel） |
| 库存管理 | `/inventory` | `pages/InventoryPage.tsx` | `features/inventory/*`（BatchDetailPanel） |
| 能耗分析 | `/energy` | `pages/EnergyPage.tsx` | `features/energy/*`（EnergyTrendChart / PeriodDonut） |
| 报告中心 | `/reports` | `pages/ReportsAuditPage.tsx` | `features/reports/*`（ReportDetailSection / AuditLogTab） |
| 系统管理 | `/settings` | `pages/SettingsPage.tsx` | `features/settings/*`、`utils/uiPrefs.ts` |

通用：`layouts/AppShell.tsx`（导航折叠接入界面设置）、`state/appData.tsx`（唯一数据边界）、`api/httpColdPilotClient.ts`（HTTP 模式）、`api/mockColdPilotClient.ts`（演示模式）。

## 3. 每页接口与禁用原因

| 页面 | 使用接口（HTTP 模式） | 禁用 / 暂无数据及原因 |
| --- | --- | --- |
| 实时监控 | `listAnomalyEvents`、`getAnomalyEvent`（库房遥测/事件标记） | 导出 CSV 为前端导出（后端无导出接口） |
| 异常告警 | `listAnomalyEvents` | — |
| Agent 对话 | `runDiagnosis`、`getAgentTask`、`getDiagnosisResult`、`listControlPlans`（HYDRATE） | — |
| 策略与仿真 | `listControlPlans`、`runSimulation`、`requestApproval`、`approvePlan`、`rejectPlan`、`startExecution` | 节能调度 Tab 暂无数据（无后端接口）；分时段逐小时计划未下发（以参数×方案对比替代）；温度波动/设备负荷安全项暂无数据 |
| 设备管理 | `getAnomalyEvent`（设备清单） | 「采纳建议」禁用（无后端写接口）；运行趋势/维护记录暂无数据 |
| 库存管理 | `getAnomalyEvent`（库存批次） | 「生成处置单」禁用（无后端写接口）；导出 CSV 为前端导出 |
| 能耗分析 | 遥测电表指标 + `listControlPlans`/`runSimulation`（仿真节能列） | 日/周/月粒度暂无数据（仅 24h 分时）；昨日×1.06、本周×6.8、电价 0.6 元/kWh、设备分摊比例为确定性派生，页面均标注 |
| 报告中心 | `getEventReport`、`listSecurityAuditEntries`（跨事件聚合）、`getAnomalyEvent` | 通用操作审计未接入（仅 L3 拦截留痕）；requestId/correlationId 未下发；附件无接口仅展示说明；导出 CSV 为前端导出 |
| 系统管理 | 无（纯前端） | Agent 配置各项暂无数据（未由后端下发，脱敏）；界面设置仅写 localStorage |

## 4. 门禁结果（最终统一验收）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| typecheck | `pnpm typecheck` | 通过（0 错误） |
| build | `pnpm build` | 通过（14.64s；单 chunk 1.0MB，ECharts 体积警告，不阻断） |
| test | `pnpm test` | 通过（6 个测试文件，41/41） |
| lint | `pnpm lint` | 通过（0 errors，3 warnings：exhaustive-deps 建议 + fast-refresh 导出提示，均良性） |

每页 Playwright 交互验证（真 Chrome + 本地后端）在开发期间全部通过：监控 8/8、告警 8/8、Agent 9/10、策略 13/13、设备 11/11、库存 9/9、能耗 10/10、报告 12/12、系统管理 13/13。

## 5. 真实页面截图（1440px 全页，非效果图）

位于 `frontend/acceptance/`：

- `final-realtime-1440.png`（实时监控）
- `final-alerts-1440.png`（异常告警）
- `final-agent-1440.png`（Agent 对话）
- `final-simulation-1440.png`（策略与仿真）
- `final-devices-1440.png`（设备管理）
- `final-inventory-1440.png`（库存管理）
- `final-energy-1440.png`（能耗分析）
- `final-reports-1440.png`（报告中心）
- `final-settings-1440.png`（系统管理）

## 6. 已知限制

1. **evt-3（压差波动）**：后端种子将其置为 `recovered` 但未生成报告，报告状态如实显示「不可用」（`GET /anomaly-events/evt-3/report` 返回 404）。
2. **审计日志**：后端仅有按事件的 L3 拦截接口，无通用操作审计（登录/审批/执行），页面已明确标注；requestId/correlationId 存于后端库但未由接口下发。
3. **派生指标**：能耗页昨日/本周/单位库存能耗等为确定性派生（×1.06/×6.8/真实比值），策略页推荐理由为模板句+真实仿真数字；所有派生均有 provenance 标注，不冒充真实计量。
4. **时间线**：告警通知、审批与恢复完成时间未由后端记录，报告详情仅展示有真实时间戳的节点。
5. **构建体积**：单 chunk 1.0MB（ECharts 按需注册后仍较大），未做路由级代码分割；为体积警告，不影响功能。
6. **演示数据演进**：交互验证会真实推进后端事件阶段（如 evt-1 → approved）；前端通过状态机 HYDRATE 水合保证进行中事件在策略/Agent 页保持可用。重置演示：杀 python 进程 → 删 `backend/data/coldpilot.db` → `python -m alembic upgrade head` → 重启 uvicorn。

## 7. 运行命令

```powershell
# 后端（首次或重置后需先建表）
cd X:\xianniu\backend
.venv\Scripts\python -m alembic upgrade head
.venv\Scripts\python -m uvicorn app.main:app --port 8000

# 前端（.env 已配置 VITE_DATA_MODE=http + 后端地址）
cd X:\xianniu\frontend
pnpm install
pnpm dev        # http://localhost:5173

# 门禁
pnpm typecheck; pnpm build; pnpm test; pnpm lint
```
