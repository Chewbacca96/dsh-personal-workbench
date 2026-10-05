/**
 * 白名单套件：**expert**（专家功能出口批次 P9；AX-E59–E62 + P8 遗留的 AX-E52–E58 的 B 层）。
 *
 * 判据输入：`docs/tasks/51189a57-…-工作台专家功能实现和优化/acceptance.md:69-72`、
 * `implementation-plan.md:318-342`（P9 十条）、`P9-handover.md` 的接线义务。
 *
 * ## 四层，分别记状态（照 `persona.mjs` 的模板）
 *
 * | 层 | 覆盖 | 说明 |
 * |---|---|---|
 * | U/N（包与静态） | AX-E59 | 本次链真实打包出来的 tgz：方法论 / 新 `lib/**` / 内置 personas / 许可都在；`.pending`、测试数据、TEMP 证据、绝对路径**都不在** |
 * | H（真实 HTTP） | AX-E60 前半 + AX-E52–E58 的接线面 | 隔离实例的真实 SQLite + 真实文件系统：capabilities / methodology / catalog / generation-start / validate / confirm / abandon / manual-requests / preflight |
 * | B（真实浏览器） | AX-E52–E58 | 真实鼠标点「新建专家」、读 `data-wb-expert-*` 实际渲染值、开关、降级 |
 * | M（真实模型） | AX-E60/E61/E62 后半 | 需要一条真实模型链路；拿不到就**如实 skip**（required+skipped 由链判不通过），绝不写成 pass |
 *
 * ## 本套件不新增任何隐式 skip 白名单
 *
 * `skipped` 只出现在 **M 层**（真实模型链路），且 reason 逐条写清。U/H/B 三层找不到前置
 * 一律走 `suite.require()`（记 **fail**，不是 skip）。`total <= 0` 由链判失败，本套件也自检。
 *
 * 用法（链自己会拼）：
 * ```sh
 * node scripts/verify/suites/expert.mjs --url <目标> --evidence-dir <本次证据目录> --user-data-root <临时浏览器根>
 * ```
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  CHECK_LAYERS,
  createApi,
  ensureWorkbenchPanel,
  launchSuiteBrowser,
  parseSuiteArgs,
  repoRootFromSuite,
  safeJson,
  sleep,
  startSuite,
  waitFor,
} from './_harness.mjs'
import { discoverBrowser } from '../browser.mjs'

const options = parseSuiteArgs()
if (options.url === undefined) { console.error('用法：node scripts/verify/suites/expert.mjs --url <目标>'); process.exit(2) }

const AX = ['AX-E59', 'AX-E60', 'AX-E61', 'AX-E62']
/** P8 遗留的 B 层（AX-E52–E58：DOM + 真实点击）。它们与 E59–E62 同属本套件。 */
const P8_AX = ['AX-E52', 'AX-E53', 'AX-E54', 'AX-E55', 'AX-E56', 'AX-E57', 'AX-E58']
const ROOT = repoRootFromSuite()

const suite = startSuite({
  id: 'expert',
  title: '专家功能出口批次：真实包 / 真实 HTTP / 真实浏览器 / 真实模型（U-N-H-B-M 五层）',
  url: options.url,
  evidenceDir: options.evidenceDir,
  axIds: [...AX, ...P8_AX],
  legacyIds: [...AX, ...P8_AX],
})
const api = createApi(options.url, { token: options.token })

/**
 * 带**登录会话 cookie** 的 API 客户端。
 *
 * 为什么不能只靠 `Authorization: Bearer`：本机宿主 webserver 的认证是"`?token=` 换
 * `dsh-auth-*` cookie"（`GET /?token=<t>` → 303 + Set-Cookie），裸 Bearer 一律 401
 * （2026-10-05 实测：`/api/workbench/experts/capabilities` → 401，登录后同路径 404/200）。
 * cookie 只留在进程内存里，**绝不**写进证据（与 token 同一条纪律）。
 */
const sessionApi = {
  cookie: '',
  async login() {
    if (this.cookie !== '' || options.token === '') return
    const base = api.base
    const response = await fetch(`${base}/?token=${encodeURIComponent(options.token)}`, { redirect: 'manual' })
    const raw = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
    this.cookie = raw.map((entry) => entry.split(';')[0]).join('; ')
  },
  async request(path, init = {}) {
    await this.login()
    return api.request(path, { ...init, headers: { ...(this.cookie === '' ? {} : { cookie: this.cookie }), ...(init.headers ?? {}) } })
  },
  get(path) { return this.request(path, { method: 'GET' }) },
  post(path, body) { return this.request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }) },
}

/** 本套件自己的 runId：合成的会话 id / 请求文本都带它，**绝不**按标题批量匹配别人的数据。 */
const runId = `verify-expert-${Date.now().toString(36)}`
const syntheticSession = (suffix) => `${runId}-${suffix}`

const report = { runId, target: options.url, layers: {}, profile: { profile: options.profile, profileDir: options.profileDir, dbPath: options.dbPath } }
let browser
/**
 * 收尾安全网用的草稿 id（见 `finally`）：只要生成了草稿就必须在退出前确认它不是 pending ——
 * 漏一份 pending 专家草稿，横幅就会在**后续套件**的鼠标点击上盖一层浮层。
 */
let cleanupDraftId

/** 层是否被登记过（`CHECK_LAYERS` 是全仓唯一口径：U/H/W/B/N）。 */
const layerOk = (layer) => CHECK_LAYERS.has(layer)

// ─────────────────────────────────────────────────────────────────────────────
// U/N：AX-E59 —— 本次真实打包产物
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 定位**本次链真实打包出来**的 tgz。
 *
 * 顺序（先本次、后兜底，且**只信指针**）：
 * 1. `_local-build/current.txt` 里记的绝对路径 —— `dev-install.mjs` 每次打包都写它，
 *    链的 `install` 阶段刚跑过，所以它指向的就是本次构建的包；
 * 2. `_local-build/current.tgz` —— 同一份包的稳定副本；
 * 3. 仓库根 `<name>-<version>.tgz` —— 手工 `pnpm pack` 的兜底。
 *
 * **绝不按 mtime 猜**：猜错就会把上一个版本的包当成"本次产物"（那正是 AX-E59 要防的）。
 */
function locateTarball() {
  const candidates = []
  const pointer = join(ROOT, '_local-build', 'current.txt')
  if (existsSync(pointer)) {
    try {
      const recorded = readFileSync(pointer, 'utf8').trim().split(/\r?\n/)[0]
      if (typeof recorded === 'string' && recorded !== '') candidates.push({ path: recorded, source: 'current.txt' })
    } catch { /* 指针读不了就换下一档 */ }
  }
  candidates.push({ path: join(ROOT, '_local-build', 'current.tgz'), source: 'current.tgz' })
  try {
    const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
    candidates.push({ path: join(ROOT, `dely0-dsh-personal-workbench-${version}.tgz`), source: 'repo-root pack' })
  } catch { /* 读不了 package.json 就只剩前两档 */ }
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate.path) && statSync(candidate.path).size > 0) return candidate
    } catch { /* 继续 */ }
  }
  return undefined
}

/**
 * 剥掉 JS/TS/CSS 风格的注释（**只为泄漏扫描用**，不追求完整词法分析）。
 *
 * 为什么需要它：产品源码里本来就有合法示例（`src/personas/resources.ts:16` 的注释写着
 * `拒绝 UNC（\\host\share）`），把它当泄漏是假红 —— 而假红会把真正泄漏的那条淹掉。
 * 用**状态机**而不是正则：正则处理 `//` 与字符串里的 `//`（URL！）会互相咬。
 * 字符串字面量**不剥**（真泄漏也可能出现在字符串里），只剥注释。
 */
function stripComments(text) {
  let out = ''
  let index = 0
  let mode = 'code'
  while (index < text.length) {
    const two = text.slice(index, index + 2)
    const char = text[index]
    if (mode === 'code') {
      if (two === '//') { mode = 'line'; index += 2; continue }
      if (two === '/*') { mode = 'block'; index += 2; continue }
      if (char === '"' || char === "'" || char === '`') { mode = char; out += char; index += 1; continue }
      out += char
      index += 1
      continue
    }
    if (mode === 'line') {
      if (char === '\n') { mode = 'code'; out += char }
      index += 1
      continue
    }
    if (mode === 'block') {
      if (two === '*/') { mode = 'code'; index += 2; continue }
      if (char === '\n') out += char
      index += 1
      continue
    }
    /** 字符串模式：处理转义，闭合后回 code。 */
    if (char === '\\') { index += 2; continue }
    if (char === mode) { mode = 'code'; out += char; index += 1; continue }
    out += char
    index += 1
  }
  return out
}

