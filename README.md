<p align="center">
  <img src="frontend/public/logo.png" width="88" alt="鲜知 ColdPilot Logo" />
</p>

<h1 align="center">鲜知 ColdPilot</h1>

<p align="center">
  <strong>安全可控的果蔬冷库工业智能体</strong>
</p>

<p align="center">
  让冷库从“发现问题后人工处理”，升级为“主动感知、解释原因、生成方案、安全执行并验证结果”。
</p>

<p align="center">
  <img alt="Stage" src="https://img.shields.io/badge/Stage-Competition%20MVP-0FA978" />
  <img alt="Frontend" src="https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-3478F6" />
  <img alt="Backend" src="https://img.shields.io/badge/Backend-FastAPI-009688" />
  <img alt="Agent" src="https://img.shields.io/badge/Agent-Deterministic%20%2B%20LLM%20Optional-536176" />
  <img alt="Safety" src="https://img.shields.io/badge/Safety-L0--L3-E7A13A" />
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#核心闭环">核心闭环</a> ·
  <a href="#工业安全边界">安全边界</a> ·
  <a href="#系统架构">系统架构</a> ·
  <a href="#项目截图">项目截图</a> ·
  <a href="submission/GOAI-ColdPilot/">赛事材料</a>
</p>

---

## 项目简介

**鲜知 ColdPilot** 是一个面向果蔬冷库的工业 Agent 系统，覆盖异常诊断、保鲜决策、能耗优化、设备调控、审批执行与结果复盘。

它不是给传统监控大屏加一个聊天框，也不是让大模型直接控制 PLC。ColdPilot 将环境、设备、库存、能耗和历史事件组织成可执行的任务上下文，由 Agent 调用受限工具完成诊断和方案编排，再由确定性安全规则、人工审批和设备保护机制约束执行。

当前项目围绕一个可重复演示的主场景展开：

> **1 号辣椒库温度持续升高**，系统主动识别异常，调用实时遥测、库门记录、库存批次、设备日志和历史案例完成原因诊断；随后比较两种温控方案，在 L2 人工审批后进行仿真执行，并持续验证冷库是否真正恢复。

当前版本为 **参赛 MVP / 仿真验证阶段**，已完成 React + FastAPI 全栈实现、前后端 HTTP 联调、Agent 工具调用、策略仿真、L2 审批、L3 拦截、执行验证、报告与审计闭环。

![ColdPilot 指挥中心](frontend/acceptance/final-command-center-1440.png)

---

## 核心闭环

```text
持续感知
  ↓
异常识别
  ↓
Agent 自动创建任务
  ↓
多工具诊断与证据汇总
  ↓
候选方案生成
  ↓
温控与能耗仿真
  ↓
确定性安全校验
  ↓
L2 人工审批 / L3 永久拦截
  ↓
结构化控制执行
  ↓
效果验证与安全回退
  ↓
事件报告与审计沉淀
```

ColdPilot 的任务终点不是“生成一段回答”，而是：

- 异常得到验证性恢复；或
- 系统安全回退并明确转交人工。

---

## 核心能力

### 主动式异常处置

- 持续读取温度、湿度、O₂、CO₂、压差、库门、设备、电表和库存状态
- 识别持续越界、趋势异常、设备效率下降和控制未生效
- 无需用户先发起对话即可自动创建诊断任务
- 在首页、工作台和告警中心持续同步任务阶段

### 多工具诊断与可解释证据

Agent 可调用：

- 实时遥测查询
- 库门与入库记录
- 压缩机、风机和阀门状态
- 历史相似事件
- 冷库知识与运行规则
- 温控仿真与安全检查

诊断结果包含：

- 原因排序与置信度
- 支持证据与反向证据
- 不确定信息
- 推荐排查顺序
- 工具输入、输出、耗时和状态留痕

### 方案仿真与风险比较

系统可比较多个控制方案的：

- 预计恢复时间
- 仿真能耗
- 温度过冲风险
- 冻害风险
- 压缩机启停次数
- 控制参数、执行时窗与回退条件

当前仿真器采用确定性的一阶热力学近似，用于验证产品闭环和方案比较，不代表真实冷库数字孪生精度。

### 执行后验证

ColdPilot 严格区分：

- `approved`：方案获批
- `executing`：结构化命令正在执行
- `verifying`：系统正在观察环境与设备响应
- `recovered`：恢复条件已经持续满足

执行完成不等于异常恢复；只有验证成功后，任务才会进入 `recovered`。

---

## 工业安全边界

ColdPilot 的安全机制不依赖大模型自觉，也不把安全判断写进提示词。

