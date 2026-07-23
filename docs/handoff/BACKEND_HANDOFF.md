# ColdPilot 后端交接文档（BACKEND_HANDOFF）

> 版本：B0–B8 全部完成。最终 commit：`b502676`。本文档面向后端维护者，描述如何运行、测试、扩展本服务。

## 1. 技术栈与版本

| 组件 | 版本 | 说明 |
| --- | --- | --- |
| Python | 3.12.10 | `backend/.venv` |
| FastAPI | 0.115.6 | 单进程 `uvicorn app.main:app --workers 1` |
| Pydantic | v2（2.x） | 契约响应模型，camelCase |
| SQLAlchemy | 2.0.36（async + aiosqlite 0.20.0） | SQLite WAL |
| Alembic | 1.14.0 | 迁移 |
| structlog | 24.4.0 | 结构化日志 |
| pytest / pytest-asyncio / httpx / jsonschema / ruff / pyyaml | 见 `requirements.txt` | 固定版本 |

依赖清单见 `backend/requirements.txt`；工具配置见 `backend/pyproject.toml`（ruff line-length=100，py312，asyncio_mode=auto）。

## 2. 目录结构

```
backend/
├── app/
│   ├── main.py                 # create_app()、lifespan（日志→DB→seed→worker 启停）、CORS、request_id 中间件、/internal/health、路由挂载、异常处理
│   ├── config.py               # Settings(BaseSettings) + DemoActor(actor_id=demo-cold-room-admin, role=operator)
│   ├── api/                    # 路由 + Pydantic 契约 schema + mapper + 错误模型
│   │   ├── anomaly_events.py   # listAnomalyEvents / getAnomalyEvent / listControlPlans / getEventReport / listSecurityAuditEntries
│   │   ├── diagnosis.py        # startDiagnosis / getAgentTask / getDiagnosisResult
│   │   ├── control_plans.py    # runSimulation
│   │   ├── approvals.py        # requestApproval / submitApproval
│   │   ├── executions.py       # startExecution / getExecutionTask
│   │   ├── schemas.py          # 37 个契约模型（camelCase，SchemaModel 全局 omit-None）
│   │   ├── mappers.py          # ORM→schema 纯函数（派生 awaitingApproval/deviceIds/sensorIds）
│   │   ├── errors.py           # DomainError + 6 值 code 枚举 + install_exception_handlers
│   │   └── api_deps.py         # get_session 依赖
│   ├── application/            # 应用服务（用例编排）
│   │   ├── queries.py          # B2 读取（selectinload 预加载）
│   │   ├── diagnosis.py        # start_diagnosis + DiagnosisHandler（幂等、stale 恢复、每 tick 一步）
│   │   ├── simulation.py       # run_simulation（同步对外、内部 run 记录、复用/重跑）
│   │   ├── approval.py         # request_approval / submit_approval / record_l3_block
│   │   └── execution.py        # start_execution / get_execution_task + ExecutionHandler
│   ├── domain/                 # 纯领域规则（无 IO）
│   │   ├── constants.py        # TASK_STATUSES、awaiting_approval_from_stage、ALLOWED_TRANSITIONS、can_transition
│   │   ├── agent.py            # DeterministicAgent（5 工具、4 类原因）+ LlmAgent（OpenAI 兼容、Pydantic 校验）
│   │   └── safety.py           # evaluate_l2（5 校验）+ classify_action（L3 识别）
│   ├── ports/tools.py          # Tool Protocol + ToolRegistry
│   ├── infrastructure/
│   │   ├── db/{session.py,models.py}   # async engine + SQLite PRAGMA；23 张表；UTCDateTime(TypeDecorator)
│   │   ├── audit/{hashchain.py,repository.py}  # SHA-256 canonical 哈希链；append-only Repository
│   │   ├── simulator/thermal.py        # 一阶热力学确定性仿真器
│   │   ├── tasks/{worker.py,handlers.py,runtime.py}  # TaskWorker（lifespan 托管，单 loop）
│   │   ├── tools/{tools.py,knowledge.py}             # 5 个具体工具 + 静态知识库
│   │   └── logging.py
│   └── seed/demo_data.py       # 镜像前端 mock 的幂等 seed（MOCK_NOW=2026-07-23T10:35Z）
├── alembic/                    # env.py（async）+ versions/812d60b909f3_initial_schema.py
├── tests/                      # test_b0..b8（59 个测试）+ conftest.py
├── requirements.txt / pyproject.toml / .env.example / alembic.ini
```