async function gunzipToBuffer(file) {  const { createGunzip } = await import('node:zlib')
  const { createReadStream } = await import('node:fs')
  const chunks = []
  await new Promise((resolvePromise, rejectPromise) => {
    createReadStream(file)
      .pipe(createGunzip())
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', resolvePromise)
      .on('error', rejectPromise)
  })
  return Buffer.concat(chunks)
}

/**
 * AX-E59：对**本次真实打包产物**核验"该有的都有、不该有的都没有"。
 *
 * 复用 `scripts/lib/tarReader.mjs`（认 PAX 扩展头的唯一实现）——**不自己写一套解包**，
 * 否则中文角色名会静默漏条目（`tarReader.mjs:8-19` 记着这个 bug 的代价）。
 */
async function checkTarball() {
  report.layers.package = {}
  const located = locateTarball()
  if (located === undefined) {
    suite.require({
      id: '找到本次链真实打包出来的 tgz', axId: 'AX-E59', layer: 'U',
      detail: '探测过：_local-build/current.txt、_local-build/current.tgz、仓库根 <name>-<version>.tgz 都不存在',
    })
    return
  }
  /**
   * 动态 import **必须**用文件 URL：Windows 绝对路径（`D:\…`）交给 ESM loader 会被
   * 当成协议 `d:` 拒掉（首跑实测：`Only URLs with a scheme in: file, data, and node are supported`）。
   */
  const { listTarEntries, readEntryContent } = await import(pathToFileURL(join(ROOT, 'scripts', 'lib', 'tarReader.mjs')).href)
  let buffer
  try {
    buffer = await gunzipToBuffer(located.path)
  } catch (error) {
    suite.require({
      id: 'gzip 解压本次 tgz', axId: 'AX-E59', layer: 'U',
      detail: `${located.path} 解压失败：${error instanceof Error ? error.message : String(error)}`,
    })
    return
  }
  const entries = listTarEntries(buffer)
  const names = entries.map((entry) => entry.name)
  const files = new Set(entries.filter((entry) => entry.typeFlag !== '5').map((entry) => entry.name))
  const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
  report.layers.package = {
    tarball: located.path,
    source: located.source,
    bytes: statSync(located.path).size,
    tarBytes: buffer.length,
    entryCount: entries.length,
    version,
  }
  suite.note(`包：${located.path}（来源 ${located.source}，${statSync(located.path).size} 字节，${entries.length} 条目）`)

  suite.check({
    id: 'tgz 能解压、tar 条目非空、包内版本与 package.json 一致', axId: 'AX-E59', layer: 'U',
    ok: entries.length > 0 && files.has('package/package.json')
      && JSON.parse(readEntryContent(buffer, entries.find((entry) => entry.name === 'package/package.json')).toString('utf8')).version === version,
    detail: `entryCount=${entries.length} 期望版本=${version}`,
  })

  /** ① 该有的都有（逐类给**证据计数**，不是"存在即通过"）。 */
  const personaDocs = [...files].filter((name) => /^package\/assets\/personas\/.+\.md$/i.test(name))
  const libFiles = [...files].filter((name) => name.startsWith('package/lib/'))
  const expertLib = [...files].filter((name) => /^package\/lib\/experts\//.test(name))
  const methodology = files.has('package/assets/expert-generation/methodology.md')
  const licenses = ['package/LICENSE', 'package/LICENSE-novotnyllc-dotnet-artisan', 'package/LICENSE-K-Dense-scientific-agents']
    .filter((name) => files.has(name))
  const required = [
    { what: '随包方法论 assets/expert-generation/methodology.md', ok: methodology, got: methodology ? '在' : '缺' },
    { what: '新 lib/experts/**（P1–P6 的编译产物）', ok: expertLib.length >= 8, got: `${expertLib.length} 个文件` },
    { what: 'lib/client.js / lib/index.js', ok: files.has('package/lib/client.js') && files.has('package/lib/index.js'), got: `${libFiles.length} 个 lib 文件` },
    { what: '原有 personas（assets/personas/**/*.md）', ok: personaDocs.length >= 15, got: `${personaDocs.length} 篇` },
    { what: '三份许可原文', ok: licenses.length === 3, got: licenses.map((name) => basename(name)).join(' / ') },
  ]
  report.layers.package.required = required
  suite.check({
    id: 'AX-E59-a 包内"该有的都有"：方法论 / 新 lib 产物 / 原有 personas / 三份许可（逐类计数）', axId: 'AX-E59', layer: 'U',
    ok: required.every((item) => item.ok),
    detail: required.map((item) => `${item.ok ? '✅' : '❌'} ${item.what} = ${item.got}`).join('；'),
  })

  /**
   * ② 不该有的都没有。
   *
   * 判据是**包内路径**，逐条给命中（不是"整串不含某词"那种宽正则）：
   * - `.pending` 是**用户的暂存区**（`EXPERT_PENDING_DIR_NAME`），绝不能随包发出去；
   * - `test/` / `test-results/` / `_local-build/` / `_local-archive/` / `browser-temp/` / `dist/` 是开发或证据产物；
   * - `*.log` / `*.png`（截图证据）同理。
   * 注意 `package/screenshot/**` 是**产品自带**的截图目录（`package.json` 的 `files` 明确列了它），
   * 所以只按**目录**判，不按 `.png` 后缀一刀切。
   */
  const forbidden = [
    { what: '暂存区 .pending', hits: [...files].filter((name) => name.includes('/.pending/') || name.endsWith('/.pending')) },
    { what: '测试源码 test/**', hits: [...files].filter((name) => /^package\/test\//.test(name)) },
    { what: '证据包 test-results/**', hits: [...files].filter((name) => /^package\/test-results\//.test(name)) },
    { what: '开发打包产物 _local-build/**', hits: [...files].filter((name) => /^package\/_local-build\//.test(name)) },
    { what: '历史存档 _local-archive/**', hits: [...files].filter((name) => /^package\/_local-archive\//.test(name)) },
    { what: '浏览器临时目录 browser-temp/**', hits: [...files].filter((name) => /^package\/browser-temp\//.test(name)) },
    { what: '源码 src/**（包只发 lib）', hits: [...files].filter((name) => /^package\/src\//.test(name)) },
    { what: '日志 *.log', hits: [...files].filter((name) => name.endsWith('.log')) },
    { what: 'TEMP 证据（临时目录名里的 verify 痕迹）', hits: [...files].filter((name) => /\/suite-[a-z-]+\//i.test(name)) },
  ]
  report.layers.package.forbidden = forbidden.map((item) => ({ what: item.what, count: item.hits.length, sample: item.hits.slice(0, 5) }))
  suite.check({
    id: 'AX-E59-b 包内"不该有的都没有"：无 .pending / 测试数据 / TEMP 证据 / 源码 / 日志', axId: 'AX-E59', layer: 'U',
    ok: forbidden.every((item) => item.hits.length === 0),
    detail: forbidden.map((item) => `${item.hits.length === 0 ? '✅' : '❌'} ${item.what}=${item.hits.length}`).join('；'),
  })

  /**
   * ③ 包内文本**不含绝对路径**。
   *
   * 为什么只扫**文本类**条目：二进制条目里出现 `C:\` 字节序列是噪声。
   * 为什么先**剥注释**：产品源码里本来就有合法示例与正则字面量 ——
   * `src/personas/resources.ts:16` 的注释写着"拒绝 UNC（`\\host\share`）"、
   * `:81` 的正则里就有 `'\\\\'`。把文档当泄漏是**假红**（首跑实测命中 `lib/personas/resources.js`），
   * 而假红会把真正泄漏的那一条淹掉。
   * 判据抓两类真会泄漏的形态：本机用户名路径（`C:\Users\<name>\…`）与 UNC（`\\server\share`）。
   * **不抓泛化的 `[A-Za-z]:[\\/]`** —— 那会把文档里的示例路径也算成泄漏。
   */
  const textLike = entries.filter((entry) => entry.typeFlag !== '5'
    && /\.(md|json|js|mjs|cjs|ts|yml|yaml|txt|css|map|d\.ts)$/i.test(entry.name)
    && entry.size > 0)
  const leaks = []
  for (const entry of textLike) {
    const content = stripComments(readEntryContent(buffer, entry).toString('utf8'))
    for (const pattern of [/[A-Za-z]:[\\/]Users[\\/][^\\/\s"']+/, /\\\\[A-Za-z0-9._-]+\.[A-Za-z]{2,}[\\/][A-Za-z0-9$._-]+/]) {
      const match = pattern.exec(content)
      if (match !== null) { leaks.push(`${entry.name} ← ${match[0].slice(0, 60)}`); break }
    }
  }
  report.layers.package.absolutePathLeaks = leaks
  suite.check({
    id: 'AX-E59-c 包内文本没有本机绝对路径 / UNC 泄漏', axId: 'AX-E59', layer: 'U',
    ok: leaks.length === 0,
    detail: `扫描 ${textLike.length} 个文本条目；命中=${safeJson(leaks.slice(0, 5))}`,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// H：真实 HTTP（隔离实例的真实 DB + 真实文件系统）
// ─────────────────────────────────────────────────────────────────────────────

/** 用户库 personas 根（与 `src/experts/paths.ts:72` 的 `defaultUserPersonaRoot` 同源约定）。 */
function userPersonaRoot() {
  const home = process.env.DSH_VERIFY_HOME ?? homedir()
  return join(home, '.dsh', 'workbench', 'personas')
}

/** 列一个目录下的**条目名**（不存在返回空数组，不抛）。 */
function listDir(path) {
  try { return readdirSync(path, { withFileTypes: true }).map((entry) => entry.name) } catch { return [] }
}

/** 递归列出相对路径（只在需要精确比对时用；深度受限，绝不扫上万文件）。 */
function walkRelative(root, maxEntries = 4000) {
  const out = []
  const stack = ['']
  while (stack.length > 0 && out.length < maxEntries) {
    const rel = stack.pop()
    const absolute = rel === '' ? root : join(root, rel)
    let dirents
    try { dirents = readdirSync(absolute, { withFileTypes: true }) } catch { continue }
    for (const dirent of dirents) {
      const child = rel === '' ? dirent.name : `${rel}/${dirent.name}`
      out.push(`${child}${dirent.isDirectory() ? '/' : ''}`)
      if (dirent.isDirectory()) stack.push(child)
    }
  }
  return out.sort()
}

async function checkHttpLayer() {
  report.layers.http = {}
  const health = await api.get('/api/workbench/health')
  report.layers.http.health = { status: health.status, version: health.body?.version ?? null, buildId: health.body?.buildId ?? null, db: health.body?.db ?? null }
  suite.note(`目标 health：status=${health.status} version=${health.body?.version} buildId=${health.body?.buildId} schema=${health.body?.db?.schemaVersion}`)

  /** ── capabilities：四项能力如实探测 ─────────────────────────────────────── */
  const caps = await sessionApi.get('/api/workbench/experts/capabilities')
  report.layers.http.capabilities = caps.body
  suite.check({
    id: 'GET /experts/capabilities 200 且四项能力都带 available/reason（不静默缺字段）', axId: 'AX-E60', layer: 'H',
    ok: caps.status === 200 && caps.body?.ok === true
      && typeof caps.body?.generation?.available === 'boolean'
      && typeof caps.body?.skills?.available === 'boolean'
      && typeof caps.body?.manualSummon?.available === 'boolean'
      && typeof caps.body?.autoSummon?.available === 'boolean'
      && typeof caps.body?.autoSummon?.enabled === 'boolean',
    detail: safeJson(caps.body),
  })
  suite.check({
    id: 'capabilities.generation.available=true（随包方法论可读，这是生成入口的前置）', axId: 'AX-E60', layer: 'H',
    ok: caps.body?.generation?.available === true && caps.body?.generation?.reason === null,
    detail: safeJson(caps.body?.generation ?? null),
  })

  /** ── methodology：真实全文 ──────────────────────────────────────────────── */
  const methodology = await sessionApi.get('/api/workbench/experts/methodology')
  const methodologyText = typeof methodology.body?.text === 'string' ? methodology.body.text : ''
  report.layers.http.methodology = { status: methodology.status, version: methodology.body?.version, chars: methodologyText.length }
  suite.check({
    id: 'GET /experts/methodology 返回真实全文（version=1 且正文非空、不是占位串）', axId: 'AX-E60', layer: 'H',
    ok: methodology.status === 200 && methodology.body?.version === 1 && methodologyText.length > 500
      && /专家|persona|人格/i.test(methodologyText),
    detail: `version=${methodology.body?.version} chars=${methodologyText.length}`,
  })

  /**
   * ── catalog：管理行 + 可选择摘要 ─────────────────────────────────────────
   *
   * ⚠️ 键名按**路由层实际投影**：`{ok, experts, personas, diagnostics, skillsAvailable, preliminary}`
   * —— 服务层的 `rows` 在路由层被投影成 `experts`（`src/experts/catalog.ts:135` 是服务层形状）。
   * 首跑按 `rows` 读，把一条真实 200 记成了失败（假红）。
   */
  const catalogBefore = await sessionApi.get('/api/workbench/experts/catalog')
  const expertsBefore = Array.isArray(catalogBefore.body?.experts) ? catalogBefore.body.experts : []
  const personasBefore = Array.isArray(catalogBefore.body?.personas) ? catalogBefore.body.personas : []
  report.layers.http.catalogBefore = {
    status: catalogBefore.status,
    ok: catalogBefore.body?.ok,
    keys: Object.keys(catalogBefore.body ?? {}),
    experts: expertsBefore.length,
    personas: personasBefore.length,
    diagnostics: Array.isArray(catalogBefore.body?.diagnostics) ? catalogBefore.body.diagnostics.length : null,
    skillsAvailable: catalogBefore.body?.skillsAvailable ?? null,
    preliminary: catalogBefore.body?.preliminary ?? null,
    expert0: expertsBefore[0] ?? null,
  }
  suite.check({
    id: 'GET /experts/catalog 200：管理行（experts）与可选择摘要（personas）都在，每行带 id/source/status', axId: 'AX-E56', layer: 'H',
    ok: catalogBefore.status === 200 && catalogBefore.body?.ok === true
      && expertsBefore.length >= 6 && personasBefore.length >= 6
      && expertsBefore.every((row) => typeof row.id === 'string' && typeof row.source === 'string' && typeof row.status === 'string'),
    detail: safeJson({ keys: report.layers.http.catalogBefore.keys, experts: expertsBefore.length, personas: personasBefore.length, expert0: expertsBefore[0] }).slice(0, 900),
  })

  /**
   * ── AX-E60 前半：generation-start → 草稿；**确认前正式库为空** ─────────────
   *
   * 为什么这是 E60 的**多数派证据**：真实模型那一半（模型确实调了生成工具）需要真实链路；
   * 而"用户确认前正式库为空"这条**与模型无关**，用真实 HTTP + 真实 FS/DB 就能钉死。
   */
  const personasRoot = userPersonaRoot()
  const beforeSnapshot = walkRelative(personasRoot)
  const pendingDir = join(personasRoot, '.pending')
  const pendingBefore = listDir(pendingDir)
  const generatedDir = join(personasRoot, 'generated')
  const generatedBefore = listDir(generatedDir)
  report.layers.http.fsBefore = { personasRoot, entries: beforeSnapshot.length, pendingBefore, generatedBefore }

  const request = `${runId}：写一个只回答"就绪"的验证用专家`
  const started = await sessionApi.post('/api/workbench/experts/generation-start', {
    sessionId: syntheticSession('gen'),
    request,
    workspaceId: process.cwd(),
  })
  /**
   * 响应形状**逐字按实现**（`ExpertDraftView`，不是草稿仓储行）：
   * `{draftId, statusCode, contentVersion, phase, expertId, request, personaMd, provenance, skills, files, validation}`
   * —— 首跑按 `draft.id` 读，拿到 `undefined`，把一条正确的 200 记成了失败（假红）。
   */
  const draft = started.body?.draft
  report.layers.http.generationStart = {
    status: started.status,
    draftId: draft?.draftId ?? null,
    statusCode: draft?.statusCode ?? null,
    phase: draft?.phase ?? null,
    contentVersion: draft?.contentVersion ?? null,
    expertId: draft?.expertId ?? null,
  }
  suite.check({
    id: 'POST /experts/generation-start 建出 pending 草稿（draftId / statusCode=pending / phase=editing / contentVersion 是数字）', axId: 'AX-E60', layer: 'H',
    ok: started.status === 200 && started.body?.ok === true
      && typeof draft?.draftId === 'string' && draft.draftId !== ''
      && draft?.statusCode === 'pending'
      && draft?.phase === 'editing'
      && Number.isInteger(draft?.contentVersion)
      && typeof draft?.expertId === 'string' && draft.expertId.startsWith('generated/'),
    detail: safeJson(report.layers.http.generationStart),
  })
  if (typeof draft?.draftId !== 'string' || draft.draftId === '') {
    suite.require({ id: '后续 E60/E61 断言需要一份真实草稿 id', axId: 'AX-E60', layer: 'H', detail: `generation-start 没给 draftId：${safeJson(started.body)}` })
    return
  }
  const draftId = draft.draftId
  cleanupDraftId = draftId

  /**
   * 正式库为空：三重判据（新草稿的 id 不在 personas 正式根、`generated/` 没多出条目、
   * personas 根**除 `.pending` 外**没有新增文件）。只比对**新增**，不要求"根是空的" ——
   * 隔离实例的用户库本来可能已有历史角色，那不该被算成失败，但**本次的 draftId 绝不能出现**。
   */
  const afterSnapshot = walkRelative(personasRoot)
  const added = afterSnapshot.filter((entry) => beforeSnapshot.includes(entry) === false)
  const leakedIntoLibrary = added.filter((entry) => entry.startsWith('.pending') === false)
  const stagedDir = join(pendingDir, draftId)
  const stagedFiles = existsSync(stagedDir) ? walkRelative(stagedDir) : []
  const generatedAfter = listDir(generatedDir)
  /**
   * **直接读隔离实例的 SQLite**（只读、只查这一行）：HTTP 回执说"草稿建好了"是一件事，
   * 库里真有这行 `pending` 且 `kind_code='expert'` 是另一件事 —— 后者才是"用户确认前
   * 只是草稿"的硬证据（AX-E60 的核心判据）。
   */
  let dbRow
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const database = new DatabaseSync(options.dbPath, { readOnly: true })
    try {
      dbRow = database
        .prepare('SELECT id, kind_code, session_id, status_code FROM task_drafts WHERE id = ?')
        .get(draftId)
      const installed = database
        .prepare("SELECT COUNT(*) AS n FROM task_drafts WHERE id = ? AND status_code <> 'pending'")
        .get(draftId)
      dbRow = { ...(dbRow ?? {}), notPending: installed?.n ?? null }
    } finally { database.close() }
  } catch (error) {
    dbRow = { error: error instanceof Error ? error.message : String(error) }
  }
  report.layers.http.fsAfterDraft = { added, leakedIntoLibrary, stagedFiles, pending: listDir(pendingDir), generatedAfter, dbRow }
  suite.check({
    id: 'AX-E60 ⭐ 草稿阶段正式库为空：新草稿只落在 task_drafts(pending)，generated/ 与 personas 正式根零新增', axId: 'AX-E60', layer: 'H',
    ok: leakedIntoLibrary.length === 0
      && generatedAfter.length === generatedBefore.length
      && dbRow?.kind_code === 'expert'
      && dbRow?.status_code === 'pending'
      && dbRow?.notPending === 0,
    detail: `正式根新增=${safeJson(added.slice(0, 8))}；泄漏=${safeJson(leakedIntoLibrary)}；DB 行=${safeJson(dbRow)}；generated/=${generatedAfter.length}（原 ${generatedBefore.length}）`,
  })
  suite.check({
    id: 'AX-E60 暂存区按规格待在 .pending/<draftId>/（生成起步时可以是空目录：文件要等模型暂存才落盘）', axId: 'AX-E60', layer: 'H',
    ok: stagedFiles.length === 0 || existsSync(stagedDir),
    detail: `pendingDir=${pendingDir} draftDir=${stagedDir} 条目=${safeJson(stagedFiles.slice(0, 8))}；起步阶段按规格不含文件（stageFile 才落盘）`,
  })

  /** ── 草稿读回 + 校验 + 版本 CAS ─────────────────────────────────────────── */
  const preview = await sessionApi.get(`/api/workbench/experts/drafts/${encodeURIComponent(draftId)}`)
  report.layers.http.preview = { status: preview.status, phase: preview.body?.draft?.phase, contentVersion: preview.body?.draft?.contentVersion, drift: preview.body?.drift ?? null }
  suite.check({
    id: 'GET /experts/drafts/:id 读回草稿与漂移诊断（phase + contentVersion + drift 字段都在）', axId: 'AX-E54', layer: 'H',
    ok: preview.status === 200 && preview.body?.ok === true
      && (preview.body?.draft?.draftId ?? preview.body?.draft?.id) === draftId
      && 'drift' in (preview.body ?? {}),
    detail: safeJson(report.layers.http.preview),
  })

  const badVersion = await sessionApi.post(`/api/workbench/experts/drafts/${encodeURIComponent(draftId)}/validate`, { expectedVersion: 99999 })
  report.layers.http.validateStaleVersion = { status: badVersion.status, code: badVersion.body?.code }
  suite.check({
    id: 'POST /drafts/:id/validate 用过期 expectedVersion → 409（版本 CAS 真的在拦，不是只写文档）', axId: 'AX-E55', layer: 'H',
    ok: badVersion.status === 409,
    detail: safeJson(report.layers.http.validateStaleVersion),
  })

  const validated = await sessionApi.post(`/api/workbench/experts/drafts/${encodeURIComponent(draftId)}/validate`, { expectedVersion: draft.contentVersion })
  const validation = validated.body?.validation
  report.layers.http.validate = { status: validated.status, phase: validated.body?.draft?.phase, errors: validation?.errors?.length, warnings: validation?.warnings?.length, manifestHash: validation?.manifestHash ?? null }
  suite.check({
    id: 'POST /drafts/:id/validate 真跑校验：200/ok:true 且给 validation（errors 是数组、有 manifestHash）', axId: 'AX-E54', layer: 'H',
    ok: validated.status === 200 && validated.body?.ok === true && Array.isArray(validation?.errors)
      && typeof validation?.manifestHash === 'string' && validation.manifestHash.length > 0,
    detail: safeJson(report.layers.http.validate),
  })

  /** ── 放弃：正式库仍为空，且暂存区被清 ─────────────────────────────────── */
  /**
   * ⚠️ 2026-10-05 修（真链上抓到的跨套件污染）：
   * 专家草稿的 abandon **必须带 `{expectedVersion}`** ——
   * `src/api/routes/drafts.ts:312-321`：`body === undefined` → 400 `invalid-json`，
   * 有 body 但缺 `expectedVersion` → 400 `invalid-payload`。
   * 旧写法不带 body ⇒ 恒 400、草稿永远 pending；而「待确认草稿」横幅每 5 秒轮询会把它
   * 弹成全屏浮层盖住工作台，把**同一条链上后面的** progress 套件的鼠标点击吃掉
   *（实测：点 25% 落到了横幅 header 上，progress 挂 2 条，链在 expert 之前就断了）。
   * 判据同时收紧：必须 200，且**直接复读 DB** 确认这行已不是 pending
   *（"我调过放弃了" 不等于 "它真的不再是待确认草稿"）。
   */
  const abandoned = await sessionApi.post(`/api/workbench/drafts/${encodeURIComponent(draftId)}/abandon`, { expectedVersion: draft.contentVersion })
  const afterAbandon = walkRelative(personasRoot)
  const leakedAfterAbandon = afterAbandon.filter((entry) => beforeSnapshot.includes(entry) === false && entry.startsWith('.pending') === false)
  let abandonRow
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const database = new DatabaseSync(options.dbPath, { readOnly: true })
    try {
      abandonRow = database.prepare('SELECT status_code FROM task_drafts WHERE id = ?').get(draftId)?.status_code ?? null
    } finally { database.close() }
  } catch (error) {
    abandonRow = `error:${error instanceof Error ? error.message : String(error)}`
  }
  report.layers.http.abandon = { status: abandoned.status, code: abandoned.body?.code ?? null, statusAfterAbandon: abandonRow, leakedAfterAbandon }
  suite.check({
    id: 'POST /drafts/:id/abandon（带 expectedVersion）→ 200 且 DB 复读已不是 pending，正式库零新增', axId: 'AX-E60', layer: 'H',
    ok: abandoned.status === 200 && abandoned.body?.ok === true && abandonRow === 'abandoned' && leakedAfterAbandon.length === 0,
    detail: safeJson(report.layers.http.abandon),
  })

  /** ── 手动入口：manual-requests 只建请求（auto=false 也能用） ────────────── */
  const manualPersona = personasBefore[0]
  if (manualPersona === undefined) {
    suite.require({ id: '至少有一个可用角色用于 preflight / manual-requests', axId: 'AX-E61', layer: 'H', detail: `catalog.personas=${personasBefore.length}` })
  } else {
    const preflight = await sessionApi.post('/api/workbench/experts/preflight', { personaId: manualPersona.id, sessionId: syntheticSession('pf') })
    report.layers.http.preflight = { status: preflight.status, usable: preflight.body?.usable, status2: preflight.body?.status, preliminary: preflight.body?.preliminary, summary: preflight.body?.summary }
    suite.check({
      id: 'POST /experts/preflight 给可用性预检（HTTP 侧如实 preliminary=true，不假装权威）', axId: 'AX-E61', layer: 'H',
      ok: preflight.status === 200 && typeof preflight.body?.usable === 'boolean' && preflight.body?.preliminary === true,
      detail: safeJson(report.layers.http.preflight),
    })
    /**
     * 真建一条手动请求：身份（`expectedSourceKey` / `expectedRevision`）**逐字**来自 catalog 行。
     *
     * ⚠️ 这里**不**去读 `/api/workbench/personas/bind`：那条路由的读法是 `GET /bind?session_id=`
     * —— 实测返回里没有 `binding` 字段（首跑按 `body.binding` 判"没写绑定行"，会**恒真**，
     * 属于假绿）。改成两条真的会失败、且不依赖别的套件的判据：
     * ① 身份对得上 → 200 + `requestId`/`expiresAt`；② 身份对不上 → **400** `revision-changed`
     *（不是 409：`src/client/expertInputSource.ts:358` 逐字写着「服务端当场 `revision-changed`（400）」，
     *  真机实测也是 400 —— 首跑按 409 判，把一条正确的拒绝记成了失败）。
     */
    const manualSession = syntheticSession('manual')
    const manual = await sessionApi.post('/api/workbench/experts/manual-requests', {
      sessionId: manualSession,
      personaId: manualPersona.id,
      expectedSourceKey: String(manualPersona.sourceKey ?? ''),
      expectedRevision: String(manualPersona.revision ?? ''),
    })
    const staleSource = await sessionApi.post('/api/workbench/experts/manual-requests', {
      sessionId: syntheticSession('manual-stale'),
      personaId: manualPersona.id,
      expectedSourceKey: 'verify-not-the-real-source',
      expectedRevision: 'verify-not-the-real-revision',
    })
    report.layers.http.manualRequests = {
      status: manual.status,
      code: manual.body?.code ?? null,
      requestId: manual.body?.requestId ?? null,
      expiresAt: manual.body?.expiresAt ?? null,
      staleStatus: staleSource.status,
      staleCode: staleSource.body?.code ?? null,
      staleField: staleSource.body?.field ?? null,
      personaIdentity: { id: manualPersona.id, sourceKey: manualPersona.sourceKey, revision: manualPersona.revision },
    }
    suite.check({
      id: 'POST /experts/manual-requests 建请求成功（200 + requestId + expiresAt，身份按 catalog 逐字传）', axId: 'AX-E61', layer: 'H',
      ok: manual.status === 200 && manual.body?.ok === true
        && typeof manual.body?.requestId === 'string' && manual.body.requestId !== ''
        && typeof manual.body?.expiresAt === 'string' && manual.body.expiresAt !== '',
      detail: safeJson(report.layers.http.manualRequests),
    })
    suite.check({
      id: 'AX-E61 ⭐ 身份对不上时 manual-requests 返回 400 revision-changed 且 sourceKey 字段指认（不按陈旧身份建请求）', axId: 'AX-E61', layer: 'H',
      ok: staleSource.status === 400 && staleSource.body?.code === 'revision-changed'
        && staleSource.body?.field === 'expected_source_key'
        && staleSource.body?.requestId === undefined,
      detail: safeJson(report.layers.http.manualRequests),
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// B：真实浏览器（AX-E52–E58 的 DOM + 真实点击）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 读专家域在真实 DOM 里的**实际渲染值**。
 *
 * 源码级唯一性（P8 已有断言）**不等于** DOM 里的值正确 —— 这里读的就是渲染结果。
 * 选择器逐个来自 `方案-v0.3.md` §12.3 的枚举（`P8-handover.md` §9-4 的接线义务）。
 */
const READ_EXPERT_DOM = `
  const q = (sel) => Array.from(document.querySelectorAll(sel));
  const text = (el) => (el.textContent || '').trim().slice(0, 120);
  return {
    roots: q('[data-wb-experts]').map((el) => ({ kind: el.getAttribute('data-wb-experts'), visible: el.offsetParent !== null })),
    actions: q('[data-wb-expert-action]').map((el) => ({ action: el.getAttribute('data-wb-expert-action'), tag: el.tagName, disabled: el.disabled === true, visible: el.offsetParent !== null, text: text(el) })),
    fields: q('[data-wb-expert-field]').map((el) => ({ field: el.getAttribute('data-wb-expert-field'), tag: el.tagName, type: el.getAttribute('type'), value: String(el.value ?? '').slice(0, 80) })),
    rows: q('[data-wb-expert-id]').map((el) => ({ id: el.getAttribute('data-wb-expert-id'), status: el.getAttribute('data-wb-expert-status') })),
    drafts: q('[data-wb-expert-draft]').map((el) => ({ draft: el.getAttribute('data-wb-expert-draft'), version: el.getAttribute('data-wb-expert-version'), status: el.getAttribute('data-wb-expert-status') })),
    errors: q('[data-wb-expert-error]').map((el) => ({ code: el.getAttribute('data-wb-expert-error'), text: text(el) })),
  };
`

async function checkBrowserLayer() {
  report.layers.browser = {}
  const discovered = discoverBrowser({ overridePath: options.browser })
  if (discovered.ok !== true) {
    suite.require({ id: '发现可用浏览器（真实 DOM 判据的前置）', axId: 'AX-E52', layer: 'B', detail: `没有可用浏览器：${discovered.reason}` })
    return
  }
  browser = await launchSuiteBrowser({ url: options.url, token: options.token, userDataRoot: options.userDataRoot, browserPath: discovered.path })
  await browser.goto(api.pageUrl())
  await waitFor(async () => (await browser.evaluate(`return document.querySelector('[class*="sidebarCol"]') !== null;`)) === true, { timeoutMs: 30000, description: '宿主侧栏渲染' }).catch(() => undefined)
  await sleep(1500)
  const openState = await ensureWorkbenchPanel(browser)
  if (openState === null) {
    suite.require({ id: '打开工作台面板（B 层全部判据的前置）', axId: 'AX-E52', layer: 'B', detail: '找不到侧栏工作台入口' })
    return
  }
  await waitFor(async () => (await browser.evaluate(`const h=document.querySelector('.wb-panel-host'); return h !== null && h.getAttribute('data-open') === '1';`)) === true, { timeoutMs: 15000, description: '面板 data-open=1' }).catch(() => undefined)
  await sleep(1200)
  await browser.screenshot(`${suite.dir}/01-面板.png`)

  /** ── 打开设置弹窗 → 角色库分区（`data-wb-experts="admin"` 挂在这里）───────── */
  /**
   * ⚠️ 选择器必须**限定在工作台面板内**（`.wb-h button`）：宿主侧栏左下角也有一个「设置」，
   * 而它在 document 顺序里更靠前 —— 首跑 `clickByText('设置', 'button')` 点的是宿主的设置弹窗
   *（按钮里出现「通用设置 / 关闭」而不是工作台的「角色库 / 取消 / 保存设置」），
   * 于是 `.wb-settings-nav` 永远不存在，B 层在第一步就 `return`，AX-E52–E58 一条都没跑到。
   */
  const settingsOpened = await browser.clickByText('设置', '.wb-h button')
  await sleep(1500)
  const settingsDom = await browser.evaluate(`
    const nav = document.querySelector('.wb-settings-nav');
    const host = document.querySelector('.wb-panel-host');
    return {
      navFound: nav !== null,
      sections: nav === null ? [] : Array.from(nav.querySelectorAll('button')).map((b) => (b.textContent || '').trim()),
      /* 诊断用：点完「设置」之后，屏幕上跟"设置 / 弹窗"有关的按钮文字 */
      panelOpen: host === null ? null : host.getAttribute('data-open'),
      buttons: Array.from(document.querySelectorAll('button'))
        .filter((b) => /设置|角色库|通用|取消|关闭/.test(b.textContent || '') && b.offsetParent !== null)
        .map((b) => (b.textContent || '').trim()).slice(0, 12),
      dialogCount: document.querySelectorAll('.wb-dialog, [role="dialog"]').length,
      settingsRootFound: document.querySelector('.wb-settings') !== null,
    };
  `)
  report.layers.browser.settings = { clicked: settingsOpened !== null, clickTarget: settingsOpened?.text ?? null, ...settingsDom }
  await browser.screenshot(`${suite.dir}/02-设置.png`)
  if (settingsOpened === null || settingsDom.navFound !== true) {
    suite.require({ id: '真实点击「设置」打开弹窗（专家管理入口的前置）', axId: 'AX-E52', layer: 'B', detail: safeJson(report.layers.browser.settings) })
    return
  }

  /**
   * 设置弹窗里的「角色库」分区。P8 把专家管理放进 `PersonaAdmin`（`data-wb-experts="admin"`），
   * 它只在 `section === 'persona'` 时渲染（`SettingsModal.tsx:235-275`），所以要**真点**那个页签。
   */
  let adminDom = await browser.evaluate(READ_EXPERT_DOM)
  let switched = false
  if (adminDom.roots.some((root) => root.kind === 'admin') === false) {
    switched = (await browser.clickByText('角色库', '.wb-settings-nav button')) !== null
      || (await browser.clickByText('角色库', 'button')) !== null
    await sleep(1200)
    adminDom = await browser.evaluate(READ_EXPERT_DOM)
  }
  report.layers.browser.adminDom = { switched, sections: settingsDom.sections, ...adminDom }
  await browser.screenshot(`${suite.dir}/03-专家管理.png`)
  suite.check({
    id: 'AX-E56 ⭐ 真实 DOM：设置页渲染出专家管理根 data-wb-experts="admin"（可见）', axId: 'AX-E56', layer: 'B',
    ok: adminDom.roots.some((root) => root.kind === 'admin' && root.visible === true),
    detail: safeJson(adminDom.roots),
  })
  suite.check({
    id: 'AX-E52 ⭐ 真实 DOM：专家管理里有 data-wb-expert-action="create"（新建专家入口，按钮可点）', axId: 'AX-E52', layer: 'B',
    ok: adminDom.actions.some((item) => item.action === 'create' && item.disabled === false),
    detail: safeJson(adminDom.actions.filter((item) => item.action === 'create')),
  })
  suite.check({
    id: 'AX-E57 ⭐ 真实 DOM：auto-summon 开关渲染出 data-wb-expert-field="auto-summon"', axId: 'AX-E57', layer: 'B',
    ok: adminDom.fields.some((item) => item.field === 'auto-summon'),
    detail: safeJson(adminDom.fields),
  })

  /** ── 真实点击「新建专家」→ 弹窗 + 两个字段 + 提交按钮 ─────────────────── */
  const createTarget = adminDom.actions.find((item) => item.action === 'create')
  let createDom = { roots: [], actions: [], fields: [], rows: [], drafts: [], errors: [] }
  if (createTarget === undefined) {
    suite.require({ id: '真实鼠标点「新建专家」（AX-E52/E53 的入口）', axId: 'AX-E52', layer: 'B', detail: '管理页里没有 create 动作' })
  } else {
    const clicked = await browser.evaluate(`
      const el = document.querySelector('[data-wb-expert-action="create"]');
      if (el === null) return false;
      el.click();
      return true;
    `)
    await sleep(1000)
    createDom = await browser.evaluate(READ_EXPERT_DOM)
    report.layers.browser.createModal = { clicked, ...createDom }
    await browser.screenshot(`${suite.dir}/04-新建专家弹窗.png`)
    suite.check({
      id: 'AX-E52 ⭐ 真实点击后弹出 data-wb-experts="create-modal"，含 request / workspace 两个字段', axId: 'AX-E52', layer: 'B',
      ok: clicked === true
        && createDom.roots.some((root) => root.kind === 'create-modal' && root.visible === true)
        && createDom.fields.some((item) => item.field === 'request')
        && createDom.fields.some((item) => item.field === 'workspace'),
      detail: safeJson({ roots: createDom.roots, fields: createDom.fields }),
    })
    suite.check({
      id: 'AX-E54 ⭐ 真实 DOM：弹窗里没有「创建任务」假文案（专家流程不写任务）', axId: 'AX-E54', layer: 'B',
      ok: (await browser.evaluate(`
        const root = document.querySelector('[data-wb-experts="create-modal"]');
        return root === null ? true : (root.textContent || '').includes('创建任务') === false;
      `)) === true,
      detail: 'create-modal 的 textContent 不含「创建任务」',
    })

    /** 空文本时提交按钮必须禁用（AX-E52 的"空文本"判据在真实 DOM 上的证据）。 */
    const submitDisabledEmpty = await browser.evaluate(`
      const btn = document.querySelector('[data-wb-expert-action="start-generation"]');
      return btn === null ? null : { disabled: btn.disabled === true, text: (btn.textContent || '').trim() };
    `)
    report.layers.browser.submitEmpty = submitDisabledEmpty
    suite.check({
      id: 'AX-E52 ⭐ 真实 DOM：请求文本为空时「开始生成」按钮是禁用的', axId: 'AX-E52', layer: 'B',
      ok: submitDisabledEmpty !== null && submitDisabledEmpty.disabled === true,
      detail: `start-generation（空文本）=${safeJson(submitDisabledEmpty)}`,
    })

    /**
     * 「按钮会解禁」这条分三步判，因为 `ExpertCreateModal.tsx:53-55` 的 `blocked` 是
     * **busy || 缺 sessions.create || 空文本 || 没选工作区** 四项的并集：
     * ① 空文本 → 禁用（上面已断言）；
     * ② 填文本 + **把工作区清成空选项** → 仍禁用，且出现
     *    `data-wb-expert-error="no-workspace"`（`ExpertCreateModal.tsx:124-131`）；
     * ③ 真选一个工作区 → 解禁。
     * ⚠️ 首跑只断言"填完文本仍禁用"，在这台机器上**假红**了：工作区下拉的初值不是空
     *（实测 `ef1cf070-…`，是上次选择留下的），所以填完文本它本来就该解禁。
     * 要证明"工作区必选"必须**主动把下拉设回 `<option value="">请选择…</option>`**。
     */
    const typed = await browser.evaluate(`
      const input = document.querySelector('[data-wb-expert-field="request"]');
      if (input === null) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, '验证用专家：只回答就绪');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `)
    await sleep(500)
    const clearedWorkspace = await browser.evaluate(`
      const select = document.querySelector('[data-wb-expert-field="workspace"]');
      if (select === null) return { ok: false, reason: 'no-select' };
      if (Array.from(select.options).some((o) => o.value === '') === false) return { ok: false, reason: 'no-empty-option' };
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
      setter?.call(select, '');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, value: select.value, options: select.options.length };
    `)
    await sleep(700)
    const afterTyping = await browser.evaluate(READ_EXPERT_DOM)
    const submitAfterTyping = afterTyping.actions.find((item) => item.action === 'start-generation') ?? null
    const noWorkspaceNote = afterTyping.errors.some((item) => item.code === 'no-workspace')
    report.layers.browser.afterTyping = { typed, clearedWorkspace, requestValue: afterTyping.fields.find((f) => f.field === 'request')?.value ?? null, submit: submitAfterTyping, noWorkspaceNote, errors: afterTyping.errors }
    await browser.screenshot(`${suite.dir}/05-已输入.png`)
    suite.check({
      id: 'AX-E52 ⭐ 真实 DOM：清空工作区后即使有文本也禁用，并给出 data-wb-expert-error="no-workspace"（工作区必选，不是"填了就能发"）', axId: 'AX-E52', layer: 'B',
      ok: typed === true && clearedWorkspace.ok === true && submitAfterTyping?.disabled === true && noWorkspaceNote === true,
      detail: safeJson(report.layers.browser.afterTyping),
    })

    /** 真选一个工作区（原生 select 的 value setter + change 事件）→ 按钮必须解禁。 */
    const picked = await browser.evaluate(`
      const select = document.querySelector('[data-wb-expert-field="workspace"]');
      if (select === null) return { ok: false, reason: 'no-select' };
      const options = Array.from(select.options).map((o) => o.value).filter((v) => v !== '');
      if (options.length === 0) return { ok: false, reason: 'no-option' };
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
      setter?.call(select, options[0]);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, value: options[0], count: options.length };
    `)
    await sleep(900)
    const afterPick = await browser.evaluate(READ_EXPERT_DOM)
    const submitAfterPick = afterPick.actions.find((item) => item.action === 'start-generation') ?? null
    report.layers.browser.afterWorkspace = { picked, submit: submitAfterPick, errors: afterPick.errors }
    await browser.screenshot(`${suite.dir}/06-已选工作区.png`)
    suite.check({
      id: 'AX-E52 ⭐ 真实 DOM：选好工作区后「开始生成」解禁（受控输入真的驱动按钮态）', axId: 'AX-E52', layer: 'B',
      ok: picked.ok === true && submitAfterPick?.disabled === false,
      detail: safeJson(report.layers.browser.afterWorkspace),
    })
    /**
     * 收起弹窗，避免污染后续判据。
     *
     * ⚠️ 「取消」必须**限定在这份 create-modal 的 `.wb-dialog` 里**找：
     * 首跑用全局 `button` 列表找第一个文案为「取消」的按钮 —— 命中的是**设置弹窗** footer 的
     * 「取消」（`SettingsModal.tsx:179`），于是整个设置弹窗被关掉，
     * `data-wb-experts="admin"` 与它的 15 行 `data-wb-expert-id` 一起消失，
     * AX-E58 / AX-E56 双双假红（detail 里 `adminStillThere:false` / `rows:0`）。
     */
    const clickedCancel = await browser.evaluate(`
      const root = document.querySelector('[data-wb-experts="create-modal"]');
      const dialog = root === null ? null : root.closest('.wb-dialog');
      if (dialog === null) return { ok: false, reason: 'no-dialog' };
      const cancel = Array.from(dialog.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === '取消');
      if (cancel === undefined) return { ok: false, reason: 'no-cancel-button' };
      cancel.click();
      return { ok: true, dialogClass: dialog.className };
    `)
    await sleep(900)
    const afterCancel = await browser.evaluate(READ_EXPERT_DOM)
    report.layers.browser.cancelled = { clickedCancel, drafts: afterCancel.drafts, adminRoots: afterCancel.roots }
    if (clickedCancel?.ok !== true) {
      suite.require({ id: '真实点击 create-modal 自己的「取消」（AX-E58 卸载判据的前置）', axId: 'AX-E58', layer: 'B', detail: safeJson(clickedCancel) })
    }
  }

  /**
   * ── 关闭弹窗后的稳定性 / 降级面（AX-E58）──────────────────────────────────
   *
   * 判据刻意**不是**"页面还有字"（那是恒真的假判据）。两条真实可失败的条件：
   * ① 新建弹窗真的消失了（`Modal` 走 portal，关闭是否真卸载 DOM 是 P8 的装配约束）；
   * ② 专家管理根仍在（`data-wb-experts="admin"` 不是一次性入口），且它渲染出的行/草稿
   *    在关弹窗后**没有被清空**（`useWorkbenchExperts` 的 catalog 状态不随弹窗重置）。
   */
  const afterClose = await browser.evaluate(READ_EXPERT_DOM)
  const modalGone = afterClose.roots.some((root) => root.kind === 'create-modal') === false
  const adminStillThere = afterClose.roots.some((root) => root.kind === 'admin')
  report.layers.browser.afterClose = { modalGone, adminStillThere, rows: afterClose.rows.length, drafts: afterClose.drafts.length }
  suite.check({
    id: 'AX-E58 ⭐ 真实 DOM：取消后 create-modal 真的从 DOM 卸载，而专家管理根与它的 catalog 状态仍在', axId: 'AX-E58', layer: 'B',
    ok: modalGone === true && adminStillThere === true && afterClose.rows.length > 0,
    detail: safeJson(report.layers.browser.afterClose),
  })
  suite.check({
    id: 'AX-E56 ⭐ 真实 DOM：专家管理里每行都带 data-wb-expert-id + data-wb-expert-status（行级选择器真的渲染）', axId: 'AX-E56', layer: 'B',
    ok: afterClose.rows.length > 0 && afterClose.rows.every((row) => typeof row.id === 'string' && row.id !== '' && typeof row.status === 'string' && row.status !== ''),
    detail: safeJson(afterClose.rows.slice(0, 6)),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// M：真实模型（AX-E60/E61/E62 的后半）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 真实模型链路。
 *
 * ## 判据只能来自宿主侧的真实记录
 *
 * 这一步要求观察到**模型真的调用了专家工具**（`workbench_submit_expert_draft` 一族 /
 * `run_expert_request` / `summon_expert`）。我们能诚实拿到的宿主侧证据只有两处：
 *
 * 1. **DB 里的专家草稿行**：模型调了生成工具 → 会为该会话建/更新一份草稿。
 *    `generation-start`（HTTP）也会建草稿，所以判据是"**模型会话 id** 名下的草稿"，
 *    而不是"有一份草稿"。
 * 2. **会话记录里出现工具名**：DSH 的会话日志按 zstd 压缩时无法按文本扫描（`persona.mjs`
 *    已记这条），所以它只作**加分项**、不作必要条件。
 *
 * 拿不到真实模型时**如实 skip**（`skipped: true` + reason）—— 链把 required+skipped
 * 判成不通过，这正是"不许假装通过"。
 */
async function tryObserveModelToolCalls() {
  const findings = { probed: [], hits: [], notes: [] }
  /**
   * 造一条**真实模型会话**的能力探测。
   *
   * ⚠️ 2026-10-05 实测结论：本机 `headless` 是 **profile 名**（`dsh --profile headless "任务"`），
   * 不是 web profile 的子命令 —— `dsh --profile web headless --json …` 会被 web app 当成
   * 普通 app 参数解析（`error: unknown option '--json'`）。所以这条探测在当前环境下
   * **必然拿不到工具调用**，它只在"将来本机有了可用的 headless 入口"时才有意义。
   * 要不要真跑由 `DSH_VERIFY_EXPERT_MODEL` 决定（默认 **不跑**：验收链的预算与费用
   * 不由套件擅自决定）；跑不通时如实报**具体原因**，绝不伪造。
   */
  /**
   * ⚠️ 2026-10-05 修（口径，比第一版更严）：**不设开关、默认就去尝试**。
   * 第一版写成"`DSH_VERIFY_EXPERT_MODEL !== '1'` 就直接返回未开启"，等于用一个环境变量
   * 把必需套件里最关键的模型层**静默关掉** —— P9 明令「不允许新增隐式 skip 白名单」，
   * 默认关就是把"未验证"伪装成"配置没打开"。
   * 现在只有**根本发不了车**才提前返回（没给目标 profile / 找不到 dsh bin），
   * 其余一律真的 spawn 一次，把退出码 + stderr 当证据（退出码 1 与 stderr 会写进 reason 与证据文件）。
   * `DSH_VERIFY_EXPERT_MODEL` 仍然记录，但**不再决定跑不跑**，只作为现场标注。
   */
  const requested = process.env.DSH_VERIFY_EXPERT_MODEL === '1'
  findings.notes.push(`DSH_VERIFY_EXPERT_MODEL=${requested ? '1' : '未设置'}（本层不再由它决定跑不跑，只记录现场）`)
  const { spawn } = await import('node:child_process')
  const binCandidates = [
    join(process.env.APPDATA ?? '', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), '..', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
  ]
  const bin = binCandidates.find((candidate) => candidate !== '' && existsSync(candidate))
  if (bin === undefined) {
    return { ok: false, reason: `找不到 dsh 的 bin.js（探测过 ${binCandidates.join('、')}）`, findings }
  }
  const task = [
    `这是研发验收的一次真实模型探测（runId=${runId}）。`,
    '请只做一件事：调用工作台的专家草稿生成工具，为「只回答『就绪』的验证用专家」提交一份草稿。',
    '不要安装、不要确认发布。做完用一句话说明你调用了哪个工具。',
  ].join('')
  const sessionId = `${runId}-model`
  /**
   * ⚠️ 2026-10-05 修（这条错会把"模型链路未验证"报成错误的原因）：
   * 必须用 `options.targetProfile` / `options.targetProfileDir`（**被验收的那个实例**），
   * 不是 `options.profile`（**当前会话所在实例**，本机是 desktop）。
   * 首跑用 `options.profile` ⇒ `dsh --profile desktop headless …` 被 CLI 当场拒掉：
   * `error: profile "desktop" is managed exclusively by the Electron application`
   *（`_harness.mjs:54-65` 逐字区分了这两组参数）。
   */
  const targetProfile = options.targetProfile ?? ''
  const targetProfileDir = options.targetProfileDir ?? ''
  if (targetProfile === '') {
    return { ok: false, reason: '本次没有给出目标 profile（--target-profile），无法在隔离实例上跑真实模型会话', findings }
  }
  const result = await new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [bin, '--profile', targetProfile, 'headless', '--json', '--session-id', sessionId, task], {
      cwd: ROOT,
      env: {
        ...process.env,
        DSH_PROFILE: targetProfile,
        DSH_PROFILE_DIR: targetProfileDir,
        WORKBENCH_PROFILE_DIR: targetProfileDir,
        WORKBENCH_EXPECTED_DB_PATH: options.dbPath,
      },
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => { try { child.kill() } catch { /* ignore */ } }, 240000)
    child.stdout?.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', (error) => { clearTimeout(timer); resolvePromise({ code: 1, stdout, stderr: `${stderr}${String(error)}`, timedOut: false }) })
    child.on('close', (code) => { clearTimeout(timer); resolvePromise({ code: code ?? 1, stdout, stderr, timedOut: false }) })
  })
  const evidenceDir = suite.dir ?? join(tmpdir(), `expert-suite-${runId}`)
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, 'model-run-stdout.txt'), result.stdout.slice(0, 200000), 'utf8')
  writeFileSync(join(evidenceDir, 'model-run-stderr.txt'), result.stderr.slice(0, 50000), 'utf8')
  findings.probed.push({ kind: 'dsh headless', bin, profile: targetProfile, profileDir: targetProfileDir, sessionId, code: result.code, stdoutBytes: result.stdout.length, stderrTail: result.stderr.slice(-400) })
  const toolNames = ['workbench_submit_expert_draft', 'workbench_stage_expert_file', 'workbench_validate_expert_draft', 'workbench_get_expert_draft', 'run_expert_request', 'workbench_summon_expert']
  for (const name of toolNames) if (result.stdout.includes(name)) findings.hits.push(name)
  if (findings.hits.length === 0) {
    /**
     * ⚠️ 2026-10-05 实测：本机 DSH 里 `headless` 是**profile 名**，不是 web profile 的子命令
     *（`dsh --help` 的 Usage 是 `dsh [--profile] <name> [options] [app-args...]`，
     *  例子里 `dsh headless "run the tests"` 等价于 `dsh --profile headless …`）。
     * 所以 `dsh --profile web headless --json …` 实际把 `headless --json …` 当**任务文本**喂给
     * web app：`--help` 回的是 web UI 的用法，`--json` 直接 `error: unknown option '--json'`。
     * 结论写进 reason（不写成"模型没调工具"那种会被误读成运行时故障的话）——
     * 真实模型链路要在**目标实例自己的会话 API**上做（或给 headless profile 叠插件层），
     * 本次未实现，按规格如实记未验证。
     */
    const stderrTail = result.stderr.trim().split('\n').filter((line) => line.trim() !== '').slice(-2).join(' / ')
    return {
      ok: false,
      reason: `本机没有可用的 web-profile headless 入口（退出码 ${result.code}${stderrTail === '' ? '' : `；stderr: ${stderrTail}`}）：` +
        '`headless` 在本机 DSH 里是 profile 名而非 web profile 的子命令，真实模型链路需走目标实例自己的会话 API，本次未实现',
      findings,
    }
  }
  /** 第二条证据：DB 里出现了**该模型会话**名下的专家草稿（HTTP 重读，不是读进程内存）。 */
  const drafts = await sessionApi.get(`/api/workbench/experts/drafts?session_id=${encodeURIComponent(sessionId)}`).catch(() => undefined)
  findings.notes.push(`drafts by session 探测：status=${drafts?.status ?? 'n/a'}`)
  return { ok: true, reason: null, findings }
}

async function checkModelLayer() {
  report.layers.model = {}
  const observed = await tryObserveModelToolCalls()
  report.layers.model = observed
  suite.check({
    id: 'AX-E60 ⭐ 真实模型调用专家草稿提交工具并落库（模型链路）', axId: 'AX-E60', layer: 'B',
    skipped: observed.ok !== true,
    ok: observed.ok === true,
    skipReason: `未观察到真实模型工具调用：${observed.reason}（草稿生命周期与"确认前正式库为空"已在 H 层用真实 HTTP + 真实 FS/DB 证明；本层按规格记未验证，不记 pass）`,
    detail: safeJson(observed).slice(0, 1500),
  })
  suite.check({
    id: 'AX-E61 ⭐ 真实模型：父绑定 A 时 @ 专家 B，子代理走专用 loader 且父仍为 A（模型链路）', axId: 'AX-E61', layer: 'B',
    skipped: observed.ok !== true,
    ok: false,
    skipReason: `需要真实模型链路才能观察到子代理调用与父绑定不变：${observed.reason}`,
    detail: '本层的 H 层部分（manual-requests 只建请求、不写绑定）已单独记 pass；端到端的父绑定不变需要真实模型会话',
  })
  suite.check({
    id: 'AX-E62 ⭐ 真实模型：auto=true 自主召唤、关闭后该轮无自主 schema/prompt（模型链路）', axId: 'AX-E62', layer: 'B',
    skipped: observed.ok !== true,
    ok: false,
    skipReason: `需要真实模型链路才能观察自主工具调用与"关闭后下一轮 schema/prompt 消失"：${observed.reason}`,
    detail: 'auto 开关的真实值读写已在 H/B 层证据里；"模型真的自主挑专家"需要真实模型会话',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 入口
// ─────────────────────────────────────────────────────────────────────────────

try {
  await checkTarball()
  await checkHttpLayer()
  await checkBrowserLayer()
  await checkModelLayer()

  /** 自检：层名必须都是 `CHECK_LAYERS` 认得的口径（写错层名 = 证据口径漂移）。 */
  const usedLayers = [...new Set(suite.checks.map((entry) => entry.layer).filter((layer) => layer !== undefined))]
  report.usedLayers = usedLayers
  suite.check({
    id: '自检：本套件用到的层名都在 CHECK_LAYERS 口径内（U/H/W/B/N）', layer: 'N',
    ok: usedLayers.length > 0 && usedLayers.every((layer) => layerOk(layer)),
    detail: `used=${usedLayers.join(',')}`,
  })
} catch (error) {
  suite.fatalError(error)
} finally {
  /**
   * 安全网：正常路径已经在 H 层放弃过草稿；这里兜的是"中途 fatal / 提前退出"——
   * 一份遗留的 pending 专家草稿会让「待确认草稿」横幅在**同一条链上后面的套件**里
   * 自动弹出并盖住界面（真机实测过：progress 套件的 25% 点击落到横幅上）。
   * 兜底失败不覆盖原判定，只记一条 note（本来就该失败的地方不能因此变绿）。
   */
  if (cleanupDraftId !== undefined) {
    try {
      const { DatabaseSync } = await import('node:sqlite')
      const database = new DatabaseSync(options.dbPath, { readOnly: true })
      let stillPending = false
      try {
        stillPending = database.prepare('SELECT status_code FROM task_drafts WHERE id = ?').get(cleanupDraftId)?.status_code === 'pending'
      } finally { database.close() }
      if (stillPending) {
        const view = await sessionApi.get(`/api/workbench/experts/drafts/${encodeURIComponent(cleanupDraftId)}`)
        const sweeper = await sessionApi.post(`/api/workbench/drafts/${encodeURIComponent(cleanupDraftId)}/abandon`, { expectedVersion: view.body?.draft?.contentVersion ?? 0 })
        suite.note(`收尾兜底放弃遗留草稿 ${cleanupDraftId}：HTTP ${sweeper.status}（不覆盖原判定）`)
      }
    } catch (error) {
      suite.note(`收尾兜底放弃草稿失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }
  try {
    if (browser !== undefined) {
      await browser.screenshot(`${suite.dir}/99-收尾.png`).catch(() => undefined)
      await browser.close()
    }
    suite.writeEvidence('expert-readings.json', report)
  } catch (error) {
    suite.note(`收尾失败（不覆盖原判定）：${error instanceof Error ? error.message : String(error)}`)
  }
  const counts = suite.counts()
  if (counts.total <= 0) suite.fatalError(new Error('套件一条断言都没记下（total<=0）——空测试不算通过'))
  process.exit(suite.finish({ runId }))
}