| 等级 | 典型能力 | 执行策略 |
| --- | --- | --- |
| **L0** | 读取数据、查询知识、生成报告 | 自动执行并记录 |
| **L1** | 运行仿真、重新采样、增加观察任务 | 规则校验后自动执行 |
| **L2** | 调整目标温度、风机、压缩机负载、阀门开度 | 必须人工二次确认 |
| **L3** | 关闭联锁、越过硬件保护、绕过安全边界 | 永久禁止，仅生成安全审计记录 |

所有控制动作均采用结构化参数，并经过：

- 参数白名单
- 上下限检查
- 变化速率检查
- 状态与权限检查
- 方案版本绑定
- 审批有效性检查
- 回退条件检查
- 完整操作审计

> 大模型不直接向 PLC 发送自由文本指令。PLC 联锁、设备保护和传统控制始终拥有更高优先级。

---

## 系统架构

```mermaid
flowchart TB
    S[传感器 / 设备 / 库门 / 电表 / 库存] --> API[统一数据接口]
    API --> EVT[异常检测与事件上下文]
    EVT --> AGENT[Agent 任务编排]

    AGENT --> T1[实时遥测工具]
    AGENT --> T2[设备与库存工具]
    AGENT --> T3[历史案例与知识]
    AGENT --> SIM[温控仿真器]

    T1 --> DIAG[原因、证据与候选方案]
    T2 --> DIAG
    T3 --> DIAG
    SIM --> DIAG

    DIAG --> SAFE[确定性安全规则引擎]
    SAFE -->|L0 / L1| EXEC[结构化执行]
    SAFE -->|L2| APPROVAL[人工审批]
    SAFE -->|L3| BLOCK[永久拦截与审计]
    APPROVAL --> EXEC

    EXEC --> ADAPTER[设备适配层 / 仿真执行器]
    ADAPTER --> VERIFY[效果验证]
    VERIFY -->|恢复| REPORT[事件报告与案例沉淀]
    VERIFY -->|失败| FALLBACK[安全回退]
```

### 技术实现

| 层级 | 技术与职责 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、React Router、ECharts、CSS Modules |
| 接口契约 | OpenAPI 3.1、`ColdPilotClient`、HTTP / Mock 双模式 |
| 后端 | FastAPI、Pydantic v2、SQLAlchemy 2、Alembic、SQLite WAL |
| Agent | 默认 deterministic Agent；可选 OpenAI-compatible LLM 综合模式 |
| 任务执行 | 进程内持久化任务 worker，诊断与执行状态可查询、可恢复 |
| 安全 | L0-L3 分级、方案版本绑定、幂等控制、L3 拦截、审计哈希链 |
| 测试 | Vitest、Testing Library、pytest、httpx、jsonschema、ruff |

---

## 已实现页面

| 页面 | 路由 | 主要能力 |
| --- | --- | --- |
| 首页看板 | `/command-center` | 冷库、设备、库存、能耗、告警、Agent 自主任务概览 |
| 实时监控 | `/monitoring` | 多指标时序、目标区间、事件标记、数据质量与设备状态 |
| 异常告警 | `/events` | 告警筛选、阶段状态、详情与诊断入口 |
| Agent 工作台 | `/workbench` | 工具轨迹、原因证据、方案、审批、执行、验证与报告 |
| 策略与仿真 | `/strategy` | A/B 方案、预测曲线、安全校验和 L2 审批 |
| 设备管理 | `/devices` | 设备状态、参数、健康度、关联异常和维护建议 |
| 库存管理 | `/inventory` | 批次、环境适宜性、风险和剩余安全窗口 |
| 能耗分析 | `/energy` | 能耗趋势、峰平谷、设备构成与仿真节能比较 |
| 报告中心 | `/reports` | 事件报告、安全审计和执行复盘 |
| 系统管理 | `/settings` | 数据源、安全规则、Agent 版本和界面设置 |

---

## 项目截图

<table>
  <tr>
    <td width="50%">
      <strong>Agent 诊断工作台</strong><br/>
      <img src="frontend/acceptance/final-agent-1440.png" alt="Agent 工作台" />
    </td>
    <td width="50%">
      <strong>策略与仿真</strong><br/>
      <img src="frontend/acceptance/final-simulation-1440.png" alt="策略与仿真" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>实时监控</strong><br/>
      <img src="frontend/acceptance/final-realtime-1440.png" alt="实时监控" />
    </td>
    <td width="50%">
      <strong>报告与审计</strong><br/>
      <img src="frontend/acceptance/final-reports-1440.png" alt="报告与审计" />
    </td>
  </tr>
</table>

更多页面截图见 [`frontend/acceptance/`](frontend/acceptance/) 与 [`submission/GOAI-ColdPilot/03-Demo截图/`](submission/GOAI-ColdPilot/03-Demo截图/)。

---

## 快速开始

### 环境要求

- Node.js 20+
- pnpm
- Python 3.12
- Windows、macOS 或 Linux

### 1. 启动后端

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

后端地址：

- 健康检查：`http://127.0.0.1:8000/internal/health`
- API 文档：`http://127.0.0.1:8000/internal/docs`

### 2. 配置并启动前端

在 `frontend/.env` 中设置：

```env
VITE_DATA_MODE=http
VITE_COLDPILOT_API_BASE_URL=http://127.0.0.1:8000
```

然后启动：

```bash
cd frontend
pnpm install
pnpm dev --host 127.0.0.1
```

访问：`http://127.0.0.1:5173/command-center`

### 可选 LLM 模式

默认使用无需外部服务的确定性 Agent：

```env
AGENT_MODE=deterministic
```

也可接入 OpenAI-compatible 模型，用于基于工具结果综合诊断文本：

```env
AGENT_MODE=llm
LLM_BASE_URL=https://your-provider.example/v1
LLM_API_KEY=your-key
LLM_MODEL=your-model
```

LLM **不参与**安全规则、审批权限、控制命令生成或设备执行授权。

---

## 质量门禁

### Frontend

```bash
cd frontend
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

当前验收记录：

- TypeScript：0 error
- Frontend tests：41 passed
- ESLint：0 error
- Production build：passed

### Backend

```bash
cd backend
python -m pytest
python -m ruff check app tests
```

当前验收记录：

- Backend tests：59 passed
- Ruff：all checks passed
- Alembic migration：passed
- 冻结 OpenAPI：13 paths / 37 schemas，契约测试通过

详细验收记录：

- [`docs/handoff/FRONTEND_ACCEPTANCE.md`](docs/handoff/FRONTEND_ACCEPTANCE.md)
- [`docs/handoff/BACKEND_ACCEPTANCE.md`](docs/handoff/BACKEND_ACCEPTANCE.md)
- [`DELIVERY_REPORT.md`](DELIVERY_REPORT.md)

---

## 仓库结构

```text
coldpilot/
├── frontend/                 # React 前端、页面、状态机、API Client 与验收截图
├── backend/                  # FastAPI 后端、Agent、仿真、安全规则、任务与测试
├── docs/
│   ├── product/              # PRD
│   ├── contracts/            # OpenAPI 与行为契约
│   ├── handoff/              # 前后端交接与验收文档
│   └── screenshots/          # 产品截图
├── submission/
│   └── GOAI-ColdPilot/       # 初赛简介、PPT/PDF、Demo 截图与运行说明
├── DELIVERY_REPORT.md
└── README.md
```

---

## 数据与真实性声明

当前版本用于验证工业 Agent 的产品与工程闭环：

- 冷库、传感器、库存、异常和候选方案来自演示种子数据
- 仿真器采用一阶热力学近似，尚未由真实冷库数据校准
- 当前设备执行为仿真曲线回放，不连接真实 PLC 或边缘网关
- 能耗、恢复时间、置信度和策略效果均属于演示或仿真结果
- 当前没有真实客户、商业部署、节能率或货损降低率证据
- deterministic Agent 用于可重复演示，不等同于真实大模型自主推理
- SQLite 审计哈希链提供基础防篡改证据，不等于密码学意义上的绝对不可抵赖

因此，本项目不将模拟结果描述为真实试点成果，也不声称已经通过工业安全认证。

---

## 文档与赛事材料

- [产品需求文档](docs/product/coldpilot-prd-v1.0.pdf)
- [OpenAPI 契约](docs/contracts/openapi.frontend-draft.yaml)
- [接口行为说明](docs/contracts/api-behavior.md)
- [项目运行说明](submission/GOAI-ColdPilot/05-项目运行说明.md)
- [GOAI 初赛提交说明](submission/GOAI-ColdPilot/04-提交说明与自检.md)
- [Demo 截图索引](submission/GOAI-ColdPilot/03-Demo截图索引.md)
- [可编辑方案 PPT](submission/GOAI-ColdPilot/02-ColdPilot-GOAI-Preliminary.pptx)
- [方案 PDF](submission/GOAI-ColdPilot/02-ColdPilot-GOAI-Preliminary.pdf)

---

## 后续计划

- 接入单库真实传感器、边缘网关与设备协议
- 使用真实冷库数据校准仿真器和恢复判定
- 建立试点指标、实验条件和运营复盘体系
- 将设备适配器扩展至不同 PLC、压缩机、风机、阀门和电表
- 开放异常事件 Schema、仿真环境、诊断 Agent 模板和安全审批示例

---

## License

仓库尚未补充正式开源许可证。在明确代码、数据、模型和第三方素材的授权边界前，请勿默认将本项目视为已采用某种开源协议。