## 3. 13 个契约接口实现状态

全部 13 个接口已实现并通过契约测试（路径/方法与冻结 OpenAPI 完全一致，GET 响应通过 jsonschema 校验）。

| # | operationId | 路径 | 阶段 |
| --- | --- | --- | --- |
| 1 | listAnomalyEvents | GET /anomaly-events | B2 |
| 2 | getAnomalyEvent | GET /anomaly-events/{eventId} | B2 |
| 3 | listControlPlans | GET /anomaly-events/{eventId}/control-plans | B2 |
| 4 | getEventReport | GET /anomaly-events/{eventId}/report | B2 |
| 5 | listSecurityAuditEntries | GET /anomaly-events/{eventId}/security-audit | B2 |
| 6 | startDiagnosis | POST /anomaly-events/{eventId}/diagnosis | B3 |
| 7 | getAgentTask | GET /agent-tasks/{taskId} | B3 |
| 8 | getDiagnosisResult | GET /agent-tasks/{taskId}/diagnosis-result | B3 |
| 9 | runSimulation | POST /control-plans/{planId}/simulation | B4 |
| 10 | requestApproval | POST /control-plans/{planId}/approval-requests | B5 |
| 11 | submitApproval | POST /approval-requests/{requestId}/decision | B5 |
| 12 | startExecution | POST /control-plans/{planId}/execution | B6 |
| 13 | getExecutionTask | GET /execution-tasks/{taskId} | B6 |

另含内部接口 `GET /internal/health`（不属于 13 业务接口，被契约测试显式排除），返回 `{status, database, worker_handlers, agent_mode}`。

## 4. 运行与联调

### 4.1 安装
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 4.2 初始化数据库（Alembic）
```powershell
# 默认 DATABASE_URL 见 .env.example；可用环境变量覆盖
$env:DATABASE_URL = "sqlite+aiosqlite:///./data/coldpilot.db"
python -m alembic upgrade head     # 建表
```
> 说明：生产路径用 Alembic 建表；测试用 `conftest.py` 的 `create_all`（隔离临时库）。lifespan 只负责 seed，不自动建表。

### 4.3 启动
```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```
启动顺序（lifespan）：配置日志 → 获取/创建 DB → `seed_database`（幂等）→ 注册并启动 worker（`diagnosis` + `execution` 两个 handler）。关闭时逆序 stop + dispose。

### 4.4 前端联调（HTTP 模式）
前端无需改 UI：在 `frontend/.env` 设置
```
VITE_DATA_MODE=http
VITE_COLDPILOT_API_BASE_URL=http://localhost:8000
```
`HttpColdPilotClient`（`frontend/src/api/httpColdPilotClient.ts`）会调用 `/api/v1/*`，错误信封还原为 `ApiError`。页面与状态机零改动。

### 4.5 环境变量（`.env.example`）
- `DATABASE_URL`（默认 `sqlite+aiosqlite:///./data/coldpilot.db`）
- `AGENT_MODE`（`deterministic` 默认 / `llm`）
- `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`（仅 `llm` 模式；未配置 Key 时确定性模式照常运行）
- `WORKER_TICK_SECONDS` / `WORKER_STALE_TIMEOUT_SECONDS`
- `DEMO_ACTOR_ID` / `DEMO_ACTOR_DISPLAY_NAME` / `DEMO_ACTOR_ROLE`

## 5. 关键设计

### 5.1 异步任务（进程内 worker，非 BackgroundTasks）
- `TaskWorker` 在 lifespan 内单 loop 托管，每 tick 对每个 handler 调一次 `recover_stale` + 一次 `claim_and_process`（每 tick 仅一步，保证前端渐进揭示）。
- 任务状态持久化在 DB（`agent_tasks` / `execution_tasks`）。重启后 queued 任务继续推进；stale running 超时由 `recover_stale` 处理（诊断删 tool_invocations 重置为 queued；执行标记 failed + triggered_rollback）。任务不会永久停在 running。
- **未使用** Redis / Celery / RQ / Kafka / RabbitMQ / 微服务，也未用 FastAPI BackgroundTasks 作为核心持久化任务系统。

### 5.2 仿真（确定性一阶热力学近似）
- `infrastructure/simulator/thermal.py`：`tau = 1.7/(fan_factor*valve_factor)`，指数逼近 + 末端过冲 dip；输出 predicted_series / recoveryHours / energyKWh / overshootRisk / frostRisk / compressorCycles。
- 同 `planId + planVersion` 成功结果复用；失败可重跑。对外 `POST .../simulation` 同步返回 200，内部创建 `simulation_runs`（running→succeeded/failed）。
- **不是** 经过校验的数字孪生，**不是** 真实试点数据。

### 5.3 Agent（双模式）
- `DeterministicAgent`（默认，离线可完整运行）：实际调用 5 个工具并保存完整结构化 IO（`tool_invocations`），按数据条件综合 4 类原因（入库热量负荷 / 库门长时间开启 / 压缩机效率下降 / 风机风量不足）。**不读 fixture 假装执行**。
- `LlmAgent`：OpenAI 兼容 chat/completions，输出经 Pydantic `LlmDiagnosis` 校验。**LLM 仅参与诊断综合，不决定审批 / 安全 / 执行。**
- agent task / run 记录 agent_mode / model_id / prompt_template_id(_version) / knowledge_version / tool_registry_version / started_at / finished_at / failure_reason。

### 5.4 L2 / L3 与安全审计
- L2：须已完成仿真、版本绑定（`planId + planVersion`）、含控制参数；方案变更使旧审批失效（执行时校验 approval 的 version == 当前 version）；未批准不能生成命令；批准 ≠ 执行；执行完成 ≠ 恢复；只有 `verifying` 成功才 `recovered`。
- L3：**不创建** plan / approval / command / execution，**不入队**，不允许管理员绕过。由确定性安全规则（`classify_action`）拦截，**不由大模型判断**；只追加 `SecurityAuditEntry`。
- 安全审计：`security_audit_entries` 含 `previous_hash / entry_hash / sequence_number / request_id / correlation_id`，形成 SHA-256 哈希链；Repository 仅 append / list / verify / count，不暴露 update / delete；可验证哈希链。**不得声称** 这等于密码学不可抵赖（单进程 SQLite，非防篡改存储）。

### 5.5 幂等规则
- 诊断：同事件 queued/running → 返回既有；终态 → 允许新建（重诊断）。
- 仿真：同 `planId + planVersion` 成功 → 复用；失败 → 允许重跑。
- 审批请求：同 `planId + planVersion` pending → 返回既有。
- 审批决定：同 `requestId + actor + decision` → 200 返回既有；不同 decision → 409。
- 执行：同 `planId + planVersion + approvalRequestId` → 返回既有，不产生第二条命令。

### 5.6 错误模型与状态机
- 固定 6 值 code：`NOT_FOUND / CONFLICT / INVALID_STATE / VALIDATION / FORBIDDEN / INTERNAL`；信封 `{error:{code,message,details,requestId,retryable}}`（前端忽略额外字段）。
- `domain/constants.py` 的 `ALLOWED_TRANSITIONS` 镜像前端 `workbenchMachine` 守卫；`can_transition` 在各服务中独立校验。`awaitingApproval / deviceIds / sensorIds` 全部由持久化数据派生（`anomaly_events` 只存 `stage`）。

### 5.7 演示身份
服务端注入固定 actor（`demo-cold-room-admin` / `冷库管理员` / `operator`）；`submitApproval` **忽略**请求体的 `approverId`。

## 6. 测试

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest            # 59 passed
.\.venv\Scripts\python.exe -m ruff check app tests   # All checks passed!
```

覆盖：状态转换全路径、未诊断不能仿真、未仿真不能审批、未批准不能执行、rejected 不能执行、executionFailed 不能直接 recovered、只有 verifying 可 recovered、L3 不产生 plan/approval/command/execution、重复审批返回既有、不同审批 409、重复执行不产生第二条命令、awaitingApproval 由 stage 派生、审计哈希链完整、queued 重启恢复、stale running 处理、确定性、FastAPI 与冻结 OpenAPI 一致（B8 契约测试）。

## 7. 已知限制（不得过度声称）
- 未连接真实 PLC / 设备；执行侧是 mock 设备适配器（基于仿真曲线的确定性回放）。
- 未通过真实工业安全认证；L3 拦截是确定性规则，不是认证级功能安全。
- 仿真为一阶热力学近似，非真实试点数据、非校验过的数字孪生。
- SQLite 哈希链用于审计完整性自校验，**不等于** 密码学不可抵赖。
- 确定性 Agent 是数据驱动的规则综合，**不等于** 真实大模型推理；`llm` 模式需自行配置 Key。
- 单进程单 worker；水平扩展需引入外部协调（当前范围之外）。
