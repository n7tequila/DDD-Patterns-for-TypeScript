# 001 · TypeScript DDD skill · 开工清单

日期：2026-11-03
母本：`../DDD-Patterns-for-Java`（github.com/n7tequila/DDD-Patterns-for-Java，MIT，作者即发起人）
来由：child-learning-harness 项目的架构讨论 ADISC-LEARNING_HARNESS-001（2026-11-03 各条）与 ADEC-LEARNING_HARNESS-003（技术栈）。
本 skill 独立于该项目：内容不得出现该项目的领域术语，示例领域另选。

## 〇、开工前 6 条裁决（2026-11-03 发起人逐条答复，均选推荐项）

| # | 问题 | 裁决 |
|---|---|---|
| 1 | 仓库布局 | skill 本体放子目录 `typescript-domain-driven-design/`；仓库根放 README、examples/、evals/、docs/；安装时只复制该子目录 |
| 2 | 正文语言 | 英文（与 Java 版一致）；开发日志与审阅报告用中文 |
| 3 | 错误策略 | 异常与 Result 分工：违反不变量、编程错误抛带类型的领域异常；可预期的业务失败由应用服务返回可辨识联合的 Result |
| 4 | svngoku 素材 | 只作参考，全部自写，不复制原文，不附其版权声明 |
| 5 | 建模风格 | 面向对象类：聚合根为类、状态用 `#private` 字段封装、业务方法守不变量；值对象用只读类或品牌类型；仓储提供重建工厂 |
| 6 | 示例领域 | 会议室预订（时段冲突、签到、取消、行级权限、跨上下文的会议室目录与通知） |

## 〇·二、分批计划

| 批次 | 内容 | 验证 |
|---|---|---|
| B1 | 仓库骨架（README、LICENSE、.gitignore、agents/openai.yaml）、SKILL.md | T9 格式校验 |
| B2 | 核心参考：tactical-patterns、typescript-modeling、typescript-ddd-layout、workspace-structures、shared-kernel、error-handling | T7 对照 |
| B3 | 集成参考：anti-corruption-layer、assemblers、contracts-and-published-language、query-side、consistency-and-sagas、runtime-portability、strong-rules | T7 对照 |
| B4 | 示例工程（会议室预订）+ 强制资产 + enforcement、bindings/hono、bindings/drizzle、testing-strategy | T1–T4 及破坏验证 |
| B5 | 审查：ddd-code-review、ddd-checklist、output-template；评测用例与对比运行 | T5、T6、T8 |

每批结束出一份报告（`docs/dev-log/00N-*-报告.md`），"我替你定的"逐条请发起人裁决后再进下一批。

## 一、任务边界

### 交付

| 类别 | 内容 |
|---|---|
| skill 本体（子目录 `typescript-domain-driven-design/`） | `SKILL.md`（设计与审查两种模式）、`agents/openai.yaml`、`references/`、`assets/` |
| 与母本对齐的参考 | 母本 13 份 references 逐份有 TS 对应（见第二节对照表） |
| TS 新增参考 | TS 类型建模、强制工具、十条强规则 TS 版、运行时可移植、Hono 绑定、Drizzle 绑定 |
| 强制资产 | 严格 tsconfig 基线、dependency-cruiser 分层规则、eslint 规则片段、架构测试示例 |
| 示例工程 | 一个完整限界上下文：Bun + Hono + Drizzle（bun:sqlite）+ zod + bun test；`tsc --strict` 与测试全绿 |
| 评测 | 审查模式的植入违规用例、设计模式的建模任务；用 skill-creator 跑有无 skill 的对比 |
| 仓库文件 | README、LICENSE（MIT）、必要时 NOTICE |

### 不交付

- NestJS、MikroORM、Prisma 等其他绑定：留出位置，本轮不写。
- 发布到 GitHub：由发起人执行。
- 复制到 `~/.claude/skills/` 与在 `~/.claude/rules/typescript/` 中加引用：全部完成后另行确认再做。
- valkyrja catalog 的 TS DDD 约定条目：属 catalog 侧的另一件事。

## 二、与母本的对照表

| 母本文件 | TS 版文件 | 主要改动 |
|---|---|---|
| SKILL.md | SKILL.md | Spring Boot Guidance 改为框架无关的组装原则 + 指向绑定层；record 改为 TS 的值对象与品牌类型写法 |
| tactical-patterns.md | tactical-patterns.md | 增加 TS 下实体、值对象、聚合的封装与相等性写法 |
| java-ddd-layout.md | typescript-ddd-layout.md | 包结构改为目录与模块结构；可见性靠 package.json exports 与入口文件 |
| build-structures.md | workspace-structures.md | Maven / Gradle 改为 Bun workspaces、tsconfig project references |
| anti-corruption-layer.md | anti-corruption-layer.md | 翻译层示例改 TS；外部数据入境必须经 schema 校验 |
| assemblers.md | assemblers.md | 纯函数转换；禁止在转换里做业务判断 |
| contracts-and-published-language.md | contracts-and-published-language.md | 契约用 zod schema 定义并导出类型 |
| query-side.md | query-side.md | 读模型直接查询，不经聚合仓储 |
| consistency-and-sagas.md | consistency-and-sagas.md | 事务提交后副作用改为 outbox；Drizzle 同步事务的注意点 |
| shared-kernel.md | shared-kernel.md | 品牌 ID 与通用值对象的取舍 |
| testing-strategy.md | testing-strategy.md | bun test / Vitest；内存仓储；破坏验证 |
| error-handling.md | error-handling.md | 异常与 Result 的分工（待裁决）；接口层映射 |
| ddd-checklist.md | ddd-checklist.md | "Java And Spring Specifics" 改为 "TypeScript Specifics" |
| ddd-code-review.md | ddd-code-review.md | 异味目录增加 TS 特有异味；四级严重级别不变 |
| output-template.md | output-template.md | 基本照搬 |
| （无） | typescript-modeling.md | 品牌类型、可辨识联合、不可变、边界校验、时间与时区、序列化、未 await 的 Promise |
| （无） | strong-rules.md | conv-java-ddd 十条强规则的 TS 版，Spring 专属的几条改写或说明不适用 |
| （无） | enforcement.md | tsconfig、dependency-cruiser、eslint、架构测试的用法 |
| （无） | runtime-portability.md | 运行时专有 API 只进基础设施层 |
| （无） | bindings/hono.md、bindings/drizzle.md | 首批绑定层 |

## 三、对抗性测试清单

| # | 怎么验 | 守哪条承诺 |
|---|---|---|
| T1 | 示例工程 `tsc --strict` 与 `bun test` 全绿 | 文中写法确实成立（验收标准 5） |
| T2 | 在示例里让领域层 import Drizzle，dependency-cruiser 必须报错；恢复后通过 | 强制资产真能拦截（验收标准 4） |
| T3 | 把 ParentId 传给要 ChildId 的地方，tsc 必须报错 | 同形 ID 不可互换 |
| T4 | 去掉 outbox 写入的事务包裹，回滚测试必须变红 | 聚合与事件同事务 |
| T4b | 向事务包装传入 async 回调，tsc 必须报错；去掉 `@ts-expect-error` 做破坏验证 | Drizzle 在 bun:sqlite 上不能用异步事务回调（2026-11-03 实测：async 回调会让事务在返回 Promise 时提交，失败不回滚） |
| T5 | 审查模式对植入违规样例的检出率；干净样例不得报 CRITICAL | 审查模式有效（验收标准 6） |
| T6 | 设计任务：有无本 skill 各跑多次，按评分细则对比 | 设计模式有效（验收标准 6） |
| T7 | 脚本比对母本与 TS 版的文件与章节对照，不得有空项 | 与母本对齐（验收标准 1、2） |
| T8 | grep 本仓不得出现 child-learning 项目的领域词 | skill 与项目无关 |
| T9 | skill-creator 的格式校验通过 | 可被宿主正确加载 |

每条测试做破坏验证：临时改坏实现，确认测试变红，再恢复。

## 四、已知风险与跨任务契约

- 体量大（母本约 1650 行，TS 版预计更多，外加示例工程与评测）：分批交付，每批出一份报告，按"我替你定的"逐条请你裁决。
- 版本漂移：示例工程用 bun.lock 锁版本，文中写明实测版本（Bun 1.3.12、Hono 4.13.16、Drizzle 0.45.4、zod 4.6.7）。
- Drizzle 在 bun:sqlite 上的事务是同步的。2026-11-03 已实测：回调只要是 async，事务就在返回 Promise 时提交，之后失败不回滚。对策是统一的事务包装，回调类型禁止返回 Promise，异步 I/O 放在开事务之前。须写进 drizzle 绑定、强规则与示例工程。
- SKILL.md 要控制篇幅（目标 300 行以内），细节放 references，按需加载。
- 跨任务契约：child-learning-harness 通过 `~/.claude/skills/` 使用本 skill；其项目约定另经 valkyrja adopt。
