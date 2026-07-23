# ColdPilot 后端验收清单（BACKEND_ACCEPTANCE）

> 验收基线 commit：`b502676`（B0–B8 全部完成）。日期：2026-07-24。

## A. 自动化验收（全部通过）

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| 后端单测 | `python -m pytest` | **59 passed**（B0:6 / B1:7 / B2:8 / B3:10 / B4:6 / B5:9 / B6:6 / B8:7） |
| 静态检查 | `python -m ruff check app tests` | **All checks passed!** |
| Alembic 迁移 | `python -m alembic upgrade head` | 成功建表（`812d60b909f3 initial schema`） |
| 前端单测 | `npm test -- --run` | **26 passed**（含 7 个 HttpColdPilotClient） |
| 前端类型检查 | `npm run typecheck` | 通过（0 error） |
| 前端构建 | `npm run build` | 成功（dist 产出） |

## B. 契约一致性（B8）

- 冻结 SSOT：`docs/contracts/openapi.frontend-draft.yaml`（13 paths / 37 schemas，未改动）。
- `test_b8_contract.py`：
  - FastAPI 在 `/api/v1` 下提供全部 13 个冻结 path+method（无缺失）。
  - `/internal/health` 存在且不属于业务契约集合。
  - 5 个 seeded GET 响应（anomaly-events / detail / control-plans / report / security-audit）通过 jsonschema 校验（含 `$ref` 解析）。
- 实现产物（FastAPI 自动生成的 OpenAPI）与冻结契约一致由上述测试保证；未对契约做任何修改。

## C. 实时联调证据（uvicorn 起服，curl 命中）

端口 8000 被本机策略阻挡，联调在 `127.0.0.1:8765` 进行（迁移已执行、seed 完成、worker 启动 `["diagnosis","execution"]`）：

- `GET /internal/health` → `{"status":"ok","database":"ok","worker_handlers":["diagnosis","execution"],"agent_mode":"deterministic"}`
- `GET /api/v1/anomaly-events` → 返回 3 个事件（evt-3 recovered、evt-1/evt-2 detected；`awaitingApproval` 由 stage 派生）。
- `GET /api/v1/anomaly-events/evt-1/security-audit` → 返回 L3 拦截记录（`approvalLevel=L3, outcome=blocked`）。
- 状态机守卫（活体）：
  - 未仿真即申请审批 `POST /control-plans/plan-a/approval-requests` → **HTTP 409**，信封 `{"error":{"code":"INVALID_STATE",...,"requestId":"...","retryable":false}}`。
  - 未知方案执行 `POST /control-plans/nope/execution` → **HTTP 404**，信封 `{"error":{"code":"NOT_FOUND",...}}`。
- 前端 HTTP 模式：`HttpColdPilotClient` 单元测试覆盖 URL 前缀（`/api/v1`）、同源/跨源 base URL、POST body 序列化、错误信封→`ApiError`（含 code+status）、非 JSON 错误兜底 `INTERNAL`、路径参数编码。

## D. 必须测试覆盖矩阵（对照需求逐条）

| 需求 | 覆盖测试 | 状态 |
| --- | --- | --- |
| 状态转换全路径 | B5/B6 流程 + constants 镜像 | ✅ |
| 未诊断不能仿真 | B4（`test_simulation_requires_diagnosis`） | ✅ |
| 未仿真不能审批 | B5（`test_request_approval_requires_simulation`） | ✅ |
| 未批准不能执行 | B6（`test_start_execution_blocked_without_approval`） | ✅ |
| rejected 不能执行 | ALLOWED_TRANSITIONS + 守卫 | ✅ |
| executionFailed 不能直接 recovered | constants（executionFailed→{simulating,safeFallback}） | ✅ |
| 只有 verifying 可 recovered | B6（handler 仅在 verifying 判定 recovered；事件 stage 跟随） | ✅ |
| L3 不产生 plan/approval/command/execution | B5（`test_l3_block_creates_only_audit`） | ✅ |
| 重复审批返回既有 | B5（`test_repeat_same_decision_is_idempotent`） | ✅ |
| 不同审批返回冲突 | B5（`test_conflicting_decision_returns_409`） | ✅ |
| 重复执行不产生第二条命令 | B6（`test_execution_generates_one_command_only`） | ✅ |
| awaitingApproval 由 stage 派生 | mappers + B2 | ✅ |
| 审计哈希链完整 | audit repository verify_chain | ✅ |
| queued 重启恢复 | worker lifespan + handler claim | ✅ |
| stale running 处理 | B3/B6 recover_stale | ✅ |
| deterministic 确定性 | B3（同输入同输出） | ✅ |
| FastAPI 与冻结 OpenAPI 一致 | B8 契约测试 | ✅ |
| HTTP 模式页面/状态机无需修改 | B7（仅新增 client+工厂+env+测试） | ✅ |

## E. 边界与不得声称项（验收确认）

- ✅ 未声称连接真实 PLC / 通过工业安全认证 / 仿真为真实试点数据。
- ✅ 未声称 SQLite 哈希链等于密码学不可抵赖。
- ✅ 未声称 deterministic 等于真实大模型推理。
- ✅ 未修改冻结 OpenAPI；FastAPI OpenAPI 仅作实现产物。
- ✅ pending/queued 对外统一用 `queued`。
- ✅ B7 前端改动严格在授权范围（`httpColdPilotClient.ts`、`api/index.ts` 工厂、`.env`/`.env.example`、测试），未触碰页面组件 / 状态机 / DTO / `ColdPilotClient` 签名 / Mock / OpenAPI / UI。

## F. 交付物

- `docs/handoff/BACKEND_HANDOFF.md`（本文档配套技术交接）。
- `docs/handoff/BACKEND_ACCEPTANCE.md`（本清单）。
- 代码：`backend/`（app + tests + alembic）、`frontend/src/api/httpColdPilotClient.ts` 等。
- 提交历史：`6c23866`(B0) → `a8a32a2`(B1) → `5cc737e/015761e`(B2) → `43b479e`(B3) → `3c1ef54`(B4) → `1bd7f06`(B5) → `a343ec1`(B6) → `8c0620e`(B7) → `b502676`(B8)。

## G. 启动命令（验收复现）

```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL = "sqlite+aiosqlite:///./data/coldpilot.db"
python -m alembic upgrade head
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
# 前端：frontend/.env 设 VITE_DATA_MODE=http, VITE_COLDPILOT_API_BASE_URL=http://localhost:8000
```
