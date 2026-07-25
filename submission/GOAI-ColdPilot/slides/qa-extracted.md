<!-- Slide number: 1 -->

GOAI · BOUNDLESS AGENTS / AI + INDUSTRIAL MANUFACTURING

鲜知

![X:\xianniu\frontend\public\logo.png](Image0.jpg)
ColdPilot
果蔬冷库安全可控工业 Agent
让 Agent 自主诊断与验证，让安全边界始终由确定性规则和人类掌握。
DIAGNOSE  ·  SIMULATE  ·  GOVERN  ·  VERIFY

可运行全栈 MVP
GOAI 世界人工智能开源大赛 · 初赛方案 · 2026

### Notes:

<!-- Slide number: 2 -->
01  SCENE & PROBLEM
真正的难点不是告警，而是安全地闭环

传统处置：信息碎片 + 经验判断
ColdPilot：证据驱动的受控自治
冷库管理员、冷链运营负责人、设备运维与安全审计人员

面向谁
传感器
库门记录
温湿度 / 气体 / 压差
作业与外界扰动
看懂异常
五类工具自动取数，输出原因排序与正反证据

设备日志
库存批次

压缩机 / 风机 / 阀门
品类 / 数量 / 安全窗口
比较方案
在控制前仿真恢复时间、能耗、过冲与冻害风险

SOP 与案例
守住边界
L2 必须人工审批；L3 联锁绕过永久禁止

规则散落、经验依赖
验证结果
执行不等于恢复，验证通过后才生成闭环报告

原因是什么？哪个方案更稳？谁来授权？执行后真的恢复了吗？
人工需要同时回答
工业 Agent 的价值不在“替人拍板”，而在“判断更深、边界更硬、结果更实”。
产品判断

02
场景：果蔬冷库持续高温等异常处置；痛点表述依据当前产品流程，真实客户量化数据仍待试点

### Notes:

<!-- Slide number: 3 -->
02  TASK LOOP
不是聊天窗口：这是从异常到验证的任务闭环
Agent 自主推进
人在关键节点负责

01
异常进入
02
工具诊断
03
原因证据
04
候选方案

持续高温事件
多源取数与留痕
排序 + 正反证据
A / B 控制策略

05
仿真校验
06
人工审批
07
受控执行
08
效果验证

效果与风险预测
L2 停下等授权
结构化命令
通过才恢复
执行完成 ≠ 事件恢复；必须进入 verifying 并满足恢复条件。
L2 方案必须绑定版本并由人工审批；版本变化后旧审批失效。

关键守卫 2
关键守卫 1

03
仓库事实：前端 15 阶段状态机与后端状态迁移共同约束流程；当前异常检测输入和执行均为演示/仿真

### Notes:

<!-- Slide number: 4 -->
03  PRODUCT DEMO
可运行 Demo：自主推进，L2 人工接管

真实浏览器截图

![X:\xianniu\frontend\acceptance\agent-awaiting-approval.png](Image0.jpg)

01
自动推进
无需聊天输入，Agent 自动完成诊断、仿真与安全检查。

02
人工授权
L2 控制参数、当前值、目标值和允许范围在批准前完整可见。

03
责任边界
L3 危险动作不进入方案、审批、命令或执行链。
一屏回答评委最关心的三个问题
首页看板：多源环境、候选控制方案、L2 审批与 L3 禁止边界同屏呈现
Agent 做了什么？人何时介入？危险动作如何被阻止？

04
截图：frontend/acceptance/agent-awaiting-approval.png；页面数据为演示数据，方案指标为仿真结果

### Notes:

<!-- Slide number: 5 -->
04  AGENT & TOOLS
Agent 能力：五类工具取数，结论可解释、可追溯

![X:\xianniu\frontend\docs\screenshots\verify-agent-trend.png](Image0.jpg)
真实后端工具调用
telemetry.query

温度 / 湿度 / O₂ / CO₂ / 压差
doorlog.query

库门开启时段与持续时间
devicelog.query

压缩机 / 风机 / 阀门状态
knowledge.search

冷库高温处置知识
cases.search

相似异常历史案例

结构化产出
原因排序 + 置信度
支持证据 + 反向证据
不确定项 + 现场核查
Agent 工作台：工具调用进度、事件趋势和业务上下文
每次调用均记录完整输入输出、摘要、耗时与状态。

05
默认模式为离线确定性 Agent；可选 OpenAI 兼容 LLM 仅综合诊断原因，不决定安全、审批或执行

### Notes:

<!-- Slide number: 6 -->
05  SIMULATION
控制前先仿真：把效果、能耗与风险放在同一张桌上

![X:\xianniu\frontend\acceptance\final-simulation-1440.png](Image0.jpg)

方案 A
平滑逼近目标
预计恢复
预计能耗
5.2 h
1,170 kWh
过冲风险
冻害风险
低
低

方案 B
快速强制降温
预计恢复
预计能耗
2.3 h
887 kWh
过冲风险
冻害风险
中
中

结论：不是只选“更快”，而是让恢复速度、能耗和货品风险可比较。
策略与仿真页：A/B 方案、温度预测、控制参数、安全校验和 L2 审批

06
仿真值来自当前一阶热力学近似模型，仅用于技术可行性演示；不得视为真实冷库节能或恢复成效

### Notes:

<!-- Slide number: 7 -->
06  SAFETY & GOVERNANCE
安全不是 Prompt：模型、规则、人和设备边界分层治理

