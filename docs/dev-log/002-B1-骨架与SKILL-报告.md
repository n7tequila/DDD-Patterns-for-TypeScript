# 002 · B1 仓库骨架与 SKILL.md · 报告

- 日期：2026-11-03；当时写的（非事后补写）。
- 提交：仓库尚未 `git init`，无提交哈希；发起人决定何时初始化与首次提交。
- 依据：`001-ts-ddd-skill-清单.md` 的 6 条开工裁决与分批计划。

## 一 · 动了什么

| 文件 | 行数 | 职责 |
|---|---|---|
| `typescript-domain-driven-design/SKILL.md` | 224 | skill 主文件：两种工作模式、发现与战略、战术默认、分层规则、实现默认、绑定原则、交付清单、参考索引 |
| `typescript-domain-driven-design/agents/openai.yaml` | 4 | Codex 调用元数据，与 Java 版同构 |
| `README.md` | 57 | 仓库说明：布局、安装、覆盖范围、默认栈、示例提示词 |
| `LICENSE` | 21 | MIT，Copyright (c) 2026 Tequila |
| `.gitignore` | 34 | 增加 node_modules、*.db、evals/runs 等 TS 与评测产物 |
| `docs/dev-log/001-ts-ddd-skill-清单.md` | 100 | 开工清单（含 6 条裁决、分批计划、测试清单） |

另建空目录：`references/bindings/`、`assets/`、`examples/`、`evals/`。

## 二 · SKILL.md 结构与母本对照

| SKILL.md 节（行号） | 对应母本节 | 差异 |
|---|---|---|
| Overview（8） | Overview | 默认栈改为 TS strict + Bun + Hono + Drizzle/SQLite + zod + bun test |
| Working Mode（14） | Working Mode | 设计模式多一步"在一个组装入口里完成装配"；审查模式由 6 步扩为 7 步，新增"类型层保证"与"事务和副作用时序"两步 |
| Start With Domain Discovery（46） | 同名 | 照搬 |
| Define Strategic Boundaries（60） | 同名 | 公开入口写成"应用门面 + 发布契约" |
| Model Tactical Patterns（76） | 同名 | 换成 TS 默认：#private 类、create/reconstitute 双路径、品牌 ID、可辨识联合、领域同步并注入 Clock |
| Code Structure Rules（90） | 同名 | 依赖规则改写成 import 规则；新增"禁止深层 import 其他上下文""运行时专有 API 只进基础设施""规则靠工具强制" |
| Implementation Defaults（136） | 同名 | 新增工作单元包装、禁止悬空 Promise；错误策略按裁决 3 写成异常与 Result 分工 |
| Framework And Persistence Bindings（158） | Spring Boot Guidance | 改为与框架无关的原则加指向两份绑定；写入 async 事务回调不回滚的结论 |
| Output Expectations（171） | 同名 | 增加审查请求的产出 |
| Delivery Checklist（183） | 同名 | 增加品牌 ID、边界校验、事务内无异步、无悬空 Promise、工具强制五项 |
| References（204） | 同名 | 20 份参考（母本 13 份对应 + 新增 7 份），本批尚未写出 |

## 三 · 核心机制

- 渐进加载：SKILL.md 只放默认与规则，细节全部指向 references，按需读取。目标 300 行以内，现 224 行。
- 审查模式新增两步的理由：TS 的结构类型（同形 ID 可互换，已实测）与同步驱动下的 async 事务（已实测不回滚）是 Java 版不存在、TS 版最易出事的两类问题，必须在审查流程里单列。

## 四 · 安全防线

本批只有文档，没有可执行代码，不涉及。

## 五 · 测试与承诺的对应

| 测试 | 结果 |
|---|---|
| T9 skill-creator `quick_validate.py` | `Skill is valid!` |
| T8 中性检查：在 skill 目录与 README 中 grep 儿童学习项目的领域词 | 无命中 |
| 引用计数：SKILL.md 引用的 references 文件 | 20 份，均待 B2–B5 写出（当前为悬空引用，属分批中的预期状态） |

## 六 · 我替你定的 9 个决定

1. **默认栈写进 SKILL.md**：没有指定栈时默认 Bun + Hono + Drizzle/SQLite + zod + bun test。放弃了"完全不指定栈"。理由：给出可直接运行的默认更有用，且与绑定层一致。
2. **zod 不进领域层**：值对象在自己的工厂里手写校验，zod 只用在边界。放弃了"值对象内部用 zod"。代价：同一条规则可能在边界 schema 与值对象里各写一次。
3. **聚合两条构造路径**：`create` 校验并记录事件，`reconstitute` 不记录事件。重建时是否重新校验不变量，留到 B2 的 tactical-patterns 与 typescript-modeling 里定。
4. **领域保持同步且确定**：时间与 ID 生成通过注入的 Clock 与生成器提供，领域内禁止 `Date.now()` 与 `crypto.randomUUID()`。
5. **跨上下文只经公开入口**：另一个上下文只能经应用门面或发布契约访问，禁止 import 其领域模型。对应母本强规则第 8 条。
6. **所有事务经统一的工作单元包装**：禁止直接调用 ORM 的 transaction。来自 2026-11-03 的 async 事务实测。
7. **运行时专有 API 的范围**：`Bun.*`、`bun:*` 以及 `node:*` 的 I/O 模块只能出现在基础设施层。
8. **依赖注入容器可选**：组装入口用构造函数注入即可，领域永远不依赖容器。
9. **层名**：用 `interface` 指接口层（路由、CLI、消息消费者）；母本用 `interfaces` 或 `web`。

## 七 · 已知限制与跨任务契约

- 20 份 references 尚未写出，SKILL.md 中的链接暂时悬空，B2–B5 补齐。
- README 标注"进行中"，全部批次完成后去掉。
- 仓库未初始化 Git。

## 八 · 三问裁决（2026-11-03 发起人逐条答复）

**结论：3 条均维持推荐，其中 1 条按裁决扩大了规则范围并已改正文。**

| # | 问题 | 裁决 |
|---|---|---|
| 1 | 发布版 SKILL.md 是否写明默认栈 | 写明（维持决定 1） |
| 2 | zod 等校验库是否禁止进入领域层 | 禁止，只用在边界（维持决定 2） |
| 3 | `node:*` 模块的禁止范围 | I/O 类与纯计算类一律禁止进入领域层和应用层，哈希、UUID 等经注入端口提供。已改 SKILL.md 的 Code Structure Rules 一条（决定 7 由"只禁 I/O"扩为"全部禁止"） |
