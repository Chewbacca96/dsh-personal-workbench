# 专家功能 · 证据与验证状态

本文件分清“已经核对的设计依据”和“产品实现后的验收”。**截至本版写作，专家功能未施工，AX-E01–E62 均未作产品验收。**

规格：[方案 v0.3](方案-v0.3.md)。实施：[implementation-plan.md](implementation-plan.md)。断言：[acceptance.md](acceptance.md)。

## 1. 本轮已核对的仓库基线

| 项 | 核对结果 | 本地复核入口 |
|---|---|---|
| HEAD | 216bb36（开始细化文档时） | git rev-parse HEAD；后续施工必须重新记录 |
| package | @dely0/dsh-personal-workbench 1.16.3 | package.json |
| schema | 19 | src/db/schema.ts / SCHEMA_VERSION |
| host inject | webServer、systemPrompt、tools、commands | src/index.ts / inject |
| client inject | sessions、workspaces、connection、slots、layout | src/client/capabilities.ts / inject |
| 普通绑定 | 同身份幂等；不同角色 409；工具不接角色 ID | src/personas/binding.ts、src/tools.ts |
| 草稿确认 | SQLite BEGIN/COMMIT/ROLLBACK，不能回滚 FS | src/db/repo/shared.ts / withDraftConfirm |
| 草稿路由 | 无 expert kind 处理 | src/api/routes/drafts.ts；此项是待新增能力 |
| 种子 | INSERT OR IGNORE，支持已有 DB 补项 | src/db/seed.ts / seedDictionaries |
| 角色管理 | 来源未登记、解析无效行的丰富视图尚未实现 | src/client/components/PersonaAdmin.tsx |
| ADR 编号 | 0008 已用于 WorkbenchApp 出口判据 | docs/adr/0008-workbenchapp-exit-criteria.md |

## 2. 本轮已核对的本机 SDK 契约

以下为源码/类型核对，**不是运行验证**。基目录为 `<本机家目录>/.dsh/profiles/node_modules/@deepseek-ai`；主 SDK 取证版本为 0.2.0-rc.2。P0 要在真正执行环境重新读版本。

| 契约 | 已核对内容 | 可复核文件/符号 |
|---|---|---|
| 命令身份 | CommandInvocation.agent 是 live Agent，signal 为取消通道，handler 可以 Promise | dsh-commands/lib/types/index.d.ts |
| @ source | onPick 同步，codec.serialize 异步；source 自己提供序列化 | dsh-client-ui-input-trigger/lib/types/types.d.ts |
| 引用插入 | insert.source/ref/label/appearance/clipboardText | dsh-client-ui-reference/lib/client.js |
| 连接工作区 | connectWorkspace 会 reuseOrCreateBlank | dsh-client-ui-workspace/lib/client.js / connectWorkspace |
| 新会话 | sessions.create({workspaceId})，不传旧 sessionId | dsh-api-session-controller/lib/types/client/contract/sessions.d.ts |
| provider 注册 | registerProvider(control 工厂)，有 invalidate 和 effect disposer | dsh-skill/lib/types/index.d.ts |
| rank | 较小 rank 优先；用户 DSH 400；runtime 250；bundled 600 | dsh-skill/lib/index.js、dsh-skill-filesystem/lib/index.js |
| scope | 最近 scope 层先胜出；root list 不自动使用 Agent scope | dsh-skill/lib/index.js / collect |
| 公共 scope helper | scopeOf(ctx)，不能猜内部 tag | dsh-scope 的公开 exports |
| spawn | providerName 默认 spawn，inheritsParentContext=false，persona/toolFilter/depthLimit=true | dsh-subagent-spawn-in-process/lib/index.js |
| 开始与结果 | start(name,request)，run.localAgent/id/result/dispose；stopReason 不等 completed 时输出可能部分 | dsh-subagent/lib/types/index.d.ts、types.d.ts |
| 初始时序 | startInProcessRun 内创建后直接 drivePublishedRun；不能等 start 返回才绑定人格 | dsh-subagent-in-process-driver/lib/index.js |
| persona | child scoped persona-prefix，严格模板插值；完整正文直填可能误插值 | dsh-subagent/lib/types/child-agent.js |
| child 身份 | header.origin='subagent'，parentSession，delegationDepth | dsh-subagent/lib/types/child-agent.js |
| depth | max(header.delegationDepth??0, options.subagentDepth??0) | dsh-subagent/lib/types/depth.js / delegationDepthOf |
| YAML | 宿主安装 yaml 2.9.1；用于 SKILL.md frontmatter | node_modules/yaml/package.json |
| skill invocation | disable-model-invocation、user-invocable；legacy key 拒绝；字符串布尔要解析 | dsh-skill-filesystem/lib/index.js / parseInvocationPolicy |
| prompt 字段 | section.text 可动态函数，interpolate:false 可保留文字 | dsh-system-prompt/lib/types/index.d.ts / PromptSection |

本方案选择公开服务形状 + 可选 scope helper；不把这些本机绝对 SDK 文件路径写进产品或打包产物。

## 3. K-Dense 长度勘误（已复算）

- 上游 commit：98c7fae46648724e1a43a1f2b207b0c82fcc462e。
- AGENTS.md 数量：503；总字节：9,872,867。
- 整文件字节数 >20000：227。
- 原始 UTF-16 文本长度 >20000：219。
- 归一化后的整文本长度 >20000：198。
- 去标题/元信息后的正文长度 >20000：**196 / 503 = 39.0%**。
- 将标题改为短测试名以隔离“名称 ≤40”后，实际 parsePersonaDocument 复算：307 通过、196 oversized-body、0 其他错误。
- 改短标题仅用于长度复核；不能据此说未适配的原始人格全部能直接导入。

v0.2 的 227/45.1% 实际对应字节数，不能当成解析器的正文字符计数。方案转向的依据为用户定位与维护成本，不要求通过长度或镜像统计证明唯一选择。

已有本机克隆位置为 `<本机临时目录>/probe-kdense-1dr6ay`。该路径不是长期证据依赖；其他机器可在独立临时目录取得相同 commit。

可复算命令（仓库 cwd；先有本次 src 对应的 lib。仅统计，不写用户库）：

~~~powershell
$env:EXPERT_PROBE_ROOT = '<本机临时目录>/probe-kdense-1dr6ay/scientific-agents'
git -C (Split-Path $env:EXPERT_PROBE_ROOT) rev-parse HEAD
@'
import fs from 'node:fs';
import path from 'node:path';
import { parsePersonaDocument } from './lib/personas/parse.js';
const root = process.env.EXPERT_PROBE_ROOT;
const counts = { total:0, totalBytes:0, over20kBytes:0, valid:0, oversizedBody:0, otherErrors:0 };
for (const entry of fs.readdirSync(root, { withFileTypes:true })) {
  if (!entry.isDirectory()) continue;
  const file = path.join(root, entry.name, 'AGENTS.md');
  if (!fs.existsSync(file)) continue;
  const bytes = fs.readFileSync(file);
  counts.total++; counts.totalBytes += bytes.length;
  if (bytes.length > 20000) counts.over20kBytes++;
  const raw = bytes.toString('utf8').replace(/^# [^\r\n]*/, '# 校验名称');
  const result = parsePersonaDocument(raw);
  if (result.ok) counts.valid++;
  else if (result.diagnostics.some(d => d.code === 'oversized-body')) counts.oversizedBody++;
  else counts.otherErrors++;
}
console.log(JSON.stringify(counts));
'@ | node --input-type=module
~~~

镜像候选 19 个失败只说明这轮未确认可用镜像，不说明镜像不存在或必然只能自建。本期不实现镜像功能，因此不以 V5 网络结果作为实施出口。

## 4. 旧 V1–V6 的用途

| 旧项目 | 本期用途 | 能否代替新产品验收 |
|---|---|---|
| V1 会话 ID | /expert 识别真实来源 | 不能证明子代理人格生效；不能中途换绑父会话 |
| V2 四文件差异 | 说明素材形态/归档可追溯 | 不能证明安装/许可/恢复成功 |
| V3 codec | @ 文本序列化设计依据 | 不能证明模型实际启动了正确子代理 |
| V4 inject | 软注入与能力降级 | 不能仅根据版本号宣称所有宿主支持 |
| V5 镜像 | 历史调研，已非主路径 | 不能阻塞本期 |
| V6 会话通道 | 生成流程不直接 ctx.llm.stream | 不能证明模型能可靠取源/提交草稿 |
| 第三方 peerDeps | 可选兼容调查 | 非本期前置或验收硬门 |

旧完整原始取证仍在 TEMP；重要结论已归纳为本文件的可复核契约和固定 commit。未来需要长期原始附件时，只保存相关短片段与工具版本，不复制整个 node_modules。

## 5. 产品验收记录（执行后填写）

本轮文档自身检查已完成：六份文档的本地链接目标存在、Markdown 围栏配对、无 TODO/TBD/FIXME、AX-E01–E62 连续且无重复。§5.3 人格模板用现有 lib/personas/parse.js 实际解析通过，并核对名称/简介/工作模式及 frontmatter group。这里只证明规格引用和模板格式，不算产品断言通过。

初始状态如下。不要因为规格文档存在而勾选完成。

| 阶段 | 状态 | 证据/实际结果 |
|---|---|---|
| P0 目标执行环境重新核对 | ✅ 2026-10-05 已执行 | 见 §7；HEAD 50d85b9、SDK 0.2.0-rc.2、依赖的公开接口全部存在。原状态“未执行（本轮只核对了本机设计环境）”保留于此 |
| P1 类型/设置/字典种子/路径与来源校验 | ✅ 2026-10-05 已执行 | 见 §8；typecheck 0 / build 0 / expert 三件套 43 pass / 回归 80 pass，AX-E01–E06 全 pass。原状态“未实现”保留于此 |
| P2 草稿提交/分文件暂存/整包校验 | ✅ 2026-10-05 已执行 | 见 §9；typecheck 0 / build 0 / P2 三件套 77 pass / 回归 105 pass，AX-E07–E14 全 pass。原状态“未实现”保留于此 |
| P3 安装/受管发布门/中断恢复 | ✅ 2026-10-05 已执行 | 见 §10；typecheck 0 / build 0 / 11 个测试文件 207 pass 0 fail，AX-E15–E23 全 pass；含 17 个故障点矩阵与 4 例跨进程真崩溃。原状态“未实现”保留于此 |
| P4 skill provider / catalog / 运行前依赖预检 | ✅ 2026-10-05 已执行 | 见 §11；typecheck 0 / build 0 / P4 三件套 45 pass / 回归 207 pass，AX-E24–E30 与 AX-E49 的 scope 前置全 pass；另有真实安装器 → 真实 provider 的独立字节级证据。原状态“未实现”保留于此 |
| P5 生成会话与调用接线 | ✅ 2026-10-05 已执行 | 见 §12；typecheck 0 / build 0 / P5 四件套 43 pass / 专家域回归 45 pass / 全仓 1195 tests 1194 pass 1 fail（唯一失败是既有 db.test.mjs 清理期 EPERM）、AX-E31–E35 与 AX-E50 全 pass；另有真实 HTTP 全链独立证据 38/38 与 `pnpm pack` 产物核验。原状态“未实现”保留于此 |
| P6 专家调用主链（请求 / 子代理按需人格 / 回传与释放） | ✅ 2026-10-05 已执行 | 见 §13；typecheck 0 / build 0 / P6 三件套 33 pass / 专家域回归 80 pass，AX-E36–E44、E48 全 pass，AX-E49 通过但其中"真实 skills 服务根因"标未验证；主会话另做并发位反向注入（AX-E44 变红）。原状态"未实现"保留于此 |
| P7 手动入口（`@` / `/expert` / `POST manual-requests`） | ✅ 2026-10-05 已执行 | 见 §14；typecheck 0 / build 0 / P7 三件套 40 pass / 专家域回归 146 pass / 全仓 1244 tests 1243 pass 1 fail（唯一失败是既有 db.test.mjs 清理期 EPERM，单跑亦失败）、AX-E45–E47 与 E51 全 pass；主会话另做 disposed 守卫反向注入（2 条断言变红，还原后逐字节一致）。真实宿主里的 `@` 菜单点击与 serialize 抛错时宿主 UI 行为**未验证**（留 P8/集成验收）。原状态"未实现"保留于此 |
| P8 客户端界面（生成入口 / 专家管理 / 专家草稿横幅） | ✅ 2026-10-05 已执行 | 见 §15；typecheck 0 / build 0 / P8 四件套 56 pass / 全仓 1282 tests 1281 pass 1 fail（唯一失败是既有 db.test.mjs 清理期 EPERM）、AX-E52–E58 全 pass；主会话另做 picker 第二道闸门反向注入（AX-E56 变红，还原后逐字节一致）。**无浏览器结果**：DOM 渲染、点击、真实宿主 `sessions.create`、真实 LLM 与真实安装落地全部未验（留 P9）。原状态"未实现"保留于此 |
| P9 包/真实 SDK/真实 LLM | 未执行 | 不以 fake provider 代替 |

每批追加日期、git/build ID、命令、退出码、AX-E 编号、pass/fail/unverified/blocked 与证据路径。不要改写此前失败记录来伪装连续通过。

## 6. 独立研发实例命令与授权边界

遵守 ADR 0006：只允许已核验的独立测试实例。当前用户实例永不作为重启目标。不要拿历史 PID 当运行配置。

先从真实环境取得目标 profile 绝对目录和独立 DB，再运行：

~~~powershell
node scripts/dev-verify.mjs --url http://127.0.0.1:3080 --profile web --profile-dir '<实际独立测试 profile 绝对路径>' --db-path '<实际独立 DB 绝对路径>' --dry-run
~~~

尖括号是运行环境参数，不是设计待定项；执行模型必须从实际配置核对，不替用户猜路径。本轮文档工作不执行装盘、重启或发布。

dry-run 通过、目标不等于当前实例且任务已有测试实例授权后，用相同实参去掉 --dry-run。套件 expert.mjs 必须先创建并登记 required/active；缺文件不能静默跳过。

真实 LLM 验证费用、模型选择和环境按测试实例现有配置；不要为了得到绿色结果换成假 provider 或伪造模型响应。

## 7. P0 施工基线记录（2026-10-05 执行）

执行任务：ed644638-f9a0-45cf-a32f-90df7d060dda「工作台专家功能实现和优化」（用户要求执行阶段 1–3，P0 为前置基线）。

### 7.1 目标执行环境事实（命令退出码均为 0）

| 项 | 实测值 | 复核命令 |
|---|---|---|
| git HEAD | `50d85b9aeffee3a23929e32ddb44567a82e89e61` | `git rev-parse HEAD` |
| package | `@dely0/dsh-personal-workbench` **1.16.4**（工作树内为未提交的版本号提升；HEAD 内为 1.16.3） | `git diff package.json` |
| schema | `SCHEMA_VERSION = 19`（`src/db/schema.ts:7`） | `node --test test/db.test.mjs` 属后续批次 |
| host inject | `['webServer', 'systemPrompt', 'tools', 'commands']`（`src/index.ts:47`） | 源码 |
| client inject | `['sessions', 'workspaces', 'connection', 'slots', 'layout']`（`src/client/capabilities.ts:35`） | `test/capabilities.test.mjs` |
| 基线 typecheck | `pnpm typecheck` → 退出码 0（node v24.19.0 / pnpm 11.7.0） | 已执行 |

工作树内另有**用户未提交改动**：`README.md`、`docs/design/2026-10-03-专家市场-调研.md`、`package.json`（版本号 1.16.3→1.16.4）、未跟踪 `docs/releases/v1.16.4.md`、未跟踪 `docs/design/20261003-工作台专家功能调研.txt`、未跟踪 `scripts/lib/_p2_left_body.txt`。这些不属于本任务施工成果，各批提交只显式指定本批文件。

### 7.2 真实 SDK 契约核对（0.2.0-rc.2，基目录 `<本机家目录>/.dsh/profiles/node_modules/@deepseek-ai`）

**结论：方案 v0.3 依赖的公开接口在本机目标环境全部存在，与 §2 设计取证版本一致，无差异需要记录，P1–P3 不因契约缺失而停止。**

| 契约 | 实测符号（文件） | 结论 |
|---|---|---|
| 新建会话 | `create(opts?: { workspaceId?; cwd?; sessionId? }): Promise<SessionId>`（`dsh-api-session-controller/lib/types/client/sessions/service.d.ts:179`；契约声明 `.../contract/sessions.d.ts:80`） | ✅ 不传旧 sessionId |
| subagents | `list(): string[]`、`getProvider(name): SubagentProvider \| undefined`、`start(name, request): Promise<SubagentRun>`（`dsh-subagent/lib/types/index.d.ts:282/287/300`） | ✅ |
| spawn provider | `depthLimit: true`、`toolFilter: true`、`persona: true`、`inheritsParentContext = false`、providerName 缺省 `spawn`（`dsh-subagent-spawn-in-process/lib/index.js`） | ✅ 四个能力位齐 |
| run | `SubagentRun.localAgent: Agent \| undefined`、`dispose(): Promise<void>`（`dsh-subagent/lib/types/types.d.ts:304/317`） | ✅ |
| 深度 | `delegationDepthOf(agent): number` 由 `dsh-subagent/lib/types/index.d.ts` 公开导出（实现 `.../types/depth.d.ts`） | ✅ 按官方语义，不猜 header 字段 |
| skills provider | `registerProvider(create: (control: SkillProviderControl) => SkillProvider): () => void`（`dsh-skill/lib/types/index.d.ts:247`）、`SkillProviderControl.invalidate`（同文件 :192） | ✅ |
| candidate | `SkillCandidate.rank`（:65）、`SkillCandidate.resourceBase: SkillResourceBase`（:60） | ✅ rank 600 / resourceBase 可用 |
| scope helper | `scopeOf(ctx: Context): ScopeKey \| undefined`（`dsh-scope/lib/index.js:312`，`lib/types/index.d.ts:84`） | ✅ `dsh-scope@0.2.0-rc.2` 已装盘 |
| @ 引用源 | `InputTriggerSource.onPick(pick): PickOutcome`（同步）、`ReferenceCodec.clipboardText(ref): string`、`serialize(ref, signal): Promise<string>`（`dsh-client-ui-input-trigger/lib/types/types.d.ts:161/124/126`） | ✅ 同步 pick + 异步 serialize |
| 引用插入 | `ReferenceInsert` 由 `@deepseek-ai/dsh-client-ui-conversation/client` 再导出（`dsh-client-ui-input-trigger/lib/types/types.d.ts:11,14`） | ✅ 形状照 §8.3 |

### 7.3 本批新增的产品事实与约束

- **本项目 devDependencies 里没有** `dsh-skill` / `dsh-subagent` / `dsh-scope` / 客户端 UI 包（只有 cordis、dsh-commands、dsh-host-webserver、dsh-llm、dsh-system-prompt、dsh-tools）。因此 P4/P6/P7 的适配层**只能按结构化 Probe 接口写形状探测**，不能 `import` 宿主 runtime；`@deepseek-ai/dsh-scope` 的开发依赖按 P4 计划再加。
- 客户端 `sessions.create` 与宿主 controller 的 `create` 是两层同名接口，形状一致（`workspaceId` / `cwd` / `sessionId` 全可选），P8 的 `WorkbenchRuntime.sessions` 可选方法形状按此声明（**P8 已按此落地**：`src/client/viewTypes.ts:217` 的 `create?(input?: {...}): Promise<string>`，见 §15）。

### 7.4 未验证项（如实标注，不填通过）

- 本批**没有**运行任何真实宿主服务调用（未注册 provider、未起子代理、未建生成会话）；仅为**源码/类型契约核对**，不是运行验证。
- `connectWorkspace` 的 `reuseOrCreateBlank` 行为沿用设计取证结论（`dsh-client-ui-workspace/lib/client.js`），本批未复跑。
- AX-E01–E62 仍全部**未做产品验收**（生产库、真实宿主、真实 LLM 均未跑）。

## 8. P1 施工记录（2026-10-05 执行）

**批次**：P1 类型、设置、字典种子与纯路径/来源校验。完整交接（导出签名、路径负例清单、未接线事实、逐条断言覆盖）见 [P1-handover.md](P1-handover.md)。

### 8.1 命令与退出码（主会话独立复跑，2026-10-05 12:0x–12:2x）

| 命令 | 退出码 | 实际结果 |
|---|---|---|
| `pnpm typecheck` | 0 | 干净（Node v24.19.0 / pnpm 11.7.0） |
| `pnpm build` | 0 | `buildId wb-a6d365e4dc01c490`，188 个输入文件 |
| `node --test --test-concurrency=1 test/expertContracts.test.mjs test/expertPaths.test.mjs test/expertProvenance.test.mjs` | 0 | `tests 43 / pass 43 / fail 0` |
| `node --test --test-concurrency=1 test/personaParse.test.mjs test/personaLibrary.test.mjs test/capabilities.test.mjs` | 0 | `tests 80 / pass 80 / fail 0` |
| `node --test --test-concurrency=1 test/db.test.mjs` | 1 | `tests 9 / pass 8 / fail 1`：仅 `finally` 的 `removeTempDir` EPERM（`test/db.test.mjs:35`），**仓库既有 Windows 清理期问题**（v1.16.0.md:134、docs/issues/2026-10-05-clear-plan-does-not-refresh.md:60），非本批回归 |
| `node docs/tasks/ed644638-…/evidence/p1-settings-http.mjs` | 0 | 真实 HTTP GET/POST 6/6（补 P1 无路由测试的缺口） |

### 8.2 AX-E01–E06

| 断言 | 结论 | 证据 |
|---|---|---|
| AX-E01（seed 两个 expert 种子 + 旧 schema 库补种 + 版本不变） | ✅ pass | `test/expertContracts.test.mjs` |
| AX-E02（设置缺失/脏值/`'false'` 字符串 → 关；真 boolean 后 GET 一致） | ✅ pass | `test/expertContracts.test.mjs` + `evidence/p1-settings-http.mjs` |
| AX-E03（同 session 去重 / 不同 request 冲突 / 不动其他域草稿） | ✅ pass | `test/expertContracts.test.mjs` |
| AX-E04（同旧版本并发 CAS 只一个成功、不丢新内容） | ✅ pass | `test/expertContracts.test.mjs` |
| AX-E05（路径负例全部拒 + 根外无写入） | ✅ pass | `test/expertPaths.test.mjs` |
| AX-E06（根/父目录/目标文件是链接均拒 + 哨兵逐字不变） | ✅ pass | `test/expertPaths.test.mjs` |

### 8.3 未验证项（如实标注）

- 本批只有**单元/仓储层**证据：未起真实宿主、未注册 skill provider、未起子代理、未调真实 LLM（P4/P6/P9 范围）。
- 设置页 **UI 开关未加**（§9.3，属 P5/P8）；本批只保证服务端读写与 GET/POST 接线。
- 暂存/提交/校验/确认/放弃/安装器/恢复/catalog/手动 request/子代理调用**全部未实现**（P2+）；`~/.dsh/workbench/personas`、`skills` 仍为空，未写入任何文件。
- 来源许可只做本地结构校验，不联网核验仓库/commit（设计如此）。

### 8.4 规格偏差与复核修复

- 偏差 1：`src/api/routes.ts` 超出 P1 清单接了设置 GET/POST（P5 复核并补 `service.setAutoEnabled`）。
- 偏差 2：读开关接受 `'1'` 为真值标记（写入只写 `'true'`/`'false'`），AX-E02 的「脏值」不含 `'1'`。
- 偏差 3：根是链接时 fail-closed，需显式 `allowRootLinkUnder`（P2/P3 生产安装器必须传）。
- 复核修复 4 处（主会话提出、子代理只改这 4 处并复跑全绿）：①`assertNoLinksInPaths` 不再在「根是链接且边界允许」时提前返回（并按规格补中间级链接测试，反向注入后该测试确实变红 `pass 15 / fail 1`）；②`validateStagedFileContent` 默认只判字节、字符上限改为显式 `maxChars`（否则「归档原件超 20000 字符只给 warning」不可达）；③锁记录补 `draftId`；④删除注释里「V8 RegExp 漏 `$` 校验」的错判（`/^a+$/.test('aa') === true` 是正确行为，实现零改动）。

### 8.5 环境事实（外部会话干扰，不当作本批成果）

- 仓库内**另一个会话**正在跑 `release-preflight.mjs` 与 `scripts/repro/probe-*-mutations.mjs`：会删 `lib/`、改源文件再还原 → `pnpm build` 与 `node --test` 必须写在同一条命令里。
- 检出并还原了一处**探针遗留变异**：`probe-listview-mutations.mjs` 被中途终止后，`src/client/components/KnowledgeList.tsx` 的 `knowledgeFilterActive` 留在 `return false`（正是该探针第 12 个变异）；主会话用 `git checkout` 还原，该文件不属于本批改动。

## 9. P2 施工记录（2026-10-05 执行）

**批次**：P2 草稿提交、分文件暂存与整包校验。完整交接（导出签名、错误码清单、接线义务、未验证项）见 [P2-handover.md](P2-handover.md)。

### 9.1 命令与退出码（主会话独立复跑）

| 命令 | 退出码 | 实际结果 |
|---|---|---|
| `pnpm typecheck` | 0 | 干净 |
| `pnpm build` | 0 | `buildId wb-13288ff8e36523c8`，190 个输入文件 |
| `node --test --test-concurrency=1 test/expertDrafts.test.mjs test/expertSkillPackage.test.mjs test/personaParse.test.mjs` | 0 | `tests 77 / pass 77 / fail 0` |
| `node --test --test-concurrency=1`（expertContracts/expertPaths/expertProvenance/personaLibrary/personaBinding/capabilities） | 0 | `tests 105 / pass 105 / fail 0` |
| `node --test --test-concurrency=1 test/db.test.mjs` | 1 | `tests 9 / pass 8 / fail 1`：仅 `removeTempDir` EPERM（`test/db.test.mjs:35`），仓库既有 Windows 清理期问题，非本批回归 |

`SUMMARY typecheck=0 build=0 p2=0 regression=0 dbtest=1`。

### 9.2 AX-E07–E14

| 断言 | 结论 | 证据 |
|---|---|---|
| AX-E07（正文 20000/20001 UTF-16 单元；CRLF/BOM/emoji 计数与现有 parser 一致） | ✅ pass | `test/expertDrafts.test.mjs`（2 条） |
| AX-E08（白名单外 frontmatter/空正文/超长名称 → 提交失败且旧草稿不损坏，不放宽 parser） | ✅ pass | 同上（2 条） |
| AX-E09（translated 无来源、merged 单来源、MIT 缺版权/全文；commit 缺失只警告） | ✅ pass | 同上（3 条） |
| AX-E10（含 CRLF 与原版权的许可文本按输入字节保存） | ✅ pass | 同上 |
| AX-E11（他会话草稿、无真实 session、伪造参数 session 一律拒绝） | ✅ pass | 同上（3 条） |
| AX-E12（单件/总量/数量/skill 数越界；不留超限索引） | ✅ pass | `test/expertDrafts.test.mjs`（4 条）+ `test/expertSkillPackage.test.mjs`（多条） |
| AX-E13（validate 后 stage 改文件 → version 增、validation 清空、旧 hash 失效） | ✅ pass | 同上（2 条 + 步骤 5 的 `staged-file-changed`） |
| AX-E14（坏 YAML/重复 key/缺 name·description/目录名不符/legacy 键/字符串 false/metadata 保留） | ✅ pass | `test/expertSkillPackage.test.mjs`（10 条） |

### 9.3 交付物与接线义务

- 新增 `src/experts/skill-package.ts`、`src/experts/drafts.ts` + 两个测试；`package.json`/`pnpm-lock.yaml` 增加普通运行时依赖 `yaml 2.9.1`；`tsconfig.build.json` 增两条 include。P1 文件零改动。
- **P5 接线义务（复核中发现，必须遵守）**：①五个工具的 `sessionId` 必须来自执行上下文 `exec.agent.session.id`，**不得作为工具参数暴露**；②`validateExpertDraft` 的 HTTP 路径靠"不传 `sessionId` 键"区分，工具路径必须传真实会话 id；③`context.failpoint` 只给测试，生产入口不得暴露；④`context.skills` 的生产注入点在 P4/P5 补。
- **P3 注意**：`manifestHash` 来自 DB 索引（已与磁盘核对），confirm 必须重读磁盘自行复算后比对，不能只信库里的值。

### 9.4 未验证项（如实标注）

- 中断/回滚用注入 `failpoint` 模拟，不是真杀进程；跨进程恢复属 P3（install journal + `.install.lock`）。
- 未接真实 skills 服务/DSH runtime；reuse 判定只对 fake registry 验过。
- 未跑全仓 75 个测试文件（只跑 P2 三个 + 回归六个）；未用 `--frozen-lockfile` 复验锁文件。
- `~/.dsh/workbench/personas`、`~/.dsh/workbench/skills` **仍不存在**：本批未写任何正式目录，无可安装专家。

### 9.5 规格偏差与过程事实

- 偏差 1：`ExpertOperationFailure.code` 放宽为 `ExpertErrorCode | PersonaDiagnosticCode`（仅人格正文失败路径，AX-E07/E08 要求原码透出）。
- 偏差 2：`rootForArea()`（P1）只认 `'persona' | 'skill'`，`drafts.ts` 内部用 `areaRoot()` 显式映射，未改 P1。
- 偏差 3：skill 包单件超限只报 `file-too-large`，不多报 `skill-package-invalid`。
- 过程事实：实施子代理在写完两个源文件后中断（无收尾消息，`pnpm typecheck` 退出码 2：`drafts.ts:64` 模块导入错、失败对象 `code` 类型过宽、`:1183` area 类型不匹配）；主会话诊断后发回修复清单，补测并全绿。本批是**跨轮续作**，不是一次成功，如实记录。
- 仓库本地 `core.autocrlf` 被外部改成 `false`，而 HEAD blob 全为 LF、工作树多为 CRLF → 直接把改动 `git add` 会产生整文件 CRLF churn；本批文件已统一成 LF 后再提交（`git diff --stat` 只显示真实改动 +51/−3）。

## 10. P3 施工记录（2026-10-05 执行）

完整交接（导出签名逐字、故障点矩阵、接线义务、偏差清单）见同目录 [`P3-handover.md`](./P3-handover.md)；这里只记录**证据**。

### 10.1 命令与退出码（主会话独立复跑，非只读子代理报告）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `pnpm typecheck` | 0 | 无输出 |
| `pnpm build` | 0 | 客户端 `lib/client.js` 552.64 kB |
| `node --test --test-concurrency=1`（expertInstall + P1/P2 回归 + persona 系，共 10 个文件） | 0 | `tests 194 / pass 194 / fail 0`（第一轮复核） |
| `node --test --test-concurrency=1`（再加 `test/expertRecovery.test.mjs`，共 11 个文件） | 0 | `tests 207 / pass 207 / fail 0`（第二轮复核，`duration_ms 15590`） |

`SUMMARY typecheck=0 build=0 p3plusregression=0`（194）→ `SUMMARY typecheck=0 build=0 recovery_full=0`（207）。`build` 与 `node --test` 同一条命令：外部会话的 `probe-*-mutations.mjs` 会删 `lib/`。

### 10.2 AX-E15–E19 / E23（第一轮：install.ts + managed.ts）

| 断言 | 结论 | 证据 |
|---|---|---|
| AX-E15 原创无技能确认 | ✅ | DB `confirmed` + `publication.ready` + catalog 可取 + 附件字节比对 |
| AX-E16 MIT + 两 skill，ready 前不可发现 | ✅ | 4 个 failpoint 快照：`discoverPersonas`/`resolvePersona` 均读不到且给 `installation-incomplete` |
| AX-E17 重复确认/并发 | ✅ | 同 `expertId`/`confirmResult`、文件数不增；重入 → `install-in-progress` |
| AX-E18 不同 hash 同名 skill | ✅ | 两例（提交期 + 确认时重新校验）；旧 skill 字节不变、无正式入口 |
| AX-E19 同 hash ready skill 复用 | ✅ | 记 `reusedPaths`、字节不变；补偿只撤本次 `createdPaths` |
| AX-E23 锁三档 | ✅ | 活→`install-busy`；同机死→回收；不明/别主机→`install-lock-owner-unknown` 不强删；不释放别人的锁 |

另有 §6.2 坏 `publication.json` 三种形态、§6.5 两条补偿路径、§6.3 跨 DB 跳过的额外用例。

### 10.3 AX-E20–E22（第二轮：真崩溃 + 故障矩阵）

| 断言 | 结论 | 证据 |
|---|---|---|
| AX-E20 发布点失败（DB 未确认） | ✅ | 17 个 failpoint 的进程内补偿矩阵（每个点断言 DB/FS/可见性/journal 终态/`.build*` 清理/**暂存 sha256 不变**/同版本重试成功） |
| AX-E20 真崩溃 | ✅ | 子进程跑产品代码自身的 stage→validate→confirm，在目标点 `process.exit(97)`（`spawnSync` 断言 `status=97` + marker 存在），父进程在同一 dbPath 重开新实例恢复：`@prepared`、`@files-published` 两例 |
| AX-E21 COMMIT 后中断 | ✅ | 5 个提交后 failpoint + 真崩溃 `@db-committed`/`@ready`：`completed-publication`（只多一个 `publication.json`）/`already-ready`，重复确认幂等，`generated/` 逐字节不变 |
| AX-E22 外部修改/日志损坏/他库日志 | ✅ | 主坏+备份好 → `degraded:true` 并用**备份**决策补偿；两份都坏 → `repair-required` 且同轮健康草稿仍 `already-ready`（`scanned=2`）；`ownerDbKey` 缺失/null/空串 → `skipped-owner-unknown`，异库 → `skipped-foreign-owner`（四种都不动文件、日志字节不变）；两 DB 共享一根的最小端到端 |

### 10.4 反向注入验证（主会话亲自执行）

`src/experts/install.ts` 的 `parseJournal` 修复（非字符串 `ownerDbKey` 归一为 `''`）由主会话独立反向注入确认：

- 装回 bug 后：`pnpm build` 退出码 0，`node --test --test-concurrency=1 test/expertRecovery.test.mjs` → `ℹ tests 13 / ℹ pass 12 / ℹ fail 1`，失败原文 `actual: 'repair-required', expected: 'skipped-owner-unknown'`。
- 还原后：`ℹ tests 13 / ℹ pass 13 / ℹ fail 0`，源码内 `REVERSE-INJECTION PROBE` 残留 0 处，`CR-count 0`（LF）。

### 10.5 交付物与接线义务

- 新增 `src/experts/install.ts`（1916）、`src/personas/managed.ts`（350）、`test/expertInstall.test.mjs`（1027，12 test）、`test/expertRecovery.test.mjs`（1276，13 test）；修改 `src/personas/library.ts`、`src/shared/persona.ts`、`src/shared/expert.ts`、`src/experts/paths.ts`、`src/experts/drafts.ts`、`src/db/repo/experts.ts`、`tsconfig.build.json`。**未改** `src/index.ts` / `src/tools.ts` / `src/api/**`。
- **后续接线义务**：①启动时**先** `recoverExpertInstallations` **再**注册技能 provider，`repair-required` 不得阻止启动；②`confirmExpertDraft` 只把 `InstallFailure`/`ExpertRepoError` 转成 `ok:false`，**其它异常会抛出** → HTTP/工具层必须 try/catch 且不透出原始日志/绝对路径；③`sessionId` 取 `exec.agent.session.id`，HTTP 路径不传该键；④`context.failpoint` 只给测试；⑤P4 注册 provider 时 `refreshSkills` 接 `control.invalidate`，list/get 用 `readManagedSkillInstallState` 判 ready。

### 10.6 未验证项（如实标注，不填通过）

- 生产启动接线未做（`recoverExpertInstallations` 无调用点）；真实 provider 未注册（`refreshSkills` 仍是注入 hook）。
- 字节撕裂（SIGKILL/断电打断 `fsync`/`rename` 中间态）未测 —— §6.3 末段明确排除。
- 无真实 dsh 实例级端到端；`~/.dsh/workbench/{personas,skills}` **仍不存在**（本批只在 `mkdtempSync` 目录写文件）。
- 恢复路径下的 `reusedPaths` 未单独测；`repair-required` 之后的人工修复流程未测；多条同时中断未测。
- 未跑全仓 `test/*.test.mjs`；`test/db.test.mjs:35` 的既有 Windows 清理期 EPERM 未触碰（非本批回归）；未用 `--frozen-lockfile` 复验。

### 10.7 规格偏差与过程事实

- 偏差 1【已修+反向注入】：`parseJournal` 把 `ownerDbKey` 缺失判成日志损坏，与 §6.3/AX-E22 矛盾（见 10.4）。
- 偏差 2【记录未改】：已提交分支的补偿把日志钉成 `db-committed`，`install.after-ready-journal` 抛错会把日志从 `ready` 降级为 `db-committed`；仅测试可达，恢复只看 DB + publication → 仍 `already-ready`，无功能影响。
- 偏差 3【记录未改】：publication 已就绪时的幂等回放不重写日志（停在 `db-committed`）；规格未要求。
- 偏差 4：`install.after-validation` 的异常原样抛给调用方（该点在补偿 try 之外，磁盘/DB 零改动）→ 强化了 10.5 的接线义务 ②。
- 偏差 5：未预期异常统一回 `install-repair-required`；中断型补偿 `lastInstallError.code='canceled'`。
- 过程事实：P3 由**同一子代理分两轮**完成（第一轮 1914 行 install.ts + managed.ts + 12 test；第二轮 +13 test 与 1 处缺陷修复），两轮都经主会话独立复跑（194 → 207）与逐段源码复核。第一轮过程中撞到两个真缺陷（draft mutex 重入被自己挡住导致 11 例全红；外层 catch 漏认 `InstallFailure`），均已修；测试侧另有 3 处用例自身问题（sessionId 复用串味、journal 目录未建、漏 import），如实记录。

## 11. P4 施工记录（2026-10-05 执行）

### 11.1 命令与退出码（主会话独立复跑）

同一条命令内顺序执行（外部会话的 `scripts/repro/probe-*-mutations.mjs` 会 `rmSync('lib')`，分开跑会赛跑）：

| 命令 | 退出码 | 输出 |
|---|---|---|
| `pnpm typecheck` | 0 | 无输出 |
| `pnpm build` | 0 | buildId `wb-7fb1c7f63bec2961`（195 输入文件；client 552.64 kB） |
| `node --test test/expertProvider.test.mjs test/expertCatalog.test.mjs test/skills.test.mjs` | 0 | `ℹ tests 45 / pass 45 / fail 0 / skipped 0`（18 provider + 12 catalog + 15 存量） |
| `node --test`（11 个回归文件） | 0 | `ℹ tests 207 / pass 207 / fail 0` |
| `node <evidence/p4-provider-real-install.mjs>` | 0 | `11/11 PASS`、临时根已清理 |

子代理曾自报一次回归抖动（`test/personaLibrary.test.mjs` AX-R06 报 undici `bad port`），主会话两次独立复跑均**未复现**，该文件本批未改。

### 11.2 AX-E24–E30 / E49 对账

| 断言 | 结论 | 证据 |
|---|---|---|
| AX-E24 未 ready 受管技能不进 list/get；补 publication 后立即可见 | ✅ | `test/expertProvider.test.mjs:302` |
| AX-E24 坏包只记诊断（YAML 坏/name 不符/旧驼峰键/链接/非目录/坏目录名） | ✅ | 同上 `:354` |
| AX-E24 完整性字段（`complete`、abort 立即返回空） | ✅ | 同上 `:413` |
| **AX-E24 清单 hash 复核（本批修复轮新增）** | ✅ | 同上 `:423`/`:447`/`:479`/`:520`/`:542` + 真实安装产物证据（11.4） |
| AX-E25 同层 rank 400 胜 600、只走 `registerProvider` | ✅ 消费侧 | 同上 `:435`/`:476` |
| AX-E26 真实 `scopeOf` 解析 / 跨层胜出 | ✅ SDK 实测 + ⚠️ 仲裁为模拟注册表 | 同上 `:506`/`:517` |
| AX-E27 候选变动 → get undefined + invalidate，不偷换正文 | ✅ | 同上 `:590` |
| AX-E28 安装后无需重启即可发现 / 换代后旧控制器作废 | ✅ 消费侧 | 同上 `:640`/`:677` |
| AX-E29 目录行与状态优先级（含 installation-incomplete 压过 invalid/disabled） | ✅ | `test/expertCatalog.test.mjs:268`/`:397`/`:421` |
| AX-E30 依赖预检三例 + 坏清单 + 清单一致判可用 | ✅ | 同上 `:442`/`:497`/`:527`/`:570` |
| AX-E49 scope 前置（helper 缺失/抛错 → `skill-scope-unavailable`，preflight 绝不判通过） | ✅ | 同上 `:630` + `test/expertProvider.test.mjs:552` |
| §7.3 投影保真（provider/source/rank/locator；坏条目丢弃） | ✅ | 同上 `:738` |
| AX-E48 自主召唤开关 off→on→off | 未验证（P6 范围） | 本批只交 `buildAutoExpertPrompt`，未注册进 systemPrompt |

### 11.3 交付物

新增 `src/experts/skill-provider.ts`（673）、`src/experts/host-adapter.ts`（404）、`src/experts/catalog.ts`（963）、`test/expertProvider.test.mjs`（933，18 test）、`test/expertCatalog.test.mjs`（780，12 test）、`test/fixtures/expertSkillFixture.mjs`（72）；修改 `package.json`（peer + `peerDependenciesMeta` optional + devDependency `@deepseek-ai/dsh-scope` 0.2.0-rc.2）、`pnpm-lock.yaml`（+3 行）、`tsconfig.build.json`（include +3）。**未改** `src/index.ts` / `src/tools.ts` / `src/api/**` / `src/client/**`；P1–P3 源文件零改动。逐字签名与接线义务见 `P4-handover.md` §2 与 §9。

### 11.4 独立证据：真实安装器 → 真实 provider

仓库测试的 `workbench-install.json` 是夹具构造的（用产品自己的 `hashSkillPackage` 算真哈希），所以"健康包被列出"在测试里带自证成分。`docs/tasks/ed644638-…/evidence/p4-provider-real-install.mjs`（**不属于仓库测试**）用真实草稿链（create → submit → stage×4 → validate → confirm）装一个含子目录许可副本与点开头文件 `.notes.txt` 的受管技能，再喂给真实 provider：**清单 `packageHash` 与候选 `locator.packageHash` 逐字相等**；清单 `files[]` 的 bytes/sha256 与磁盘真实字节相符；手改 `SKILL.md` → list 空 + `skill-package-invalid` + 伪造 locator 的 get 也拿不到（invalidate 恰好 1 次）；删掉 `.notes.txt` → 同样拒绝；全部还原 → 重新可见；根外哨兵未变。实跑 `11/11 PASS`、退出码 0。

### 11.5 规格偏差与过程事实

- 偏差 1【记录未改】：`duplicate-id-overridden` 的诊断行给 `status='disabled'`+`enabled:false`（§9.1 状态枚举无"被覆盖"档，两个方向都是撒谎，取"存在但不生效"并保留 issues 原文）。
- 偏差 2【记录未改】：`invalid` 只可能出现在诊断行（winner 行来自解析成功且发布门已放行的文档）；五级优先级在两类行合起来的意义上完整成立。
- 偏差 3【记录未改】：`readPendingInstallNote` 只读扫 `.pending/*/install-journal.json`（仓库没有"列出全部 expert 草稿"的函数），失败静默跳过。
- 偏差 4【记录未改】：`sourceKey` 反查复用 `sourceKeyForRoot`，反查不到落 `'user'`（理论不可达）。
- 偏差 5【记录未改】：`buildAutoExpertPrompt` 走 `checkSkills:false` —— 摘要不是权限证明，真正执行仍走完整异步 `preflightExpert`。
- 偏差 6【记录未改】：`scopeOf` 成功但返回 `undefined` 时投影记 `preliminary:true`（比 §7.3 更保守）；**P5 不得把 `preliminary` 当"不可用"**。
- **过程事实 1（真缺陷，已修）**：`isLinkEntry` 兜底用 `statSync`（跟随链接）→ 对 `Dirent` 未标出的 junction 永远 `false`，安全网为空；改 `lstatSync` 并补语义前提用例。此条**无反向注入**（真实文件系统造不出该形状），只有本机实测 `Dirent=true / lstat=true / statSync=false` + 代码论证。
- **过程事实 2（真缺陷，已修 + 反向注入）**：受管技能的清单 hash 从未被消费 → 安装后手改/增删文件仍会被当受管版本列出与 get。已加比对（`src/experts/skill-provider.ts:438`）。反向注入把该条件改 `if (false)`：`tests 30 / pass 28 / fail 2`，只有两条篡改用例红；还原后 45/45，探针残留 0。
- **过程事实 3（连带口径不一致，已修）**：`walkSkillPackage` 原跳过包内点开头文件，而安装器的 `packageHash` 覆盖它写入的每个文件（`src/experts/paths.ts:148` 只拒 `.`/`..` 整段）→ 含 `.foo.txt` 的**合规**包会被永久误判；已去掉包内跳过（副作用：更严）。
- **过程事实 4（夹具必须同步）**：两个测试文件的 `workbench-install.json` 原用合成哈希（`packageHash: HEX`，catalog 连 `files[].sha256` 也是 `HEX`）；修复后会被正确判成"被改过"。新增 `test/fixtures/expertSkillFixture.mjs`（真实哈希）后，**原有 24 条用例的断言文本一字未改**。
- **过程事实 5**：P4 由**同一子代理分两轮**完成（第一轮三源文件 + 39 test；第二轮两项修复 + 夹具真实化 → 45 test），两轮都经主会话独立复跑与逐段源码复核；未接生产装配（属 P5/P8），未执行安装/重启/发布。

## 12. P5 施工记录（2026-10-05 执行）

### 12.1 命令与退出码（主会话独立复跑，同一条命令链）

| 命令 | 退出码 | 输出要点 |
|---|---|---|
| `pnpm typecheck` | 0 | `tsc --noEmit` 无输出 |
| `pnpm build` | 0 | client 552.64 kB（gzip 163.91 kB），Build complete in 78ms |
| `node --test test/expertRoutes.test.mjs test/expertTools.test.mjs test/expertWiring.test.mjs test/httpFence.test.mjs` | 0 | `ℹ tests 43 / pass 43 / fail 0`（16+14+8+5） |
| `node --test test/expertProvider.test.mjs test/expertCatalog.test.mjs test/skills.test.mjs` | 0 | `ℹ tests 45 / pass 45 / fail 0`（18+12+15） |
| `node --test test/*.test.mjs` | 1 | `ℹ tests 1195 / pass 1194 / fail 1`；唯一失败 `db migrations, dictionaries and task tree` 为**清理期 EPERM**（既有问题，`docs/releases/v1.16.0.md:134`） |
| 独立证据 `evidence/p5-http-e2e.mjs` | 0 | `P5 HTTP 端到端证据：38/38 PASS，响应样本 23 条` |
| `pnpm pack`（`prepare` 会重建 lib，单独跑） | 0 | tarball 299 条目；含 `assets/expert-generation/methodology.md` + 全部新 lib 模块 + 3 个 LICENSE |

本批 14 个文件 CR 全 0（LF）；`REVERSE-INJECTION` 在 `src/**`、`test/**` 残留 0。

### 12.2 AX-E31–E35 / E50 对账

| 断言 | 结论 | 证据（测试文件:用例 / 独立证据） |
|---|---|---|
| AX-E31 | ✅ 测试内（真实 19387 宿主未跑） | `test/expertRoutes.test.mjs` 非回环 403 / 坏 JSON 400 / 声明超长 413；`test/expertWiring.test.mjs` 真发 300KiB body → 413 且草稿零行；`evidence/p5-http-e2e.mjs` 全链泄漏扫描（无临时根、`install-journal`、`ticket`） |
| AX-E32 | ✅ | `test/expertRoutes.test.mjs` 旧 version / 错 hash → 409 且正式库零写入；`evidence/p5-http-e2e.mjs` pending 草稿三条负例 + 已确认草稿幂等回放 |
| AX-E33 | ✅ | `test/expertRoutes.test.mjs` 首次 `replayed:false` → 再次 200 `replayed:true`；旧任务 kind 返回结构不变 |
| AX-E34 | ✅ | `test/expertTools.test.mjs` 只注册 5 个生成工具、无确认/安装工具、无 `session_id`/`root`/`absolute_path` 参数 |
| AX-E35 | ✅ | `test/expertRoutes.test.mjs` abandon 只清自己的暂存；installing → 409 且草稿仍 pending；其他草稿不受影响 |
| AX-E50 | ✅ **仅 fake ctx 内**（真实宿主未跑） | `test/expertWiring.test.mjs` 6 条：inject 逐字未变、一份 service 三处共用、skills 缺失不 pending、子 fiber + effect 范式、live agent 的 scope/cwd 原样传到 `skills.list`、settings POST 真 boolean 恰好转发一次 |

### 12.3 交付物

14 个文件（8 新增 + 6 修改）与逐字导出签名见 `P5-handover.md` §1/§2。

### 12.4 独立证据：真实 HTTP 全链 + 真实 provider 挂载

`docs/tasks/ed644638-…/evidence/p5-http-e2e.mjs`（**不属于仓库测试**）：真实 `http.createServer` + `makeRoutes(db, { experts })` + 真服务（`roots={home:<临时根>}`，与生产 `config.home` 同口径），走完 `capabilities → methodology → generation-start → 5 个工具 → validate → file → confirm → catalog → 再次 confirm → 负例 → abandon`。

三条最有价值的真实行为：①**无 skills 服务时**，受管发布被 `catalog` 真的发现（`source:'user'`、`provenanceState:'recorded'`、`enabled:true`）但如实降级为 `dependency-unavailable` + `skill-service-unavailable`，且不进 `personas` 可选摘要；②把**真实 P4 provider** 包进假 skills 服务后，同一行翻成 `usable`、`requiredSkills[0].available===true`、`preliminary===true`（无 live agent ⇒ 不假装已按 scope 仲裁），`preflight.usable===true`；③AX-E32 的"旧 version → 409"必须打在 **pending** 草稿上——已确认草稿的 confirm 走**幂等回放**（`src/experts/install.ts:1407-1413`，replay 优先于版本校验，这是设计）。

### 12.5 规格偏差、复核与修复

7 条规格偏差逐条列在 `P5-handover.md` §7（其中 ②`validateDraft` 第三参、③`Config.home`、⑥把 P1/P3 缺口在接线层补偿，明确标注为**子代理/主会话的判断偏差**）。

主会话逐文件复核后发出 3 处修复请求并已落地：①preflight 回调漏传 `exec` → 永远无 scope 全局视角（真问题，+11 行 + 反向注入）；②`setAutoEnabled` 转发只靠源码扫描 → 改可注入桩断言；③413 只靠声明式长度 → 补真发超限 body 用例。修复轮后 `tests 330 / pass 330 / fail 0`，反向注入（接线点传 `undefined`）→ `tests 8 / pass 7 / fail 1`（`actual: undefined` vs `expected: {label:'wiring-agent-scope'}`），还原后全绿。

### 12.6 未验证项（如实标注，不填通过）

8+1−1 条见 `P5-handover.md` §8，其中与 §12.2 直接相关的是：**真实 19387 宿主实例未跑**（未重启、未装盘，需用户明确授权）、**真实宿主 skills 服务未跑**（全程 fake/桩）、**"最近层同名技能胜出"的合并语义未在真实注册表验证**（只证明了 scope/cwd 原样传入）。

---

## 13. P6 施工记录（2026-10-05 执行）

### 13.1 命令与退出码（主会话独立复跑，同一条命令链）

| 命令 | 退出码 | 计数 / 结果 |
|---|---|---|
| `pnpm typecheck` | 0 | — |
| `pnpm build` | 0 | client `lib\client.js` 552.64 kB；buildId `wb-fc290c643d3d895a`（200 个输入文件） |
| `node --test test/expertInvocation.test.mjs test/expertWiring.test.mjs test/personaBinding.test.mjs` | 0 | `tests 33 / pass 33 / fail 0`（16 + 8 + 9） |
| `node --test test/expertProvider.test.mjs test/expertCatalog.test.mjs test/skills.test.mjs test/expertRoutes.test.mjs test/expertTools.test.mjs test/httpFence.test.mjs` | 0 | `tests 80 / pass 80 / fail 0` |

全仓套件本批**未跑**；按 P5 基线（`1195 / 1194 pass / 1 fail`，唯一失败为既有 `test/db.test.mjs` 清理期 EPERM）+ 新增 16 条推算为 `1211 / 1210 / 1` —— 推算不等于实测。

### 13.2 AX-E36–E44 / E48 / E49

逐条证据（用例名）见 `P6-handover.md` §6。结论：**AX-E36–E44 与 AX-E48 全 ✅**；**AX-E49** 的 5 条用例通过（缺 subagents / 只有 fork / 缺 `persona|toolFilter|depthLimit` / 开关打开但无合格 provider / 完全无 subagents 服务），但其中"真实 skills 服务导致的 `skill-scope-unavailable`"**根因未验证**（拒绝路径真实，触发源是注入的假 preflight）。

### 13.3 交付物

新增 `src/experts/invocation.ts`（1284 行）、`test/expertInvocation.test.mjs`（1150 行，16 条）；修改 `src/experts/host-adapter.ts`（405 → 564）、`src/experts/service.ts`（994 → 1140）、`src/experts/tools.ts`（576 → 959）、`src/index.ts`（618 → 670）、`tsconfig.build.json`（+1 include）。全部 CR=0 且以 LF 结尾。顶层 `inject` 逐字未变；未加依赖；未改 `SCHEMA_VERSION`；`src/api/**` 与 `src/client/**` 未动（`POST /experts/manual-requests` 属 P7）。

### 13.4 独立证据（主会话亲自执行）

- **反向注入（主会话另挑一处）**：`acquireSlot` 的 `perSession >= 1 || total >= 2` 闸门改成 `>= 999` → `✖ AX-E44 … (60107.39ms)`、`tests 16 / pass 15 / fail 1`；还原后 SHA256 与注入前逐字节相同（`29BC8900ADA9445FC341AE14AA3FCB26ADE3EC3780EE4057FF271740AE0950B2`），CR=0。→ 并发上限由**会失败的断言**守住，不是源码扫描。
- **子代理的反向注入**：拿掉 `requireTicket` 的 `parentSession` 校验 → `✖ AX-E39 …`（`'ticket-child-mismatch'` ≠ `'ticket-invalid'`）、`tests 1 / pass 0 / fail 1`；还原后 33/33。
- **格式修复**：`src/experts/host-adapter.ts` 缺尾换行 + 新段前多一个空行 → 已补（564 行、CR=0）。
- **无真实 provider 证据**：本机 spawn provider 是 cordis 插件（只导出 `Config/apply/inject/name`），要跑需真宿主 + 真 LLM，属 P9 隔离实例验收范围 → §13.6 如实标未验证。

### 13.5 规格偏差、复核与修复

12 条规格偏差逐条列在 `P6-handover.md` §7（其中"非 completed 的失败码映射"、"没 claim ≠ 契约错配"、"多一道能力可用门"、"两个常量落本模块"、"子代理守卫用 `expert-disabled`"明确标注为**判断/解释**）。

主会话逐段读完 `invocation.ts` 全文与 4 个修改文件的 diff，**未发现功能缺陷，故本批没有修复轮**（只做了一处格式修复）。口径纠正一处：子代理报告 §6-1 称"error/max-tokens/refusal 统一映射成 `expert-subagent-unavailable`"，实际是 `error` → `expert-subagent-unavailable`、`aborted` → `canceled`、`max-tokens`/`refusal` → 直接使用宿主 stopReason 字面值作为 `code`（§12.1 无对应码），以 `P6-handover.md` §7-3 为准。另修正 `P5-handover.md:40` 的 `methodology()` 签名漂移（同步 `ExpertMethodology`，不是 `Promise`）。

### 13.6 未验证项（如实标注，不填通过）

8 条见 `P6-handover.md` §8，核心是：**真实宿主 provider / 真 `SubagentRuntime` / 真 LLM 全部未跑**（时序、dispose 幂等、stopReason 取值、child header 字段、`persona` 严格插值、`ToolRuntime` 对未知 deny 名的 loud 拒绝都只对着忠实假实现验证过）；**真实 skills 服务的 `skill-scope-unavailable` 根因未验证**；**真 cordis 热重载未验证**；**`subagents` 服务"晚到"不会重同步**（只在设置变化时 `sync()`）；**P7 UI 与真实 19387 实例未跑**；macOS/Linux 未测。

---

## 14. P7 施工记录（2026-10-05 执行）

### 14.1 命令与退出码（主会话独立复跑，同一条命令链）

| 命令 | 退出码 | 计数 / 结果 |
|---|---|---|
| `pnpm typecheck` | 0 | — |
| `pnpm build` | 0 | buildId `wb-56b6a671db50d923`（203 个输入文件）；`lib\client.js` 559.78 kB / gzip 166.22 kB |
| `node --test test/expertInputSource.test.mjs test/expertCommand.test.mjs test/capabilities.test.mjs` | 0 | `tests 40 / pass 40 / fail 0` |
| `node --test` 专家域 9 文件 | 0 | `tests 146 / pass 146 / fail 0` |
| `node --test test/*.test.mjs`（全仓） | 1 | `tests 1244 / pass 1243 / fail 1`（duration 约 11.2 s） |

全仓唯一失败与 P5/P6 基线同源、非本批引入：`test/db.test.mjs` 的 "db migrations, dictionaries and task tree"，单独跑也失败（`tests 9 / pass 8 / fail 1`），错误为 `Error: EPERM, Permission denied: \\?\C:\Users\ADMINI~1\AppData\Local\Temp\dsh-personal-workbench-db-KXtbln`（临时目录清理期）。`test/verifySafety.test.mjs:351` 会打一行带 `✖` 前缀的诊断文本，但它不在 failing tests 列表、不计入 `fail`。基线推算 P5 `1195 / 1194 / 1` + P6 16 + P7 34 = 期望 1245，实测 1244（差 1 条纯计数差，未追根因，不影响断言结论）。

### 14.2 AX-E45–E47 / E51

逐条证据（用例名与行号）见 `P7-handover.md` §6。结论：**AX-E45（8 条）、AX-E46（7 条）、AX-E47（11 条）、AX-E51（3 条）全 ✅**。其中 AX-E45/E46 的"源不抢文件仲裁"、"inputTriggers 缺失不注册"、"跨会话只认 ref 的 sessionId"、"serialize 失败绝不回落成普通文本"都各有会失败的断言守着；`expertCommand.test.mjs:312-320` 真起 `http.createServer` + `server.listen(0,'127.0.0.1')` + `fetch` 打真端点验 `POST /experts/manual-requests` 契约。

### 14.3 交付物

新增 `src/experts/command.ts`（253 行）、`src/client/expertPrompt.ts`（85 行）、`src/client/expertInputSource.ts`（580 行）、`test/expertInputSource.test.mjs`（566 行，16 条）、`test/expertCommand.test.mjs`（425 行，18 条）；修改 `src/api/routes/experts.ts`（`+31 −2`，新增 `manual-requests` 分支）、`src/index.ts`（`+45 −2`，新增 `registerExpertCommand`）、`src/client/index.tsx`（`+14 −1`，一行装配）、`tsconfig.build.json`（`+3` include）。10 个相关文件全部 CR=0 且以 LF 结尾。顶层 `inject` 逐字未变（4 项），`src/client/capabilities.ts` 逐字未变（5 项，sha256 `0C5326113D5606B9BE0781139999BD20D76EBDD6869B603DB8226818ACC430EF`）；未加任何依赖；ticket 无 HTTP 出口；`SCHEMA_VERSION` 未动。

### 14.4 独立证据（主会话亲自执行）

- **反向注入（主会话另挑一处）**：删掉 `src/client/expertInputSource.ts` 里 `register()` 的 `if (disposed) return` 守卫 → `build 0` 但 `node --test` 两文件 = `tests 33 / pass 31 / fail 2`；还原后 sha256 = `FF3C3F9D11B9988365BB03E1345FF914A00C802BEF068EF1632831ACFFBD8640`（与注入前逐字节相同，也与子代理自报前缀一致）。→ 生命周期守卫由**会失败的断言**守住。
- **diff 逐行读完**（4 个已跟踪文件合计 `+93 −5`），**三个新模块全文通读**（85 + 253 + 580 行）：未发现功能缺陷，故本批没有修复轮，只做 §14.5 的两处小修。
- **注释引用核对**：`EXPERT_INVOCATION_DIRECTIVE` 5 行与 `方案-v0.3.md:654-660` 逐字一致；`src/index.ts:246-249` 确是 `/workbench` 的 steer 调用点；`dsh-commands/lib/types/index.d.ts:54` 确是 `readonly handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>`。

### 14.5 规格偏差、复核与修复

5 条偏差逐条列在 `P7-handover.md` §7（其中 **`serialize` 先 `preflight` 再 `manual-requests`** 是主会话复核时新识别的：超出 §8.3 字面顺序，但正是 P6 交接 §9-2 与 AX-E46"身份变动即拒"的要求，代价是提交时多一次 HTTP 往返；另 4 条为"两条不可达分支删除"、"`command.ts` 的 tsconfig include 冗余但保留"、"入口装配收进一行"、"端点常量集中一处"）。

两处小修（均为格式/注释，无行为变更）：①`src/client/index.tsx` 新段后多余空行删除（1986 → 1985 行）；②`src/experts/command.ts:232` 注释的 steer 出处由 `src/index.ts:209-212` 更正为 `src/index.ts:246-249`，并注明 `createUserMessage` 自 `src/index.ts:9` 起即既有 import 口径（⇒ 该文件 sha256 由 `CFF465BA…41D1C` 变为 `A3E1DA683F2A85D2E56CE80FE04EB127882B0F5F0CC43C573E4EC2081A7D4F24`）。修完重跑全绿（`typecheck 0` / `build 0` / 三件套 40/40 / 专家域 146/146）。

### 14.6 未验证项（如实标注，不填通过）

8 条见 `P7-handover.md` §8，核心是：**真实宿主未跑**（未起 19387、未点 `@` 菜单，源并列/引用胶囊/`onPick` 后的 ref 呈现只对着假 `host` 验过）；**`codec.serialize` 抛错时宿主的 UI 行为未验证**（"保留输入并阻止发送"属宿主契约）；**跨会话复制的拒绝未端到端验证**（`manual-request-session-mismatch` 属 P6/服务端）；**真实 `agent.steer` 与 `CommandInvocation.agent` 真实形状未跑**；**`pnpm test` 全量脚本未跑**（用等价 `node --test test/*.test.mjs`）；**真实 provider / 真 `SubagentRuntime` / 真 LLM 全部未跑**（同 P6）；**macOS/Linux 未测**。

---

## 15. P8 施工记录（2026-10-05 执行）

### 15.1 命令与退出码（主会话独立复跑，同一条命令链）

| 命令 | 退出码 | 计数 / 结果 |
|---|---|---|
| `pnpm typecheck` | 0 | `tsc --noEmit`（`tsconfig.json` 的 `include: ["src"]` + `strict: true`，**确实覆盖 `src/client/**`**） |
| `pnpm build` | 0 | buildId `wb-d130ed707d64a654`（206 个输入文件）；`lib\client.js` 597.32 kB / gzip 177.29 kB |
| `node --test test/expertClientFlow.test.mjs test/clientInvariants.test.mjs test/capabilities.test.mjs test/draftBannerSessionJump.test.mjs` | 0 | `tests 56 / pass 56 / fail 0` |
| `node --test test/*.test.mjs`（全仓） | 1 | `tests 1282 / pass 1281 / fail 1`（duration 约 12 s） |

全仓唯一失败与 P5/P6/P7 基线同源、非本批引入：`test/db.test.mjs` 的 "db migrations, dictionaries and task tree"（临时目录清理期 `EPERM`）。**收尾复核补充**：`origin/main` 已前进到 `7980493`，其中 `05fea07` 与 `7980493` 正是修这条（"清理临时目录不再抛错，避免 finally 顶替真正的断言失败"）⇒ 本批的"1 fail"是**本地基线**的真实状态，P9 rebase 到新 `origin/main` 后预期归零。计数核对：P7 基线 1244 + 本批新增 38（`test/expertClientFlow.test.mjs` 全部用例）= **1282** ✓。子代理首轮曾报"全仓连跑第二次会多出 4 条假失败"（AX-E48 / AX-R04 / draft defer-resume-abandon API / PATCH `/tasks/:id`），主会话复跑时未复现；那 4 个文件本批一个未碰。

### 15.2 AX-E52–E58

逐条证据（用例名与行号，主会话逐条打开核对过）见 `P8-handover.md` §6。结论：**AX-E52（4 条）、AX-E53（6 条）、AX-E54（6 条）、AX-E55（3 条）、AX-E56（5 条）、AX-E57（4 条）、AX-E58（10 条）全 ✅**。其中"不复用 blank 会话"（`:258` 断言 `sessions.create` 新身份 + `connectWorkspace` 调用数 = 0）、"确认 body 恰好两字段且等于所见版本"（`:505`）、"版本冲突后没有第二次确认"（`:593`）、"安装成功后重读目录"（`:649`）、"required 缺失行可见但选择器不可选"（`:710`）、"`WorkbenchApp` 体内零 `useState`/零网络/零定时器"（`:886`）都各有会失败的断言守着（见 §15.4 的 6 处反向注入）。

### 15.3 交付物

新增 `src/client/hooks/useWorkbenchExperts.ts`（1510 行）、`src/client/components/ExpertCreateModal.tsx`（154 行）、`src/client/components/ExpertDraftBody.tsx`（253 行）、`test/expertClientFlow.test.mjs`（1018 行，38 条）；修改 `src/client/viewTypes.ts`（`+15 −0`，`sessions.create?`）、`src/client/index.tsx`（`+65 −2`，装配 hook + 惰性转发 ref）、`src/client/components/SettingsModal.tsx`（`+57 −3`）、`src/client/components/PersonaAdmin.tsx`（`+244 −143`，改受控组件）、`src/client/components/PersonaPicker.tsx`（`+32 −52`）、`src/client/hooks/useWorkbenchAISessions.ts`（`+21 −0`，绑定前同一份 preflight 守卫）、`src/client/hooks/useWorkbenchDrafts.ts`（`+32 −1`）、`src/client/components/DraftBanner.tsx`（`+189 −22`）、`src/client/app/{assembly.ts,WorkbenchBody.tsx,WorkbenchOverlays.tsx,WorkbenchDialogs.tsx}`（合计 `+44 −4`，纯传参）、`test/personaWiring.test.mjs`（`+17 −4`，写入口径重定向 + 补"受控界面不许留第二份写入口"）、`tsconfig.build.json`（`+1 −0`）。18 个文件全部 CR=0、无 BOM、以 LF 结尾（逐字节统计）。客户端 `inject` 5 项与顶层 `inject` 4 项**逐字未变**；`package.json` / `pnpm-lock.yaml` / `src/client/styles.ts` / `SCHEMA_VERSION` / 迁移 / `src/experts/**` 未动。

### 15.4 独立证据（主会话亲自执行）

- **反向注入 6 处**（5 处子代理 + 1 处主会话自选，全部真红、还原后 SHA256 逐字节一致）：① 删 busy 守卫 → 37/1（AX-E52）；② `manifestHash` 换常量 → 37/1（AX-E54）；③ `create` 改复用 blank 会话 → 32/6（AX-E52 + 5 条 AX-E53）；④ auto 保存失败不回滚 → 37/1（AX-E57）；⑤ 版本冲突后自动确认新版本 → 37/1（AX-E55）；⑥ **主会话自选**：`src/client/hooks/useWorkbenchExperts.ts:579` 的 picker 第二道闸门改成 `return true` → `pnpm build` 0 但 `tests 38 / pass 37 / fail 1`（AX-E56「required 缺失的行：选择器不可选」），还原后 `build 0` + `38/38`，sha256 回到 `DEF610758C5882D2556F2744FB07AF5C6383609EDFBA8B9D2F757BABD044F6DD`。
- **diff 通读 + 逐条核对 38 个用例锚点**：14 个已跟踪文件 diff 全读，`test/expertClientFlow.test.mjs` 的 38 个行号逐条打开核对（每一行确实是所述行为的用例开头）。**未发现功能缺陷；本批没有修复轮，主会话未改动任何一行源码**。
- **真实宿主契约核对**：在 `C:\Users\Administrator\.dsh\profiles\node_modules\@deepseek-ai\` 下读到 `ISessions.create(opts?: { workspaceId?; cwd?; sessionId? }): Promise<SessionId>`、失败抛 `SessionCreateError`、`SessionSummary.blank`、`uiWorkspace.openSession(target)` 均真实存在，与 `viewTypes.ts` 注释所述一致。

### 15.5 规格偏差、复核与修复

11 条逐条列在 `P8-handover.md` §7。前 10 条为施工方自报（确认走既有 `POST /drafts/:id/confirm` 而非计划里的 `/experts/.../confirm`；`api()` 不暴露状态码 ⇒ 409 靠重读草稿比对版本；真实 preflight 无 `reason`/`code`；`sessions.create` 按真实 d.ts 声明为可选能力、缺能力不静默降级；工作区必须取带 id 的宿主快照；白名单外 4 个装配管道文件 + 1 个既有测试；`matchWorkspaceForCwd` 改最长前缀；"真值未定时禁用确认"标判断；"全仓 LF"任务书与实况不符）。

**第 11 条是主会话复核时新识别的**：设置页专家列表**不再有分组章节标题**——HEAD 的 `PersonaAdmin.tsx` 用 `groupPersonas(personaPickerList(...))` 渲染分组章节与计数（2026-10-01 用户反馈"层级不明显"后的设计），P8 版改成扁平行（行内显示 `来源｜分组｜登记来源`，另加状态标签与"来源与技能"折叠详情），分组顺序也不再受控。依据 `方案-v0.3.md:785` 只要求"列表展示名称、简介、分组、三级来源、状态、来源方式"，未要求章节，**故按规格不算偏差**；`PersonaPicker` 的分组章节仍保留（`personaPicker.ts:174`）。这是一次相对 HEAD 的可见布局变化，且本批无浏览器验证 ⇒ P9 真机视觉核对项（`P8-handover.md` §9-9）。

**一处观察，未改**：`src/client/index.tsx:711` 的 `if (sessionId === null) return ''` 在 `currentSessionIdOf(runtime): string` 下是恒假分支（`strict: true` 下 TS 也未报错，下一行 `?? ''` 已覆盖空串）；行为无害，按"只接线不改既有语义"未动它。

### 15.6 未验证项（如实标注，不填通过）

8 条见 `P8-handover.md` §8，核心是：**无真浏览器/GUI**（DOM 渲染、点击、弹窗视觉、真实 DOM 里的 `data-wb-expert-*` 取值只做源码级唯一性断言）；**无真实宿主**（`sessions.create` / `acquireSession` / `uiWorkspace.openSession` 全用假 runtime，`SessionCreateError` 的真实抛法未跑）；**无真实 LLM**（generation-start / validate / confirm 全用假 HTTP 响应）；**无真实安装落地**（journal / publication / 文件写入 / skill provider 生效属 P5–P6 覆盖）；**未起宿主点 `@` 菜单与 `/expert`**（P7 遗留）；**auto 开关对自主召唤行为的真实影响未验**（只验了值写对与失败回滚）；**未重启实例**；**macOS/Linux 未测**。