![X:\xianniu\frontend\acceptance\agent-l3-blocked.png](Image0.jpg)

四级自治边界

读取数据、识别异常，不改变设备状态
观察
Agent 自动
L0

输出诊断、方案与核查建议
建议
Agent 自动
L1

方案绑定版本，执行前再次安全检查
受控执行
必须人工审批
L2
真实页面：L3 “关闭联锁并强制满负荷”被永久拦截

联锁绕过等动作不进入控制链
永久禁止
规则直接拦截
L3

LLM 最多参与诊断综合；安全、审批、控制命令和执行永远不由模型决定。

设计原则
参数白名单  ·  上下限  ·  变化速率  ·  冲突检测  ·  权限校验
L2 五项确定性检查
当前实现提供工程级约束，不宣称等同于经认证的功能安全系统。

07
实现证据：backend/app/domain/safety.py、approval.py、execution.py；L3 只写审计，不创建方案/审批/命令/任务

### Notes:

<!-- Slide number: 8 -->
07  ARCHITECTURE
技术架构：把 Agent 能力嵌入可测试的业务用例层

Web 产品层
API 与用例层

React 18 + TypeScript
ColdPilotClient
FastAPI + Pydantic
Application Use Cases

10 个业务模块
驾驶舱 / 监控 / Agent / 仿真 / 审计
唯一数据边界
Mock 与 HTTP 可切换
13 个业务 API
冻结契约 + 结构化 Schema
diagnosis · simulation · approval · execution

核心能力层

Agent
Tool Registry
Safety Engine
Thermal Simulator
Async Worker
确定性默认
可选 LLM 综合
五类工具协议
结构化 IO 留痕
L2 五项检查
L3 永久拦截
一阶热力学近似
预测曲线与风险
诊断 / 执行任务
逐步可观察

23 张表覆盖遥测、Agent 任务、证据、方案版本、仿真、审批、命令、执行、报告与安全审计
SQLAlchemy Async + SQLite WAL

08
当前为单进程 MVP：无 Redis、消息队列、微服务、向量数据库或真实设备网关；生产化路线见第 11 页

### Notes:

<!-- Slide number: 9 -->
08  ENGINEERING EVIDENCE
工程完成度：可运行、可验证、可复现

10
13
23

复现路径
不是只有截图：工程材料可直接运行
业务模块
业务 API
数据库表
驾驶舱到报告审计
前后端冻结契约
覆盖完整事件闭环
双数据模式
Mock 独立演示 / HTTP 全栈联调

后端接口文档
/internal/docs + OpenAPI 契约

15
5
109
数据库迁移
Alembic 一键建表与演示种子

质量门禁
typecheck / test / lint / build / ruff

工作流阶段
Agent 工具
自动化测试
浏览器验收
关键页面与 Agent 状态全程留图

状态与守卫可测试
真实调用、结构化留痕
前端 50 + 后端 59
部署边界
单 worker 运行要求已明确记录

工具协议 · 安全策略 · 仿真器 · 示例数据 · 部署文档
拟开放复用

09
工程数量依据当前源码；测试数量为前端 50 个与后端 59 个，提交前已重新运行关键质量门禁

### Notes:

<!-- Slide number: 10 -->
09  COMPLIANCE & LIMITS
合规与边界：明确“已实现”与“落地前必须补齐”

当前系统已经做到

真实落地前必须补齐
IMPLEMENTED
NEXT
演示数据、仿真结果和真实数据预留分别标注
真实身份认证、RBAC 与多级审批

L2 人工审批与方案版本绑定
传感器与业务数据授权、最小化和脱敏策略

L3 危险动作永久拦截并写入审计
外部模型供应商、数据保留和私有化部署约定

执行前再次进行确定性安全检查
PLC / 边缘网关的二次边界校验与人工接管

LLM 输出经结构化 Schema 校验
外部不可变审计存储、密钥管理和 API 限流

执行或验证失败可回退传统规则 / PID
真实冷库模型校准、工业安全评估与试点验收

当前无真实 PLC、无真实试点、无工业安全认证；哈希链只能检测链条被修改，不等于密码学不可抵赖。
不做过度声称

10
合规策略：先只读、再影子仿真、后 L1 建议，最后才在 L2 人工审批下接入受控执行

### Notes:

<!-- Slide number: 11 -->
10  ROADMAP & OPEN SOURCE
从可运行 MVP 走向真实冷库的受控落地
永久边界：L3 联锁绕过类动作始终不交给 Agent 执行。

01
02
03
04
0–3 个月
3–6 个月
6–9 个月
9–12 个月
只读试点
影子仿真
L1 建议运行
受控 L2 接入

接入真实传感器，对比 Agent 诊断与人工判断
历史数据校准模型，方案不下发设备
Agent 给建议，由值班员人工执行
边缘二次校验、人工审批、人工接管与 PID 回退

验证指标
验证指标
验证指标
验证指标
诊断耗时 / 原因命中率 / 误报率
温度与能耗预测误差
采纳率 / 货损 / 能耗
安全事件 / 恢复时间 / 可用性

期待连接
真实冷库场景 · 历史数据 · 设备接口
可运行全栈 MVP，任务闭环、安全边界与工程复现已验证。

当前

11
OPEN FOR REUSE  ·  TOOL CONTRACTS  ·  SAFETY POLICIES  ·  SIMULATOR  ·  SAMPLE DATA  ·  DOCS

### Notes: