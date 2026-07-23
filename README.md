# 鲜知 ColdPilot

面向果蔬冷库的工业智能体产品 —— 异常诊断、保鲜决策、能耗优化与安全调控。

> 本仓库当前仅包含**前端 MVP**（`frontend/`），以 Mock 数据模式独立运行，不依赖任何后端。

## 仓库结构

```
xianniu/
├─ frontend/                # React + TS + Vite 前端（本阶段唯一交付物）
├─ docs/
│  ├─ product/              # 产品需求文档（PRD）
│  ├─ contracts/            # 前后端接口契约（OpenAPI + 行为说明）
│  └─ handoff/              # 前端交接文档（FRONTEND_HANDOFF / DECISIONS）
├─ README.md
└─ .gitignore
```

> 后端（`backend/`）由另一模型依据 `docs/contracts/` 与 `docs/handoff/` 单独实现，本仓库当前不包含。

## 快速开始

```bash
cd frontend
pnpm install
pnpm dev        # 本地开发（默认 mock 数据模式）
pnpm build      # 类型检查 + 生产构建
pnpm test       # 运行测试
pnpm typecheck  # 仅类型检查
```

## 文档索引

- 产品需求：`docs/product/coldpilot-prd-v1.0.pdf`
- 接口契约：`docs/contracts/openapi.frontend-draft.yaml`、`docs/contracts/api-behavior.md`
- 交接说明：`docs/handoff/FRONTEND_HANDOFF.md`、`docs/handoff/DECISIONS.md`

## 数据声明

前端当前运行于 `VITE_DATA_MODE=mock`。界面中所有数据均为**演示数据 / 模拟结果 / 仿真结果**，不代表真实冷库运行成果。