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
| P3–P5 生成与安装主链 | 未实现 | 无产品运行结果 |
| P6–P7 专家调用主链 | 未实现 | 无产品运行结果 |
| P8 客户端界面 | 未实现 | 无浏览器结果 |
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
- 客户端 `sessions.create` 与宿主 controller 的 `create` 是两层同名接口，形状一致（`workspaceId` / `cwd` / `sessionId` 全可选），P8 的 `WorkbenchRuntime.sessions` 可选方法形状按此声明。

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
