// Baton 组合包入口（由 scripts/gen-bundle.mjs 从 plugin/baton.js 生成，禁止手改）
import { defineTool } from '@deepseek-ai/dsh-tools'
import { fileURLToPath } from 'node:url'

export const name = 'baton'
export const inject = ['tools', 'shell', 'fs']

const BATON_PKG_DIR = fileURLToPath(new URL(".", import.meta.url))

export function apply(ctx) {
    let shell = ctx.get('shell')
    let fs = ctx.get('fs')
    // verify_push → record_push 的进程内短期回执：绑定项目/分支/本地 HEAD/远端 SHA。
    // 不写磁盘，因此 verify_push 仍保持文件系统纯只读；宿主重启后自动回落为重新实查远端。
    const verifiedPushReceipts = new Map()
    function services() {
      if (shell === undefined) shell = ctx.get('shell')
      if (fs === undefined) fs = ctx.get('fs')
      return shell !== undefined && fs !== undefined
    }

    function currentSession() {
      try {
        const agents = ctx.get('agents')
        if (agents === undefined) return undefined
        const a = agents.currentInitiator()
        return a === undefined ? undefined : a.session
      } catch (e) {
        return undefined
      }
    }

    function currentAgent() {
      try {
        const agents = ctx.get('agents')
        return agents === undefined ? undefined : agents.currentInitiator()
      } catch (e) {
        return undefined
      }
    }

    async function approvalOnce(toolName, reason, exec) {
      let approval
      try { approval = ctx.approval !== undefined ? ctx.approval : ctx.get('approval') } catch (e) { approval = undefined }
      const initiatingAgent = currentAgent()
      const agent = exec && exec.agent
      const callId = exec && exec.callId
      if (approval === undefined || typeof approval.request !== 'function' || agent === undefined || typeof callId !== 'string' || callId === '' || (initiatingAgent !== undefined && initiatingAgent !== agent)) {
        return { allowed: false, outcome: 'unavailable', reason: 'DSH approval 服务、exec.agent/callId 或当前开放轮次绑定不可用：fail-closed；Codex/Claude/Cursor 只能按无插件流程由主会话当轮确认，不能伪装成宿主机械授权' }
      }
      try {
        const outcome = await approval.request({ agent, toolName, callId, reason, signal: exec.signal })
        return outcome === 'allowed-once'
          ? { allowed: true, outcome }
          : { allowed: false, outcome, reason: '宿主一次性授权结果为 ' + outcome + '：拒绝扩大范围' }
      } catch (e) {
        return { allowed: false, outcome: 'unavailable', reason: '宿主授权请求失败：已按 fail-closed 拒绝扩大范围' }
      }
    }

    function writePolicy() {
      const sandboxPolicy = ctx.get('sandboxPolicy')
      if (sandboxPolicy === undefined) return undefined
      const s = currentSession()
      if (s === undefined) return undefined
      try { return sandboxPolicy.resolve({ session: s }) } catch (e) { return undefined }
    }

    async function sh(command, workdir) {
      services()
      if (shell === undefined) return { exitCode: 127, timedOut: false, out: '', err: 'shell 服务不可用（组合挂载未完成）' }
      const wd = workdir.replace(/\\/g, '/')
      const req = { command, workdir: wd, timeoutMs: 60000, stdoutMaxBytes: 200000 }
      const policy = writePolicy()
      if (policy !== undefined) req.sandboxPolicy = policy
      const spec = shell.resolve(req)
      const res = await shell.run(spec)
      return {
        exitCode: res.exitCode,
        timedOut: res.timedOut,
        out: (res.stdout && res.stdout.text) || '',
        err: (res.stderr && res.stderr.text) || '',
      }
    }

    async function rootOf(args) {
      services()
      if (fs === undefined) throw new Error('fs 服务不可用（组合挂载未完成）')
      const t = await fs.resolve(args.path || '.')
      return fs.processPath(t)
    }

    // 读取语义：只有「文件不存在」返回 null；
    // stat 或 readText 抛错（EIO/权限/同步盘锁定）一律抛出——写工具不会把读取失败当「不存在」而用空对象覆盖状态。
    async function readTextAt(rootPath, rel) {
      services()
      if (fs === undefined) throw new Error('fs 服务不可用（组合挂载未完成）')
      const t = await fs.resolve(rel, { cwd: rootPath })
      let info
      try {
        info = await fs.stat(t)
      } catch (e) {
        throw new Error('读取状态失败（' + rel + '）：' + (e && e.message ? e.message : String(e)))
      }
      if (info === undefined) return null
      let content
      try {
        content = await fs.readText(t)
      } catch (e) {
        throw new Error('读取内容失败（' + rel + '）：fail-closed，拒绝把读取失败当作文件不存在（' + (e && e.message ? e.message : String(e)) + '）')
      }
      if (content === undefined || content === null) {
        throw new Error('读取内容失败（' + rel + '）：fail-closed，拒绝把读取失败当作文件不存在')
      }
      return content
    }

    async function writeTextAt(rootPath, rel, content) {
      services()
      if (fs === undefined) throw new Error('fs 服务不可用（组合挂载未完成）')
      const t = await fs.resolve(rel, { cwd: rootPath })
      await fs.writeText(t, content, undefined, undefined, writePolicy())
    }

    // 瞬时写失败自愈：handoff 写入遇 ReplaceFileW EIO（杀软/同步盘瞬时锁文件）一次即抛，
    // 整个 clock_out 重跑造成日报/索引/交接重复追加。对单次写入做一次 300ms 后重试；两次都失败才抛出。
    async function writeTextRetry(rootPath, rel, content) {
      try {
        await writeTextAt(rootPath, rel, content)
      } catch (e) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        await writeTextAt(rootPath, rel, content)
      }
    }

    async function appendTextAt(rootPath, rel, content) {
      const cur = (await readTextAt(rootPath, rel)) || ''
      await writeTextRetry(rootPath, rel, cur + content)
    }

    function stableMetricId(prefix, value) {
      const s = String(value)
      let a = 2166136261
      let b = 2246822519
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i)
        a ^= c
        a = Math.imul(a, 16777619)
        b ^= c + i
        b = Math.imul(b, 3266489917)
      }
      const hex = (n) => (n >>> 0).toString(16).padStart(8, '0')
      return prefix + '-' + hex(a) + hex(b)
    }

    function jsonlObjects(raw) {
      return String(raw || '').split('\n').map((line) => {
        try { return JSON.parse(line) } catch (e) { return null }
      }).filter((row) => row !== null && typeof row === 'object')
    }

    function metricComparable(row) {
      const out = {}
      for (const k of Object.keys(row || {}).sort()) {
        if (k !== 'ts' && k !== 'started_at' && k !== 'ended_at') out[k] = row[k]
      }
      return JSON.stringify(out)
    }

    async function metricEventRows(rootPath, days) {
      services()
      const rels = []
      const now = Date.now()
      const monthKeys = new Set()
      const spanDays = Math.max(31, Number(days || 30))
      for (let offset = 0; offset <= spanDays; offset++) {
        const d = east8Stamp(now - offset * 86400000).date
        monthKeys.add(d.slice(0, 7).replace('-', '/'))
      }
      for (const month of monthKeys) rels.push('docs/ai_memory/agent_metrics/' + month + '/runs.jsonl')
      try {
        const dir = await fs.resolve('.baton/local/metrics', { cwd: rootPath })
        const entries = await fs.listDir(dir)
        for (const e of entries || []) {
          if (e.type === 'file' && /\.jsonl$/i.test(e.name || '')) rels.push('.baton/local/metrics/' + e.name)
        }
      } catch (e) { /* 尚无本机 metrics */ }
      const rows = []
      const seen = new Set()
      for (const rel of rels) {
        const raw = (await readTextAt(rootPath, rel)) || ''
        for (const row of jsonlObjects(raw)) {
          const key = typeof row.event_id === 'string' && row.event_id !== '' ? 'event:' + row.event_id : 'raw:' + JSON.stringify(row)
          if (seen.has(key)) continue
          seen.add(key)
          rows.push(row)
        }
      }
      return rows
    }

    async function appendMetricEventOnce(rootPath, event) {
      const rows = await metricEventRows(rootPath, 31)
      const existing = rows.find((r) => r.event_id === event.event_id)
      if (existing !== undefined) {
        if (metricComparable(existing) !== metricComparable(event)) return { ok: false, conflict: true, existing }
        return { ok: true, existing, appended: false }
      }
      const day = east8Stamp(event.ts).date
      await appendTextAt(rootPath, '.baton/local/metrics/' + day + '.jsonl', JSON.stringify(event) + '\n')
      return { ok: true, existing: event, appended: true }
    }

    function parseNullableCount(value, field) {
      const s = value === undefined || value === null ? '' : String(value).trim()
      if (s === '') return { ok: true, value: null }
      if (!/^\d+$/.test(s)) return { ok: false, reason: field + ' 必须是非负整数或留空' }
      const n = Number(s)
      if (!Number.isSafeInteger(n)) return { ok: false, reason: field + ' 超出安全整数范围' }
      return { ok: true, value: n }
    }

    async function readJsonAt(rootPath, rel, fallback) {
      const raw = await readTextAt(rootPath, rel)
      if (raw === null) return fallback
      try { return JSON.parse(raw) } catch (e) { return fallback }
    }

    // 写路径严格读：区分「文件不存在」与「JSON 损坏」；损坏时写工具必须阻断，禁止用空对象覆盖历史状态
    async function readJsonGuarded(rootPath, rel, fallback) {
      const raw = await readTextAt(rootPath, rel)
      if (raw === null) return { value: fallback, corrupt: false }
      try { return { value: JSON.parse(raw), corrupt: false } } catch (e) { return { value: null, corrupt: true } }
    }

    async function assertJsonHealthy(rootPath, rel, fallback) {
      const g = await readJsonGuarded(rootPath, rel, fallback)
      if (g.corrupt) throw new Error(rel + ' JSON 损坏：拒绝写入，防止静默覆盖历史状态（请人工修复后重试）')
      return g.value
    }

    async function statAt(rootPath, rel) {
      services()
      if (fs === undefined) return null
      try {
        const t = await fs.resolve(rel, { cwd: rootPath })
        const info = await fs.stat(t)
        return info === undefined ? null : { type: info.type, size: info.size || 0 }
      } catch (e) {
        return null
      }
    }

    async function addIndexEntry(rootPath, entry) {
      const index = await assertJsonHealthy(rootPath, 'docs/ai_memory/state/archive_index.json', { entries: [] })
      index.entries.push(entry)
      index.revision = (index.revision || 0) + 1
      index.updated_at = nowIso()
      await writeTextAt(rootPath, 'docs/ai_memory/state/archive_index.json', JSON.stringify(index, null, 2))
    }

    function east8Stamp(input) {
      const base = input === undefined || input === null ? Date.now() : (input instanceof Date ? input.getTime() : new Date(input).getTime())
      const x = new Date(base + 8 * 60 * 60 * 1000)
      const p = (n) => String(n).padStart(2, '0')
      const date = x.getUTCFullYear() + '-' + p(x.getUTCMonth() + 1) + '-' + p(x.getUTCDate())
      const hm = p(x.getUTCHours()) + ':' + p(x.getUTCMinutes())
      const hhmm = p(x.getUTCHours()) + p(x.getUTCMinutes())
      return { date, hm, hhmm, display: date + ' ' + hm }
    }
    function agentLabel(args) {
      const s = [
        args && args.writer_agent,
        args && args.actual_model,
        process.env.CURSOR_TRACE_ID ? 'cursor' : '',
        process.env.CLAUDECODE ? 'claude' : '',
      ].join(' ').toLowerCase()
      if (s.indexOf('workbuddy') !== -1) return 'workbuddy'
      if (s.indexOf('cursor') !== -1) return 'Cursor'
      if (s.indexOf('codex') !== -1) return 'Codex'
      if (s.indexOf('claude') !== -1) return 'Claude'
      if (s.indexOf('deepseek') !== -1 || /\bdsh\b/.test(s)) return 'DeepSeek'
      return '未知'
    }
    function topicOf(text, fallback) {
      const t = String(text || '').replace(/\s+/g, ' ').trim()
      if (t === '') return fallback
      return t.length > 24 ? t.slice(0, 24) : t
    }
    function hoId(agent, when) {
      const e = east8Stamp(when)
      return 'HO-' + e.date.replace(/-/g, '') + '-' + e.hhmm + '-' + (agent || '未知')
    }
    function safeRevCell(s) {
      return String(s || '').replace(/\|/g, '/').replace(/\r?\n/g, ' ')
    }

    // 修订记录表（每个长期 md 的强制区块）：若文件已有该表则追加一行，否则插入一个最小表。
    // 行尾必须兼容 CRLF：Windows 检出的模板是 CRLF，只匹配 LF 的正则会静默追加失败。
    async function appendRevision(rootPath, rel, summary, agent) {
      const who = agent || '未知'
      const cur = (await readTextAt(rootPath, rel)) || ''
      const row = '| ' + todayLocal() + ' | ' + who + ' | ' + safeRevCell(summary) + ' |\n'
      const header = '| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n'
      const marker = '| 日期 | 修改人 | 变更概要 |'
      const idx = cur.indexOf(marker)
      if (idx !== -1) {
        const re = /(\| 日期 \| 修改人 \| 变更概要 \|\r?\n\| --- \| --- \| --- \|\r?\n)/
        if (re.test(cur)) {
          await writeTextRetry(rootPath, rel, cur.replace(re, '$1' + row))
        } else {
          const lineEnd = cur.indexOf('\n', idx)
          const at = lineEnd === -1 ? cur.length : lineEnd + 1
          await writeTextRetry(rootPath, rel, cur.slice(0, at) + row + cur.slice(at))
        }
      } else {
        await writeTextRetry(rootPath, rel, cur + '\n## 【修订记录】\n\n' + header + row + '\n')
      }
    }

    async function upsertCurrentRevision(rootPath, rel, summary, agent) {
      const who = agent || '未知'
      const day = todayLocal()
      const newRow = '| ' + day + ' | ' + who + ' | ' + safeRevCell(summary) + ' |'
      const cur = (await readTextAt(rootPath, rel)) || ''
      const lines = cur.split('\n')
      const start = lines.findIndex((l) => l.indexOf('| 日期 | 修改人 | 变更概要 |') !== -1)
      const reRow = /^\| (\d{4}-\d{2}-\d{2}) \|/
      if (start === -1) {
        await appendRevision(rootPath, rel, summary, agent)
        return
      }
      let i = start + 2
      const rows = []
      while (i < lines.length) {
        const line = lines[i]
        if (!reRow.test(line)) break
        rows.push({ date: line.match(reRow)[1], line })
        i += 1
      }
      if (rows.length > 0 && rows[0].date === day) rows[0].line = newRow
      else rows.unshift({ date: day, line: newRow })
      const seen = {}
      const kept = []
      for (const r of rows) {
        if (seen[r.date]) continue
        seen[r.date] = true
        kept.push(r)
        if (kept.length === 3) break
      }
      const out = lines.slice(0, start + 2).concat(kept.map((r) => r.line)).concat(lines.slice(i))
      await writeTextRetry(rootPath, rel, out.join('\n'))
    }

    // 日报：不存在时用模板头创建，再追加条目。
    async function ensureDailyFile(rootPath, today) {
      const rel = 'docs/ai_memory/daily_log/daily_' + today + '.md'
      const cur = await readTextAt(rootPath, rel)
      if (cur === null) {
        await writeTextAt(rootPath, rel,
          '# ' + today + ' 日报\n\n> 本文件是当日工作流水：交接条目/进度条目按时间追加，最新在末。\n> 文件名 `daily_' + today + '.md`；每天一份，不跨天合并。\n\n## 今日条目\n\n')
      }
      return rel
    }

    // 保头更新 current.md：保留【归档分卷索引】+【修订记录】区块，只替换「当前事实」主体。
    async function updateCurrentFacts(rootPath, factsText, revSummary, agent) {
      const rel = await docRole(rootPath, 'current')
      const cur = (await readTextAt(rootPath, rel)) || ''
      const idx = cur.indexOf('## 当前事实')
      if (idx !== -1 && cur.slice(idx).trim() === ('## 当前事实（简写，随生命周期更新）\n\n' + factsText).trim()) return
      await upsertCurrentRevision(rootPath, rel, revSummary || topicOf(factsText, '更新当前事实'), agent)
      const updated = await readTextAt(rootPath, rel) || cur
      const idx2 = updated.indexOf('## 当前事实')
      const head = idx2 === -1 ? updated : updated.slice(0, idx2)
      const body = head.replace(/\n+$/, '') + '\n\n## 当前事实（简写，随生命周期更新）\n\n' + factsText + '\n'
      await writeTextAt(rootPath, rel, body)
    }

    async function appendHandoffEntry(rootPath, entryMarkdown, revSummary, agent) {
      const rel = await docRole(rootPath, 'handoff')
      await appendRevision(rootPath, rel, revSummary, agent)
      await appendTextAt(rootPath, rel, '\n' + entryMarkdown + '\n')
    }

    function lineCount(text) {
      return (text || '').split('\n').length
    }

    // 当前事实摘要：定位「## 当前事实」小节（模板从第 13 行才进入正题），缺失时退回首行摘要
    function currentFacts(text) {
      const idx = (text || '').indexOf('## 当前事实')
      if (idx === -1) return (text || '').slice(0, 600)
      return (text || '').slice(idx).trim().slice(0, 800)
    }

    // 交接末条：先剔除模板代码块（fresh 项目的交接模板里含 ### HO- 占位符，会误判为真实交接条目）；
    // 无真实条目（尾段不含「交接状态」字段）时返回空串，避免把模板头当成交接事实。
    function handoffTailOf(handoff) {
      const stripped = (handoff || '').replace(/```[\s\S]*?```/g, '')
      const tail = stripped.split(/###\s+HO-/).slice(-1)[0] || ''
      return tail.indexOf('交接状态') === -1 ? '' : tail
    }

    // 从 todo/progress 视图表里机械移除任务行（表格行 = 以 | 开头且任务 ID 列精确匹配；修订记录行不受影响）
    async function removeTaskRow(rootPath, rel, taskId) {
      const cur = (await readTextAt(rootPath, rel)) || ''
      const re = new RegExp('^\\|\\s*\\S+\\s*\\|\\s*' + taskId + '\\s*\\|')
      const lines = cur.split('\n')
      const out = lines.filter((l) => !re.test(l))
      if (out.length !== lines.length) await writeTextAt(rootPath, rel, out.join('\n'))
    }

    function idSuffix() {
      return String(Date.now()).slice(-6)
    }

    function nowIso() {
      return new Date().toISOString()
    }

    function issuePushReceipt(rootPath, branch, localHead, remoteSha, evidence) {
      const now = Date.now()
      for (const [key, value] of verifiedPushReceipts.entries()) {
        if (value === null || now - value.issued_at_ms > 10 * 60 * 1000) verifiedPushReceipts.delete(key)
      }
      const token = 'push-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 14)
      verifiedPushReceipts.set(token, { root_path: rootPath, branch, local_head: localHead, remote_sha: remoteSha, evidence, issued_at_ms: now })
      return token
    }

    function todayLocal() {
      return east8Stamp().date
    }

    function monthLocal() {
      return todayLocal().slice(0, 7).replace('-', '/')
    }

    function safeBranchName(b) {
      return /^[A-Za-z0-9._\/-]{1,200}$/.test(b)
    }

    async function gitSnapshot(rootPath) {
      const branch = (await sh('git branch --show-current', rootPath)).out.trim()
      const head = (await sh('git rev-parse HEAD', rootPath)).out.trim()
      // core.quotepath=false：中文路径按 UTF-8 原样输出，不做八进制转义（否则范围门禁匹配不到真实文件名）
      // porcelain v1 -z：NUL 分隔、路径零转义（含空格/中文/引号的路径不再被 git 引号包裹），
      // rename 为 "R  <旧路径>" NUL "<新路径>" NUL —— 无歧义，杜绝引号路径绕过 protected 检查。
      const statusOut = await sh('git -c core.quotepath=false status --porcelain=v1 -z', rootPath)
      const dirty = statusOut.out.trim().length > 0
      const filesAll = []
      if (dirty) {
        const buf = statusOut.out
        const len = buf.length
        let i = 0
        while (i < len) {
          const rest = buf.slice(i)
          const nul = rest.indexOf('\0')
          const entry = nul === -1 ? rest : rest.slice(0, nul)
          i += entry.length + 1
          if (entry === '') continue
          const xy = entry.slice(0, 2)
          const p1 = entry.slice(3)
          if (xy[0] === 'R' || xy[0] === 'C') {
            const rest2 = buf.slice(i)
            const nul2 = rest2.indexOf('\0')
            const p2 = nul2 === -1 ? rest2 : rest2.slice(0, nul2)
            i += p2.length + 1
            filesAll.push(p1, p2)
          } else {
            filesAll.push(p1)
          }
        }
      }
      const files = filesAll.slice(0, 30)
      const files_count = filesAll.length
      let tracking = null
      let ahead = null
      let behind = null
      const tr = await sh('git rev-parse --abbrev-ref --symbolic-full-name @{u}', rootPath)
      if (tr.exitCode === 0) {
        tracking = tr.out.trim()
        const cnt = await sh('git rev-list --left-right --count HEAD...@{u}', rootPath)
        if (cnt.exitCode === 0) {
          const parts = cnt.out.trim().split(/\s+/)
          ahead = Number(parts[0])
          behind = Number(parts[1])
        }
      }
      // 远端检测：以 git remote 实列表为准（tracking 只反映 upstream 配置，会误判"有 origin 但分支未设 upstream"为无远端）
      const remoteOut = await sh('git remote', rootPath)
      const remotes = remoteOut.exitCode === 0 ? remoteOut.out.trim().split('\n').map((s) => s.trim()).filter((s) => s !== '') : []
      return { branch, head, dirty, files, files_all: filesAll, files_count: filesAll.length, tracking, ahead, behind, remotes }
    }

    function gitView(g) {
      return { branch: g.branch, head: g.head, dirty: g.dirty, files: g.files, files_count: g.files_count, tracking: g.tracking, ahead: g.ahead, behind: g.behind }
    }

    // 远端 URL 归一化（仅用于比对）：去协议 → 去 userinfo（令牌/用户，错误消息绝不回显）→ scp 形 host:path 转 host/path → 去尾部 .git 与斜杠 → 全小写。
    function normalizeRemoteUrl(url) {
      let u = String(url || '').trim().toLowerCase()
      u = u.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
      u = u.replace(/^[^/@]+@/, '')
      if (/^[^/:]+:[^/]/.test(u)) u = u.replace(':', '/')
      u = u.replace(/\/+$/, '').replace(/\.git$/, '')
      return u
    }
    // 内置禁推清单：开源发布仓库。发布只走官方发布脚本，任何项目的日常 push 永不允许指向它。
    const PUSH_BLOCKED_DEFAULT = ['github.com/kakadeka/baton']
    const blockedRemoteList = (config) => PUSH_BLOCKED_DEFAULT.concat(config && config.remotes && Array.isArray(config.remotes.push_blocked) ? config.remotes.push_blocked : []).map(normalizeRemoteUrl)

    // 推流目标远端：优先当前分支 tracking 的 remote，其次 origin，最后第一个 remote；
    // config.remotes.push_allowed 存在时强制核对；
    // 目标 URL 命中禁推清单（内置 + config.remotes.push_blocked）→ 硬阻断。
    async function resolvePushRemote(rootPath, git) {
      const config = await loadConfig(rootPath)
      const trackingRemote = git.tracking ? git.tracking.split('/')[0] : null
      let target = (trackingRemote !== null && git.remotes.indexOf(trackingRemote) !== -1) ? trackingRemote
        : (git.remotes.indexOf('origin') !== -1 ? 'origin'
        : (git.remotes.length > 0 ? git.remotes[0] : null))
      const pushAllowed = config && config.remotes && Array.isArray(config.remotes.push_allowed) ? config.remotes.push_allowed : null
      if (target !== null && pushAllowed !== null && pushAllowed.length > 0 && pushAllowed.indexOf(target) === -1) {
        return { target: null, url: null, error: '远端 ' + target + ' 不在 config.remotes.push_allowed 允许清单中' }
      }
      if (target === null) return { target: null, url: null, error: null }
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(target)) return { target: null, url: null, error: '远端名含非法字符，拒绝推流（防命令注入）' }
      const gu = await sh('git remote get-url ' + target, rootPath)
      const url = gu.exitCode === 0 ? (gu.out || '').trim() : null
      const blocked = blockedRemoteList(config)
      if (url !== null && url !== '' && blocked.indexOf(normalizeRemoteUrl(url)) !== -1) {
        return { target: null, url, error: '远端 ' + target + ' 指向 Baton 开源发布仓库（' + normalizeRemoteUrl(url) + '），禁止项目日常推送。开源发布只走官方发布脚本；请把该 remote 改指你自己的仓库或本地仓库后重试' }
      }
      return { target, url, error: null }
    }

    // gh api 实查通道：
    // GitHub 远端且 ls-remote 受限时，用 gh api 直取 refs/heads/<branch> 的真实 SHA（HTTP 通道，绕过沙箱内 msys git 限制）。
    // 返回 40 位十六进制 SHA；远端非 GitHub、gh 不可用或输出不合法时返回 null。
    async function githubRefSha(remoteUrl, branch, rootPath) {
      if (!remoteUrl) return null
      const m = /^github\.com\/([^/]+)\/([^/]+)$/.exec(normalizeRemoteUrl(remoteUrl))
      if (m === null) return null
      const owner = m[1]
      const repo = m[2]
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(owner) || !/^[A-Za-z0-9._-]{1,100}$/.test(repo) || !/^[A-Za-z0-9._\/-]{1,200}$/.test(branch)) return null
      const r = await sh('gh api repos/' + owner + '/' + repo + '/git/refs/heads/' + branch + ' --jq .object.sha', rootPath)
      if (r.exitCode !== 0) return null
      const sha = (r.out || '').trim()
      return /^[0-9a-f]{40}$/i.test(sha) ? sha : null
    }

    async function loadConfig(rootPath) {
      return readJsonAt(rootPath, '.baton/config.json', null)
    }

    // 安全配置 fail-closed 读取：config.json 缺失或损坏 = 安全门禁不可信 → 返回错误，写工具必须阻断，
    // 绝不降级为空 protected_paths 继续执行。
    async function loadConfigGuarded(rootPath) {
      const raw = await readTextAt(rootPath, '.baton/config.json')
      if (raw === null) return { config: null, error: '缺少 .baton/config.json（安全配置不存在）：请运行 baton_init / scripts/baton-install.ps1 补齐后重试' }
      try {
        const cfg = JSON.parse(raw)
        return { config: cfg, error: null }
      } catch (e) {
        return { config: null, error: '.baton/config.json JSON 损坏：修复配置后重试（安全门禁 fail-closed，不降级为空保护）' }
      }
    }

    // 单写入者锁门禁：所有写工具必须核对工作区处于 holding 且（有会话身份时）持有者为本会话；
    // 无会话身份的环境（测试/无插件模式）无法区分调用者 → holding 即放行（SKILL 注明该环境下为尽力而为，最终防线是交接门禁+用户确认）。
    async function ownershipGuard(rootPath) {
      const st = await readJsonGuarded(rootPath, 'docs/ai_memory/state/project_state.json', {})
      if (st.corrupt) return { pass: false, reason: 'state JSON 损坏：拒绝写入（fail-closed，请人工修复后重试）' }
      const own = (st.value && st.value.ownership) || {}
      if (own.logical_state !== 'holding') return { pass: false, reason: '工作区未被持有：先「上班啦」（baton_clock_in）持有单写入者锁，再执行写操作；下班/释放后需重新上班' }
      const w = currentSession()
      if (w !== undefined && w !== null && w.id !== undefined) {
        if (String(own.writer) !== String(w.id)) return { pass: false, reason: '单写入者锁由 ' + String(own.writer).slice(0, 20) + ' 持有（非本会话）：写操作被拒绝；换会话先「上班啦」或经用户确认 baton_release 释放' }
      }
      return { pass: true, reason: null }
    }

    // ownership ref 是原子锁权威。释放必须先读取旧 SHA，再用 update-ref CAS 删除并回读确认；
    // 非零结果不能当作“可能已经不存在”弱放行，否则会产生 state=released 但 ref 遗留。
    async function releaseOwnershipRef(rootPath) {
      const lockRef = 'refs/baton/ownership-lock'
      const before = await sh('git rev-parse --verify --quiet ' + lockRef, rootPath)
      if (before.exitCode === 1) return { ok: true, already_absent: true }
      const oldSha = before.out.trim()
      if (before.exitCode !== 0 || !/^[0-9a-f]{40}$/i.test(oldSha)) {
        return { ok: false, reason: '无法读取 ownership ref：' + (before.timedOut ? 'timeout' : (before.err || 'exit=' + before.exitCode)) }
      }
      const del = await sh('git update-ref -d ' + lockRef + ' ' + oldSha, rootPath)
      if (del.exitCode !== 0) {
        return { ok: false, reason: 'ownership ref 删除失败：' + (del.timedOut ? 'timeout' : (del.err || 'exit=' + del.exitCode)) }
      }
      const after = await sh('git rev-parse --verify --quiet ' + lockRef, rootPath)
      if (after.exitCode !== 1) {
        return { ok: false, reason: 'ownership ref 删除后仍存在或无法确认不存在' }
      }
      return { ok: true, already_absent: false }
    }

    async function tombstoneOwnershipLock(rootPath) {
      const rel = '.baton/local/ownership-lock.json'
      const existing = await readJsonAt(rootPath, rel, null)
      if (existing !== null && existing.writer === null && existing.logical_state === 'released') return
      await writeTextAt(rootPath, rel, JSON.stringify({ writer: null, logical_state: 'released', released_at: nowIso() }, null, 2))
    }

    async function verifiedGitHead(rootPath) {
      const result = await sh('git rev-parse HEAD', rootPath)
      const head = result.out.trim()
      if (result.exitCode !== 0 || result.timedOut || !/^[0-9a-f]{40}$/i.test(head)) {
        return { ok: false, head: null, reason: result.timedOut ? 'timeout' : (result.err || 'exit=' + result.exitCode) }
      }
      return { ok: true, head, reason: null }
    }

    // exactly-once 操作信封：
    // 副作用前写 intent（含 head_before）；只有业务成功（回调返回 ok===true）才写 done；
    // 回调返回 ok!==true 或抛异常 → 写 failed（不写 done），重试 failed 必须重新执行（不幂等短路），
    // 副作用自带内容级去重（按摘要/标题/task_id）双保险；已 done 的同 operation_id 重试才短路。
    // shortcut=false：只记 intent/done/failed 不短路（工具自身已有更精确幂等的场景，如 complete 的状态机防重开）。
    async function opEnvelope(rootPath, opId, fn, shortcut) {
      const doShortcut = shortcut !== false
      const logRel = '.baton/local/operations.jsonl'
      const log = (await readTextAt(rootPath, logRel)) || ''
      const doneMark = '"op":"' + opId + '","phase":"done"'
      if (doShortcut && log.indexOf(doneMark) !== -1) {
        return { ok: true, op_skipped: true, note: '操作已完成（operation 幂等短路，无需重复副作用）' }
      }
      let headBefore = ''
      try { headBefore = (await gitSnapshot(rootPath)).head } catch (e) { headBefore = '' }
      await appendTextAt(rootPath, logRel, JSON.stringify({ ts: nowIso(), op: opId, phase: 'intent', head_before: headBefore }) + '\n')
      let result
      let failed = false
      try {
        result = await fn()
        if (result === undefined || result === null || result.ok !== true) failed = true
      } catch (e) {
        failed = true
        result = { ok: false, reason: '操作执行异常：' + (e && e.message ? e.message : String(e)) }
      }
      if (failed) {
        await appendTextAt(rootPath, logRel, JSON.stringify({ ts: nowIso(), op: opId, phase: 'failed' }) + '\n')
      } else {
        await appendTextAt(rootPath, logRel, JSON.stringify({ ts: nowIso(), op: opId, phase: 'done' }) + '\n')
      }
      return result
    }

    // 敏感信息写前扫描：凭据绝不进入 Git 跟踪文档——summary/facts/content/note 等输入写库前机械排查，
    // 命中即拒绝整次写入（绝不静默截断或继续）。
    const SECRET_PATTERNS = [
      [/sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}/, '疑似 API Key'],
      [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '疑似私钥 PEM'],
      [/AKIA[0-9A-Z]{16}/, '疑似 AWS Access Key'],
      [/xox[baprs]-[A-Za-z0-9-]{10,}/, '疑似 Slack Token'],
      [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, '疑似 JWT'],
      [/Bearer\s+[A-Za-z0-9._-]{20,}/, '疑似 Bearer Token'],
      [/(?:mongodb|postgres(?:ql)?|mysql|redis):\/\/[^\s"']+/, '疑似数据库连接串'],
      [/https?:\/\/[^\s"'/]+:[^\s"'/@]+@[^\s"']+/, '疑似 URL 内嵌凭据'],
    ]
    function secretHits(text) {
      const hits = []
      if (typeof text !== 'string' || text === '') return hits
      for (const [re, label] of SECRET_PATTERNS) {
        try { if (re.test(text)) hits.push(label) } catch (e) { /* 忽略坏模式 */ }
      }
      return hits
    }

    // 待提交文件凭据扫描：git add -A 会纳入的真实文件在提交前全量扫描——
    // 秘密模式 + 敏感文件名黑名单命中即阻断；文件读不出来 fail-closed 阻断（不猜测、不放行）。
    // exempt 为用户显式豁免路径前缀（user: 声明），命中豁免则跳过该文件。
    const SENSITIVE_FILE_PATTERNS = [
      [/^\.env(\..*)?$/i, '环境变量文件'],
      [/^\.npmrc$/i, 'npm 配置'],
      [/\.pem$/i, 'PEM 文件'],
      [/^id_rsa($|\.)/i, 'SSH 私钥'],
      [/\.key$/i, '密钥文件'],
      [/(^|[\\/])credentials?($|\.)/i, '凭据文件'],
      [/\.p12$/i, '证书文件'],
    ]
    async function stagedSecretScan(rootPath, files, exempt) {
      const hits = []
      const seen = new Set()
      // 凭据红线不可豁免：范围豁免（user:）只豁免「任务路径越界」，
      // 绝不豁免秘密扫描——.env*/.npmrc/私钥/源码 Token 没有任何普通豁免。
      const exemptList = (exempt || []).map((s) => String(s).replace(/\\/g, '/')).filter((s) => s !== '')
      const inExempt = (f) => false && exemptList.some((a) => f === a || f.indexOf(a + '/') === 0) // 关闭豁免：扫描无豁免路径
      const scanOne = async (rawF, depth) => {
        const nf = String(rawF).replace(/\\/g, '/')
        if (nf === '' || seen.has(nf)) return
        seen.add(nf)
        void inExempt
        const base = nf.split('/').pop()
        for (const [re, label] of SENSITIVE_FILE_PATTERNS) {
          try { if (re.test(base)) { hits.push(nf + ' [' + label + ']'); break } } catch (e) { /* 忽略坏模式 */ }
        }
        // fail-closed：stat/listDir/readText 的异常一律阻断，绝不把异常当「不存在/空」；
        // 只有 fs.stat 明确返回 undefined（真实不存在 = Git 已删除）才跳过。
        let st
        try {
          st = await fs.stat(await fs.resolve(nf, { cwd: rootPath }))
        } catch (e) {
          hits.push(nf + ' [stat 读取失败 fail-closed：' + (e && e.message ? e.message : String(e)) + ']')
          return
        }
        if (st === undefined) return // 已删除的文件（D 状态）无内容可提交，跳过
        if (st.type === 'directory') {
          // 未跟踪目录：git status 只列目录本身，但 git add -A 会递归纳入内部文件——必须递归扫描
          if (depth >= 5) { hits.push(nf + ' [目录嵌套过深，fail-closed 未扫描]'); return }
          let entries
          try {
            entries = await fs.listDir(await fs.resolve(nf, { cwd: rootPath }))
          } catch (e) {
            hits.push(nf + ' [目录列举失败 fail-closed：' + (e && e.message ? e.message : String(e)) + ']')
            return
          }
          if (entries.length > 400) { hits.push(nf + ' [目录条目过多，fail-closed 未扫描]'); return }
          for (const e of entries) {
            await scanOne(nf.replace(/\/$/, '') + '/' + e.name, depth + 1)
          }
          return
        }
        const content = await readTextAt(rootPath, nf)
        if (content === null) {
          hits.push(nf + ' [内容读取失败，fail-closed 阻断]')
          return
        }
        for (const h of secretHits(content)) hits.push(nf + ' [' + h + ']')
      }
      for (const f of files) await scanOne(f, 0)
      return hits
    }

    // ===== Lean Gate 机械预算=====
    // strict 模式对新增依赖/文件/抽象计算 delta（相对 select 时的 base SHA），超预算必须契约内预锁例外（用户明确例外）；
    // full 只要求 select 时提供证据字段、不阻断；off/lite 不施加预算。安全/凭据/范围门禁在本门禁上游，不受策略削弱。
    // 抽象计数为行级启发式（函数/类/箭头赋值声明），不解析语义；边界如实记录在 SKILL。
    const ABSTRACTION_PATTERNS = [
      [/^\s*(export\s+)?(async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/, 'function'],
      [/^\s*(export\s+)?class\s+[A-Za-z_$][\w$]*/, 'class'],
      [/^\s*(export\s+)?const\s+[A-Za-z_$][\w$]*\s*=\s*(async\s*)?(\([^)]*\)|function|class|new\s+[A-Za-z_$][\w$]*\s*\()/, 'const-assign'],
    ]
    function countAbstractions(text) {
      let n = 0
      if (typeof text !== 'string') return 0
      for (const line of text.split('\n')) {
        for (const [re] of ABSTRACTION_PATTERNS) {
          try { if (re.test(line)) { n += 1; break } } catch (e) { /* 忽略坏模式 */ }
        }
      }
      return n
    }
    function depNamesOf(pkg) {
      const names = []
      if (pkg && typeof pkg === 'object') {
        for (const sec of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
          const o = pkg[sec]
          if (o && typeof o === 'object') for (const k of Object.keys(o)) names.push(k)
        }
      }
      return names
    }
    // 只读计算 Lean delta：新增文件（A + 未跟踪）、新增依赖（当前 package.json vs base 提交）、新增抽象行。
    // excludeFn 过滤框架管理域（docs/ai_memory、.baton 等），框架自产文件不计预算。
    async function leanDelta(rootPath, baseSha, excludeFn) {
      const newFiles = []
      const addedDeps = []
      const abstractFiles = []
      const absCounts = {}
      const errors = []
      const baseOk = /^[0-9a-f]{7,40}$/i.test(String(baseSha || ''))
      if (baseOk) {
        const ns = await sh('git -c core.quotepath=false diff --name-status ' + String(baseSha), rootPath)
        if (ns.exitCode !== 0) errors.push('diff name-status 失败：' + String(ns.err).slice(0, 80))
        else {
          for (const line of ns.out.split('\n')) {
            const parts = line.split('\t')
            if (parts[0] === 'A' && parts[1]) {
              const np = parts[1].replace(/\\/g, '/')
              if (!excludeFn(np)) newFiles.push(np)
            }
          }
        }
      }
      const un = await sh('git -c core.quotepath=false ls-files --others --exclude-standard', rootPath)
      if (un.exitCode !== 0) errors.push('ls-files others 失败：' + String(un.err).slice(0, 80))
      else {
        for (const p of un.out.split('\n')) {
          const np = p.trim().replace(/\\/g, '/')
          if (np !== '' && !excludeFn(np) && newFiles.indexOf(np) === -1) newFiles.push(np)
        }
      }
      const absSeen = new Set()
      if (baseOk) {
        const df = await sh('git -c core.quotepath=false diff --unified=0 ' + String(baseSha), rootPath)
        if (df.exitCode !== 0) errors.push('diff 失败：' + String(df.err).slice(0, 80))
        else {
          let cur = null
          for (const line of df.out.split('\n')) {
            if (line.indexOf('+++ b/') === 0) { cur = line.slice(6).replace(/\\/g, '/'); continue }
            if (line.indexOf('--- a/') === 0) { cur = null; continue }
            if (line.charAt(0) !== '+' || line.indexOf('+++') === 0 || cur === null) continue
            if (excludeFn(cur)) continue
            let hit = false
            for (const [re] of ABSTRACTION_PATTERNS) {
              try { if (re.test(line.slice(1))) { hit = true; break } } catch (e) { /* 忽略坏模式 */ }
            }
            if (hit) {
              absCounts[cur] = (absCounts[cur] || 0) + 1
              absSeen.add(cur)
            }
          }
        }
      }
      // 未跟踪新文件：整文件按行计抽象（与 diff hunk 已计入的文件去重）
      for (const p of newFiles) {
        const txt = await readTextAt(rootPath, p)
        if (txt === null) continue
        if (absSeen.has(p)) continue
        const c = countAbstractions(txt)
        if (c > 0) absCounts[p] = c
      }
      for (const f of Object.keys(absCounts)) abstractFiles.push(f)
      // 依赖 delta：当前 package.json vs base 提交版本
      const curPkg = await readJsonAt(rootPath, 'package.json', null)
      const curDeps = depNamesOf(curPkg)
      const baseDeps = []
      if (baseOk) {
        const bp = await sh('git show ' + String(baseSha) + ':package.json', rootPath)
        if (bp.exitCode !== 0) {
          // base 无 package.json：新项目正常基线（按零历史依赖处理，不算 delta 错误）
        } else {
          try { const bj = JSON.parse(bp.out); for (const n of depNamesOf(bj)) baseDeps.push(n) } catch (e) { errors.push('base package.json 不可解析') }
        }
      }
      for (const n of curDeps) if (baseDeps.indexOf(n) === -1) addedDeps.push(n)
      return { new_files: newFiles, new_deps: addedDeps, abstractions: abstractFiles.reduce((s, f) => s + (absCounts[f] || 0), 0), abstract_files: abstractFiles, errors }
    }

    // A 是否为 B 的祖先（或相等）——用于「记账提交叠加在已核验内容之上」的判定
    async function isAncestor(shaA, shaB, rootPath) {
      if (!/^[0-9a-f]{40}$/i.test(shaA) || !/^[0-9a-f]{40}$/i.test(shaB)) return false
      if (shaA === shaB) return true
      const r = await sh('git merge-base --is-ancestor ' + shaA + ' ' + shaB, rootPath)
      return r.exitCode === 0
    }

    // completed 前置证据门——accept 前必须同时成立：
    // ① Git 内执行证据（evidence.jsonl / .baton/evidence 有 source SHA 绑定且为 HEAD 祖先的行，跨机可见）；
    // ② task_finished 证据行存在且非占位。任一不成立 → 拒绝写 completed。
    async function taskEvidenceGate(rootPath, taskId) {
      const evIndexRaw = (await readTextAt(rootPath, 'docs/ai_memory/state/evidence.jsonl')) || ''
      const ev = evIndexRaw + '\n' + ((await readTextAt(rootPath, '.baton/evidence/' + taskId + '.jsonl')) || '')
      let evOk = false
      for (const line of ev.split('\n')) {
        const s = line.trim()
        if (s === '') continue
        try {
          const r = JSON.parse(s)
          if (r && r.task_id === taskId && typeof r.actual_model === 'string' && r.actual_model !== '') {
            const h = typeof r.head === 'string' ? r.head : ''
            if (/^[0-9a-f]{40}$/i.test(h)) {
              const gitNow = await gitSnapshot(rootPath)
              if (h === gitNow.head || await isAncestor(h, gitNow.head, rootPath)) { evOk = true; break }
            }
          }
        } catch (e) { /* 坏行跳过 */ }
      }
      const finishedDoc = (await readTextAt(rootPath, 'docs/ai_memory/tasks/task_finished.md')) || ''
      const seg = finishedDoc.split('## ').find((s) => s.indexOf(taskId + '｜') === 0 || s.indexOf(taskId + '|') === 0) || ''
      const evLine = seg.split('\n').find((l) => /^-\s*证据：/.test(l)) || ''
      const placeholder = evLine === '' || evLine.indexOf('（待补充') !== -1 || evLine.indexOf('（待补）') !== -1 || evLine.indexOf('证据：（待') !== -1
      return { evOk, placeholder }
    }

    // 文档角色解析：老项目通过 config.legacy.doc_roles 把角色映射到旧文件名（如 00_项目总览架构.md → overview）。
    // 规则：配置了映射且旧文件真实存在 → 用旧路径；否则用规范路径。写入与读取都走本函数，保证旧文档可被继续读写。
    // 注意：state/*.json、tasks/、knowledge/、ui_spec/ 等目录结构新旧一致，不需映射。
    const DOC_ROLES = { index: 'docs/ai_memory/index.md', current: 'docs/ai_memory/current.md', handoff: 'docs/ai_memory/handoff_current.md', commands: 'docs/ai_memory/commands.md', overview: 'docs/ai_memory/overview.md', constraints: 'docs/ai_memory/constraints.md', validation_matrix: 'docs/ai_memory/validation_matrix.md' }
    // config 读取缓存：同一工具调用内 docRole 多次调用只读一次 config.json（避免重复请求）；30 秒 TTL 防用户改配置后失效
    const configCache = new Map()
    async function docRole(rootPath, role) {
      const canonical = DOC_ROLES[role]
      if (canonical === undefined) return canonical
      const key = rootPath + ':config'
      const cached = configCache.get(key)
      let config
      if (cached !== undefined && Date.now() - cached.ts < 30000) {
        config = cached.value
      } else {
        config = await loadConfig(rootPath)
        configCache.set(key, { ts: Date.now(), value: config === null ? null : config })
      }
      const legacy = (config && config.legacy && config.legacy.doc_roles) || null
      if (legacy === null) return canonical
      const mapped = legacy[role]
      if (typeof mapped !== 'string' || mapped === '') return canonical
      if ((await readTextAt(rootPath, mapped)) !== null) return mapped
      return canonical
    }

    function output() {
      return { schema: { type: 'object', additionalProperties: true }, render(_args, value) {
        const t = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
        return [{ type: 'text', text: t }]
      } }
    }

    function simple(parameters) {
      const params = {}
      for (const key of Object.keys(parameters)) {
        params[key] = { type: 'string', description: parameters[key] }
      }
      return params
    }

    ctx.tools.register(defineTool({
      name: 'baton_status',
      description: 'Baton：查看项目状态（git 六层快照 + 当前任务 + 交接摘要）。只读，不写任何文件。',
      parameters: simple({ path: '项目根目录，默认当前目录' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const git = await gitSnapshot(rootPath)
        const config = await loadConfig(rootPath)
        const current = (await readTextAt(rootPath, await docRole(rootPath, 'current'))) || ''
        const handoff = (await readTextAt(rootPath, await docRole(rootPath, 'handoff'))) || ''
        const handoffTail = handoffTailOf(handoff)
        const tasks = await readJsonAt(rootPath, 'docs/ai_memory/state/tasks.json', { tasks: [] })
        const open = (tasks.tasks || []).filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
        const state = await readJsonAt(rootPath, 'docs/ai_memory/state/project_state.json', {})
        const ownership = state.ownership || {}
        return {
          ok: true,
          project: config ? config.project_name : null,
          git: gitView(git),
          ownership: {
            writer: ownership.writer || null,
            logical_state: ownership.logical_state || 'unknown',
          },
          open_tasks: open.slice(0, 10).map((t) => ({ id: t.id, title: t.title, status: t.status, next_step: t.next_step || null })),
          current_summary: currentFacts(current),
          handoff_tail: handoffTail.slice(0, 1200),
          doc_roles_resolved: {
            index: await docRole(rootPath, 'index'),
            current: await docRole(rootPath, 'current'),
            handoff: await docRole(rootPath, 'handoff'),
            commands: await docRole(rootPath, 'commands'),
            overview: await docRole(rootPath, 'overview'),
            constraints: await docRole(rootPath, 'constraints'),
          },
          read_only: true,
        }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_git',
      description: 'Baton：本地 Git 操作（status/commit_all）。commit_all 与下班同款门禁：protected 命中或非管理域改动未声明 allowed_files 即阻断。fetch/sync/push 属网络操作，请主会话用 pwsh 工具执行，再用 baton_verify_push 核验。危险操作（force push/reset/clean/rebase）不存在。',
      parameters: simple({ path: '项目根目录', action: 'status | commit_all', message: 'commit 信息（commit_all 时必填）', allowed_files: '允许改动的文件清单，逗号分隔（commit_all 存在非管理域改动时必填）' }),
      output: output(),
      async execute(args, exec) {
        const rootPath = await rootOf(args)
        const action = args.action || 'status'
        if (action === 'status') {
          const g = await gitSnapshot(rootPath)
          return { ok: true, action, git: gitView(g) }
        }
        if (action === 'commit_all') {
          const git = await gitSnapshot(rootPath)
          if (!git.dirty) return { ok: true, action, committed: false, note: '工作区干净，无内容可提交' }
          // 与 clock_out 同款门禁：protected 与未声明范围一律不放行，封死 git add -A 绕过；config 缺失/损坏 fail-closed
          const cfgG = await loadConfigGuarded(rootPath)
          if (cfgG.error !== null) return { ok: false, action, reason: '安全配置不可用：提交已阻断（fail-closed）：' + cfgG.error }
          const config = cfgG.config
          const protectedPaths = (config && Array.isArray(config.protected_paths)) ? config.protected_paths : []
          const isProtected = (f) => protectedPaths.some((p) => f === p || f.indexOf(p + '/') === 0 || f.indexOf(p + '\\') === 0)
          const managed = (f) => f.indexOf('docs/ai_memory/') === 0 || f === '.baton' || f.indexOf('.baton/') === 0 || f === '.gitignore' || f === 'AGENTS.md' || f === 'CLAUDE.md' || f === '.cursorrules' || f === '.cursor/rules/baton.mdc' || /^(\.agents|\.claude|\.cursor)\/skills\/baton\//.test(f)
          const allowed = (args.allowed_files || '').split(',').map((s) => s.trim()).filter((s) => s !== '')
          // Contract 预锁同款：预锁范围外的改动必须 user: 豁免，封死 commit_all 绕过 closeout 门禁
          const tasksDoc = await readJsonAt(rootPath, 'docs/ai_memory/state/tasks.json', { tasks: [] })
          const stateDoc = await readJsonAt(rootPath, 'docs/ai_memory/state/project_state.json', {})
          const currentTask = (tasksDoc.tasks || []).find((t) => t.id === tasksDoc.current_task_id)
          const contractLock = (stateDoc && stateDoc.contract && stateDoc.contract.task_id === tasksDoc.current_task_id && Array.isArray(stateDoc.contract.allowed_paths)) ? stateDoc.contract.allowed_paths : null
          const preLock = (contractLock !== null && contractLock.length > 0)
            ? contractLock.map((p) => String(p).replace(/\\/g, '/')).filter((p) => p !== '')
            : ((currentTask && Array.isArray(currentTask.allowed_paths) && currentTask.allowed_paths.length > 0) ? currentTask.allowed_paths.map((p) => String(p).replace(/\\/g, '/')) : null)
          const userExempt = allowed.filter((a) => a.indexOf('user:') === 0).map((a) => a.slice(5))
          const allowedPlain = allowed.filter((a) => a.indexOf('user:') !== 0)
          const inPath = (f, a) => f === a || f.indexOf(a + '/') === 0 || f.indexOf(a + '\\') === 0
          const nonManaged = git.files_all.filter((f) => !managed(f))
          const inPreLock = (f) => preLock !== null && preLock.some((p) => inPath(f, p))
          const scopeViolations = nonManaged.filter((f) => !inPreLock(f) && !allowedPlain.concat(userExempt).some((a) => inPath(f, a)))
          const contractViolations = preLock !== null ? nonManaged.filter((f) => !inPreLock(f) && !userExempt.some((a) => inPath(f, a))) : []
          // protected 检查覆盖全部文件（含 Baton 管理域）：rename 进受保护目录同样阻断
          const protectedViolations = git.files_all.filter((f) => isProtected(f))
          if (scopeViolations.length > 0 || protectedViolations.length > 0) {
            return {
              ok: false, action, reason: '越界或受保护文件命中：提交已阻断（未提交任何内容）',
              scope_violations: scopeViolations, protected_violations: protectedViolations,
              next_step: '把 allowed_files 声明完整后重试；protected 文件必须移出本次提交范围',
            }
          }
          if (contractViolations.length > 0) {
            return {
              ok: false, action, reason: '超出任务预锁范围且未获用户豁免：提交已阻断（未提交任何内容）',
              pre_lock: preLock, contract_violations: contractViolations,
              next_step: '与用户确认越界改动后，在 allowed_files 中以 user:<路径> 声明用户豁免（禁止执行者自行加 user: 前缀）后重试',
            }
          }
          const isBoundary = (f) => f === '.baton/config.json' || f === 'AGENTS.md' || f === 'CLAUDE.md' || f === '.cursorrules' || f === '.cursor/rules/baton.mdc' || f === '.gitignore' || /^(\.agents|\.claude|\.cursor)\/skills\/baton\//.test(f)
          const boundaryViolations = git.files_all.filter((f) => isBoundary(f) && !userExempt.some((a) => inPath(f, a)))
          if (boundaryViolations.length > 0) {
            return {
              ok: false, action, reason: '规则/边界文件被改动且未获用户豁免：提交已阻断（未提交任何内容）',
              boundary_violations: boundaryViolations,
              next_step: '与用户确认边界文件改动后，在 allowed_files 中以 user:<路径> 声明用户豁免（禁止执行者自行豁免）后重试',
            }
          }
          const ownGate = await ownershipGuard(rootPath)
          if (!ownGate.pass) return { ok: false, action, reason: '未持有单写入者锁：提交已阻断：' + ownGate.reason }
          // 待提交文件凭据扫描：真实待提交内容全量扫描，user: 豁免文件跳过
          const stagedHits = await stagedSecretScan(rootPath, git.files_all, userExempt)
          if (stagedHits.length > 0) {
            return {
              ok: false, action, reason: '待提交文件命中疑似凭据/敏感内容：提交已阻断（未提交任何内容）',
              secret_hits: stagedHits,
              next_step: '移除或移出本次提交范围后重试；确认安全需在 allowed_files 中以 user:<路径> 声明用户豁免',
            }
          }
          const exemptSecretHits = secretHits(userExempt.join('\n'))
          if (exemptSecretHits.length > 0) return { ok: false, action, reason: 'user: 路径疑似含敏感信息：拒绝发送授权请求', secret_hits: exemptSecretHits }
          if (userExempt.length > 0) {
            const grant = await approvalOnce('baton_git.commit_all', 'Baton 提交范围一次性豁免：' + userExempt.join(', '), exec)
            if (!grant.allowed) return { ok: false, action, reason: grant.reason, approval_outcome: grant.outcome, contract_violations: userExempt }
          }
          const msg = (args.message || 'baton: 自动提交 ' + todayLocal()).trim().replace(/[$`;&|<>]/g, ' ')
          const add = await sh('git add -A', rootPath)
          if (add.exitCode !== 0) return { ok: false, action, reason: 'git add 失败', err: add.err }
          const commit = await sh('git commit -m "' + msg.replace(/"/g, "'") + '"', rootPath)
          if (commit.exitCode !== 0) return { ok: false, action, reason: 'commit 失败', err: commit.err, out: commit.out }
          const g = await gitSnapshot(rootPath)
          return { ok: true, action, committed: true, git: gitView(g) }
        }
        return { ok: false, action, reason: '未知 action：' + action }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_verify_push',
      description: 'Baton：远端同步核验（纯只读，绝不写文件、绝不提交）。有远端时本工具自行 git ls-remote 或 gh api 实查真实远端 SHA 核验（伪造无效）；两通道均不可用则拒绝声明式 SHA（source/remote_sha 为调用方字符串，不构成证据）。无远端本地仓库时比较调用方提供的 SHA（需 source=local）。核验通过后用 baton_record_push 记账。',
      parameters: simple({ path: '项目根目录', remote_sha: '远端 SHA（无远端本地仓库时必填；有远端时仅作参考，以 ls-remote 实查为准）', source: 'SHA 来源：ls-remote | gh-api | local（可选，用于证据标注）' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const remoteSha = (args.remote_sha || '').trim()
        const source = (args.source || '').trim()
        const git = await gitSnapshot(rootPath)
        if (!safeBranchName(git.branch)) {
          return { ok: false, synced: false, message: '分支名含非法字符，拒绝核验（防命令注入）', local_head: git.head }
        }
        // 有远端（git remote 实列表，不用 tracking）→ 实查：本工具自行 ls-remote / gh api 取真实远端 SHA，调用方传什么 SHA 都不影响结论（伪造无效）
        const { target, url: remoteUrl, error: pushErr } = await resolvePushRemote(rootPath, git)
        if (pushErr !== null) return { ok: false, synced: false, message: '下班未完成：' + pushErr, local_head: git.head }
        if (target !== null && git.branch !== '') {
          // 通道 1：ls-remote 精确查询 refs/heads/<branch>（宽泛 ls-remote <branch> 会命中同名 tag 造成假成功）
          const lr = await sh('git ls-remote ' + target + ' refs/heads/' + git.branch, rootPath)
          if (lr.exitCode === 0) {
            const real = (lr.out || '').trim().split(/\s+/)[0] || ''
            if (real === '') return { ok: false, synced: false, real_remote_check: true, message: '下班未完成：ls-remote 无输出，无法核验', local_head: git.head }
            const synced = real === git.head && !git.dirty
            return {
              ok: synced, synced, read_only: true, real_remote_check: true, evidence: 'ls-remote',
              source_declared: source === '' ? null : source,
              diagnostics: synced ? null : {
                branch: git.branch, head: git.head, dirty: git.dirty, committed: null, pushed: real !== git.head,
                remote_sha: real, code_safe: !git.dirty,
                reason: real !== git.head ? '真实远端 SHA 与本地 HEAD 不一致：可能 push 未执行、push 到错误分支、或远端有他人提交' : '工作区有未提交改动：核验不通过（先收尾入库）',
              },
              message: synced ? '下班完成：真实远端 SHA == 本地 HEAD 且工作区干净（本工具自行 ls-remote 核验）' : (real !== git.head ? '下班未完成：真实远端 SHA 与本地不一致' : '下班未完成：工作区有未提交改动'),
              local_head: git.head, remote_sha: real,
              verification_receipt: synced ? issuePushReceipt(rootPath, git.branch, git.head, real, 'ls-remote') : null,
            }
          }
          // 通道 2：gh api 实查（GitHub 远端；ls-remote 受限时仍能取到真实 SHA）
          const ghSha = await githubRefSha(remoteUrl, git.branch, rootPath)
          if (ghSha !== null) {
            const syncedG = ghSha === git.head && !git.dirty
            return {
              ok: syncedG, synced: syncedG, read_only: true, real_remote_check: true, evidence: 'gh-api',
              source_declared: source === '' ? null : source,
              diagnostics: syncedG ? null : {
                branch: git.branch, head: git.head, dirty: git.dirty, committed: null, pushed: ghSha !== git.head,
                remote_sha: ghSha, code_safe: !git.dirty,
                reason: ghSha !== git.head ? '真实远端 SHA 与本地 HEAD 不一致：可能 push 未执行、push 到错误分支、或远端有他人提交' : '工作区有未提交改动：核验不通过（先收尾入库）',
              },
              message: syncedG ? '下班完成：真实远端 SHA == 本地 HEAD 且工作区干净（本工具自行 gh api 实查）' : (ghSha !== git.head ? '下班未完成：真实远端 SHA 与本地不一致（gh api）' : '下班未完成：工作区有未提交改动'),
              local_head: git.head, remote_sha: ghSha,
              verification_receipt: syncedG ? issuePushReceipt(rootPath, git.branch, git.head, ghSha, 'gh-api') : null,
            }
          }
          // 两通道均不可用：有远端但无工具自取证据 → 拒绝
          return { ok: false, synced: false, real_remote_check: false, message: '下班未完成：远端核验无实查证据（ls-remote 与 gh api 均不可用），拒绝声明式 SHA。请在具备远端访问的环境中执行核验，或由主会话用 pwsh 执行 ls-remote 后把真实 SHA 写入交接并明示「弱核验·主会话实查」' }
        }
        // 无远端（本地仓库）：调用方 SHA 机械比对 + source=local 语义；同样要求工作区干净
        if (remoteSha === '') {
          return { ok: false, synced: false, message: '下班未完成：缺少远端 SHA，无法核验', local_head: git.head }
        }
        const synced = remoteSha === git.head && !git.dirty
        const diagnostics = synced ? null : {
          branch: git.branch,
          head: git.head,
          dirty: git.dirty,
          committed: null,
          pushed: false,
          remote_sha: remoteSha,
          code_safe: !git.dirty,
          reason: remoteSha !== git.head ? '远端 SHA 与本地 HEAD 不一致：可能 push 未执行、push 到错误分支、或远端有他人提交' : '工作区有未提交改动：核验不通过',
        }
        return {
          ok: synced,
          synced,
          read_only: true,
          real_remote_check: false,
          source_declared: source === '' ? null : source,
          diagnostics,
          message: synced
            ? '下班完成：远端 SHA == 本地 HEAD 且工作区干净（本地仓库无远端，SHA 由调用方提供）' + (source !== 'local' ? ' ｜ 提醒：本地仓库请显式传 source=local' : '')
            : (remoteSha !== git.head ? '下班未完成：远端 SHA 与本地不一致' : '下班未完成：工作区有未提交改动'),
          local_head: git.head,
          remote_sha: remoteSha,
        }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_record_push',
      description: 'Baton：远端发布记账：verify_push 核验通过后调用，把真实远端 SHA 写入本机验收凭证 .baton/local/push-verified.json（gitignore）。同进程时自动复用 verify_push 签发且绑定项目/分支/HEAD/SHA 的短期回执，避免重复远端查询；回执缺失、过期或不匹配时仍用 ls-remote / gh api 重新实查，绝不降级为声明式记账。无远端本地仓库时要求 SHA==本地 HEAD（本地语义）。',
      parameters: simple({ path: '项目根目录', remote_sha: 'verify_push 核验通过的远端 SHA（必填）', source: 'SHA 来源：ls-remote | gh-api | local（可选）', verification_receipt: 'verify_push 返回的短期核验回执；仅供宿主自动传递，用户无需填写' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const remoteSha = (args.remote_sha || '').trim()
        const source = (args.source || '').trim()
        if (!/^[0-9a-f]{40}$/i.test(remoteSha)) return { ok: false, reason: 'remote_sha 必须是 40 位十六进制 SHA' }
        const git = await gitSnapshot(rootPath)
        if (!safeBranchName(git.branch)) return { ok: false, reason: '分支名含非法字符，拒绝记账（防命令注入）' }
        if (git.dirty) return { ok: false, reason: '工作区有未提交改动，拒绝记账（先收尾入库）' }
        const existingMarker = await readJsonAt(rootPath, '.baton/local/push-verified.json', null)
        if (existingMarker !== null && existingMarker !== undefined && existingMarker.strong === true && existingMarker.real_check === true && existingMarker.remote_sha === remoteSha && existingMarker.local_head === git.head && existingMarker.branch === git.branch) {
          return { ok: true, remote_sha: remoteSha, push_state: 'verified', real_check: true, evidence: existingMarker.source || null, strong: true, cross_machine: true, record_committed: false, idempotent: true, note: '同一 HEAD 已有强核验凭证：记账幂等完成，未重复查询远端、未产生 tracked 改动' }
        }
        const { target, url: remoteUrl, error: pushErr } = await resolvePushRemote(rootPath, git)
        if (pushErr !== null) return { ok: false, reason: pushErr }
        let realCheck = false
        let evidence = null
        const receiptToken = String(args.verification_receipt || '').trim()
        const receipt = receiptToken === '' ? null : verifiedPushReceipts.get(receiptToken)
        const receiptValid = receipt !== null && receipt !== undefined && Date.now() - receipt.issued_at_ms <= 10 * 60 * 1000 && receipt.root_path === rootPath && receipt.branch === git.branch && receipt.local_head === git.head && receipt.remote_sha === remoteSha && (receipt.evidence === 'ls-remote' || receipt.evidence === 'gh-api')
        if (target !== null && git.branch !== '' && receiptValid) {
          realCheck = true
          evidence = receipt.evidence
        } else if (target !== null && git.branch !== '') {
          // 有远端 → 实查绑定：远端必须 == 本地 HEAD == 传入 SHA，任一不符拒绝（伪造 verified 无效）
          const lr = await sh('git ls-remote ' + target + ' refs/heads/' + git.branch, rootPath)
          if (lr.exitCode === 0) {
            realCheck = true
            evidence = 'ls-remote'
            const real = (lr.out || '').trim().split(/\s+/)[0] || ''
            if (real === '' || real !== remoteSha) return { ok: false, reason: '远端实际 SHA 与传入 SHA 不一致，拒绝记账（防止伪造 verified）', remote_actual: real || null }
            if (real !== git.head) return { ok: false, reason: '远端 SHA 与本地 HEAD 不一致（本地有未推送提交），拒绝记账', remote_actual: real, local_head: git.head }
          } else {
            // 通道 2：gh api 实查（GitHub 远端）
            const ghSha = await githubRefSha(remoteUrl, git.branch, rootPath)
            if (ghSha !== null) {
              realCheck = true
              evidence = 'gh-api'
              if (ghSha !== remoteSha) return { ok: false, reason: '远端实际 SHA（gh api）与传入 SHA 不一致，拒绝记账（防止伪造 verified）', remote_actual: ghSha }
              if (ghSha !== git.head) return { ok: false, reason: '远端 SHA 与本地 HEAD 不一致（本地有未推送提交），拒绝记账', remote_actual: ghSha, local_head: git.head }
            } else {
              // 两通道均不可用：有远端但无工具自取证据 → 拒绝（声明式 SHA 可伪造，不设弱记账路径）
              return { ok: false, reason: '远端核验无实查证据（ls-remote 与 gh api 均不可用），拒绝记账。请在具备远端访问的环境中完成核验后再记账' }
            }
          }
        } else {
          if (remoteSha !== git.head) return { ok: false, reason: '本地仓库无远端：传入 SHA 必须等于本地 HEAD，拒绝记账' }
        }
        // 验收凭证写本机 gitignore 目录（不进 Git、不脏工作区、不产生 tracked commit）：
        // 远端仓库本身就是跨机真相——closeout 的发布声明（repository.remote_sha）随 push 到达远端后，
        // 新 clone 通过「remote_sha 是否为本地 HEAD 的祖先」判定发布声明已兑现，无需本机 marker。
        const marker = { remote_sha: remoteSha, local_head: git.head, branch: git.branch, verified_at: nowIso(), source: realCheck ? evidence : 'local', real_check: realCheck, strong: realCheck }
        await writeTextAt(rootPath, '.baton/local/push-verified.json', JSON.stringify(marker, null, 2))
        return { ok: true, remote_sha: remoteSha, push_state: 'verified', real_check: realCheck, evidence, strong: realCheck, cross_machine: true, record_committed: false, note: '验收凭证已写入本机 .baton/local/push-verified.json（不进 Git）。记账不产生任何 tracked 改动：本地 HEAD 与远端保持相等；跨电脑 clone 后以「发布声明 SHA 已在远端历史（HEAD 祖先）」识别已发布（远端仓库即真相）' + (realCheck ? '（实查证据：' + evidence + '）' : '（本地仓库语义，无远端可比对）') }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_resume',
      description: 'Baton：「继续工作」：跨会话恢复——git 快照 + 当前工作 + 交接末条 + 未完成任务 + 历史索引最近条目 + 下一步。只读。',
      parameters: simple({ path: '项目根目录' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const git = await gitSnapshot(rootPath)
        const current = (await readTextAt(rootPath, await docRole(rootPath, 'current'))) || ''
        const handoff = (await readTextAt(rootPath, await docRole(rootPath, 'handoff'))) || ''
        const tasks = await readJsonAt(rootPath, 'docs/ai_memory/state/tasks.json', { tasks: [] })
        const open = (tasks.tasks || []).filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
        const index = await readJsonAt(rootPath, 'docs/ai_memory/state/archive_index.json', { entries: [] })
        const recent = (index.entries || []).slice(-3).map((e) => ({ title: e.title, type: e.document_type, date: e.updated_at, path: e.path }))
        return {
          ok: true,
          branch: git.branch,
          head: git.head,
          dirty: git.dirty,
          current_summary: currentFacts(current),
          handoff_tail: handoffTailOf(handoff).slice(0, 1000),
          open_tasks: open.map((t) => ({ id: t.id, title: t.title, status: t.status, next_step: t.next_step || null })),
          recent_memory: recent,
          sync_hint: git.tracking !== null ? '需同步远端时用 pwsh 执行：git fetch origin --prune（分叉则停止）' : null,
          read_only: true,
        }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_clock_in',
      description: 'Baton：「上班啦」机械动作：插件自身先 fetch-before-lock，再做 git 三查 → 读交接/待办 → 生成任务表。调用者提供的裸 SHA 不能证明 fetch 新鲜度，fetched_remote_sha 已 fail-closed；插件 fetch 失败时保持只读。',
      parameters: simple({ path: '项目根目录', fetched_remote_sha: '已弃用：裸 SHA 不能证明外层 fetch 新鲜度，传入即拒绝' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const git = await gitSnapshot(rootPath)
        const tasks = await readJsonAt(rootPath, 'docs/ai_memory/state/tasks.json', { tasks: [] })
        // 编号一致性：任务表只给「可选」任务编号（与 baton_select 的候选集完全一致）；
        // 待验收任务单列展示、不占编号，杜绝显示编号与选择编号错位。
        const selectable = (tasks.tasks || []).filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'awaiting_acceptance')
        const awaiting = (tasks.tasks || []).filter((t) => t.status === 'awaiting_acceptance')
        const current = (await readTextAt(rootPath, await docRole(rootPath, 'current'))) || ''
        const handoff = (await readTextAt(rootPath, await docRole(rootPath, 'handoff'))) || ''
        const state = await readJsonAt(rootPath, 'docs/ai_memory/state/project_state.json', {})
        const ownership = state.ownership || {}
        const handoffTailFull = handoffTailOf(handoff)
        const statusMatch = /交接状态：([^\n｜]+)/.exec(handoffTailFull)
        const lastHandoffStatus = statusMatch ? statusMatch[1].trim() : null
        // 门禁机械核对（SKILL 上班啦第 2 条）：交接记录的分支/HEAD 与当前 git 不一致 → 只读并报告。
        // HEAD 判定用祖先关系而非相等：交接 HEAD 是收尾提交前的基线，后续正常提交（含发布记录）都在其后，属一致；
        // 只有被 reset/rebase/换分支改写时才判定为分歧。
        const bhMatch = /分支\s*\/\s*(?:基线\s*)?HEAD：([^\n]+)/.exec(handoffTailFull)
        let handoffBranch = null
        let handoffHead = null
        if (bhMatch) {
          const parts = bhMatch[1].trim().split(/\s*\/\s*/)
          handoffBranch = (parts[0] || '').trim() || null
          handoffHead = (parts[1] || '').trim() || null
        }
        let handoffDiverged = false
        if (handoffHead !== null && handoffHead !== '' && git.head !== '' && handoffHead !== git.head) {
          // 注入防护：交接 HEAD 只接受纯 40 位十六进制 SHA，否则不执行命令并视为分歧（只读门禁）
          if (/^[0-9a-f]{40}$/i.test(handoffHead)) {
            const anc = await sh('git merge-base --is-ancestor ' + handoffHead + ' ' + git.head, rootPath)
            handoffDiverged = anc.exitCode !== 0
          } else {
            handoffDiverged = true
          }
        }
        const branchMismatch = handoffBranch !== null && handoffBranch !== '' && handoffBranch !== git.branch
        // fetch-before-lock：抢锁前必须观测到远端最新 tip——
        // 本地 remote-tracking 陈旧会让 behind 误判为零而抢锁写 state（分裂脑）。
        // fetch 失败（网络受限/无凭据/远端不可达）→ 零写零锁 fail-closed。
        // 裸 SHA 无法证明本轮 fetch，新版不再提供“外层 fetch + SHA 回传”旁路。
        // 指向开源发布仓库的 remote 跳过 fetch（禁推守卫只警告、不触网）。
        let fetchError = null
        let fetchTarget = null
        const fetchedRemoteSha = String(args.fetched_remote_sha || '').trim()
        let freshRemoteTracking = false
        if (git.remotes.length > 0) {
          const cfgPre = await loadConfig(rootPath)
          const blockedPre = blockedRemoteList(cfgPre)
          // 优先 fetch 当前 upstream 所属 remote，保证随后 @{u} SHA 就是本次网络观察的结果；
          // 其余 remote 仅在当前分支未设 upstream 时作为兼容回退。
          const trackingRemote = git.tracking !== null && git.tracking.indexOf('/') > 0 ? git.tracking.slice(0, git.tracking.indexOf('/')) : null
          const remoteCandidates = trackingRemote !== null ? [trackingRemote].concat(git.remotes.filter((r) => r !== trackingRemote)) : git.remotes
          for (const r of remoteCandidates) {
            if (!/^[A-Za-z0-9._-]{1,100}$/.test(r)) continue
            const gu = await sh('git remote get-url ' + r, rootPath)
            if (gu.exitCode === 0 && blockedPre.indexOf(normalizeRemoteUrl(gu.out)) !== -1) continue
            fetchTarget = r
            break
          }
        }
        if (fetchedRemoteSha !== '') {
          fetchError = 'fetched_remote_sha 已弃用：SHA 相等只证明 tracking 当前值，不能证明本轮真实 fetch、远端/分支/session 绑定或新鲜度；保持只读且不抢锁'
        }
        if (fetchTarget !== null && fetchError === null) {
          const f = await sh('git fetch ' + fetchTarget + ' --prune', rootPath)
          if (f.exitCode !== 0) {
            fetchError = 'git fetch ' + fetchTarget + ' 失败：' + String((f.err || f.out || '').trim().slice(0, 120)) + '。保持只读；修复插件所在 DSH 会话的网络/凭据后再重试 clock_in。无插件宿主应自行完成完整 fetch + tracking/ahead/behind 核验，不向插件回传裸 SHA'
          } else {
            freshRemoteTracking = true
          }
        }
        if (fetchError !== null) {
          return { ok: false, sync_blocked: true, ownership_conflict: false, behind_remote: null, fetch_error: fetchError, sync_hint: 'fetch 成功前保持只读（未抢锁、未写 state）；DSH 插件需恢复本轮网络/凭据后重试，无插件宿主自行完成完整 Git 事实流程' }
        }
        // fetch 成功后重算 ahead/behind（基于新鲜 remote-tracking，而非调用前的陈旧快照）
        if (fetchTarget !== null && git.tracking !== null) {
          const cnt = await sh('git rev-list --left-right --count HEAD...@{u}', rootPath)
          if (cnt.exitCode === 0) {
            const parts = cnt.out.trim().split(/\s+/)
            git.ahead = Number(parts[0])
            git.behind = Number(parts[1])
          }
        }
        // 本地落后于远端（behind>0）时禁止抢锁写 tracked state——
        // 先按 sync_hint 同步，同步后重跑 clock_in；落后工作副本只读报告，不制造 dirty 冲突。
        const behindRemote = git.behind !== null && git.behind > 0
        // 无法归属的 dirty 文件禁止认领。Baton 生命周期自身写入的管理域文件可在 release/重试后继续，
        // 业务代码、未知文件及其它非管理域改动必须先由用户确认归属，避免把上一代理或用户的工作据为本会话所有。
        const isClockInManaged = (f) => f.indexOf('docs/ai_memory/') === 0 || f === '.baton' || f.indexOf('.baton/') === 0 || f === '.gitignore' || f === 'AGENTS.md' || f === 'CLAUDE.md' || f === '.cursorrules' || f === '.cursor/rules/baton.mdc' || /^(\.agents|\.claude|\.cursor)\/skills\/baton\//.test(f)
        const unownedDirtyFiles = git.files_all.filter((f) => !isClockInManaged(f))
        const unownedDirty = unownedDirtyFiles.length > 0
        const ownershipConflict = ownership.logical_state === 'holding' || unownedDirty || behindRemote || (lastHandoffStatus !== null && (lastHandoffStatus.indexOf('持有中') !== -1 || lastHandoffStatus.indexOf('检查点') !== -1)) || handoffDiverged || branchMismatch
        // 单写入者锁：git update-ref 旧值 CAS 抢占 refs/baton/ownership-lock——
        // 旧值=40 个零 = 「ref 必须不存在」，内核级原子比较交换，并发双开恰好一个胜者（不再依赖 60ms 回读窗口）。
        const lockRef = 'refs/baton/ownership-lock'
        const lockInfoPath = '.baton/local/ownership-lock.json'
        const lockZero = '0000000000000000000000000000000000000000'
        let claimed = false
        if (!ownershipConflict) {
          const w = currentSession()
          const writer = (w !== undefined && w !== null && w.id !== undefined) ? String(w.id) : 'baton-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
          const heldAt = nowIso()
          const cas = await sh('git update-ref ' + lockRef + ' ' + git.head + ' ' + lockZero, rootPath)
          let lockMine = cas.exitCode === 0
          if (!lockMine) {
            // ref 已存在：读锁信息判断是否本会话持有（同会话重复上班视为已持有）
            const lockInfo = await readJsonAt(rootPath, lockInfoPath, null)
            lockMine = lockInfo !== null && lockInfo !== undefined && lockInfo.writer === writer
          }
          if (lockMine) {
            await writeTextAt(rootPath, lockInfoPath, JSON.stringify({ writer, held_at: heldAt, branch: git.branch }, null, 2))
            const st = await assertJsonHealthy(rootPath, 'docs/ai_memory/state/project_state.json', {})
            const myRev = (st.revision || 0) + 1
            st.ownership = { writer, logical_state: 'holding', held_at: heldAt }
            st.revision = myRev
            st.updated_at = heldAt
            await writeTextRetry(rootPath, 'docs/ai_memory/state/project_state.json', JSON.stringify(st, null, 2))
            claimed = true
            // 返回的 ownership 反映持有后状态
            ownership.writer = writer
            ownership.logical_state = 'holding'
            ownership.held_at = heldAt
          }
        }
        // 抢占失败同样按冲突报告（与门禁冲突同一口径）
        const claimRace = !ownershipConflict && !claimed
        const table = selectable.map((t, i) => ({
          id: i + 1,
          task_id: t.id,
          action: t.next_step || t.title,
          note: t.phase || '',
          suggestion: t.risk_level || 'normal',
          command: String(i + 1),
        }))
        const verifiedMarker = await readJsonAt(rootPath, '.baton/local/push-verified.json', null)
        // pending 只允许真实远端 receipt 清除：
        // ① push_state === 'verified'（baton_verify_push + record_push 实查后的记账）；
        // ② 本工具完成 fetch 后，以本次新鲜 upstream tracking tip == 本地 HEAD 为网络回执；
        //    不再对同一远端追加 ls-remote（本地陈旧 tracking 不算数，必须 freshRemoteTracking=true）；
        // ③ 本机验收凭证 local_head == 当前 HEAD。
        let liveReceipt = false
        if (state.repository !== undefined && state.repository !== null && state.repository.push_state === 'pending' && freshRemoteTracking && git.tracking !== null) {
          const trackingTip = await sh('git rev-parse @{u}', rootPath)
          liveReceipt = trackingTip.exitCode === 0 && trackingTip.out.trim() !== '' && trackingTip.out.trim() === git.head
        }
        const pushStateVerified = state.repository !== undefined && state.repository !== null && state.repository.push_state === 'verified'
        const markerOkLocal = verifiedMarker !== null && verifiedMarker !== undefined && String(verifiedMarker.local_head || '') === git.head
        const pendingPush = state.repository !== undefined && state.repository !== null && state.repository.push_state === 'pending' && !pushStateVerified && !liveReceipt && !markerOkLocal
        // 远端合规预警：任一 remote 指向开源发布仓库 → 上班即警告（下班会硬阻断，不写不提交）
        let pushBlockedWarning = null
        if (git.remotes.length > 0) {
          const cfg = await loadConfig(rootPath)
          const blocked = blockedRemoteList(cfg)
          for (const r of git.remotes) {
            if (!/^[A-Za-z0-9._-]{1,100}$/.test(r)) continue
            const gu = await sh('git remote get-url ' + r, rootPath)
            if (gu.exitCode === 0 && blocked.indexOf(normalizeRemoteUrl(gu.out)) !== -1) {
              pushBlockedWarning = '远端 ' + r + ' 指向 Baton 开源发布仓库（' + normalizeRemoteUrl(gu.out) + '），「下班啦」推送将被硬阻断；请把该 remote 改指你自己的仓库或本地仓库'
              break
            }
          }
        }
        // 版本闭环：读本机版本锚，纯本地判断检查时效（网络实查由主会话 pwsh 执行）
        const versionAnchor = await readJsonAt(rootPath, '.baton/version.json', null)
        let versionInfo = null
        if (versionAnchor !== null && versionAnchor !== undefined) {
          const cfgUpd = await loadConfig(rootPath)
          const intervalDays = (cfgUpd !== null && cfgUpd !== undefined && cfgUpd.update !== undefined && typeof cfgUpd.update.check_interval_days === 'number') ? cfgUpd.update.check_interval_days : 7
          const last = versionAnchor.last_check_at || null
          let days = null
          if (last !== null) {
            const t = Date.parse(last)
            if (!Number.isNaN(t)) days = Math.floor((Date.now() - t) / 86400000)
          }
          const stale = days === null || days > intervalDays
          versionInfo = {
            version: versionAnchor.version || null,
            source: versionAnchor.source || null,
            installed_at: versionAnchor.installed_at || null,
            last_check_at: last,
            days_since_check: days,
            check_hint: stale ? '距上次检查更新：' + (days === null ? '从未检查' : days + ' 天（阈值 ' + intervalDays + ' 天）') + '，可说「检查更新」实查远端版本' : null,
          }
        }
        return {
          ok: true,
          branch: git.branch,
          head: git.head,
          dirty: git.dirty,
          git: gitView(git),
          push_blocked_warning: pushBlockedWarning,
          ownership: {
            writer: ownership.writer || null,
            logical_state: ownership.logical_state || 'unknown',
            last_handoff_status: lastHandoffStatus,
            handoff_branch: handoffBranch,
            handoff_head: handoffHead,
            handoff_diverged: handoffDiverged,
            branch_mismatch: branchMismatch,
          },
          ownership_claimed: claimed,
          ownership_conflict: ownershipConflict || claimRace,
          unowned_dirty_files: unownedDirtyFiles,
          claim_race: claimRace,
          pending_push: pendingPush,
          fetch_evidence: fetchTarget !== null ? 'plugin-fetch' : 'no-fetch-target',
          version_info: versionInfo,
          current_task: tasks.current_task_id ? { task_id: tasks.current_task_id, active_work: tasks.active_work || null } : null,
          behind_remote: behindRemote,
          sync_hint: behindRemote
            ? '本地落后于远端：先执行同步再重新「上班啦」——用 pwsh 执行 git fetch origin --prune，本地落后且无分叉时 git merge --ff-only；同步完成前保持只读（未抢锁、未写 state）'
            : (git.tracking !== null
              ? (git.dirty
                ? '工作区有未提交改动：先检查这些改动是否属于当前任务；如需同步远端，先让改动入库或确认可安全 fetch。git fetch origin --prune 本身安全，但 merge --ff-only 在 dirty 时可能失败'
                : '需同步远端时用 pwsh 执行：git fetch origin --prune（分叉则停止）')
              : null),
          current_summary: currentFacts(current),
          handoff_tail: handoffTailFull.slice(0, 800),
          task_table: table,
          awaiting_tasks: awaiting.map((t) => ({ id: t.id, title: t.title, next_step: t.next_step || null })),
          no_task: table.length === 0 && awaiting.length === 0,
        }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_release',
      description: 'Baton：「释放工作区」：用户确认上一执行者已停止后解除持有锁（ownership → released）并写交接释放条目；用于解除 clock_in 的持有门禁。',
      parameters: simple({ path: '项目根目录', reason: '释放原因（写入交接，可选）' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        // 释放原因写前扫描：reason 会写入 Git 交接文档，凭据绝不进入
        const releaseReason = (args.reason || '').trim()
        const reasonHits = secretHits(releaseReason)
        if (reasonHits.length > 0) {
          return { ok: false, reason: '释放原因疑似含敏感信息（' + reasonHits.join('、') + '）：拒绝写入交接（凭据绝不进入 Git 跟踪文档）', secret_hits: reasonHits }
        }
        // release 必须校验锁所有权——无条件删除他人 ref 破坏单写入者。
        // 持有者 = state.ownership.writer 或锁信息 writer；本会话持有或无人持有（可接手态）才允许释放。
        // 锁 ref 存在且持有者非空时，无宿主 session 身份 → fail-closed 拒绝释放。
        const wRel = currentSession()
        const myWriter = (wRel !== undefined && wRel !== null && wRel.id !== undefined) ? String(wRel.id) : null
        const lockInfo = await readJsonAt(rootPath, '.baton/local/ownership-lock.json', null)
        const stPre = await readJsonAt(rootPath, 'docs/ai_memory/state/project_state.json', {})
        const holderWriter = stPre !== null && stPre !== undefined && stPre.ownership ? String(stPre.ownership.writer || '') : ''
        const lockWriter = lockInfo !== null && lockInfo !== undefined ? String(lockInfo.writer || '') : ''
        const lockRefExists = (await sh('git show-ref refs/baton/ownership-lock', rootPath)).exitCode === 0
        const heldBySomeone = lockRefExists && holderWriter !== '' && holderWriter !== 'null'
        // clock_out 已提交 released、但 ref 删除失败属于已知可恢复态：ref 仍阻断新会话，
        // holder=baton 且 local writer 非空时允许本工具继续完成同一释放，不把它当作任意他人锁。
        const recoverableCloseoutRelease = lockRefExists && stPre !== null && stPre !== undefined && stPre.ownership && stPre.ownership.logical_state === 'released' && holderWriter === 'baton' && myWriter !== null && lockWriter === myWriter
        const owned = (!lockRefExists) || recoverableCloseoutRelease || (myWriter !== null && (holderWriter === '' || holderWriter === 'null' || holderWriter === myWriter || lockWriter === myWriter))
        if (!owned) {
          if (heldBySomeone && myWriter === null) {
            return { ok: false, reason: '无法确认本会话身份（宿主未提供 session）：锁 ref 存在且持有者非空，拒绝释放（fail-closed）。请在能提供会话身份的宿主中执行，或由用户明确说明「异常接手，我确认上一位代理已经停止」后由主会话人工处理', previous_state: stPre && stPre.ownership ? stPre.ownership.logical_state : 'unknown' }
          }
          return { ok: false, reason: '锁不属于本会话（holder=' + holderWriter.slice(0, 20) + '）：拒绝释放。异常接手场景：请用户明确说明「异常接手，我确认上一位代理已经停止」后再释放', previous_state: stPre && stPre.ownership ? stPre.ownership.logical_state : 'unknown' }
        }
        if (!lockRefExists && stPre !== null && stPre !== undefined && stPre.ownership && stPre.ownership.logical_state === 'released') {
          await tombstoneOwnershipLock(rootPath)
          return { ok: true, previous_state: 'released', released: true, idempotent: true, note: '工作区已释放，无需重复写入 state 或交接。' }
        }
        const refRelease = await releaseOwnershipRef(rootPath)
        if (!refRelease.ok) {
          return { ok: false, released: false, release_incomplete: true, previous_state: stPre && stPre.ownership ? stPre.ownership.logical_state : 'unknown', reason: refRelease.reason }
        }
        if (recoverableCloseoutRelease) {
          await tombstoneOwnershipLock(rootPath)
          return { ok: true, previous_state: 'released', released: true, recovered_closeout: true, note: '已完成上次 closeout 遗留的原子锁释放；tracked state 与交接无需重复写入。' }
        }
        const st = await assertJsonHealthy(rootPath, 'docs/ai_memory/state/project_state.json', {})
        const was = st.ownership ? st.ownership.logical_state : 'unknown'
        st.ownership = { writer: null, logical_state: 'released', released_at: nowIso() }
        st.revision = (st.revision || 0) + 1
        st.updated_at = nowIso()
        await writeTextAt(rootPath, 'docs/ai_memory/state/project_state.json', JSON.stringify(st, null, 2))
        await tombstoneOwnershipLock(rootPath)
        await appendHandoffEntry(rootPath,
          '### ' + hoId(agentLabel(args)) + '｜释放工作区\n- 时间：' + east8Stamp().display + '\n- 交接状态：已释放\n- 原因：' + ((args.reason || '').trim() || '用户确认上一执行者已停止') + '\n',
          '释放工作区｜' + todayLocal(), agentLabel(args))
        return { ok: true, previous_state: was, released: true, note: '持有锁已解除；下次「上班啦」可正常接手。释放条目未 commit（随下次收尾入库）' }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_select',
      description: 'Baton：「数字确认」持久化闭环：选择任务并建立 FROZEN/BOUNDED/OPEN 契约。FROZEN/BOUNDED 必须预锁 allowed_paths；OPEN 与 Lean 例外必须由 DSH ctx.approval 当次一次性授权。',
      parameters: simple({ path: '项目根目录', number: '任务表编号（clock_in 返回的 1 起始编号）', contract_level: '必填：FROZEN | BOUNDED | OPEN', allowed_paths: 'FROZEN/BOUNDED 必填：本任务允许改动的相对路径前缀，逗号分隔', open_reason: 'OPEN 必填：需要开放契约的具体原因', task_type: '任务类型（可选，由 AI 自动判断）：micro | bounded | complex | architecture | high_risk | review', implementation_policy: 'Lean Gate 策略（可选显式覆盖）：off | lite | full | strict；省略时按任务类型自动选择', reuse_candidates: '复用搜索结果，逗号分隔（full/strict 必填：已查到的可复用 helper/模式）', native_candidates: 'stdlib/native/已装依赖检查结果，逗号分隔（full/strict 必填）', minimum_check: '最小实现检查 test/evidence id（full/strict 必填）', dependency_budget: '新增依赖预算（可选自然数；strict 超限阻断）', new_file_budget: '新增文件预算（可选自然数；strict 超限阻断）', abstraction_budget: '新增抽象预算（可选自然数；strict 超限阻断）', lean_exceptions: '需宿主一次性授权的精确例外 JSON 数组（可选）：[{"kind":"dependency|new_file|abstraction","match":"名称或路径"}]' }),
      output: output(),
      async execute(args, exec) {
        const rootPath = await rootOf(args)
        const num = Number(args.number)
        if (!Number.isInteger(num) || num < 1) return { ok: false, reason: 'number 必须是正整数（任务表编号）' }
        const contractLevel = String(args.contract_level || '').trim().toUpperCase()
        if (['FROZEN', 'BOUNDED', 'OPEN'].indexOf(contractLevel) === -1) return { ok: false, reason: 'contract_level 必填，只允许 FROZEN|BOUNDED|OPEN；禁止默认推断契约范围' }
        const openReason = String(args.open_reason || '').trim()
        const selectSecretHits = secretHits(openReason + '\n' + String(args.lean_exceptions || ''))
        if (selectSecretHits.length > 0) return { ok: false, reason: 'Contract/Lean 参数疑似含敏感信息（' + selectSecretHits.join('、') + '）：拒绝写入或发送授权审计', secret_hits: selectSecretHits }
        const allowedPaths = (args.allowed_paths || '').split(',').map((s) => s.trim().replace(/\\/g, '/')).filter((s) => s !== '')
        // 路径字符集放宽：允许中文/空格等合法项目路径，仅禁止 .. 段、绝对路径与控制字符；尾部 / 归一化
        const badPath = (p) => p.indexOf('..') !== -1 || /^[A-Za-z]:/.test(p) || p.indexOf('/') === 0 || /[\u0000-\u001f]/.test(p)
        if (allowedPaths.some(badPath)) return { ok: false, reason: 'allowed_paths 只允许相对路径前缀（可含中文/空格；禁止 ..、绝对路径与控制字符）' }
        const normPaths = allowedPaths.map((p) => p.replace(/\/+$/, ''))
        if (contractLevel !== 'OPEN' && normPaths.length === 0) return { ok: false, reason: contractLevel + ' 契约必须提供非空 allowed_paths' }
        if (contractLevel === 'OPEN' && openReason === '') return { ok: false, reason: 'OPEN 契约必须提供非空 open_reason，并取得宿主一次性授权' }
        return opEnvelope(rootPath, 'select:' + num + ':' + contractLevel + ':' + normPaths.join('|').slice(0, 80), async () => {
          const ownGate = await ownershipGuard(rootPath)
        if (!ownGate.pass) return { ok: false, reason: '未持有单写入者锁：' + ownGate.reason }
        const tasks = await assertJsonHealthy(rootPath, 'docs/ai_memory/state/tasks.json', { tasks: [] })
        const open = (tasks.tasks || []).filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'awaiting_acceptance')
        const task = open[num - 1]
        if (task === undefined) return { ok: false, reason: '编号越界：当前开放任务 ' + open.length + ' 个', available: open.map((t, i) => ({ number: i + 1, task_id: t.id, title: t.title })) }
        if (task.status !== 'in_progress') task.status = 'in_progress'
        task.phase = '进行中'
        task.updated_at = nowIso()
        if (normPaths.length > 0) task.allowed_paths = normPaths
        // Lean Gate 策略：用户不需要选择内部档位。省略时按 AI 判定的任务类型自动采用：
        // micro/review=off，普通 bounded=lite，complex/architecture/high_risk=full；strict 仅显式启用。
        const policy = (args.implementation_policy || '').trim()
        if (policy !== '') {
          if (['off', 'lite', 'full', 'strict'].indexOf(policy) === -1) return { ok: false, reason: 'implementation_policy 只允许 off|lite|full|strict' }
        }
        const taskTypeRaw = (args.task_type || task.task_type || task.risk_level || 'bounded').trim().toLowerCase().replace(/-/g, '_')
        const taskType = ['micro', 'bounded', 'complex', 'architecture', 'high_risk', 'review'].indexOf(taskTypeRaw) !== -1 ? taskTypeRaw : 'bounded'
        const automaticPolicy = (taskType === 'complex' || taskType === 'architecture' || taskType === 'high_risk') ? 'full' : (taskType === 'bounded' ? 'lite' : 'off')
        // Lean Gate 契约：预算/证据字段机械校验（select 时 fail-closed，不写任何状态）
        const parseBudget = (v) => {
          const s = (v === undefined || v === null ? '' : String(v)).trim()
          if (s === '') return undefined
          if (!/^\d+$/.test(s)) return 'bad'
          return Number(s)
        }
        const depBudget = parseBudget(args.dependency_budget)
        const fileBudget = parseBudget(args.new_file_budget)
        const absBudget = parseBudget(args.abstraction_budget)
        if (depBudget === 'bad' || fileBudget === 'bad' || absBudget === 'bad') return { ok: false, reason: 'Lean 预算必须是自然数或留空（dependency_budget/new_file_budget/abstraction_budget）' }
        const effPolicy = policy === '' ? automaticPolicy : policy
        const reuse = (args.reuse_candidates || '').split(',').map((s) => s.trim()).filter((s) => s !== '')
        const native = (args.native_candidates || '').split(',').map((s) => s.trim()).filter((s) => s !== '')
        const minCheck = (args.minimum_check || '').trim()
        if (effPolicy === 'strict' || effPolicy === 'full') {
          const missing = []
          if (reuse.length === 0) missing.push('reuse_candidates（复用搜索结果）')
          if (native.length === 0) missing.push('native_candidates（stdlib/native/已装依赖检查结果）')
          if (minCheck === '') missing.push('minimum_check（最小实现检查 test/evidence id）')
          if (missing.length > 0) return { ok: false, reason: 'Lean ' + effPolicy + ' 模式缺少机械证据字段：' + missing.join('、') + '；补齐后重新 select' }
        }
        let leanExceptions = []
        const exRaw = (args.lean_exceptions || '').trim()
        if (exRaw !== '') {
          try {
            const parsed = JSON.parse(exRaw)
            if (!Array.isArray(parsed)) throw new Error('not array')
            for (const e of parsed) {
              if (e === null || typeof e !== 'object' || ['dependency', 'new_file', 'abstraction'].indexOf(e.kind) === -1 || typeof e.match !== 'string' || e.match.trim() === '') throw new Error('bad entry')
              leanExceptions.push({ kind: e.kind, match: e.match.trim() })
            }
          } catch (e) {
            return { ok: false, reason: 'lean_exceptions 必须是 JSON 数组：[{"kind":"dependency|new_file|abstraction","match":"名称或路径"}]' }
          }
        }
        if (contractLevel === 'OPEN' || leanExceptions.length > 0) {
          const approvalReason = contractLevel === 'OPEN'
            ? 'Baton OPEN 契约：' + openReason + (leanExceptions.length > 0 ? '；同时登记 Lean 精确例外：' + JSON.stringify(leanExceptions) : '')
            : 'Baton Lean 精确例外：' + JSON.stringify(leanExceptions)
          const grant = await approvalOnce('baton_select', approvalReason, exec)
          if (!grant.allowed) return { ok: false, reason: grant.reason, approval_outcome: grant.outcome }
        }
        const leanContract = {
          policy: effPolicy,
          dependency_budget: depBudget,
          new_file_budget: fileBudget,
          abstraction_budget: absBudget,
          minimum_check: minCheck === '' ? undefined : minCheck,
          reuse_candidates: reuse.length > 0 ? reuse : undefined,
          native_candidates: native.length > 0 ? native : undefined,
          lean_exceptions: leanExceptions.length > 0 ? leanExceptions : undefined,
        }
        if (effPolicy !== undefined) {
          task.implementation_policy = effPolicy
          task.lean_contract = leanContract
        }
        task.contract_level = contractLevel
        task.allowed_paths = contractLevel === 'OPEN' ? (normPaths.length > 0 ? normPaths : undefined) : normPaths
        task.open_reason = contractLevel === 'OPEN' ? openReason : undefined
        tasks.current_task_id = task.id
        tasks.active_work = { task_id: task.id, title: task.title, phase: '进行中', selected_at: nowIso(), selected_by: '编号 ' + num, contract_level: contractLevel, allowed_paths: task.allowed_paths || null }
        tasks.revision = (tasks.revision || 0) + 1
        // 预锁防篡改快照：锁定的允许范围写进机器状态 state.contract，
        // 收尾以快照为准——执行者事后改 tasks.json 的 allowed_paths 无法放大预锁范围。
        const stDoc = await assertJsonHealthy(rootPath, 'docs/ai_memory/state/project_state.json', {})
        // Lean 预算窗口锚定任务开工时刻：记录 base SHA + 依赖基线；重选同一任务保留原 base（预算窗口不因重选重置）
        let baseSha = null
        let baseDeps = null
        const prevSnap = stDoc.contract
        if (prevSnap !== undefined && prevSnap !== null && prevSnap.task_id === task.id && typeof prevSnap.base_sha === 'string' && /^[0-9a-f]{7,40}$/i.test(prevSnap.base_sha)) {
          baseSha = prevSnap.base_sha
          baseDeps = Array.isArray(prevSnap.base_deps) ? prevSnap.base_deps : null
        }
        // 预算窗口的 base SHA 永不重置；但 clock_out 暴露出事前无法预见的超预算项后，
        // 用户可以在对话中明确同意，再按返回指令重选同一任务登记精确例外。
        // 该能力必须跨 DSH/Codex/Cursor/Claude 工作，因此不依赖某一宿主专属审批 API。
        if (baseSha === null) {
          try { baseSha = (await gitSnapshot(rootPath)).head } catch (e) { baseSha = '' }
          const p0 = await readJsonAt(rootPath, 'package.json', null)
          baseDeps = depNamesOf(p0)
        }
        stDoc.contract = { task_id: task.id, level: contractLevel, allowed_paths: task.allowed_paths || null, open_reason: contractLevel === 'OPEN' ? openReason : null, approval: (contractLevel === 'OPEN' || leanExceptions.length > 0) ? { outcome: 'allowed-once', audited_by: 'ctx.approval', granted_at: nowIso() } : null, locked_at: nowIso(), locked_rev: tasks.revision, lean: leanContract, base_sha: baseSha, base_deps: baseDeps }
        stDoc.revision = (stDoc.revision || 0) + 1
        stDoc.updated_at = nowIso()
        await writeTextAt(rootPath, 'docs/ai_memory/state/project_state.json', JSON.stringify(stDoc, null, 2))
        await writeTextAt(rootPath, 'docs/ai_memory/state/tasks.json', JSON.stringify(tasks, null, 2))
        await removeTaskRow(rootPath, 'docs/ai_memory/tasks/task_todo.md', task.id)
        const cell = (s) => String(s === undefined || s === null ? '' : s).replace(/\|/g, '\\|').trim()
        const row = '| ' + cell(task.risk_level || 'normal') + ' | ' + task.id + ' | ' + cell(task.title) + ' | 进行中 | 已选定 | ' + cell(task.next_step || '') + ' |\n'
        const prog = (await readTextAt(rootPath, 'docs/ai_memory/tasks/task_progress.md')) || ''
        if (prog.indexOf('| ' + task.id + ' |') === -1) {
          const tablePos = prog.lastIndexOf('|---')
          if (tablePos !== -1) {
            const lineEnd = prog.indexOf('\n', tablePos)
            const at = lineEnd === -1 ? prog.length : lineEnd + 1
            await writeTextAt(rootPath, 'docs/ai_memory/tasks/task_progress.md', prog.slice(0, at) + row + prog.slice(at))
          }
        }
        await appendRevision(rootPath, 'docs/ai_memory/tasks/task_progress.md', '选定任务：' + task.id + ' ' + (task.title || ''), agentLabel(args))
        return { ok: true, selected: task.id, title: task.title, task_type: taskType, implementation_policy: effPolicy, contract_level: contractLevel, next_step: task.next_step || null, note: '已持久化为当前任务；执行完成后用 baton_complete(task_id=' + task.id + ') 收尾' }
        }, false)
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_clock_out',
      description: 'Baton：「下班啦」本地收尾：更新日报/状态/交接 → metrics 固化 + 月度报表 → git commit。存在非 Baton 管理域的改动时必须用 allowed_files 声明允许清单，越界或 protected 命中即阻断（不写不提交）。随后返回 push 命令，主会话执行 push 后用 baton_verify_push 完成远端 SHA 核验。',
      parameters: simple({ path: '项目根目录', summary: '今日工作摘要（写入交接）', next: '下一步建议（可选）', actual_model: '实际执行模型（可选，记入 Metrics）', reviewer_model: '实际复核模型（可选，记入 Metrics）', reviewer_agent_id: '复核代理身份（可选；仅声明 unverified，独立性需宿主事件证明，防假 Reviewer）', reviewer_run_id: '复核子代理会话 ID（可选；插件查宿主 subagent/descriptor 事件签发 Reviewer receipt，查无事件则标 unverified）', allowed_files: '允许改动的文件清单，逗号分隔（可选，用于越界核对）' }),
      output: output(),
      async execute(args, exec) {
        const rootPath = await rootOf(args)
        const git = await gitSnapshot(rootPath)
        // 命令注入防护：分支名进入 push 命令前必须先过白名单，含 ;&| 等元字符的分支直接中止
        if (!/^[A-Za-z0-9._\/-]{1,200}$/.test(git.branch)) {
          return { ok: false, aborted: true, reason: '分支名包含非法字符（仅允许字母/数字/点/下划线/斜杠/连字符），收尾已中止；请先改用安全分支名再下班', branch: git.branch }
        }
        // 远端门禁：推流目标指向开源发布仓库 → 下班硬阻断（不写任何文件、不提交），
        // 防止把项目记忆文档（docs/ai_memory）经收尾流程推到公开仓库。
        const pushPlan = await resolvePushRemote(rootPath, git)
        if (pushPlan.error !== null) {
          return { ok: false, aborted: true, reason: '推流远端不合规：收尾已阻断（未写任何文件、未提交）：' + pushPlan.error, remote_error: pushPlan.error }
        }
        const today = todayLocal()
        const summary = (args.summary || '').trim()
        const next = (args.next || '').trim()
        const actualModel = (args.actual_model || 'unknown').trim()
        const agent = agentLabel(args)
        const e8 = east8Stamp()
        const closeTopic = topicOf(summary, '下班收尾')
        const reviewerModel = (args.reviewer_model || 'unknown').trim()
        const reviewerAgentIdRaw = (args.reviewer_agent_id || '').trim() || null
        const reviewerRunIdRaw = (args.reviewer_run_id || '').trim()
        // 统一凭据扫描：所有将被持久化的调用者字段都必须扫描——
        // summary/next/actual_model/reviewer_model/reviewer_agent_id/reviewer_run_id 任一命中即阻断（凭据绝不进入 tracked metrics/HTML）。
        const secHit = secretHits([summary, next, actualModel, reviewerModel, reviewerAgentIdRaw, reviewerRunIdRaw].filter((x) => typeof x === 'string').join('\n'))
        if (secHit.length > 0) {
          return { ok: false, aborted: true, reason: '输入疑似含敏感信息（' + secHit.join('、') + '）：收尾已阻断（凭据绝不进入 Git 跟踪文档），请移除后重试', secret_hits: secHit }
        }
        const month = monthLocal()
        const monthlyHtmlRel = 'docs/ai_memory/agent_metrics/' + month + '/index.html'
        const reportSep = rootPath.indexOf('\\') !== -1 ? '\\' : '/'
        const monthlyHtmlAbsolute = rootPath.replace(/[\\\/]+$/, '') + reportSep + monthlyHtmlRel.replace(/\//g, reportSep)
        let monthlyHtmlStatus = 'unverified'
        let monthlyHtmlError = null
        // 身份字段：假 Reviewer 检测按 agent/session 同源判定；身份不可验证时留空回落模型名判定
        const wSessCo = currentSession()
        const coAgentId = (wSessCo !== undefined && wSessCo !== null && wSessCo.id !== undefined) ? String(wSessCo.id) : null
        const reviewerAgentId = reviewerAgentIdRaw
        // Reviewer 独立性 receipt——调用者字符串只能标 unverified；
        // 独立复核必须来自宿主签发事件（reviewer_run_id 的 subagent/descriptor），查无事件 → 如实标 unverified。
        let reviewerReceipt = null
        if (reviewerRunIdRaw !== '') {
          const sq = ctx.get('sessionQuery')
          try {
            if (sq !== undefined) {
              const evs = await sq.listEvents(reviewerRunIdRaw)
              for (const e of evs) {
                if (e && e.type === 'subagent/descriptor' && e.data && typeof e.data === 'object') {
                  if (typeof e.data.agentModel === 'string') {
                    reviewerReceipt = {
                      run_id: reviewerRunIdRaw,
                      agent_model: e.data.agentModel,
                      provider: typeof e.data.provider === 'string' ? e.data.provider : null,
                      session_id: typeof e.data.sessionId === 'string' ? e.data.sessionId : (typeof e.data.session === 'string' ? e.data.session : null),
                      origin: 'host_descriptor',
                      verified: true,
                    }
                    break
                  }
                }
              }
            }
          } catch (e) { /* 保留 unverified */ }
          if (reviewerReceipt === null) reviewerReceipt = { run_id: reviewerRunIdRaw, verified: false, origin: 'unverified' }
        }
        const allowed = (args.allowed_files || '').split(',').map((s) => s.trim()).filter((s) => s !== '')
        // Contract 轻量预锁：开工时把允许路径预锁进任务条目（baton_select 的 allowed_paths）。
        // 收尾时真实 diff 超出预锁范围的改动必须用户明确豁免（allowed_files 以 user: 前缀声明），否则阻断——执行者事后自报吞不掉越界。
        const tasksDoc = await readJsonAt(rootPath, 'docs/ai_memory/state/tasks.json', { tasks: [] })
        const stateDoc = await readJsonAt(rootPath, 'docs/ai_memory/state/project_state.json', {})
        const ownershipAtCloseoutStart = stateDoc && stateDoc.ownership ? { ...stateDoc.ownership } : null
        const currentTask = (tasksDoc.tasks || []).find((t) => t.id === tasksDoc.current_task_id)
        // 预锁以 state.contract 快照为准（select 时锁定，执行者改 tasks.json 无法放大范围）；无快照时回落到任务条目（旧数据兼容）
        const contractLock = (stateDoc && stateDoc.contract && stateDoc.contract.task_id === tasksDoc.current_task_id && Array.isArray(stateDoc.contract.allowed_paths)) ? stateDoc.contract.allowed_paths : null
        const preLock = (contractLock !== null && contractLock.length > 0)
          ? contractLock.map((p) => String(p).replace(/\\/g, '/')).filter((p) => p !== '')
          : ((currentTask && Array.isArray(currentTask.allowed_paths) && currentTask.allowed_paths.length > 0) ? currentTask.allowed_paths.map((p) => String(p).replace(/\\/g, '/')) : null)
        const userExempt = allowed.filter((a) => a.indexOf('user:') === 0).map((a) => a.slice(5))
        const allowedPlain = allowed.filter((a) => a.indexOf('user:') !== 0)
        const effAllowed = allowedPlain.concat(userExempt)
        const cfgG = await loadConfigGuarded(rootPath)
        if (cfgG.error !== null) {
          return { ok: false, aborted: true, reason: '安全配置不可用：收尾已阻断（fail-closed，未写任何文件、未提交）：' + cfgG.error, config_error: cfgG.error }
        }
        const config = cfgG.config
        const protectedPaths = (config && Array.isArray(config.protected_paths)) ? config.protected_paths : []
        const isProtected = (f) => protectedPaths.some((p) => f === p || f.indexOf(p + '/') === 0 || f.indexOf(p + '\\') === 0)
        // B5：首次下班时整个 docs/ 尚未被 git 跟踪，git status 折叠成单条目 docs/（不含 ai_memory 前缀）→ 误报越界。
        // 只有当 docs 目录里只有 ai_memory 时才算 Baton 管理域；混有用户文档则如实按越界处理。
        let docsDirMemoryOnly = false
        if (git.files_all.some((f) => f === 'docs' || f === 'docs/')) {
          const docsT = await fs.resolve('docs', { cwd: rootPath })
          const docsEntries = await fs.listDir(docsT).catch(() => [])
          const docsNames = docsEntries.map((e) => e.name)
          docsDirMemoryOnly = docsNames.length > 0 && docsNames.every((n) => n === 'ai_memory')
        }
        const isBatonManaged = (f) => f.indexOf('docs/ai_memory/') === 0 || f === '.baton' || f.indexOf('.baton/') === 0 || f === '.gitignore' || f === 'AGENTS.md' || f === 'CLAUDE.md' || f === '.cursorrules' || f === '.cursor/rules/baton.mdc' || /^(\.agents|\.claude|\.cursor)\/skills\/baton\//.test(f) || ((f === 'docs' || f === 'docs/') && docsDirMemoryOnly)
        // 前缀必须匹配到路径边界：src/app 不得误放行 src/application.txt
        const inPath = (f, a) => f === a || f.indexOf(a + '/') === 0 || f.indexOf(a + '\\') === 0
        // 红线 5：allowed_files 为空时不放行任何非管理域改动——存在非 Baton 管理域改动必须声明允许清单
        const nonManaged = git.files_all.filter((f) => !isBatonManaged(f))
        const inPreLock = (f) => preLock !== null && preLock.some((p) => inPath(f, p))
        const scopeViolations = nonManaged.filter((f) => !inPreLock(f) && !effAllowed.some((a) => inPath(f, a)))
        const contractViolations = preLock !== null ? nonManaged.filter((f) => !inPreLock(f) && !userExempt.some((a) => inPath(f, a))) : []
        // protected 检查覆盖全部文件（含 Baton 管理域）：rename 进受保护目录的管理域文件同样阻断
        const protectedViolations = git.files_all.filter((f) => isProtected(f))
        // 阻断级门禁（红线 5）：任一越界或 protected 命中 → 不写任何文件、不提交，直接返回 FAIL 清单
        if (scopeViolations.length > 0 || protectedViolations.length > 0) {
          return {
            ok: false,
            aborted: true,
            reason: '越界或受保护文件命中：收尾已阻断（未写任何文件、未提交）',
            scope_violations: scopeViolations,
            protected_violations: protectedViolations,
            next_step: {
              command: '修正 allowed_files 或把违规改动移出本次收尾范围后重试 clock_out',
              then: '如需豁免先与用户确认，禁止擅自放宽范围',
            },
          }
        }
        // Contract 预锁阻断：预锁范围外的改动必须 user: 豁免（用户明确确认），执行者事后自报不构成豁免
        if (contractViolations.length > 0) {
          return {
            ok: false,
            aborted: true,
            reason: '超出任务预锁范围且未获用户豁免：收尾已阻断（未写任何文件、未提交）',
            pre_lock: preLock,
            contract_violations: contractViolations,
            next_step: {
              command: '与用户确认越界改动后重试 clock_out：在 allowed_files 中以 user:<路径> 声明用户豁免（如 user:src/extra.txt）',
              then: '豁免必须来自用户明确确认，禁止执行者自行加 user: 前缀',
            },
          }
        }
        // 边界文件门禁：规则载体（config/入口文件/SKILL 镜像/.gitignore）被改动必须用户豁免，
        // 执行者不能先改保护规则或入口约束再收尾。
        const isBoundary = (f) => f === '.baton/config.json' || f === 'AGENTS.md' || f === 'CLAUDE.md' || f === '.cursorrules' || f === '.cursor/rules/baton.mdc' || f === '.gitignore' || /^(\.agents|\.claude|\.cursor)\/skills\/baton\//.test(f)
        const boundaryViolations = git.files_all.filter((f) => isBoundary(f) && !userExempt.some((a) => inPath(f, a)))
        if (boundaryViolations.length > 0) {
          return {
            ok: false,
            aborted: true,
            reason: '规则/边界文件被改动且未获用户豁免：收尾已阻断（未写任何文件、未提交）',
            boundary_violations: boundaryViolations,
            next_step: {
              command: '与用户确认边界文件改动后重试 clock_out：在 allowed_files 中以 user:<路径> 声明用户豁免',
              then: '边界文件（config/AGENTS/CLAUDE/.cursorrules/.gitignore/SKILL 镜像）的改动必须经用户明确确认，禁止执行者自行豁免',
            },
          }
        }
        // 待提交文件凭据扫描：git add -A 会纳入的真实文件全量扫描，
        // 命中即阻断（未写任何文件、未提交）；user: 豁免文件跳过
        const stagedHits = await stagedSecretScan(rootPath, git.files_all, userExempt)
        if (stagedHits.length > 0) {
          return {
            ok: false,
            aborted: true,
            reason: '待提交文件命中疑似凭据/敏感内容：收尾已阻断（未写任何文件、未提交）',
            secret_hits: stagedHits,
            next_step: {
              command: '移除或移出本次提交范围后重试 clock_out；确认安全需在 allowed_files 中以 user:<路径> 声明用户豁免',
              then: '凭据绝不进入 Git：.env*、.npmrc、私钥文件、源码内 Token 等命中即阻断',
            },
          }
        }
        const exemptSecretHits = secretHits(userExempt.join('\n'))
        if (exemptSecretHits.length > 0) return { ok: false, aborted: true, reason: 'user: 路径疑似含敏感信息：拒绝发送授权请求', secret_hits: exemptSecretHits, committed: false }
        if (userExempt.length > 0) {
          const grant = await approvalOnce('baton_clock_out', 'Baton 收尾范围一次性豁免：' + userExempt.join(', '), exec)
          if (!grant.allowed) return { ok: false, failure: grant.reason, approval_outcome: grant.outcome, contract_violations: userExempt, committed: false }
        }
        // 单写入者锁门禁：写工具必须持有锁；置于范围门禁之后，保证越界/预锁阻断优先报告
        const ownGate = await ownershipGuard(rootPath)
        if (!ownGate.pass) {
          return { ok: false, aborted: true, reason: '未持有单写入者锁：收尾已阻断（未写任何文件、未提交）：' + ownGate.reason, ownership_error: ownGate.reason }
        }
        // Lean Gate 机械执行：strict 预算 delta 阻断（例外必须契约内预锁，执行者事后自报无效）；
        // full 只报告不阻断（预算只约束 strict）；off/lite 不施加。凭据/范围/边界门禁在本门禁上游，任何策略不得削弱。
        const leanSnap = (stateDoc !== undefined && stateDoc !== null && stateDoc.contract !== undefined && stateDoc.contract !== null && stateDoc.contract.task_id === tasksDoc.current_task_id && stateDoc.contract.lean !== undefined && stateDoc.contract.lean !== null && typeof stateDoc.contract.lean === 'object') ? stateDoc.contract.lean : null
        const leanBaseSha = (stateDoc !== undefined && stateDoc !== null && stateDoc.contract !== undefined && stateDoc.contract !== null && typeof stateDoc.contract.base_sha === 'string') ? stateDoc.contract.base_sha : ''
        let leanReport = null
        if (leanSnap !== null && (leanSnap.policy === 'strict' || leanSnap.policy === 'full')) {
          const delta = await leanDelta(rootPath, leanBaseSha, isBatonManaged)
          // strict 下任何 delta 计算错误一律阻断（fail-closed），不猜测放行
          if (leanSnap.policy === 'strict' && delta.errors.length > 0) {
            return {
              ok: false, aborted: true,
              reason: 'Lean strict 预算 delta 计算失败：收尾已阻断（未写任何文件、未提交）',
              lean_violations: [{ kind: 'delta_error', item: delta.errors[0] }],
              lean_report: { policy: 'strict', base_sha: leanBaseSha, applied: true, errors: delta.errors, blocked: true },
              next_step: { command: '检查 git 可用性与仓库完整性后重试 clock_out', then: 'strict 模式下任何 delta 计算错误一律阻断，不猜测放行' },
            }
          }
          const budgets = {
            dependency_budget: typeof leanSnap.dependency_budget === 'number' ? leanSnap.dependency_budget : null,
            new_file_budget: typeof leanSnap.new_file_budget === 'number' ? leanSnap.new_file_budget : null,
            abstraction_budget: typeof leanSnap.abstraction_budget === 'number' ? leanSnap.abstraction_budget : null,
          }
          const exceptions = Array.isArray(leanSnap.lean_exceptions) ? leanSnap.lean_exceptions : []
          const covered = (kind, item) => exceptions.some((e) => e !== null && typeof e === 'object' && e.kind === kind && typeof e.match === 'string' && (e.match === item || item.indexOf(e.match + '/') === 0))
          const overNew = budgets.new_file_budget !== null && delta.new_files.length > budgets.new_file_budget ? delta.new_files.filter((f) => !covered('new_file', f)) : []
          const overDeps = budgets.dependency_budget !== null && delta.new_deps.length > budgets.dependency_budget ? delta.new_deps.filter((n) => !covered('dependency', n)) : []
          const overAbs = budgets.abstraction_budget !== null && delta.abstractions > budgets.abstraction_budget ? delta.abstract_files.filter((f) => !covered('abstraction', f)) : []
          const violations = overNew.map((f) => ({ kind: 'new_file', item: f }))
            .concat(overDeps.map((n) => ({ kind: 'dependency', item: n })))
            .concat(overAbs.map((f) => ({ kind: 'abstraction', item: f })))
          leanReport = {
            policy: leanSnap.policy, base_sha: leanBaseSha, applied: true,
            new_files: delta.new_files, new_deps: delta.new_deps, abstractions: delta.abstractions, abstract_files: delta.abstract_files,
            budgets, exceptions, violations, errors: delta.errors, blocked: violations.length > 0,
          }
          if (leanSnap.policy === 'strict' && violations.length > 0) {
            return {
              ok: false, aborted: true,
              reason: 'Lean strict 预算超限：收尾已阻断（未写任何文件、未提交）',
              lean_violations: violations,
              lean_report: leanReport,
              next_step: {
                command: '与用户确认超预算项后，重新 baton_select 同一任务并把用户例外登记进 lean_exceptions（如 [{"kind":"dependency","match":"left-pad"}]）；例外必须由用户明确确认，执行者事后自报无效',
                then: '或移除超预算改动后重试 clock_out；strict 模式新增依赖/文件/抽象超预算一律阻断',
              },
            }
          }
        }
        const sizeWarnings = []
        for (const rel of ['docs/ai_memory/handoff_current.md', 'docs/ai_memory/daily_log/daily_' + today + '.md']) {
          const st = await statAt(rootPath, rel)
          if (st !== null && st.size > 3 * 1024 * 1024) sizeWarnings.push(rel + ' 超过 3MB，建议按条目分卷（主文件留摘要与读取顺序）')
        }

        // 两阶段事务+ 文档阶段写前日志：
        // token 记录 head_at_start / commit1_head 两个阶段点，并在文档阶段每步完成时记录 step；
        // 文档阶段中途失败（如 handoff 被瞬时文件锁打断）后重试，从 step 断点续跑，日报/索引/交接绝不重复追加。
        // 阶段1 重试（commit1 失败，HEAD 未变，docs_done=true）→ 跳过文档只重跑 commit1；
        // 阶段2 重试（commit2 失败，HEAD == commit1_head）→ 跳过文档与 commit1，只补发布记录提交；
        // 同日第二次正常下班（HEAD 已越过 commit1_head）→ 照常写新文档。
        const tokenPath = '.baton/local/closeout.json'
        const tokenBefore = await readJsonAt(rootPath, tokenPath, null)
        const closeoutHead = git.head
        const sameDay = tokenBefore !== null && tokenBefore.date === today
        const phase1Retry = sameDay && tokenBefore.head_at_start === git.head && tokenBefore.commit1_head === undefined
        const phase2Retry = sameDay && tokenBefore.commit1_head !== undefined && git.head === tokenBefore.commit1_head
        // 断点恢复：commit1 已成功但 token 未写 commit1_head（崩溃窗口）→ 识别为 commit1Already：
        // 跳过文档阶段与 commit1，直接进入发布记录阶段（重试不重复 metrics/提交）。
        let commit1Already = false
        if (sameDay && !phase1Retry && !phase2Retry && tokenBefore.head_at_start !== undefined && tokenBefore.head_at_start !== git.head) {
          const hl = await sh('git log -1 --format=%s', rootPath)
          if (hl.exitCode === 0 && hl.out.indexOf('baton: 下班收尾 ' + today) !== -1) commit1Already = true
        }
        const docsSkipped = (phase1Retry && tokenBefore.docs_done === true) || commit1Already
        const commit1Skipped = phase2Retry || commit1Already
        const DOC_STEPS = ['start', 'daily', 'current', 'index', 'metrics', 'handoff']
        const rawStep = (tokenBefore !== null && tokenBefore !== undefined && tokenBefore.step) || 'start'
        // -intent 后缀 = 副作用前意图日志：崩溃后必须重跑「该段本身」——
        // 执行判断是 resumeIdx < N（跳过小于 resumeIdx 的段），故 intent 段映射为其前一步的下标。
        const intentName = rawStep.replace(/-intent$/, '')
        const intentIdx = DOC_STEPS.indexOf(intentName)
        const resumeStep = (phase1Retry && !docsSkipped && intentIdx !== -1) ? (rawStep.indexOf('-intent') !== -1 && intentIdx > 0 ? DOC_STEPS[intentIdx - 1] : intentName) : 'start'
        const resumeIdx = DOC_STEPS.indexOf(resumeStep)
        const writeStep = (step) => writeTextRetry(rootPath, tokenPath, JSON.stringify({ date: today, head_at_start: closeoutHead, step, updated_at: nowIso() }, null, 2))
        const writeIntent = (step) => writeStep(step + '-intent')
        if (!docsSkipped) {
          const dailyRel = await ensureDailyFile(rootPath, today)
          const dailyBefore = (await readTextAt(rootPath, dailyRel)) || ''
          const fileSummary = git.files_count === 0 ? '无'
            : (git.files_count > 30 ? git.files.join('、') + ' 等共 ' + git.files_count + ' 个文件' : git.files.join('、'))
          // 内容幂等（双保险）：同日同摘要的日报块/索引/交接只允许出现一次，断点续跑即使重入也不会重复
          const dailyExistingIdx = summary !== '' ? dailyBefore.split('\n').findIndex((l) => l.indexOf('- 摘要：' + summary) !== -1) : -1
          const dailyLineStart = dailyExistingIdx !== -1 ? dailyExistingIdx + 1 : lineCount(dailyBefore) + 1
          const summaryKey = (summary || '下班收尾').slice(0, 60)
          if (resumeIdx < 1 && dailyExistingIdx === -1) {
            await writeIntent('daily')
            await appendTextAt(rootPath, dailyRel,
              '\n## 下班收尾｜' + closeTopic + '｜' + e8.display + '｜' + agent + '\n\n- 时间：' + e8.display + '\n- 摘要：' + (summary || '（无）') + '\n- 下一步：' + (next || '（无）') + '\n- 改动文件：' + fileSummary + '\n- 已验证：未跑\n- 未验证项及原因：未跑\n- 凭据检查：未记录敏感信息\n')
            await writeStep('daily')
          }
          if (resumeIdx < 2) {
            await writeIntent('current')
            await updateCurrentFacts(rootPath,
              '- 最近收尾：' + today + '\n- 摘要：' + (summary || '（无）') + '\n- 下一步：' + (next || '说「上班啦」继续') + '\n- 分支：' + git.branch + ' / HEAD：' + git.head + '\n',
              closeTopic + '｜下班收尾', agent)
            await writeStep('current')
          }
          if (resumeIdx < 3) {
            await writeIntent('index')
            // 写档顺序（SKILL 原则 3）：任务/知识/日报 → 索引 → metrics → handoff 最后写（handoff 收尾 = 前序事务完成）
            const idxBefore = await readJsonAt(rootPath, 'docs/ai_memory/state/archive_index.json', { entries: [] })
            const indexAlready = (idxBefore.entries || []).some((e) => e.path === dailyRel && e.summary === summaryKey)
            if (!indexAlready) {
              await addIndexEntry(rootPath, {
                id: 'ARCH-' + idSuffix(), document_type: 'daily_log', title: '下班收尾｜' + closeTopic,
                time: { start: today, end: null }, modules: [dailyRel],
                keywords: ['日报', '下班', today, agent, closeTopic].concat(summary ? summary.slice(0, 40).split(/\s+/).slice(0, 5) : []),
                summary: summaryKey,
                task_ids: [], decision_ids: [], issue_ids: [],
                path: dailyRel, line_start: dailyLineStart, updated_at: nowIso(),
              })
            }
            await writeStep('index')
          }
          if (resumeIdx < 4) {
            await writeIntent('metrics')
            // 稳定 event_id 绑定「日期 + 收尾起始 HEAD + 摘要」：metrics 固化后、local 清空前崩溃，
            // 重试产生的新时间戳仍属于同一事件，不得把成功/失败/排行重复计数。
            const clockOutEventId = 'clock_out:' + today + ':' + closeoutHead + ':' + encodeURIComponent(summary || '下班收尾').slice(0, 160)
            const localMetricsRel = '.baton/local/metrics/' + today + '.jsonl'
            const localBeforeMetrics = (await readTextAt(rootPath, localMetricsRel)) || ''
            let dayMetrics = localBeforeMetrics
            const eventNeedle = '"event_id":' + JSON.stringify(clockOutEventId)
            if (localBeforeMetrics.indexOf(eventNeedle) === -1) {
              const line = JSON.stringify({ ts: nowIso(), event_id: clockOutEventId, type: 'clock_out', branch: git.branch, dirty: git.dirty, files_changed: git.files.length, actual_model: actualModel, reviewer_model: reviewerModel, actual_agent_id: coAgentId, reviewer_agent_id: reviewerAgentId, reviewer_run_id: reviewerRunIdRaw === '' ? null : reviewerRunIdRaw, reviewer_receipt: reviewerReceipt }) + '\n'
              dayMetrics += line
              await writeTextRetry(rootPath, localMetricsRel, dayMetrics)
            }
            const monthDir = 'docs/ai_memory/agent_metrics/' + month
            // 把所有尚未固化的本机日期文件按事件时间归月；started 与 evaluated 可跨日/跨月，
            // 历史路由再按 attempt_id 配对。固化仍以 event_id 去重，清空前崩溃重试不会重复统计。
            const metricKey = (raw) => {
              try {
                const parsed = JSON.parse(raw)
                return parsed !== null && typeof parsed === 'object' && typeof parsed.event_id === 'string' && parsed.event_id !== '' ? 'event:' + parsed.event_id : 'raw:' + raw
              } catch (e) { return 'raw:' + raw }
            }
            const localRels = new Set([localMetricsRel])
            try {
              const localDir = await fs.resolve('.baton/local/metrics', { cwd: rootPath })
              for (const e of await fs.listDir(localDir)) if (e.type === 'file' && /\.jsonl$/i.test(e.name || '')) localRels.add('.baton/local/metrics/' + e.name)
            } catch (e) { /* 当天文件已在集合中 */ }
            const grouped = new Map()
            for (const rel of localRels) {
              const content = rel === localMetricsRel ? dayMetrics : ((await readTextAt(rootPath, rel)) || '')
              for (const raw of content.split('\n').filter((x) => x.trim() !== '')) {
                let eventMonth = month
                try {
                  const parsed = JSON.parse(raw)
                  const stamp = east8Stamp(parsed.ended_at || parsed.started_at || parsed.ts)
                  eventMonth = stamp.date.slice(0, 7).replace('-', '/')
                } catch (e) { /* 无效旧行归当前月并保留 */ }
                if (!grouped.has(eventMonth)) grouped.set(eventMonth, [])
                grouped.get(eventMonth).push(raw)
              }
            }
            let monthMetricsAfter = (await readTextAt(rootPath, monthDir + '/runs.jsonl')) || ''
            for (const [targetMonth, lines] of grouped.entries()) {
              const runsRel = 'docs/ai_memory/agent_metrics/' + targetMonth + '/runs.jsonl'
              const before = targetMonth === month ? monthMetricsAfter : ((await readTextAt(rootPath, runsRel)) || '')
              const seenMetrics = new Set(before.split('\n').filter((x) => x.trim() !== '').map(metricKey))
              const additions = []
              for (const raw of lines) {
                const key = metricKey(raw)
                if (seenMetrics.has(key)) continue
                seenMetrics.add(key)
                additions.push(raw)
              }
              const after = before + (additions.length > 0 ? additions.join('\n') + '\n' : '')
              if (additions.length > 0) await writeTextRetry(rootPath, runsRel, after)
              if (targetMonth === month) monthMetricsAfter = after
            }
            for (const rel of localRels) await writeTextAt(rootPath, rel, '')
            const oldHtml = (await readTextAt(rootPath, monthDir + '/index.html')) || ''
            try {
              const generatedHtml = await monthlyHtml(rootPath, monthDir, month, today, git, actualModel, reviewerModel, monthMetricsAfter)
              await writeTextRetry(rootPath, monthDir + '/index.html', generatedHtml)
              const verifiedHtml = (await readTextAt(rootPath, monthDir + '/index.html')) || ''
              if (!verifiedHtml.startsWith('<!doctype html>') || verifiedHtml.indexOf('</html>') === -1) throw new Error('生成文件完整性校验失败')
              monthlyHtmlStatus = 'generated'
            } catch (e) {
              monthlyHtmlError = String(e && e.message ? e.message : e)
              if (oldHtml.startsWith('<!doctype html>') && oldHtml.indexOf('</html>') !== -1) {
                try {
                  await writeTextRetry(rootPath, monthDir + '/index.html', oldHtml)
                  monthlyHtmlStatus = 'old'
                } catch (restoreError) {
                  monthlyHtmlStatus = 'missing'
                  monthlyHtmlError += '；旧版恢复失败：' + String(restoreError && restoreError.message ? restoreError.message : restoreError)
                }
              } else {
                monthlyHtmlStatus = 'missing'
              }
            }
            await writeStep('metrics')
          }
          if (resumeIdx < 5) {
            await writeIntent('handoff')
            const handoffBefore = (await readTextAt(rootPath, await docRole(rootPath, 'handoff'))) || ''
            // 只与「末条」交接比对本事务摘要
            const hoSegments = handoffBefore.split(/###\s+HO-/)
            const lastSegment = hoSegments.length > 0 ? hoSegments[hoSegments.length - 1] : ''
            const handoffAlready = summary !== '' && lastSegment.indexOf('- 任务：' + summary) !== -1
            if (!handoffAlready) {
              await appendHandoffEntry(rootPath,
                '### ' + hoId(agent) + '｜下班收尾｜' + closeTopic + '\n' +
                '- 时间：' + e8.display + '\n- 交接状态：可接手\n- 任务：' + (summary || '（无）') + '\n- 分支 / HEAD：' + git.branch + ' / ' + git.head + '\n' +
                '- 改动文件：' + fileSummary + '\n- 下一步：' + (next || '（无）') + '\n- 凭据检查：未记录敏感信息',
                '下班收尾｜' + closeTopic, agent)
            }
            await writeStep('handoff')
          }
          await writeTextRetry(rootPath, tokenPath, JSON.stringify({ date: today, head_at_start: closeoutHead, docs_done: true, updated_at: nowIso() }, null, 2))
        }

        // commit1：全部工作产物（日报/current/索引/metrics/handoff）。阶段2 重试时跳过（HEAD 已是 commit1）。
        let committed = commit1Skipped
        let addError = null
        if (!commit1Skipped) {
          const add = await sh('git add -A', rootPath)
          if (add.exitCode === 0) {
            const commit = await sh('git commit -m "baton: 下班收尾 ' + today + '"', rootPath)
            committed = commit.exitCode === 0
            if (!committed && /nothing to commit/i.test(commit.out + commit.err)) {
              // 断点恢复：commit1 已成功但 closeout token 未写入（崩溃窗口）→
              // HEAD 顶部已是本次收尾提交时视为 commit1 完成，继续发布记录阶段（否则漏掉 commit2/发布状态）。
              const headLog = await sh('git log -1 --format=%s', rootPath)
              const headNow = (await sh('git rev-parse HEAD', rootPath)).out.trim()
              if (headLog.exitCode === 0 && headLog.out.indexOf('baton: 下班收尾 ' + today) !== -1 && headNow !== closeoutHead) {
                committed = true
              }
            }
            if (!committed && !/nothing to commit/i.test(commit.out + commit.err)) addError = 'commit1 失败：' + commit.err
          } else {
            addError = 'git add 失败：' + add.err
          }
        }
        let recordCommitOk = false
        let releaseOk = false
        let releaseError = null
        let commit1HeadForToken = undefined
        if (committed) {
          // 发布记录语义：remote_sha/last_published_sha = 本次收尾「内容提交」SHA，push_state='pending'；
          // push 与核验完成后由 baton_record_push 写本机验收凭证（不进 Git，工作区保持干净）。
          // 重试幂等：上一轮失败已写过 state 时不再重复 bump。
          const afterCommit1 = await verifiedGitHead(rootPath)
          if (!afterCommit1.ok) {
            addError = '无法取得 commit1 后 HEAD：' + afterCommit1.reason
          } else {
          commit1HeadForToken = afterCommit1.head
          await writeTextAt(rootPath, tokenPath, JSON.stringify({ date: today, head_at_start: closeoutHead, docs_done: true, commit1_head: afterCommit1.head, updated_at: nowIso() }, null, 2))
          const state = await assertJsonHealthy(rootPath, 'docs/ai_memory/state/project_state.json', {})
          const prev = state.last_handoff
          const alreadyRecorded = prev !== null && prev !== undefined && prev.summary === summary && state.repository !== undefined && state.repository.push_state === 'pending' && state.repository.remote_sha === afterCommit1.head
          if (!alreadyRecorded) {
            state.revision = (state.revision || 0) + 1
            state.updated_at = nowIso()
            state.repository = state.repository || {}
            state.repository.branch = git.branch
            state.repository.dirty = false
            state.repository.remote_sha = afterCommit1.head
            state.repository.last_published_sha = afterCommit1.head
            state.repository.push_state = 'pending'
            state.repository.push_verified_at = null
            state.last_handoff = { summary, next, updated_at: nowIso(), branch: git.branch }
          }
          // release 必须和 commit2 成功绑定：commit2 失败时仍保留/恢复 holding，
          // 这样返回的“直接重试 clock_out”才不会被 ownershipGuard 自己拦死。
          state.ownership = { writer: 'baton', logical_state: 'released', updated_at: nowIso() }
          await writeTextAt(rootPath, 'docs/ai_memory/state/project_state.json', JSON.stringify(state, null, 2))
          const add2 = await sh('git add docs/ai_memory/state/project_state.json', rootPath)
          if (add2.exitCode === 0) {
            const commit2 = await sh('git commit -m "baton: 记录发布 last_published_sha"', rootPath)
            recordCommitOk = commit2.exitCode === 0
            if (!recordCommitOk && !/nothing to commit/i.test(commit2.out + commit2.err)) addError = 'commit2 失败：' + commit2.err
          } else {
            addError = '发布记录 git add 失败：' + add2.err
          }
          if (recordCommitOk) {
            // 只有发布记录提交成功，才真正释放原子锁。
            const refRelease = await releaseOwnershipRef(rootPath)
            releaseOk = refRelease.ok
            if (releaseOk) {
              await tombstoneOwnershipLock(rootPath)
            } else {
              releaseError = refRelease.reason
              addError = 'commit2 已完成，但 ownership 释放未完成：' + refRelease.reason
            }
          } else if (ownershipAtCloseoutStart !== null && ownershipAtCloseoutStart.logical_state === 'holding') {
            // commit2/add2 失败：恢复调用开始时的持有态并重新暂存，供 phase2Retry 直接续跑。
            const recoverState = await assertJsonHealthy(rootPath, 'docs/ai_memory/state/project_state.json', {})
            recoverState.ownership = ownershipAtCloseoutStart
            recoverState.updated_at = nowIso()
            await writeTextAt(rootPath, 'docs/ai_memory/state/project_state.json', JSON.stringify(recoverState, null, 2))
            await sh('git add docs/ai_memory/state/project_state.json', rootPath)
          }
          }
        }
        await writeTextAt(rootPath, tokenPath, JSON.stringify({ date: today, head_at_start: closeoutHead, docs_done: true, commit1_head: commit1HeadForToken, committed, record_committed: recordCommitOk, updated_at: nowIso() }, null, 2))
        const finalHead = await verifiedGitHead(rootPath)
        if (!finalHead.ok && addError === null) addError = '无法取得收尾后 HEAD：' + finalHead.reason
        const finalGit = { head: finalHead.head, branch: git.branch, remotes: git.remotes }
        const failed = addError !== null
        const reportNow = (await readTextAt(rootPath, monthlyHtmlRel)) || ''
        const reportExists = reportNow.startsWith('<!doctype html>') && reportNow.indexOf('</html>') !== -1
        if (monthlyHtmlStatus === 'unverified') monthlyHtmlStatus = reportExists ? 'old' : 'missing'
        const monthlyHtmlLine = reportExists
          ? (monthlyHtmlStatus === 'old' ? '统计 HTML（旧版，本次未刷新）：' : '统计 HTML：') + monthlyHtmlAbsolute
          : '统计 HTML：未生成（' + (monthlyHtmlError || '文件不存在或完整性校验失败') + '）'
        return {
          ok: !failed,
          committed,
          record_committed: recordCommitOk,
          released: releaseOk,
          release_incomplete: recordCommitOk && !releaseOk,
          release_error: releaseError,
          docs_skipped: docsSkipped,
          local_head: finalGit.head,
          push_state: committed ? 'pending' : null,
          docs_updated: !docsSkipped,
          metrics: { today, monthly_html: monthlyHtmlRel, monthly_html_absolute: reportExists ? monthlyHtmlAbsolute : null, monthly_html_status: monthlyHtmlStatus, monthly_html_line: monthlyHtmlLine, actual_model: actualModel, reviewer_model: reviewerModel },
          scope_violations: scopeViolations,
          protected_violations: protectedViolations,
          size_warnings: sizeWarnings,
          lean_report: leanReport,
          scope_fail: scopeViolations.length > 0,
          protected_fail: protectedViolations.length > 0,
          next_step: failed ? null : (finalGit.remotes.length > 0 ? {
            command: 'git push ' + (pushPlan.target || 'origin') + ' ' + finalGit.branch,
            then: '用 pwsh 执行上述 push（一次推送包含收尾提交与发布记录提交），随后调用 baton_verify_push：工具自行 ls-remote / gh api 实查远端 SHA；若插件环境两通道均不可用，由主会话 pwsh 执行 ls-remote 取得真实 SHA 写入交接并明示「弱核验·主会话实查」；核验通过后调用 baton_record_push 记账',
          } : {
            command: null,
            then: '本地仓库无远端：无需 push；核验用 baton_verify_push（remote_sha=本地 HEAD、source=local）+ baton_record_push 记账',
          }),
          note: failed
            ? (releaseError !== null
              ? '收尾失败：' + addError + '（发布记录已提交但原子锁仍在，禁止 push；请先调用 baton_release 完成释放）'
              : '收尾失败：' + addError + '（文档写入已由 closeout token 标记，直接重试 clock_out 即可：文档不会重复追加，只重跑 commit）')
            : (committed ? '两次本地提交（收尾 + 发布记录）已就绪，随一次 push 推送；push 核验后记得 baton_record_push 记账' : '本地无新增提交（工作区干净或已在之前提交）'),
          failure: addError,
        }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_complete',
      description: 'Baton：「完成」任务级收尾：action=finish（默认）置「待验收」；action=accept 在用户验收通过后置 completed 并写验收记录（幂等防重复）。均更新任务状态与记录、记 metrics、给下一步。不 commit/push（那些留给下班）。',
      parameters: simple({ path: '项目根目录', task_id: '任务 ID', note: '完成说明', next: '下一步建议', actual_model: '实际执行模型（可选，记入 Metrics）', action: 'finish（默认，置待验收） | accept（用户已验收，置完成）' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const taskId = (args.task_id || '').trim()
        const action = (args.action || 'finish').trim()
        if (taskId === '') return { ok: false, reason: '缺少 task_id' }
        if (!/^[A-Za-z0-9_\-]{1,64}$/.test(taskId)) return { ok: false, reason: 'task_id 只允许字母/数字/下划线/连字符（1-64 位）' }
        return opEnvelope(rootPath, 'complete:' + taskId + ':' + action, async () => {          const ownGate = await ownershipGuard(rootPath)
        if (!ownGate.pass) return { ok: false, reason: '未持有单写入者锁：' + ownGate.reason }
        const secHit = secretHits((args.note || '') + '\n' + (args.next || ''))
        if (secHit.length > 0) return { ok: false, reason: '输入疑似含敏感信息（' + secHit.join('、') + '）：拒绝写入任务记录（凭据绝不进入 Git 跟踪文档）', secret_hits: secHit }
        const tasks = await assertJsonHealthy(rootPath, 'docs/ai_memory/state/tasks.json', { tasks: [] })
        const found = (tasks.tasks || []).find((t) => t.id === taskId)
        if (found === undefined) return { ok: false, reason: '任务不存在：' + taskId }
        // —— accept 路径：用户已验收，把「待验收」最终置为「已完成」（此前状态机缺少这一步，任务永远无法真正完成）——
        if (action === 'accept') {
          if (found.status === 'completed') {
            // 断点恢复：tasks 已置 completed 但完成条目验收标注未更新（崩溃窗口）→ 断点修复补齐
            const finRep2 = (await readTextAt(rootPath, 'docs/ai_memory/tasks/task_finished.md')) || ''
            const segRep2 = finRep2.split('## ').find((s) => s.indexOf(taskId + '｜') === 0 || s.indexOf(taskId + '|') === 0) || ''
            if (segRep2 !== '' && segRep2.indexOf('用户验收：已验收') === -1) {
              const idx2 = finRep2.indexOf('## ' + taskId + '｜')
              const segEnd2 = finRep2.indexOf('\n## ', idx2 + 1)
              const seg2 = segEnd2 === -1 ? finRep2.slice(idx2) : finRep2.slice(idx2, segEnd2)
              const rest2 = segEnd2 === -1 ? '' : finRep2.slice(segEnd2)
              await writeTextAt(rootPath, 'docs/ai_memory/tasks/task_finished.md', finRep2.slice(0, idx2) + seg2.replace(/- 用户验收：未验收/, '- 用户验收：已验收（' + todayLocal() + '）') + rest2)
              await appendRevision(rootPath, 'docs/ai_memory/tasks/task_finished.md', '断点修复：用户验收通过 ' + taskId + ' ' + found.title, agentLabel(args))
              return { ok: true, completed: taskId, status: 'completed', note: '任务已验收过：完成条目验收标注缺失，已修复补齐（崩溃断点恢复），未重复任何副作用' }
            }
            return { ok: true, completed: taskId, status: 'completed', note: '任务已验收过（无需重复）：未做任何写入' }
          }
          if (found.status !== 'awaiting_acceptance') {
            return { ok: false, reason: '任务尚未 finish（当前状态：' + found.status + '）：先调用 baton_complete(action=finish) 置「待验收」，用户验收通过后再 accept' }
          }
          // 门禁必须在 completed 之前成立：
          // 无有效执行证据或证据行占位 → 拒绝 accept，保持 awaiting_acceptance，零 completed 写入。
          const a2Gate = await taskEvidenceGate(rootPath, taskId)
          if (!a2Gate.evOk) {
            return { ok: false, reason: '任务 ' + taskId + ' 缺少有效执行证据（source SHA 绑定且为 HEAD 祖先，跨机可见）：保持「待验收」未做任何写入。先用 baton_record_actual 记录执行模型与来源（证据绑定当前提交）后再 accept', status: 'awaiting_acceptance' }
          }
          if (a2Gate.placeholder) {
            return { ok: false, reason: '任务 ' + taskId + ' 完成条目证据行为占位或缺失：保持「待验收」未做任何写入。把 task_finished 证据行补为真实结果（命令 → 结果）后再 accept', status: 'awaiting_acceptance' }
          }
          found.status = 'completed'
          found.phase = '已验收'
          found.completed_at = nowIso()
          found.accepted_at = nowIso()
          found.next_step = (args.next || '无').trim()
          found.updated_at = nowIso()
          tasks.revision = (tasks.revision || 0) + 1
          if (tasks.current_task_id === taskId) { tasks.current_task_id = null; tasks.active_work = null }
          await writeTextAt(rootPath, 'docs/ai_memory/state/tasks.json', JSON.stringify(tasks, null, 2))
          const fin = (await readTextAt(rootPath, 'docs/ai_memory/tasks/task_finished.md')) || ''
          const idx = fin.indexOf('## ' + taskId + '｜')
          if (idx !== -1) {
            const segEnd = fin.indexOf('\n## ', idx + 1)
            const seg = segEnd === -1 ? fin.slice(idx) : fin.slice(idx, segEnd)
            const rest = segEnd === -1 ? '' : fin.slice(segEnd)
            await writeTextAt(rootPath, 'docs/ai_memory/tasks/task_finished.md', fin.slice(0, idx) + seg.replace(/- 用户验收：未验收/, '- 用户验收：已验收（' + todayLocal() + '）') + rest)
          } else {
            await appendTextAt(rootPath, 'docs/ai_memory/tasks/task_finished.md', '\n## ' + taskId + '｜' + found.title + '\n- 完成日期：' + todayLocal() + '\n- 用户验收：已验收（' + todayLocal() + '）\n- 结果：' + (args.note || '') + '\n')
          }
          await appendRevision(rootPath, 'docs/ai_memory/tasks/task_finished.md', '用户验收通过：' + taskId + ' ' + found.title, agentLabel(args))
          await appendTextAt(rootPath, '.baton/local/metrics/' + todayLocal() + '.jsonl',
            JSON.stringify({ ts: nowIso(), type: 'task_accept', task_id: taskId, actual_model: (args.actual_model || 'unknown').trim() }) + '\n')
          const open = (tasks.tasks || []).filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
          return {
            ok: true,
            completed: taskId,
            status: 'completed',
            next: (args.next || '无').trim(),
            remaining: open.map((t) => ({ id: t.id, title: t.title, status: t.status, next_step: t.next_step || null })),
            note: '任务已验收完成（状态机终态）；下班时才 commit/push',
          }
        }
        // —— finish 路径（默认）：置「待验收」——
        // 状态机诚实落地：已完成任务不被 finish 重新打开；
        // 已在「待验收」的任务不重复追加记录/索引/metrics（B3：若完成条目缺失则断点修复补齐）
        if (found.status === 'awaiting_acceptance') {
          const finRep = (await readTextAt(rootPath, 'docs/ai_memory/tasks/task_finished.md')) || ''
          const segRep = finRep.split('## ').find((s) => s.indexOf(taskId + '｜') === 0 || s.indexOf(taskId + '|') === 0) || ''
          if (segRep === '') {
            await appendTextAt(rootPath, 'docs/ai_memory/tasks/task_finished.md',
              '\n## ' + taskId + '｜' + found.title + '\n- 完成日期：' + todayLocal() + '\n- 用户验收：未验收\n- 结果：' + (args.note || '') + '\n- 证据：（待补充命令 → 结果）\n- 边界：（待补充）\n')
            await appendRevision(rootPath, 'docs/ai_memory/tasks/task_finished.md', '断点修复：完成任务 ' + taskId + ' ' + found.title, agentLabel(args))
            return { ok: true, completed: taskId, status: 'awaiting_acceptance', note: '任务已在「待验收」但完成条目缺失：已修复补齐（崩溃断点恢复），等待用户验收 accept' }
          }
          return { ok: true, completed: taskId, status: 'awaiting_acceptance', note: '任务已在「待验收」：无需重复 finish，未做任何写入（等待用户验收 accept）' }
        }
        if (found.status === 'completed') {
          return { ok: true, completed: taskId, status: 'completed', note: '任务已完成：finish 不会重新打开已完成任务；如需重新处理请新建任务' }
        }
        found.status = 'awaiting_acceptance'
        found.phase = '待验收'
        found.next_step = (args.next || '无').trim()
        found.updated_at = nowIso()
        tasks.revision = (tasks.revision || 0) + 1
        await writeTextAt(rootPath, 'docs/ai_memory/state/tasks.json', JSON.stringify(tasks, null, 2))
        await appendRevision(rootPath, 'docs/ai_memory/tasks/task_finished.md', '完成任务：' + found.title, agentLabel(args))
        await appendTextAt(rootPath, 'docs/ai_memory/tasks/task_finished.md',
          '\n## ' + taskId + '｜' + found.title + '\n- 完成日期：' + todayLocal() + '\n- 用户验收：未验收\n- 结果：' + (args.note || '') + '\n- 证据：（待补充命令 → 结果）\n- 边界：（待补充）\n')
        // 视图同步：先把任务行从 todo/progress 表机械移除（不再只追加修订说明），再写修订记录留痕
        await removeTaskRow(rootPath, 'docs/ai_memory/tasks/task_todo.md', taskId)
        await removeTaskRow(rootPath, 'docs/ai_memory/tasks/task_progress.md', taskId)
        await appendRevision(rootPath, 'docs/ai_memory/tasks/task_todo.md', '完成任务：' + taskId + ' ' + found.title + '（已移出待办）', agentLabel(args))
        await appendRevision(rootPath, 'docs/ai_memory/tasks/task_progress.md', '完成任务：' + taskId + ' ' + found.title + '（已移出进行中）', agentLabel(args))
        await addIndexEntry(rootPath, {
          id: 'ARCH-' + idSuffix(), document_type: 'task_record', title: found.title,
          time: { start: todayLocal(), end: null }, modules: ['docs/ai_memory/tasks/task_finished.md'],
          keywords: [taskId, found.title], summary: (args.note || found.title).slice(0, 60),
          task_ids: [taskId], decision_ids: [], issue_ids: [],
          path: 'docs/ai_memory/tasks/task_finished.md', line_start: null, updated_at: nowIso(),
        })
        await appendTextAt(rootPath, '.baton/local/metrics/' + todayLocal() + '.jsonl',
          JSON.stringify({ ts: nowIso(), type: 'task_complete', task_id: taskId, actual_model: (args.actual_model || 'unknown').trim() }) + '\n')
        const open = (tasks.tasks || []).filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
        return {
          ok: true,
          completed: taskId,
          status: 'awaiting_acceptance',
          next: (args.next || '无').trim(),
          remaining: open.map((t) => ({ id: t.id, title: t.title, status: t.status, next_step: t.next_step || null })),
          warning: '任务已置「待验收」（用户未验收）：请按任务验收标准补齐证据（命令 → 结果）写入 task_finished 证据行；用户验收通过后调用 baton_complete(task_id=' + taskId + ', action=accept) 置完成',
          note: '任务已关闭进入待验收；下班时才 commit/push',
        }
        }, false)
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_save_design',
      description: 'Baton：「保存设计规范」：把用户确认的设计事实固化到 ui_spec 分册 + 更新索引。冲突保留历史、标注当前有效版本。',
      parameters: simple({ path: '项目根目录', category: 'global | component | page | workflow', title: '规范标题', facts: '设计事实内容（多条用分号或换行）' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const cat = ['global', 'component', 'page', 'workflow'].includes(args.category) ? args.category : 'global'
        const title = (args.title || '未命名规范').trim()
        const facts = (args.facts || '').trim()
        if (facts === '') return { ok: false, reason: '缺少 facts' }
        // opId 含 facts 摘要：同标题不同内容 = 新版本取代（正常执行）；参数全同 = 重试（幂等短路）
        return opEnvelope(rootPath, 'dsg:' + cat + ':' + title.slice(0, 60) + ':' + facts.slice(0, 40), async () => {
          const ownGate = await ownershipGuard(rootPath)
        if (!ownGate.pass) return { ok: false, reason: '未持有单写入者锁：' + ownGate.reason }
        const secHit = secretHits(title + '\n' + facts)
        if (secHit.length > 0) return { ok: false, reason: '输入疑似含敏感信息（' + secHit.join('、') + '）：拒绝固化设计规范（凭据绝不进入 Git 跟踪文档）', secret_hits: secHit }
        const file = 'docs/ai_memory/ui_spec/' + cat + '.md'
        const dsgId = 'DSG-' + todayLocal().replace(/-/g, '') + '-' + String(Date.now()).slice(-4)
        let fileBefore = (await readTextAt(rootPath, file)) || ''
        // 缺失分册先建规范头（含【修订记录】表），保证任何分类保存都有完整结构
        if (fileBefore === '') {
          const catName = { global: '全局', component: '组件', page: '页面', workflow: '工作流' }[cat]
          const header = '# ' + catName + '设计规范\n\n> 本分册由「保存设计规范」自动维护；冲突保留历史、标注当前有效版本，详见 state/archive_index.json。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n'
          await writeTextAt(rootPath, file, header)
          fileBefore = header
        }
        // 冲突处理机械化：只把「同标题」旧条目（同一规范的修订版）标为已取代；不同主题的规范互不影响
        const inLines = fileBefore.split('\n')
        let currentTitle = null
        const outLines = []
        for (const l of inLines) {
          const h = /^##\s+[^｜\n]+｜(.*)$/.exec(l)
          if (h) { currentTitle = h[1].trim(); outLines.push(l); continue }
          if (currentTitle === title && /^- 状态：当前有效\s*$/.test(l)) { outLines.push('- 状态：已取代（取代者 ' + dsgId + '）'); continue }
          outLines.push(l)
        }
        const superseded = outLines.join('\n')
        if (superseded !== fileBefore) await writeTextAt(rootPath, file, superseded)
        await appendRevision(rootPath, file, '保存设计规范：' + title, agentLabel(args))
        await appendTextAt(rootPath, file,
          '\n## ' + dsgId + '｜' + title + '\n- 日期：' + todayLocal() + '\n- 状态：当前有效\n- 事实：' + facts + '\n- 冲突处理：本分册旧「当前有效」条目已自动标「已取代」；跨分册冲突由 AI 标注\n')
        // line_start 修正：追加与修订行完成后按条目实际行号定位，避免偏一行
        const afterDesign = (await readTextAt(rootPath, file)) || ''
        const dsgIdx = afterDesign.split('\n').findIndex((l) => l.indexOf('## ' + dsgId + '｜') !== -1)
        const lineStart = dsgIdx !== -1 ? dsgIdx + 1 : null
        const index = await assertJsonHealthy(rootPath, 'docs/ai_memory/state/archive_index.json', { entries: [] })
        index.entries.push({
          id: 'ARCH-' + dsgId, document_type: 'design_spec', title,
          time: { start: todayLocal(), end: null }, modules: ['ui_spec/' + cat + '.md'],
          keywords: [title, cat], summary: facts.slice(0, 60), task_ids: [], decision_ids: [dsgId], issue_ids: [],
          path: file, line_start: lineStart, updated_at: nowIso(),
        })
        index.revision = (index.revision || 0) + 1
        await writeTextAt(rootPath, 'docs/ai_memory/state/archive_index.json', JSON.stringify(index, null, 2))
        return { ok: true, decision_id: dsgId, saved_to: file, note: '已固化；后续 UI 任务必须引用该规范，Fidelity 以其为比对事实' }
        })
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_update_docs',
      description: 'Baton：「更新项目文档」：把当前进度增量写入日报/current/handoff 检查点后停止。不 commit/push。',
      parameters: simple({ path: '项目根目录', summary: '进度摘要', next: '下一步' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const today = todayLocal()
        // opId 含摘要：同摘要重试幂等短路；不同摘要 = 新的存档点（正常追加）
        return opEnvelope(rootPath, 'docs:' + (args.summary || '').trim().slice(0, 60), async () => {
          const ownGate = await ownershipGuard(rootPath)
        if (!ownGate.pass) return { ok: false, reason: '未持有单写入者锁：' + ownGate.reason }
        const secHit = secretHits((args.summary || '') + '\n' + (args.next || ''))
        if (secHit.length > 0) return { ok: false, reason: '输入疑似含敏感信息（' + secHit.join('、') + '）：拒绝存档（凭据绝不进入 Git 跟踪文档）', secret_hits: secHit }
        const dailyRel = await ensureDailyFile(rootPath, today)
        // 检查点全字段：SKILL 要求 HEAD/修改文件/已验证/未验证/阻塞/凭据检查，不得只有摘要与下一步
        const gitNow = await gitSnapshot(rootPath)
        const fileSummary = gitNow.files_count === 0 ? '无'
          : (gitNow.files_count > 30 ? gitNow.files.join('、') + ' 等共 ' + gitNow.files_count + ' 个文件' : gitNow.files.join('、'))
        const agent = agentLabel(args)
        const e8 = east8Stamp()
        const saveTopic = topicOf(args.summary, '中途存档')
        await appendTextAt(rootPath, dailyRel,
          '\n## 中途存档｜' + saveTopic + '｜' + e8.display + '｜' + agent + '\n\n- 时间：' + e8.display + '\n- 摘要：' + (args.summary || '') + '\n- 下一步：' + (args.next || '') + '\n- 分支 / HEAD：' + gitNow.branch + ' / ' + gitNow.head + '\n- 改动文件：' + fileSummary + '\n- 已验证：未跑\n- 未验证项及原因：未跑\n- 阻塞：（无）\n- 凭据检查：未记录敏感信息\n')
        await updateCurrentFacts(rootPath,
          '- 最近存档：' + today + '\n- 摘要：' + (args.summary || '') + '\n- 下一步：' + (args.next || '') + '\n',
          saveTopic + '｜中途存档', agent)
        await addIndexEntry(rootPath, {
          id: 'ARCH-' + idSuffix(), document_type: 'checkpoint', title: '中途存档｜' + saveTopic,
          time: { start: today, end: null }, modules: ['docs/ai_memory/daily_log/daily_' + today + '.md'],
          keywords: ['存档', '检查点', today, agent, saveTopic], summary: (args.summary || '').slice(0, 60),
          task_ids: [], decision_ids: [], issue_ids: [],
          path: 'docs/ai_memory/daily_log/daily_' + today + '.md', line_start: null, updated_at: nowIso(),
        })
        await appendHandoffEntry(rootPath,
          '### ' + hoId(agent) + '｜中途存档｜' + saveTopic + '\n' +
          '- 时间：' + e8.display + '\n- 交接状态：检查点（不释放工作区）\n- 摘要：' + (args.summary || '') + '\n- 下一步：' + (args.next || ''),
          '中途存档｜' + saveTopic, agent)
        return { ok: true, saved: true, note: '已存档；未 commit/push' }
        })
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_init',
      description: 'Baton：「Baton init」：生成项目骨架（docs/ai_memory + .baton），检测旧 skill/旧文档并给出迁移计划。绝不覆盖已有文件。npm 组合包内置真 SKILL 与入口段模板时直接安装三端镜像（已存在则跳过）；无包环境生成 README 提示占位，可运行 scripts/baton-install.ps1 -Scope Project 补齐。',
      parameters: simple({ path: '项目根目录', project_name: '项目名（用于占位符替换）' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const name = (args.project_name || 'untitled').trim()
        // 统一凭据扫描：project_name 会进入 Git 跟踪文档模板
        const initHits = secretHits(name)
        if (initHits.length > 0) return { ok: false, reason: 'project_name 疑似含敏感信息（' + initHits.join('、') + '）：拒绝写入（凭据绝不进入 Git 跟踪文档）', secret_hits: initHits }
        const created = []
        const skipped = []
        const templates = inlineTemplates(name, agentLabel(args))
        for (const rel of Object.keys(templates)) {
          const existing = await readTextAt(rootPath, rel)
          const want = templates[rel] || ''
          // 文件存在且（内容非空 或 模板内容本身为空如 decisions.jsonl）→ 跳过；
          // 空文件仅在模板有内容时才视为缺失补模板（防止用户内容被清空的文件永远报“补模板”）
          if (existing !== null && (existing.trim() !== '' || want.trim() === '')) { skipped.push(rel); continue }
          await writeTextAt(rootPath, rel, want)
          created.push(rel)
        }
        const gi = (await readTextAt(rootPath, '.gitignore')) || ''
        if (!gi.includes('.baton/config.json') && !gi.includes('.baton/private-patterns.txt')) {
          await writeTextAt(rootPath, '.gitignore', gi + '\n# .baton 配置入库（clone 后即恢复门禁/路由配置）；本机与运行时文件仍忽略\n.baton/private-patterns.txt\n.baton/publish-identity.txt\n.baton/local/\n\n')
          created.push('.gitignore（追加）')
        }
        const migration = []
        // 旧 skill 检测：扫描三端 skills 目录下名字含 workday / ebowork 的 skill（含拆分后的 ebowork-* 系列），只提示不删除。
        for (const tool of ['.agents', '.claude', '.cursor']) {
          const skillsDir = tool + '/skills'
          const dirT = await fs.resolve(skillsDir, { cwd: rootPath }).catch(() => null)
          if (dirT !== null) {
            const entries = await fs.listDir(dirT).catch(() => [])
            for (const e of entries) {
              if (e.type === 'directory' && /workday|ebowork/i.test(e.name)) {
                migration.push('旧 skill：' + skillsDir + '/' + e.name + ' → 建议归档到 .baton-legacy/（不自动删除）')
              }
            }
          }
        }
        const agentsMd = await readTextAt(rootPath, 'AGENTS.md')
        if (agentsMd !== null && /workday-knowledge-manager|workday_knowledge|继续EboWork|EboWork init/i.test(agentsMd)) migration.push('AGENTS.md 含旧 skill 引用 → 建议替换为 Baton 入口段')
        const claude = await readTextAt(rootPath, 'CLAUDE.md')
        if (claude !== null && /workday-knowledge-manager|workday_knowledge|继续EboWork|EboWork init/i.test(claude)) migration.push('CLAUDE.md 含旧 skill 引用 → 建议替换为 Baton 入口段')
        // 旧命名文档检测：提示运行 baton-migrate.ps1 一次性迁移（不手动配置 doc_roles）。
        const legacyDocHits = []
        const legacyDocs = [
          ['overview', 'docs/ai_memory/00_项目总览架构.md'],
          ['constraints', 'docs/ai_memory/01_encoding_constraint.md'],
          ['index', 'docs/ai_memory/INDEX.md'],
          ['commands', 'docs/ai_memory/COMMANDS.md'],
          ['handoff_latest', 'docs/ai_memory/handoff_latest.md'],
        ]
        for (const [role, oldPath] of legacyDocs) {
          if (await readTextAt(rootPath, oldPath) !== null) {
            // 角色已解析到规范路径且规范文件存在 → 该角色已由规范文件接管；Windows 大小写不敏感下 INDEX.md 与 index.md 是同一文件，不报旧文档
            const resolved = await docRole(rootPath, role)
            if (resolved !== undefined && resolved.toLowerCase() === oldPath.toLowerCase()) continue
            legacyDocHits.push('旧文档：' + oldPath + '（角色 ' + role + '）→ 运行 scripts/baton-migrate.ps1 -ProjectRoot ' + rootPath + ' 一次性迁移为规范名并备份旧文件')
          }
        }
        for (const h of legacyDocHits) migration.push(h)
        if (migration.length > 0) migration.push('提示：旧资产统一用 scripts/baton-migrate.ps1 迁移（建新文档搬内容→改引用→备份下线），勿手工零散处理')
        const hasGit = await statAt(rootPath, '.git') !== null
        const adapters = []
        // 入口段幂等升级：EOL 不敏感比较（Windows CRLF 检出 vs 内联 LF 不得误判为差异）；
        // 段后存在**无标题用户内容**时拒绝自动重写（绝不吞用户规则，报告人工处理）。
        const nl = (s) => String(s).replace(/\r\n/g, '\n')
        async function upsertEntrySegment(rel, seg, marker) {
          const existing = (await readTextAt(rootPath, rel)) || ''
          const eol = existing.indexOf('\r\n') !== -1 ? '\r\n' : '\n'
          // 成对 marker：只替换 BEGIN/END 之间的内容，绝不动段外用户内容；
          // 旧单 marker（历史安装）反推段落边界并升级为成对。
          const beginMark = '<!-- BATON:BEGIN -->'
          const endMark = '<!-- BATON:END -->'
          const wrapped = beginMark + eol + nl(seg).trimEnd() + eol + endMark
          const bIdx = existing.indexOf(beginMark)
          const eIdx = existing.indexOf(endMark)
          if (bIdx !== -1 && eIdx !== -1 && eIdx > bIdx) {
            const candidate = existing.slice(0, bIdx) + beginMark + eol + nl(seg).trimEnd() + eol + existing.slice(eIdx)
            if (nl(candidate) !== nl(existing)) {
              await writeTextAt(rootPath, rel, candidate)
              adapters.push(rel + '（入口段成对更新）')
            }
            return
          }
          if (existing.indexOf(marker) === -1) {
            await writeTextAt(rootPath, rel, existing.trimEnd() + eol + eol + wrapped.trimEnd() + eol)
            adapters.push(rel + '（入口段新建·成对 marker）')
            return
          }
          const start = existing.indexOf(marker)
          const head = existing.slice(0, start)
          const heads = [...head.matchAll(/^#{1,6} /gm)]
          const segStart = heads.length > 0 ? heads[heads.length - 1].index : 0
          const tail = existing.slice(start)
          const next = /^#{1,6} /m.exec(tail)
          const segEnd = next ? start + next.index : -1
          if (segEnd === -1 && nl(existing.slice(segStart)).trim() !== nl(wrapped).trim()) {
            // 段后无下一标题且现有段内容与新版不一致：无法判定段边界，拒绝自动重写以保护用户尾部
            adapters.push(rel + '（⚠ 段后有无标题内容，跳过自动更新，请人工核对）')
            return
          }
          const prefix = existing.slice(0, segStart).trimEnd()
          const suffix = segEnd >= 0 ? existing.slice(segEnd) : ''
          const candidate = (prefix === '' && suffix === '')
            ? nl(wrapped).trimEnd() + eol
            : prefix + eol + eol + nl(wrapped).trimEnd() + eol + eol + suffix
          if (nl(candidate) !== nl(existing)) {
            await writeTextAt(rootPath, rel, candidate)
            adapters.push(rel + '（入口段更新·升级成对 marker）')
          }
        }
        const entrySegs = [
          ['AGENTS.md', '## Baton 项目协作入口\n\n本项目使用 Baton 协作系统（skill：`baton`，位于 `.agents/skills/baton/SKILL.md`）。规则：\n\n1. 用户说「上班啦」「下班啦」「继续工作」「保存设计规范」「完成」「更新项目文档」「Baton init」、回复任务编号、或 Git 自然语言请求时，**必须按 baton skill 执行**；本环境没有 `baton_*` 工具时，按 SKILL 的「无插件模式」章节用 git+文件手工等价执行。\n2. 项目真相 = `docs/ai_memory/`（Git 同步，唯一长期记忆，禁止另建第二套）；`.baton/` 为本机私有。\n3. 事实优先级：Git / 真实文件 / 新鲜验证 > `state/*.json` > 交接/日报 > 聊天自述。\n4. 历史只增不改（只追加或标「已取代」）；危险 Git（force push / reset --hard / 危险 clean / 未授权 rebase）禁止。\n5. 未做远端 SHA 核验（`git ls-remote origin <分支>` == 本地 HEAD）不得报告「下班完成」。\n6. 查询历史先查 `state/archive_index.json`，再只读命中文件片段；禁止全量读取 `docs/ai_memory`。'],
          ['CLAUDE.md', '## Baton 项目协作入口（Claude Code 端，勿删此段）\n\n本项目使用 Baton 协作系统（skill：`baton`，位于 `.claude/skills/baton/SKILL.md`）。规则：\n\n1. 用户说「上班啦」「下班啦」「继续工作」「保存设计规范」「完成」「更新项目文档」「Baton init」、回复任务编号、或 Git 自然语言请求时，**必须按 baton skill 执行**；本环境没有 `baton_*` 工具时，按 SKILL 的「无插件模式」章节用 git+文件手工等价执行。\n2. 项目真相 = `docs/ai_memory/`（Git 同步，唯一长期记忆，禁止另建第二套）；`.baton/` 为本机私有。\n3. 事实优先级：Git / 真实文件 / 新鲜验证 > `state/*.json` > 交接/日报 > 聊天自述。\n4. 历史只增不改（只追加或标「已取代」）；危险 Git（force push / reset --hard / 危险 clean / 未授权 rebase）禁止。\n5. 未做远端 SHA 核验（`git ls-remote origin <分支>` == 本地 HEAD）不得报告「下班完成」。\n6. 查询历史先查 `state/archive_index.json`，再只读命中文件片段；禁止全量读取 `docs/ai_memory`。'],
          ['.cursorrules', '# Baton 项目协作入口（Cursor 端，勿删此段）\n\n本项目使用 Baton 协作系统（skill：`baton`，位于 `.cursor/skills/baton/SKILL.md`）。规则：\n\n1. 用户说「上班啦」「下班啦」「继续工作」「保存设计规范」「完成」「更新项目文档」「Baton init」、回复任务编号、或 Git 自然语言请求时，**必须按 baton skill 执行**；本环境没有 `baton_*` 工具时，按 SKILL 的「无插件模式」章节用 git+文件手工等价执行。\n2. 项目真相 = `docs/ai_memory/`（Git 同步，唯一长期记忆，禁止另建第二套）；`.baton/` 为本机私有。\n3. 事实优先级：Git / 真实文件 / 新鲜验证 > `state/*.json` > 交接/日报 > 聊天自述。\n4. 历史只增不改（只追加或标「已取代」）；危险 Git（force push / reset --hard / 危险 clean / 未授权 rebase）禁止。\n5. 未做远端 SHA 核验（`git ls-remote origin <分支>` == 本地 HEAD）不得报告「下班完成」。\n6. 查询历史先查 `state/archive_index.json`，再只读命中文件片段；禁止全量读取 `docs/ai_memory`。']
        ]
        for (const [rel, seg] of entrySegs) await upsertEntrySegment(rel, seg, 'Baton 项目协作入口')
        // P0-2：npm 组合包内置真 SKILL 时直接镜像（绝不覆盖已有 SKILL.md）；无包环境退化为 README 占位提示
        const pkgDir = typeof BATON_PKG_DIR !== 'undefined' ? BATON_PKG_DIR : null
        let mdcSeg = null
        if (pkgDir !== null) {
          try {
            const mt = await fs.resolve(pkgDir + '/templates/adapter/CURSOR.rules.mdc')
            const mi = await fs.stat(mt)
            if (mi !== undefined) mdcSeg = await fs.readText(mt)
          } catch (e) { mdcSeg = null }
        }
        if (mdcSeg === null) {
          mdcSeg = '---\ndescription: Baton 项目协作入口。口令（上班啦/下班啦等）必须按 Baton skill 执行。\nalwaysApply: true\n---\n\n# Baton 项目协作入口（Cursor 端，勿删此段）\n\n本项目使用 Baton 协作系统（skill：`baton`，位于 `.cursor/skills/baton/SKILL.md`）。规则：\n\n1. 用户说「上班啦」「下班啦」「继续工作」「保存设计规范」「完成」「更新项目文档」「Baton init」、回复任务编号、或 Git 自然语言请求时，**必须按 baton skill 执行**；本环境没有 `baton_*` 工具时，按 SKILL 的「无插件模式」章节用 git+文件手工等价执行。\n2. 项目真相 = `docs/ai_memory/`（Git 同步，唯一长期记忆，禁止另建第二套）；`.baton/` 为本机私有。\n3. 事实优先级：Git / 真实文件 / 新鲜验证 > `state/*.json` > 交接/日报 > 聊天自述。\n4. 历史只增不改（只追加或标「已取代」）；危险 Git（force push / reset --hard / 危险 clean / 未授权 rebase）禁止。\n5. 未做远端 SHA 核验（`git ls-remote origin <分支>` == 本地 HEAD）不得报告「下班完成」。\n6. 查询历史先查 `state/archive_index.json`，再只读命中文件片段；禁止全量读取 `docs/ai_memory`。\n'
        }
        const mdcRel = '.cursor/rules/baton.mdc'
        const existingMdc = await readTextAt(rootPath, mdcRel)
        if (existingMdc === null) {
          await writeTextAt(rootPath, mdcRel, mdcSeg)
          adapters.push(mdcRel + '（Cursor rules）')
        } else if (pkgDir !== null && String(existingMdc).indexOf('Baton 项目协作入口') !== -1) {
          const nlMdc = (s) => String(s).replace(/\r\n/g, '\n')
          if (nlMdc(existingMdc) !== nlMdc(mdcSeg)) {
            await writeTextAt(rootPath, mdcRel, mdcSeg)
            adapters.push(mdcRel + '（Cursor rules）')
          }
        }
        let bundledSkill = null
        if (pkgDir !== null) {
          try {
            const t = await fs.resolve(pkgDir + '/skills/baton/SKILL.md')
            const info = await fs.stat(t)
            if (info !== undefined) bundledSkill = await fs.readText(t)
          } catch (e) { bundledSkill = null }
        }
        let skillMirrored = 0
        // 镜像清单：baton 主 skill + 专项 skill（lean-review/debt/doctor）
        const mirrorSkills = ['baton', 'baton-lean-review', 'baton-debt', 'baton-doctor']
        for (const dir of ['.agents/skills', '.claude/skills', '.cursor/skills']) {
          for (const s of mirrorSkills) {
            const skillPath = dir + '/' + s + '/SKILL.md'
            let bundled = null
            if (pkgDir !== null) {
              try {
                const bt = await fs.resolve(pkgDir + '/skills/' + s + '/SKILL.md')
                const bi = await fs.stat(bt)
                if (bi !== undefined) bundled = await fs.readText(bt)
              } catch (e) { bundled = null }
            }
            if (await readTextAt(rootPath, skillPath) !== null) { continue }
            if (bundled !== null) {
              await writeTextAt(rootPath, skillPath, bundled)
              skillMirrored += 1
              adapters.push(skillPath + '（真 SKILL 镜像）')
              continue
            }
            if (s === 'baton') {
              if (bundledSkill !== null) {
                await writeTextAt(rootPath, skillPath, bundledSkill)
                skillMirrored += 1
                adapters.push(skillPath + '（真 SKILL 镜像）')
                continue
              }
              const marker = dir + '/baton/README.txt'
              if (await readTextAt(rootPath, marker) === null) {
                await writeTextAt(rootPath, marker, '将 Baton 框架包 skills/baton/SKILL.md 复制到本目录，或运行 scripts/baton-install.ps1 -Scope Project -ProjectRoot <项目根> 一键完成镜像与入口写入。\n')
                adapters.push(dir + '/baton/（目录就绪）')
              }
            }
          }
        }
        return { ok: true, project_name: name, created, skipped, migration, adapters_created: adapters, skill_mirrored: skillMirrored, git_initialized: hasGit, note: hasGit ? '现在说「上班啦」即可开始；旧文档从未被改动' : '未检测到 .git：请先 git init 并完成首次提交，再使用 Baton（上班/下班依赖 Git）' }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_accept',
      description: 'Baton：一键结构验收：骨架完整性、状态文件可解析、git 可用、安全配置、发布核验凭证与远端一致，输出 PASS/FAIL + 阻塞清单。行为红线（Contract/Reviewer/Fidelity/证据等）由 AI 按 SKILL 自检，不由本工具机械判定。',
      parameters: simple({ path: '项目根目录' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const checks = []
        const need = (cond, name, detail) => checks.push({ name, pass: !!cond, detail })
        const config = await loadConfig(rootPath)
        need(config !== null, 'config.json 存在且可解析', config ? 'ok' : '缺失或损坏')
        need(config !== null && config.verify !== undefined && config.verify.remote_sha === true, '远端 SHA 核验已开启', 'verify.remote_sha 必须为 true')
        need(config !== null && config.verify !== undefined && config.verify.ff_only === true, 'ff-only 拉取已开启', 'verify.ff_only 必须为 true')
        const stateG = await readJsonGuarded(rootPath, 'docs/ai_memory/state/project_state.json', null)
        need(!stateG.corrupt && stateG.value !== null, 'project_state.json 存在且可解析', stateG.corrupt ? '损坏' : (stateG.value === null ? '缺失' : 'ok'))
        const state = stateG.value
        need(state !== null && state.repository !== null && typeof state.repository === 'object', 'state.repository 结构', state !== null ? 'ok' : '缺失')
        const shaOk = (s) => s === null || s === undefined || s === '' || /^[0-9a-f]{40}$/i.test(String(s))
        if (state !== null && state.repository) {
          need(shaOk(state.repository.remote_sha), 'remote_sha 为 40 位 SHA 或空', String(state.repository.remote_sha).slice(0, 16))
          need(shaOk(state.repository.last_published_sha), 'last_published_sha 为 40 位 SHA 或空', String(state.repository.last_published_sha).slice(0, 16))
        }
        const tasksG = await readJsonGuarded(rootPath, 'docs/ai_memory/state/tasks.json', null)
        need(!tasksG.corrupt, 'tasks.json 可解析', tasksG.corrupt ? '损坏' : 'ok')
        const tasks = tasksG.value
        need(tasks !== null && Array.isArray(tasks.tasks), 'tasks.json 结构（tasks 数组）', tasks !== null ? 'ok' : '缺失或损坏')
        const indexG = await readJsonGuarded(rootPath, 'docs/ai_memory/state/archive_index.json', null)
        need(!indexG.corrupt, 'archive_index.json 可解析', indexG.corrupt ? '损坏' : 'ok')
        const index = indexG.value
        need(index !== null && Array.isArray(index.entries), 'archive_index.json 结构（entries 数组）', index !== null ? 'ok' : '缺失或损坏')
        for (const role of ['index', 'current', 'handoff', 'commands', 'overview', 'constraints', 'validation_matrix']) {
          const f = await docRole(rootPath, role)
          need(await readTextAt(rootPath, f) !== null, f + ' 存在', 'ok')
        }
        for (const role of ['handoff', 'current']) {
          const f = await docRole(rootPath, role)
          const st = await statAt(rootPath, f)
          if (st !== null && st.size > 3 * 1024 * 1024) need(false, f + ' 体积', '超过 3MB，建议按条目分卷（主文件留摘要与读取顺序）')
          else need(true, f + ' 体积 < 3MB', st !== null ? String(Math.round(st.size / 1024)) + 'KB' : '未找到')
        }
        const git = await gitSnapshot(rootPath)
        need(git.head.length >= 7, 'git 仓库可用（HEAD 可读）', git.head.slice(0, 8))
        // 干净性豁免：上班写锁/记账会造成 state 单文件 dirty——
        // 仅当「仅 state 文件 dirty 且发布已闭环（verified 或发布声明 SHA 已含于远端历史）」时豁免，其余一律要求干净。
        const declaredCleanSha = state !== null && state.repository !== undefined && state.repository !== null ? String(state.repository.remote_sha || '') : ''
        const cleanExempt = git.dirty && git.files.length === 1 && git.files[0] === 'docs/ai_memory/state/project_state.json' &&
          state !== null && state.repository !== undefined && state.repository !== null &&
          (state.repository.push_state === 'verified' || (/^[0-9a-f]{40}$/i.test(declaredCleanSha) && (declaredCleanSha === git.head || await isAncestor(declaredCleanSha, git.head, rootPath))))
        need(git.dirty === false || cleanExempt, '工作区干净（改动全部已入库）', git.dirty ? (cleanExempt ? '仅 push-verified 记账待入库（record_push 跨电脑闭环写入，下次收尾提交）' : '有未提交改动：' + git.files.slice(0, 5).join('、')) : 'ok')
        // 发布闭环：发生过收尾的项目必须有本机验收凭证（push-verified 标记 == HEAD），否则假 PASS
        const closeoutDone = state !== null && state.repository !== null && state.repository !== undefined && typeof state.repository.remote_sha === 'string' && state.repository.remote_sha.length === 40
        const verifiedMarker = await readJsonAt(rootPath, '.baton/local/push-verified.json', null)
        if (closeoutDone) {
          const markerSha = verifiedMarker !== null && verifiedMarker !== undefined ? String(verifiedMarker.remote_sha) : ''
          const stateSha = state !== null && state.repository !== undefined && state.repository !== null && state.repository.push_state === 'verified' ? String(state.repository.push_verified_sha) : ''
          const markerOk = markerSha !== '' && /^[0-9a-f]{40}$/i.test(markerSha) && (markerSha === git.head || await isAncestor(markerSha, git.head, rootPath))
          const stateOk = stateSha !== '' && /^[0-9a-f]{40}$/i.test(stateSha) && (stateSha === git.head || await isAncestor(stateSha, git.head, rootPath))
          // 发布声明兑现：本地「声明 SHA 是 HEAD 祖先」不再视为已发布——
          // 只有实时 ls-remote 实查远端 tip == 本地 HEAD 才算真实远端 receipt。
          let liveDeclaredOk = false
          if (git.remotes.length > 0) {
            const cfgAcc = await loadConfig(rootPath)
            const blockedAcc = blockedRemoteList(cfgAcc)
            for (const r of git.remotes) {
              if (!/^[A-Za-z0-9._-]{1,100}$/.test(r)) continue
              const gu = await sh('git remote get-url ' + r, rootPath)
              if (gu.exitCode === 0 && blockedAcc.indexOf(normalizeRemoteUrl(gu.out)) !== -1) continue
              const lr = await sh('git ls-remote ' + r + ' refs/heads/' + git.branch, rootPath)
              if (lr.exitCode === 0) {
                const tip = (lr.out || '').trim().split(/\s+/)[0] || ''
                liveDeclaredOk = tip !== '' && tip === git.head
              }
              break
            }
          }
          need(markerOk || stateOk || liveDeclaredOk, '发布核验凭证有效（push-verified 标记，或 state 已核验 SHA / 实时远端 tip == HEAD）', markerOk ? String(markerSha).slice(0, 8) : (stateOk ? 'state ' + stateSha.slice(0, 8) : (liveDeclaredOk ? '远端 tip == HEAD（ls-remote 实查）' : '无凭证：push 后请用 baton_verify_push + baton_record_push 记账')))
        }
        if (closeoutDone && git.remotes.length > 0) {
          const { target, url: remoteUrl, error: pushErr } = await resolvePushRemote(rootPath, git)
          if (pushErr !== null) { need(false, '推流远端合规（push_allowed）', pushErr) }
          else {
            const lr = await sh('git ls-remote ' + target + ' refs/heads/' + git.branch, rootPath)
            if (lr.exitCode === 0) {
              const real = (lr.out || '').trim().split(/\s+/)[0] || ''
              need(real === git.head, '远端 == 本地 HEAD（ls-remote 实查）', real.slice(0, 8))
            } else {
              // 通道 2：gh api 实查；再受限则要求凭证为强核验
              const ghSha = await githubRefSha(remoteUrl, git.branch, rootPath)
              if (ghSha !== null) {
                need(ghSha === git.head, '远端 == 本地 HEAD（gh api 实查）', ghSha.slice(0, 8))
              } else {
                need(verifiedMarker !== null && verifiedMarker.remote_sha === git.head && verifiedMarker.strong === true, '远端实查受限时凭证必须为强核验（ls-remote/gh-api 实查记账）', '两通道均不可用且凭证非强核验：拒绝 PASS（声明式 SHA 可伪造）')
              }
            }
          }
        }
        need(config !== null && Array.isArray(config.routing), '路由规则表存在', 'routing 数组')
        need(config !== null && Array.isArray(config.model_pool), '模型池配置存在', 'model_pool 数组')
        // 全骨架逐项检查：此前只抽查 3 个模板，删除 task_todo/knowledge/其他 ui_spec 分册仍会 PASS；改为全清单逐项核对
        const FULL_SKELETON = [
          'docs/ai_memory/index.md', 'docs/ai_memory/current.md', 'docs/ai_memory/commands.md', 'docs/ai_memory/handoff_current.md',
          'docs/ai_memory/overview.md', 'docs/ai_memory/constraints.md', 'docs/ai_memory/validation_matrix.md',
          'docs/ai_memory/tasks/task_schema.md', 'docs/ai_memory/tasks/task_todo.md', 'docs/ai_memory/tasks/task_progress.md', 'docs/ai_memory/tasks/task_finished.md',
          'docs/ai_memory/knowledge/tech_decision.md', 'docs/ai_memory/knowledge/pit_experience.md',
          'docs/ai_memory/ui_spec/global.md', 'docs/ai_memory/ui_spec/component.md', 'docs/ai_memory/ui_spec/page.md', 'docs/ai_memory/ui_spec/workflow.md',
          'docs/ai_memory/daily_log/daily_TEMPLATE.md', 'docs/ai_memory/requirements/requirements_YYYY-MM-DD_TEMPLATE.md',
          'docs/ai_memory/state/project_state.json', 'docs/ai_memory/state/tasks.json', 'docs/ai_memory/state/archive_index.json',
          'docs/ai_memory/state/decisions.jsonl', 'docs/ai_memory/state/issues.json',
        ]
        for (const rel of FULL_SKELETON) {
          need(await readTextAt(rootPath, rel) !== null, rel + ' 存在', 'ok')
        }
        const skillMirrors = ['.agents/skills/baton/SKILL.md', '.claude/skills/baton/SKILL.md', '.cursor/skills/baton/SKILL.md']
        let mirrorCount = 0
        let placeholderCount = 0
        for (const m of skillMirrors) {
          const c = await readTextAt(rootPath, m)
          // 真 SKILL 判定：含 frontmatter（name: baton）或 Baton 标题；README 占位提示不算真镜像
          if (c !== null && (c.indexOf('name: baton') !== -1 || c.indexOf('# Baton') !== -1)) { mirrorCount += 1; continue }
          const marker = m.slice(0, m.lastIndexOf('/SKILL.md')) + '/README.txt'
          if (await readTextAt(rootPath, marker) !== null) placeholderCount += 1
        }
        need(mirrorCount >= 3, '三端 SKILL 为真 SKILL.md（3/3）', mirrorCount + '/3' + (placeholderCount > 0 ? '（' + placeholderCount + ' 端仍为 README 占位）' : ''))
        need(placeholderCount === 0, '无 README 占位镜像', placeholderCount === 0 ? 'ok' : placeholderCount + ' 端为占位：运行 scripts/baton-install.ps1 或 baton_init 补齐真 SKILL')
        // 长期 MD 文档结构机械检查——声明为长期文档的文件必须含
        // 【归档分卷索引】与【修订记录】两个强制区块（daily_log 天然追加、模板文件豁免）。
        const longDocs = ['docs/ai_memory/index.md', 'docs/ai_memory/current.md', 'docs/ai_memory/commands.md', 'docs/ai_memory/handoff_current.md', 'docs/ai_memory/overview.md', 'docs/ai_memory/constraints.md', 'docs/ai_memory/validation_matrix.md', 'docs/ai_memory/tasks/task_schema.md', 'docs/ai_memory/tasks/task_todo.md', 'docs/ai_memory/tasks/task_progress.md', 'docs/ai_memory/tasks/task_finished.md', 'docs/ai_memory/knowledge/tech_decision.md', 'docs/ai_memory/knowledge/pit_experience.md', 'docs/ai_memory/ui_spec/global.md', 'docs/ai_memory/ui_spec/component.md', 'docs/ai_memory/ui_spec/page.md', 'docs/ai_memory/ui_spec/workflow.md']
        const structureMissing = []
        for (const rel of longDocs) {
          const c = await readTextAt(rootPath, rel)
          if (c === null) continue
          if (c.indexOf('【归档分卷索引】') === -1) structureMissing.push(rel + '（缺归档分卷索引）')
          if (c.indexOf('【修订记录】') === -1) structureMissing.push(rel + '（缺修订记录）')
        }
        need(structureMissing.length === 0, '长期文档结构完整（归档分卷索引+修订记录）', structureMissing.length === 0 ? 'ok' : structureMissing.join('、'))
        // 行为验收补强：已完成任务必须有 Git 内执行证据（跨机可见）；
        // 假 Reviewer 检测改为身份判定（agent/session 同源 = 假 Reviewer），模型名只用于统计。
        const tasksDoc = await readJsonAt(rootPath, 'docs/ai_memory/state/tasks.json', { tasks: [] })
        const completedIds = (tasksDoc.tasks || []).filter((t) => t.status === 'completed').map((t) => t.id)
        const evIndexRaw = (await readTextAt(rootPath, 'docs/ai_memory/state/evidence.jsonl')) || ''
        for (const tid of completedIds) {
          // 优先 Git 内索引（跨机可见）；本机详细层作为补充
          const ev = evIndexRaw + '\n' + ((await readTextAt(rootPath, '.baton/evidence/' + tid + '.jsonl')) || '')
          let evOk = false
          for (const line of ev.split('\n')) {
            const s = line.trim()
            if (s === '') continue
            try {
              const r = JSON.parse(s)
              if (r && r.task_id === tid && typeof r.actual_model === 'string' && r.actual_model !== '') {
                // 证据行必须绑定 source SHA（40hex）且为当前 HEAD 的祖先/相等——旧 SHA/无绑定视为无效
                const h = typeof r.head === 'string' ? r.head : ''
                if (/^[0-9a-f]{40}$/i.test(h) && (h === git.head || await isAncestor(h, git.head, rootPath))) { evOk = true; break }
              }
            } catch (e) { /* 坏行跳过 */ }
          }
          need(evOk, '任务 ' + tid + ' 有有效执行证据（source SHA 绑定且为 HEAD 祖先，跨机可见）', evOk ? '证据行有效' : '无有效证据：baton_record_actual 记录执行模型与来源后再验收（证据必须绑定当前提交）')
        }
        // completed 任务的 task_finished 条目的「证据」行不得为占位（DoD 证据需真实结果）
        const finishedDoc = (await readTextAt(rootPath, 'docs/ai_memory/tasks/task_finished.md')) || ''
        for (const tid of completedIds) {
          const seg = finishedDoc.split('## ').find((s) => s.indexOf(tid + '｜') === 0 || s.indexOf(tid + '|') === 0) || ''
          const evLine = seg.split('\n').find((l) => /^-\s*证据：/.test(l)) || ''
          const hasPlaceholder = evLine !== '' && (evLine.indexOf('（待补充') !== -1 || evLine.indexOf('（待补）') !== -1 || evLine.indexOf('证据：（待') !== -1)
          need(!hasPlaceholder, '任务 ' + tid + ' 完成条目证据行为真实结果（非占位）', hasPlaceholder ? '存在待补充占位：补 task_finished 证据行后再验收' : 'ok')
        }
        const runsRaw = (await readTextAt(rootPath, 'docs/ai_memory/agent_metrics/' + monthLocal() + '/runs.jsonl')) || ''
        let fakeReviewer = false
        for (const line of runsRaw.split('\n')) {
          const s = line.trim()
          if (s === '') continue
          try {
            const r = JSON.parse(s)
            // 调用者字符串满足不了独立性——
            // 独立复核成立 = 宿主签发 receipt（reviewer_receipt.verified && origin=host_descriptor）且复核身份与执行者分离；
            // 声明了 reviewer 但无 receipt（或同身份）→ 视为假 Reviewer。
            if (r && typeof r.actual_model === 'string' && typeof r.reviewer_model === 'string') {
              const claimed = (r.reviewer_model !== 'unknown' && r.reviewer_model !== '') ||
                (typeof r.reviewer_agent_id === 'string' && r.reviewer_agent_id !== '') ||
                (typeof r.reviewer_run_id === 'string' && r.reviewer_run_id !== '')
              if (!claimed) continue
              const receipt = r.reviewer_receipt
              const receiptVerified = receipt !== null && receipt !== undefined && receipt.verified === true && receipt.origin === 'host_descriptor'
              const sameIdentity = (typeof r.actual_agent_id === 'string' && r.actual_agent_id !== '' && r.actual_agent_id === r.reviewer_agent_id) ||
                (typeof r.actual_session_id === 'string' && r.actual_session_id !== '' && r.actual_session_id === r.reviewer_session_id) ||
                (receiptVerified && typeof receipt.session_id === 'string' && receipt.session_id !== '' && typeof r.actual_session_id === 'string' && receipt.session_id === r.actual_session_id)
              if (!(receiptVerified && !sameIdentity)) fakeReviewer = true
            }
          } catch (e) { /* 跳过坏行 */ }
        }
        need(!fakeReviewer, 'Reviewer 与执行者分离（宿主签发 receipt，调用者声明不算独立）', fakeReviewer ? '存在声明 reviewer 但无宿主 receipt（或与执行者同身份）的记录' : 'ok')
        const failed = checks.filter((c) => !c.pass)
        return { ok: failed.length === 0, overall: failed.length === 0 ? 'PASS' : 'FAIL', checks, blocking: failed.map((f) => f.name) }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_export',
      description: 'Baton：导出框架包到目标目录并自动过滤敏感词（Key 模式全查；自定义敏感词清单来自本机 .baton/private-patterns.txt）。',
      parameters: simple({ path: '项目根目录（通常为 Baton 框架仓库）', target: '导出目标目录（工作区内）' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const target = (args.target || '.baton-export').trim()
        const secrets = []
        // 敏感词清单外置本机配置文件（gitignore）：代码里不硬编码任何敏感信息。
        // 文件不存在 = 未配置 → 中止并指引；存在（即使只有注释） = 作者已声明，按清单+通用 Key 检查扫描。
        const patternContent = await readTextAt(rootPath, '.baton/private-patterns.txt')
        if (patternContent === null) {
          return {
            ok: false,
            exported_to: target,
            files: 0,
            sanitized: false,
            secret_scan: [],
            blocked: [],
            note: '未配置敏感词清单：请在本机创建 .baton/private-patterns.txt（每行一个正则，# 开头为注释；无需过滤时创建空文件），导出绝不硬编码任何敏感词',
          }
        }
        const privatePatterns = (patternContent || '').split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter((l) => l !== '')
        const scan = (content, rel) => {
          const hits = []
          const isTemplate = rel.indexOf('templates/') === 0
          // scripts 是框架自带工具：install 的 REPLACE_WITH 是给用户的模板提示；
          // plugin/baton.js 与生成产物 index.mjs 内嵌 init 模板字符串（PROJECT_NAME/REPLACE_WITH 是模板占位，非敏感词），一并豁免
          const isScript = rel.indexOf('scripts/') === 0
          if (!isTemplate && !isScript && rel !== 'plugin/baton.js' && rel !== 'index.mjs' && /REPLACE_WITH|PROJECT_NAME/.test(content)) hits.push('占位符未替换')
          // 常见秘密模式全查（不只 API Key）：PEM 私钥 / AWS / Slack / JWT / Bearer / 数据库连接串
          const secretPatterns = [
            [/sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}/, '疑似 API Key'],
            [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '疑似私钥 PEM'],
            [/AKIA[0-9A-Z]{16}/, '疑似 AWS Access Key'],
            [/xox[baprs]-[A-Za-z0-9-]{10,}/, '疑似 Slack Token'],
            [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, '疑似 JWT'],
            [/Bearer\s+[A-Za-z0-9._-]{20,}/, '疑似 Bearer Token'],
            [/(?:mongodb|postgres(?:ql)?|mysql|redis):\/\/[^\s"']+/, '疑似数据库连接串'],
          ]
          for (const [re, label] of secretPatterns) { try { if (re.test(content)) hits.push(label) } catch (e) { /* 忽略坏模式 */ } }
          for (const p of privatePatterns) {
            try { if (new RegExp(p).test(content)) hits.push('疑似敏感词：' + p) } catch (e) { /* 忽略坏模式 */ }
          }
          return hits
        }
        // 导出只保留用户安装和运行 Baton 必需的文件；开发源码、测试、翻译、图片、CI 与维护脚本均不公开。
        const copies = ['README.md', 'LICENSE', 'package.json', 'index.mjs', 'cordis.patch.yml', 'skills/baton/SKILL.md', 'skills/baton-lean-review/SKILL.md', 'skills/baton-debt/SKILL.md', 'skills/baton-doctor/SKILL.md', 'scripts/baton-install.ps1', 'scripts/baton-migrate.ps1', 'scripts/baton-sync.ps1', 'scripts/baton-uninstall.ps1', 'scripts/baton-report.mjs']
        for (const dir of ['templates/ai_memory', 'templates/baton', 'templates/adapter']) {
          const t = await fs.resolve(dir, { cwd: rootPath })
          const entries = await fs.listDir(t).catch(() => [])
          for (const e of entries) {
            if (e.type === 'directory') {
              const sub = await fs.listDir(e.target).catch(() => [])
              for (const s of sub) copies.push(dir + '/' + e.name + '/' + s.name)
            } else {
              copies.push(dir + '/' + e.name)
            }
          }
        }
        // templates 根下的单文件（gitignore.append）
        for (const tf of ['templates/gitignore.append']) {
          if ((await readTextAt(rootPath, tf)) !== null) copies.push(tf)
        }
        const report = []
        const missing = []
        // 先全量扫描：任何命中即中止导出（不复制任何文件），与发布脚本「命中即中止」一致——绝不让含秘密的包被带走
        for (const rel of copies) {
          const content = await readTextAt(rootPath, rel)
          if (content === null) { missing.push(rel); continue }
          const hits = scan(content, rel)
          if (hits.length) secrets.push({ file: rel, hits })
        }
        if (secrets.length > 0) {
          return {
            ok: false,
            exported_to: target,
            files: 0,
            sanitized: false,
            secret_scan: secrets,
            blocked: secrets.map((s) => s.file),
            note: '敏感词检查未通过：发现疑似敏感内容，导出已中止，未复制任何文件；请处理后重新导出',
          }
        }
        // 旧目标残留扫描：导出前先扫目标目录里既有文件，含敏感残留即中止——
        // 否则旧敏感文件会混在新导出包里被带走
        const staleHits = []
        const targetRoot = await fs.resolve(target, { cwd: rootPath }).catch(() => null)
        // 递归扫描旧目标：顶层 200 文件上限会漏掉嵌套目录中的旧密钥；改为深度 6、总量 2000 的递归扫描
        const walkTarget = async (dirAbs, rel, depth) => {
          if (depth > 6 || staleHits.length >= 2000) return
          const entries = await fs.listDir(dirAbs).catch(() => [])
          for (const e of entries) {
            if (staleHits.length >= 2000) break
            if (e.type === 'directory') { await walkTarget(e.target, rel + '/' + e.name, depth + 1); continue }
            const c = await fs.readText(e.target).catch(() => null)
            if (c !== null) {
              const h = scan(c, rel + '/' + e.name)
              if (h.length) staleHits.push({ file: rel + '/' + e.name, hits: h })
            }
          }
        }
        if (targetRoot !== null) await walkTarget(targetRoot, target, 0)
        if (staleHits.length > 0) {
          return {
            ok: false,
            exported_to: target,
            files: 0,
            sanitized: false,
            secret_scan: staleHits,
            blocked: staleHits.map((s) => s.file),
            note: '目标目录存在疑似敏感残留，导出已中止：请清空或处理目标目录后重新导出',
          }
        }
        const failures = []
        for (const rel of copies) {
          const content = await readTextAt(rootPath, rel)
          if (content === null) continue
          try {
            await writeTextAt(target, rel, content)
            report.push('copied: ' + rel)
          } catch (e) {
            report.push('skip(failed): ' + rel)
            failures.push(rel)
          }
        }
        return {
          ok: failures.length === 0 && missing.length === 0,
          exported_to: target, files: report.length,
          sanitized: true,
          secret_scan: [],
          failed: failures,
          missing,
          note: failures.length === 0 && missing.length === 0
            ? '敏感词检查通过，可分享'
            : '导出不完整，不可分享：' + (missing.length > 0 ? '缺失源文件 ' + missing.join('、') : '') + (failures.length > 0 ? '；复制失败 ' + failures.join('、') : ''),
        }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_route',
      description: 'Baton：按任务类型与最近 30 天同宿主可信样本返回推荐执行模型，并追加 route_decided 事件。样本不足 5 次时使用 host-default，不自适应。',
      parameters: simple({ path: '项目根目录', task_id: '任务 ID（必填）', task_type: 'micro | bounded | complex | architecture | high_risk | review' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const taskId = String(args.task_id || '').trim()
        if (!/^[A-Za-z0-9_\-]{1,64}$/.test(taskId)) return { ok: false, reason: 'task_id 必填，且只允许字母/数字/下划线/连字符（1-64 位）' }
        const type = (args.task_type || 'bounded').trim()
        // B-01：route 纳入 operation envelope（只记 intent/failed/done 不短路——返回推荐数据给调用方）
        return opEnvelope(rootPath, 'route:' + taskId + ':' + type + ':' + todayLocal(), async () => {
          const ownGate = await ownershipGuard(rootPath)
          if (!ownGate.pass) return { ok: false, reason: '未持有单写入者锁：' + ownGate.reason }
          const config = await loadConfig(rootPath)
          const pool = (config && Array.isArray(config.model_pool)) ? config.model_pool : []
          const rows = (config && Array.isArray(config.routing)) ? config.routing : []
          const row = rows.find((r) => r.task === type) || { prefer: ['reasoning'], fallback: [], reasoning: 'high' }
          const byTag = (tag) => pool.find((m) => (m.tags || []).indexOf(tag) !== -1 && m.status === 'verified')
          const toModel = (tag) => {
            const m = byTag(tag)
            return m ? { provider: m.provider || 'deepseek', model: m.id, reasoning: row.reasoning || 'high' } : null
          }
          const preferred = []
          for (const tag of row.prefer || []) { const m = toModel(tag); if (m) preferred.push(m) }
          const fallback = []
          for (const tag of row.fallback || []) { const m = toModel(tag); if (m) fallback.push(m) }
          const routeModelIds = new Set(preferred.concat(fallback).map((m) => m.model))
          const allEvents = await metricEventRows(rootPath, 30)
          const cutoff = Date.now() - 30 * 86400000
          const terminalByAttempt = new Map()
          for (const e of allEvents) {
            if (e.type !== 'attempt_evaluated' || typeof e.attempt_id !== 'string' || e.attempt_id === '') continue
            const terminalShape = JSON.stringify({ task_id: e.task_id, task_type: e.task_type, host_id: e.host_id, actual_model: e.actual_model, source: e.source, result: e.result, total_tokens: e.total_tokens, duration_ms: e.duration_ms, validation_source: e.validation_source })
            const prior = terminalByAttempt.get(e.attempt_id)
            if (prior !== undefined && prior.shape !== terminalShape) return { ok: false, reason: 'attempt_id ' + e.attempt_id + ' 存在冲突终态：拒绝用不一致历史做路由' }
            if (prior === undefined) terminalByAttempt.set(e.attempt_id, { shape: terminalShape, event: e })
          }
          const samples = [...terminalByAttempt.values()].map((x) => x.event).filter((e) => e.host_id === 'dsh' && e.task_type === type && e.source === 'host_descriptor' && routeModelIds.has(e.actual_model) && Number.isFinite(Date.parse(e.ended_at || e.ts)) && Date.parse(e.ended_at || e.ts) >= cutoff && ['succeeded', 'needs_revision', 'failed'].indexOf(e.result) !== -1)
          const byModel = new Map()
          for (const e of samples) {
            if (typeof e.actual_model !== 'string' || !pool.some((m) => m.id === e.actual_model && m.status === 'verified')) continue
            if (!byModel.has(e.actual_model)) byModel.set(e.actual_model, [])
            byModel.get(e.actual_model).push(e)
          }
          const ranked = []
          for (const [model, list] of byModel.entries()) {
            if (list.length < 5) continue
            const quality = list.reduce((n, e) => n + (e.result === 'succeeded' ? 1 : (e.result === 'needs_revision' ? 0.5 : 0)), 0) / list.length
            const tokenRows = list.filter((e) => Number.isSafeInteger(e.total_tokens))
            const durationRows = list.filter((e) => Number.isSafeInteger(e.duration_ms))
            ranked.push({ model, samples: list.length, quality, avg_tokens: tokenRows.length === 0 ? null : tokenRows.reduce((n, e) => n + e.total_tokens, 0) / tokenRows.length, avg_duration_ms: durationRows.length === 0 ? null : durationRows.reduce((n, e) => n + e.duration_ms, 0) / durationRows.length })
          }
          ranked.sort((a, b) => {
            if (Math.abs(a.quality - b.quality) > 0.05) return b.quality - a.quality
            if (a.avg_tokens !== null && b.avg_tokens !== null && a.avg_tokens !== b.avg_tokens) return a.avg_tokens - b.avg_tokens
            if (a.avg_duration_ms !== null && b.avg_duration_ms !== null && a.avg_duration_ms !== b.avg_duration_ms) return a.avg_duration_ms - b.avg_duration_ms
            return b.samples - a.samples
          })
          let recommended
          let adaptive = false
          if (row.mode === 'main-session') recommended = { mode: 'main-session', note: '主会话直接执行，不派代理' }
          else if (ranked.length > 0) {
            const m = pool.find((x) => x.id === ranked[0].model)
            recommended = { provider: m.provider || 'deepseek', model: m.id, reasoning: row.reasoning || 'high' }
            adaptive = true
          } else recommended = { mode: 'host-default', note: '最近 30 天同宿主同任务类型可信样本不足 5 次，不自适应' }
          let gitHead = ''
          try { gitHead = (await gitSnapshot(rootPath)).head } catch (e) { gitHead = '' }
          const sess = currentSession()
          const sessionId = sess && sess.id !== undefined ? String(sess.id) : 'unknown'
          const routeKey = taskId + '|dsh|' + sessionId + '|' + type + '|' + gitHead
          const reusable = allEvents.slice().reverse().find((e) => e.type === 'route_decided' && e.route_key === routeKey && !allEvents.some((x) => x.type === 'attempt_started' && x.route_id === e.route_id))
          if (reusable !== undefined) return { ok: true, task_id: taskId, task_type: type, route_id: reusable.route_id, recommended: reusable.recommended, fallback: reusable.fallback || [], sample_count: reusable.sample_count || 0, adaptive: reusable.adaptive === true, event_reused: true }
          const seq = allEvents.filter((e) => e.type === 'route_decided' && e.route_key === routeKey).length + 1
          const routeId = stableMetricId('route', routeKey + '|' + seq)
          const rec = { ts: nowIso(), event_id: routeId, type: 'route_decided', route_id: routeId, route_key: routeKey, task_id: taskId, task_type: type, host_id: 'dsh', session_id: sessionId, head: gitHead, window_days: 30, sample_count: samples.length, adaptive, recommended, fallback, ranking: ranked }
          const appended = await appendMetricEventOnce(rootPath, rec)
          if (!appended.ok) return { ok: false, reason: 'route_decided event_id 冲突：拒绝覆盖已有事件' }
          return { ok: true, task_id: taskId, task_type: type, route_id: routeId, recommended, fallback, sample_count: samples.length, adaptive, note: adaptive ? '已使用最近 30 天同宿主同任务类型可信样本路由' : recommended.note }
        }, false)
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_record_actual',
      description: 'Baton：记录执行 attempt_started / attempt_evaluated 事件并兼容旧 actual 证据。终态仅 succeeded|needs_revision|failed|cancelled，缺失 Token/耗时保持 null。',
      parameters: simple({ path: '项目根目录', task_id: '任务 ID', actual_model: '实际模型（分派记录）', run_id: '子代理会话 ID（可选，尝试查宿主 descriptor）', source: 'requested | host_descriptor | unknown（可选，默认 requested）', phase: 'started | evaluated（可选；留空兼容旧 actual）', route_id: 'started 必填：baton_route 返回的 route_id', attempt_id: 'evaluated 必填：started 返回的 attempt_id', result: 'evaluated 必填：succeeded | needs_revision | failed | cancelled', total_tokens: '可选非负整数；未知留空', duration_ms: '可选非负整数；未知留空', validation_source: '可选验证来源；未知留空' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const taskId = (args.task_id || '').trim()
        if (taskId === '') return { ok: false, reason: '缺少 task_id' }
        if (!/^[A-Za-z0-9_\-]{1,64}$/.test(taskId)) return { ok: false, reason: 'task_id 只允许字母/数字/下划线/连字符（1-64 位）' }
        // B-01：record_actual 纳入 operation envelope——同任务+run+模型+来源+HEAD 重试幂等短路；
        // amend/rebase/reset 改写 HEAD 后必须允许重新绑定，不能被旧 SHA 的 done 记录永久短路。
        let raHead = ''
        try { raHead = (await gitSnapshot(rootPath)).head } catch (e) { raHead = '' }
        const lifecyclePhase = String(args.phase || '').trim()
        if (lifecyclePhase !== '' && ['started', 'evaluated'].indexOf(lifecyclePhase) === -1) return { ok: false, reason: 'phase 只允许 started|evaluated 或留空' }
        const raOpId = 'actual:' + taskId + ':' + lifecyclePhase + ':' + String(args.route_id || '').trim() + ':' + String(args.attempt_id || '').trim() + ':' + String(args.result || '').trim() + ':' + (args.run_id || '').trim() + ':' + (args.actual_model || 'unknown').trim().slice(0, 40) + ':' + (args.source || 'requested').trim() + ':' + raHead
        return opEnvelope(rootPath, raOpId, async () => {
          const ownGate = await ownershipGuard(rootPath)
          if (!ownGate.pass) return { ok: false, reason: '未持有单写入者锁：' + ownGate.reason }
        let actualModel = (args.actual_model || 'unknown').trim()
        const runId = (args.run_id || '').trim()
        let source = (args.source || 'requested').trim()
        if (['requested', 'host_descriptor', 'unknown'].indexOf(source) === -1) source = 'requested'
        // 所有进入 evidence/metrics 的调用者字段统一凭据扫描（模型名/run_id/来源等）
        const validationSource = String(args.validation_source || '').trim()
        const secHitRa = secretHits([actualModel, runId, source, validationSource].filter((x) => typeof x === 'string').join('\n'))
        if (secHitRa.length > 0) {
          return { ok: false, reason: '参数疑似含敏感信息（' + secHitRa.join('、') + '）：拒绝写入证据（凭据绝不进入 Git 跟踪文档）', secret_hits: secHitRa }
        }
        // 防伪：host_descriptor 只能来自真实宿主身份事件；无 run_id 或事件未命中时一律降级 requested
        const claimedHost = source === 'host_descriptor'
        if (claimedHost && runId === '') source = 'requested'
        let provider = null
        let hostEvidence = false
        if (runId !== '') {
          const sq = ctx.get('sessionQuery')
          try {
            if (sq !== undefined) {
              const list = await sq.listEvents(runId)
              for (const e of list) {
                if (e && e.type === 'subagent/descriptor' && e.data && typeof e.data === 'object') {
                  if (typeof e.data.provider === 'string') provider = e.data.provider
                  if (typeof e.data.agentModel === 'string') {
                    actualModel = e.data.agentModel
                    source = 'host_descriptor'
                    hostEvidence = true
                  }
                  break
                }
              }
            }
          } catch (e) { /* 保留 requested */ }
        }
        if (claimedHost && !hostEvidence) source = 'requested'
        const coerced = claimedHost && source !== 'host_descriptor'
        // 执行身份：同源判定用 session/agent 身份，模型名只用于统计展示
        const wSess = currentSession()
        const agentId = (wSess !== undefined && wSess !== null && wSess.agentId !== undefined) ? String(wSess.agentId) : (wSess !== undefined && wSess !== null && wSess.id !== undefined ? String(wSess.id) : null)
        const sessionId = (wSess !== undefined && wSess !== null && wSess.id !== undefined) ? String(wSess.id) : null
        // source SHA 绑定：证据必须绑定记录时刻的仓库 HEAD，accept 校验其为当前 HEAD 祖先
        let evHead = ''
        try { evHead = (await gitSnapshot(rootPath)).head } catch (e) { evHead = '' }
        let lifecycle = null
        if (lifecyclePhase !== '') {
          const allEvents = await metricEventRows(rootPath, 31)
          if (lifecyclePhase === 'started') {
            const routeId = String(args.route_id || '').trim()
            const route = allEvents.find((e) => e.type === 'route_decided' && e.route_id === routeId && e.task_id === taskId)
            if (route === undefined) return { ok: false, reason: 'attempt_started 必须引用当前任务已存在的 route_id' }
            const runKey = runId || agentId || sessionId || 'unknown'
            const openAttempt = allEvents.slice().reverse().find((e) => e.type === 'attempt_started' && e.route_id === routeId && e.run_key === runKey && !allEvents.some((x) => x.type === 'attempt_evaluated' && x.attempt_id === e.attempt_id))
            if (openAttempt !== undefined) return { ok: true, task_id: taskId, route_id: routeId, attempt_id: openAttempt.attempt_id, event_reused: true, status: 'started' }
            const seq = allEvents.filter((e) => e.type === 'attempt_started' && e.route_id === routeId && e.run_key === runKey).length + 1
            const attemptId = stableMetricId('attempt', routeId + '|' + runKey + '|' + seq)
            const event = { ts: nowIso(), started_at: nowIso(), event_id: attemptId + '-start', type: 'attempt_started', route_id: routeId, attempt_id: attemptId, run_key: runKey, run_id: runId || null, task_id: taskId, task_type: route.task_type, host_id: route.host_id || 'dsh', session_id: sessionId, agent_id: agentId, actual_model: actualModel, provider, source, head: evHead }
            const add = await appendMetricEventOnce(rootPath, event)
            if (!add.ok) return { ok: false, reason: 'attempt_started event_id 冲突：拒绝覆盖已有事件' }
            return { ok: true, task_id: taskId, route_id: routeId, attempt_id: attemptId, status: 'started', event_reused: add.appended !== true }
          }
          const attemptId = String(args.attempt_id || '').trim()
          const started = allEvents.find((e) => e.type === 'attempt_started' && e.attempt_id === attemptId && e.task_id === taskId)
          if (started === undefined) return { ok: false, reason: 'attempt_evaluated 必须引用当前任务已存在的 attempt_id' }
          const startedRunId = typeof started.run_id === 'string' ? started.run_id : ''
          if (runId !== startedRunId) return { ok: false, reason: 'attempt_evaluated 的 run_id 必须与 attempt_started 精确一致，禁止借用另一执行会话结算' }
          if (source !== 'host_descriptor') {
            actualModel = started.actual_model || 'unknown'
            provider = started.provider || null
            source = started.source || 'unknown'
          }
          const result = String(args.result || '').trim()
          if (['succeeded', 'needs_revision', 'failed', 'cancelled'].indexOf(result) === -1) return { ok: false, reason: 'result 只允许 succeeded|needs_revision|failed|cancelled' }
          const tokens = parseNullableCount(args.total_tokens, 'total_tokens')
          if (!tokens.ok) return { ok: false, reason: tokens.reason }
          const duration = parseNullableCount(args.duration_ms, 'duration_ms')
          if (!duration.ok) return { ok: false, reason: duration.reason }
          const existingEval = allEvents.find((e) => e.type === 'attempt_evaluated' && e.attempt_id === attemptId)
          const candidate = { type: 'attempt_evaluated', attempt_id: attemptId, route_id: started.route_id, task_id: taskId, task_type: started.task_type, host_id: started.host_id || 'dsh', session_id: sessionId, agent_id: agentId, run_id: runId || started.run_id || null, actual_model: actualModel, provider, source, result, total_tokens: tokens.value, duration_ms: duration.value, validation_source: validationSource || null, head: evHead }
          if (existingEval !== undefined) {
            const terminalInput = (e) => JSON.stringify({ result: e.result, total_tokens: e.total_tokens, duration_ms: e.duration_ms, validation_source: e.validation_source || null })
            if (terminalInput(existingEval) !== terminalInput(candidate)) return { ok: false, reason: 'attempt_id 已有不同终态或评价指标：拒绝覆盖' }
            lifecycle = { attempt_id: attemptId, result, event_reused: true }
          } else {
            const event = Object.assign({ ts: nowIso(), ended_at: nowIso(), event_id: attemptId + '-eval' }, candidate)
            const add = await appendMetricEventOnce(rootPath, event)
            if (!add.ok) return { ok: false, reason: 'attempt_evaluated event_id 冲突：拒绝覆盖已有事件' }
            lifecycle = { attempt_id: attemptId, result, event_reused: add.appended !== true }
          }
        }
        // exactly-once effect key——多处 append 之间崩溃后重试不再重复追加；
        // 同一 ekey（任务|run|模型|来源|HEAD）已存在于目标文件即跳过该次 append；
        // HEAD 改写后生成新 ekey，使 accept 提示的“重新记录”真正可恢复。
        const ekey = taskId + '|' + (runId || '-') + '|' + actualModel + '|' + source + '|' + evHead
        const ekeyIn = async (rel) => {
          const t = (await readTextAt(rootPath, rel)) || ''
          return t.indexOf('"ekey":"' + ekey + '"') !== -1
        }
        const rec = { ts: nowIso(), type: 'actual', task_id: taskId, run_id: runId || null, agent_id: agentId, session_id: sessionId, actual_model: actualModel, provider, source, head: evHead, ekey }
        const line = JSON.stringify(rec) + '\n'
        // 生命周期评价本身已是唯一工作单元；不要再写一条 legacy actual 造成月报双计。
        // 旧调用仍保留 actual 兼容，Git/本机证据索引则两种模式都写。
        if (lifecycle === null && !(await ekeyIn('.baton/local/metrics/' + todayLocal() + '.jsonl'))) await appendTextAt(rootPath, '.baton/local/metrics/' + todayLocal() + '.jsonl', line)
        // 本机详细证据层（gitignore，可放日志/截图等大附件）
        if (!(await ekeyIn('.baton/evidence/' + taskId + '.jsonl'))) await appendTextAt(rootPath, '.baton/evidence/' + taskId + '.jsonl', JSON.stringify({ ts: nowIso(), type: 'actual', task_id: taskId, run_id: runId || null, agent_id: agentId, session_id: sessionId, actual_model: actualModel, provider, source, head: evHead, ekey }) + '\n')
        // Git 内最小可验证索引：新 clone 仅凭此文件判断 completed 证据；
        // 大附件缺失时 accept 必须如实降级为「附件不可用，需重新验证」，不得伪装成完整强证据。
        const evIndexLine = JSON.stringify({ ts: nowIso(), task_id: taskId, run_id: runId || null, agent_id: agentId, session_id: sessionId, actual_model: actualModel, provider, source, check: 'actual-model', result: 'recorded', head: evHead, ekey }) + '\n'
        if (!(await ekeyIn('docs/ai_memory/state/evidence.jsonl'))) await appendTextAt(rootPath, 'docs/ai_memory/state/evidence.jsonl', evIndexLine)
        return { ok: true, task_id: taskId, actual_model: actualModel, provider, source, source_coerced: coerced, agent_id: agentId, session_id: sessionId, attempt_id: lifecycle === null ? null : lifecycle.attempt_id, result: lifecycle === null ? null : lifecycle.result, event_reused: lifecycle === null ? null : (lifecycle.event_reused || false), note: (coerced ? 'source 自报 host_descriptor 但无宿主事件证据，已降级 requested；' : '') + 'recommended 由 baton_route 记录，actual 由本工具记录；已写入 Git 内 state/evidence.jsonl（跨机可见）与本机 .baton/evidence（详细层）；只有 host_descriptor（宿主身份事件）才计入月报模型排行，requested 仅作声明展示，禁止模型自报' }
        }, false)
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_memory_query',
      description: 'Baton：按关键词查历史记忆索引，返回命中条目（路径/标题/摘要/行号）。主会话只读命中文件片段，禁止全量读取。',
      parameters: simple({ path: '项目根目录', keyword: '查询关键词' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const keyword = (args.keyword || '').trim().toLowerCase()
        if (keyword === '') return { ok: false, reason: '缺少 keyword' }
        const index = await readJsonAt(rootPath, 'docs/ai_memory/state/archive_index.json', { entries: [] })
        const hits = (index.entries || []).filter((e) => {
          const hay = ((e.title || '') + ' ' + ((e.keywords || []).join(' ')) + ' ' + (e.summary || '')).toLowerCase()
          return hay.indexOf(keyword) !== -1
        }).slice(-10).reverse().map((e) => ({
          title: e.title === undefined ? null : e.title,
          type: e.document_type === undefined ? null : e.document_type,
          path: e.path === undefined ? null : e.path,
          line_start: e.line_start === undefined ? null : e.line_start,
          summary: e.summary === undefined ? null : e.summary,
          updated_at: e.updated_at === undefined ? null : e.updated_at,
        }))
        return { ok: true, keyword, hits: hits.length, entries: hits, note: '只读命中条目对应的文件片段，不要全量读取' }
      },
    }))

    ctx.tools.register(defineTool({
      name: 'baton_remember',
      description: 'Baton：把决策/坑点/问题写入长期记忆并自动建索引（用户说「这个坑记下来」「把这个决策记进知识库」时使用）。',
      parameters: simple({ path: '项目根目录', kind: 'decision | pit | issue', title: '标题', content: '内容', task_id: '关联任务 ID（可选）', status: '状态（可选：有效/已解决/已取代 等）', root_cause: '根因（可选，坑点建议填）', alternatives: '替代方案（可选，决策建议填）', verification: '验证（可选：命令 → 结果）', boundary: '边界（可选：没有覆盖什么）' }),
      output: output(),
      async execute(args) {
        const rootPath = await rootOf(args)
        const kind = ['decision', 'pit', 'issue'].includes(args.kind) ? args.kind : 'decision'
        const title = (args.title || '未命名').trim()
        const content = (args.content || '').trim()
        if (content === '') return { ok: false, reason: '缺少 content' }
        // opId 含标题：同标题重试幂等短路（同标题记忆不重复写）；内容变化需另起标题
        return opEnvelope(rootPath, 'rem:' + kind + ':' + title.slice(0, 80), async () => {
          const ownGate = await ownershipGuard(rootPath)
        if (!ownGate.pass) return { ok: false, reason: '未持有单写入者锁：' + ownGate.reason }
        const secHit = secretHits([title, content, args.status, args.root_cause, args.alternatives, args.verification, args.boundary].filter((x) => typeof x === 'string').join('\n'))
        if (secHit.length > 0) return { ok: false, reason: '输入疑似含敏感信息（' + secHit.join('、') + '）：拒绝写入记忆（凭据绝不进入 Git 跟踪文档）', secret_hits: secHit }
        const today = todayLocal()
        const id = (kind === 'decision' ? 'TD-' : kind === 'pit' ? 'PIT-' : 'ISS-') + today.replace(/-/g, '') + '-' + idSuffix()
        let savedTo
        let lineStartValue = null
        if (kind === 'issue') {
          const issues = await assertJsonHealthy(rootPath, 'docs/ai_memory/state/issues.json', [])
          issues.push({ id, title, content, task_id: (args.task_id || '').trim() || null, created_at: nowIso(), status: 'open' })
          await writeTextAt(rootPath, 'docs/ai_memory/state/issues.json', JSON.stringify(issues, null, 2))
          savedTo = 'docs/ai_memory/state/issues.json'
        } else {
          const file = kind === 'decision' ? 'docs/ai_memory/knowledge/tech_decision.md' : 'docs/ai_memory/knowledge/pit_experience.md'
          // 结构化字段：决策/坑点模板要求状态/根因/替代方案/验证/边界，不再只写一行内容
          const extra = (args.status ? '- 状态：' + args.status + '\n' : '')
            + (args.root_cause ? '- 根因：' + args.root_cause + '\n' : '')
            + (args.alternatives ? '- 替代方案：' + args.alternatives + '\n' : '')
            + (args.verification ? '- 验证：' + args.verification + '\n' : '')
            + (args.boundary ? '- 边界：' + args.boundary + '\n' : '')
          await appendRevision(rootPath, file, '记录 ' + (kind === 'decision' ? '技术决策' : '坑点经验') + '：' + title, agentLabel(args))
          await appendTextAt(rootPath, file, '\n## ' + id + '｜' + title + '\n- 日期：' + today + '\n- 内容：' + content + '\n' + extra + (args.task_id ? '- 关联任务：' + args.task_id + '\n' : ''))
          // line_start 修正：追加与修订行完成后按条目实际行号定位，避免偏一行
          const after = (await readTextAt(rootPath, file)) || ''
          const idxLine = after.split('\n').findIndex((l) => l.indexOf('## ' + id + '｜') !== -1)
          lineStartValue = idxLine !== -1 ? idxLine + 1 : null
          savedTo = file
        }
        await addIndexEntry(rootPath, {
          id: 'ARCH-' + idSuffix(), document_type: kind, title,
          time: { start: today, end: null }, modules: [savedTo],
          keywords: [title, kind].concat(args.task_id ? [args.task_id.trim()] : []),
          summary: content.slice(0, 60), task_ids: args.task_id ? [args.task_id.trim()] : [],
          decision_ids: kind === 'decision' ? [id] : [], issue_ids: kind === 'issue' ? [id] : [],
          path: savedTo, line_start: lineStartValue, updated_at: nowIso(),
        })
        return { ok: true, id, saved_to: savedTo, note: '已入长期记忆，可被 baton_memory_query 命中' }
        })
      },
    }))

    function inlineTemplates(name, initAgent) {
      return {
        'docs/ai_memory/index.md': '# ' + name + ' AI 记忆索引\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n- 分卷规则：单文件超过 3MB 时按完整条目或章节分卷，主文件保留当前有效内容、摘要和读取顺序；分卷只生成清单，用户确认后再归档。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立记忆索引。 |\n\n更新时间：' + todayLocal() + '\n\n## 开工必读\n\n按顺序读取：\n\n1. `current.md`（当前工作摘要）\n2. `handoff_current.md` 末条（最近交接事实）\n3. `tasks/task_progress.md`（进行中任务）\n4. `tasks/task_todo.md`（待办）\n5. `overview.md`（项目总览）\n6. 当前任务关联的需求、协议、原型或文档\n\n## 当前主线\n\n- 当前任务：（无）\n- 当前阶段：（未开始）\n- 唯一下一步：说「上班啦」开始工作\n\n## 权威入口\n\n- 项目总览与需求清单：`overview.md`\n- 编码与开发红线：`constraints.md`\n- 用户口令：`commands.md`\n- 交接审计：`handoff_current.md`\n- 验证矩阵：`validation_matrix.md`\n- 任务：`tasks/`\n- 技术决策：`knowledge/tech_decision.md`\n- 坑点经验：`knowledge/pit_experience.md`\n- 设计规范：`ui_spec/`\n- 需求基线：`requirements/`\n- 日报：`daily_log/`\n- 历史索引（机器层）：`state/archive_index.json`\n\n## 未来新文档命名规则\n\n- `current.md`、`handoff_current.md`、`index.md`、`commands.md` 与 `state/` 下结构化文件保持固定名称。\n- 新任务/计划/决策/坑点文档有稳定 ID 时以 ID 开头，再接简短主题和类型，例如 `DC-YYYYMMDD-NNN_<topic>_plan.md`；日报使用 `daily_YYYY-MM-DD.md`。\n- 既有历史文件保留原名，不为统一外观批量改名；合法迁移必须保持稳定 ID，并同步引用与 `archive_index.json`。\n',
        'docs/ai_memory/current.md': '# 当前工作\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立当前工作摘要。 |\n\n> 修订表规则：只保留最近 3 个日期、每个日期一行；同日再次更新覆盖当日行，不向下堆叠。\n\n## 当前事实（简写，随生命周期更新）\n\n- 当前项目、分支和状态只读取下方托管投影；Git HEAD 在生命周期安全节点实时读取，本文件不保存会自我过期的 HEAD 字符串。\n- 当前基础设施工作：（无）\n- 当前真实阻断：（无）\n- 业务主线 `DC-YYYYMMDD-NNN`：（未开始；详细背景见其计划及 `handoff_current.md`）\n- 只有确需历史时才查询 `state/archive_index.json`，随后读取命中的文件片段；普通任务禁止扫描全部历史。\n\n<!-- BATON:CANONICAL-PROJECTION:BEGIN -->\n- Task: NONE\n- Phase: idle\n- Next step: NONE\n- Branch: NONE\n- HEAD: LIVE-READ\n<!-- BATON:CANONICAL-PROJECTION:END -->\n',
        'docs/ai_memory/commands.md': '# Baton 用户口令\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立口令说明。 |\n\n用户只需要自然描述任务，以及以下口令。Git、文档、记忆与收尾的机械步骤由 Baton 自动完成。\n\n## `上班啦`\n\n自动核对并 fetch Git（ff-only）、恢复未完成任务、读取交接与待办、生成任务表。推荐项为 ID 1，用户只回复 `1` 即可继续。\n\n## `下班啦`\n\n完整收尾：验证 → 更新文档（日报/交接/current/索引）→ 结算当日 Metrics → commit → push → 远端 SHA 核验 → 释放 ownership。未做远端 SHA 核验不得报「下班完成」。\n\n## `继续工作`（别名 `接手继续`）\n\n跨会话/跨电脑恢复上下文：从 Git、canonical state、交接的唯一下一步继续，不需要复述整个项目。\n\n## `更新项目文档`\n\n中途存档：把当前进度增量写入日报/current/handoff 检查点后停止，不 commit/push。\n\n## `保存设计规范`\n\n只保存用户已确认、可复用的设计事实，按全局/组件/页面/工作流分类写入 `ui_spec/`，并核对归属路径。\n\n## `完成`\n\n关闭当前任务、记录完成证据、给下一步（不等于下班）。\n\n## `记入记忆`\n\n把决策/坑点/问题写入 `knowledge/` 并自动建索引。\n\n## `记录需求变更`\n\n新增/修改/移除需求时，同步更新 `overview.md` 需求清单并追加一行变更记录。\n\n## `Baton init`\n\n初始化项目实例：生成文档骨架、配置与三端薄适配器（AGENTS.md / CLAUDE.md / .cursorrules / .cursor/rules/baton.mdc）。\n\n## 普通自然语言任务\n\n需要选择时统一输出：\n\n| ID | 任务/下一步 | 说明 | 建议 | 确认口令 |\n| --- | --- | --- | --- | --- |\n| 1 | 推荐事项 | 当前状态与影响 | 推荐 | 回复 `1` |\n\n用户无需执行 PowerShell、Git、hash 或 approval 命令。\n',
        'docs/ai_memory/handoff_current.md': '# 交接记录\n\n## 【归档分卷索引】\n\n- 当前文件约 0.5KB，未达到 3MB 分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立交接记录。 |\n\n## 交接条目模板（追加到文件末尾，保持最新在末）\n\n```markdown\n### HO-YYYYMMDD-HHMM-<Agent>｜下班收尾｜<关键词>\n- 时间：YYYY-MM-DD HH:MM（东八区；Agent = Cursor / Codex / Claude / DeepSeek / workbuddy）\n- 交接状态：<状态>\n- 任务 ID / 状态：\n- 分支 / HEAD：\n- 实际修改文件：\n- 已完成 / 尚未完成：\n- 已验证（命令 → 结果）：\n- 未验证项及原因：\n- 唯一下一步：\n- 阻塞与风险：\n- 凭据检查：未记录敏感信息\n```\n',
        'docs/ai_memory/overview.md': '# ' + name + ' 项目总览（Baton 权威项目卷）\n\n> 本文件是项目的"记性本"：目标、需求、技术栈、功能点都记在这里。\n> **铁律**：新增/修改/移除需求时，必须同步更新「需求清单」并在「变更记录」追加一行；历史只追加，不覆盖。\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立项目总览。 |\n\n## 一句话定义\n\n（待填：这个项目做什么，一句话）\n\n## 项目目标\n\n- 项目名：' + name + '\n- 为什么做这个项目：（待填）\n- 成功标准：（待填）\n\n## 需求清单\n\n| 编号 | 需求 | 状态 | 说明 |\n|---|---|---|---|\n| RQ-001 | （待填） | 规划中 | （待填） |\n\n> 状态：规划中 / 进行中 / 已实现 / 已移除（移除见变更记录）\n\n## 技术栈\n\n- 语言/框架：（待填）\n- 关键依赖：（待填）\n- 运行环境：（待填）\n\n## 功能点\n\n- （待填，按模块列出）\n\n## 架构概要\n\n- （待填：模块职责、进程边界、数据流；改变冻结点须经确认并记录）\n\n## 变更记录\n\n| 日期 | 变更内容 | 类型 | 原因/备注 |\n|---|---|---|---|\n| ' + todayLocal() + ' | 创建项目总览 | 新建 | Baton init |\n',
        'docs/ai_memory/constraints.md': '# 编码与开发红线（冻结点）\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立红线清单。 |\n\n## 硬性红线\n\n除非任务明确授权，任何执行者不得静默改变：\n\n- 顶层模块职责与进程边界\n- 协议/接口/状态机\n- 隐私与凭据红线\n- 依赖版本与发布方式\n\n## 处理流程\n\n发现必须改变冻结点时：停止相关改动 → 生成检查点 → 退回架构负责人/用户确认，确认后在此追加一行变更记录。\n\n## 文档约束\n\n- 所有长期 md 文件必须保留【归档分卷索引】与【修订记录】两个区块；缺失时先补齐再写入。\n- 单文件超过 3MB 时按完整条目或章节分卷，主文件保留当前有效内容、摘要和读取顺序。\n- 事实优先级：Git/真实文件/新鲜验证 > state/*.json > 交接/日报 > 聊天自述。\n- 历史只增不改；危险 Git（force push/reset --hard/危险 clean/未授权 rebase）禁止。\n- 人读时间一律东八区 `YYYY-MM-DD HH:MM`；JSON/metrics 可用 ISO。\n- 修订记录「修改人」与交接 HO 执行者只允许：Cursor / Codex / Claude / DeepSeek / workbuddy；识别不出写「未知」；禁止写 Baton。\n- 标题与修订概要必须含关键词；禁止空标题「中途存档」「下班收尾」「更新当前工作摘要」。\n- `current.md` 修订表只保留最近 3 个日期、每个日期一行（同日覆盖不堆叠）；任务防丢失靠 task_todo.md / task_progress.md / state/tasks.json。\n',
        'docs/ai_memory/validation_matrix.md': '# 验证矩阵\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立验证矩阵。 |\n\n按本次修改范围选择必要验证；构建成功不等于业务闭环。按风险选验证，禁止每个任务跑整个测试宇宙。\n\n| 范围 | 最低验证 | 高风险补充 |\n| --- | --- | --- |\n| 文档/元数据 | 文件存在性与引用一致性、`git status --short` | 交接与状态投影一致性 |\n| 工具/脚本 | 语法检查、单测 | 真实路径冒烟、错误分支注入、无凭据残留 |\n| 服务/后端 | 构建、单测 | 真实数据库联调、契约测试、失败事务注入、回滚演练 |\n| 前端 | 构建、lint、单测 | 真实 API 联调、关键路径浏览器验证 |\n| 协议/契约 | lint、schema 校验 | 前后端/客户端兼容与破坏性变更检查 |\n| 发布 | 构建制品摘要、备份、回滚、健康检查 | 恢复演练、权限/限流/TLS/防火墙/日志/告警 |\n\n| 变更级别 | 验证强度 |\n|---|---|\n| Micro | 最小必要验证 |\n| Bounded | 针对性验证 |\n| Complex | 完整关键路径 |\n| Architecture / High-risk | 端到端 + 独立复核 + Fidelity |\n',
        'docs/ai_memory/tasks/task_schema.md': '# 任务状态与字段规范\n\n## 【归档分卷索引】\n\n- 当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立任务规范。 |\n\n## 任务 ID\n\n格式：`DC-YYYYMMDD-NNN`\n\n- 日期使用任务首次进入知识库的日期。\n- `NNN` 从 `001` 起，确保仓库内唯一。\n- 旧任务在下一次启动、变更、阻塞或验收时补发 ID；不批量改写历史。\n\n## 状态机\n\n```text\n待规划 → 可开始 → 进行中 → 阻塞\n                    ↓\n                  待验收 → 已完成\n\n任意未完成状态 → 已取消\n阻塞解除 → 可开始或进行中\n```\n\n## Definition of Ready（进入"可开始"前必须明确）\n\n- 目标\n- 范围内与范围外\n- 优先级\n- 风险\n- 负责人\n- 验收标准\n- 验证计划\n- 回滚点\n\n## Definition of Done\n\n- 每条验收标准有证据（命令 → 结果）\n- diff 与范围一致\n- 验证通过\n- 无意外文件与凭据残留\n- 文档已更新（修订记录 + 归档分卷索引）\n- 独立复核通过（按风险分级）\n\n代码写完 ≠ 完成；测试全绿 ≠ 完成；必须逐条对照验收标准。\n',
        'docs/ai_memory/tasks/task_todo.md': '# 待办清单\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立待办清单。 |\n\n## 待办表\n\n| 优先级 | 任务 ID | 事项 | 状态 | 完成条件 |\n| --- | --- | --- | --- | --- |\n| P0 | DC-YYYYMMDD-001 | （首项待办，由用户确认后创建） | 待规划 | （完成标准，须可验证） |\n\n> 状态：待规划 / 可开始 / 进行中 / 阻塞 / 待验收 / 已完成 / 已取消\n> 规则：任务状态变化时，在上方【修订记录】追加一行（日期/修改人/变更概要），并同步 `state/tasks.json` 与 `state/archive_index.json`。\n',
        'docs/ai_memory/tasks/task_progress.md': '# 进行中任务\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立进行中任务视图。 |\n\n## 进行中表\n\n| 优先级 | 任务 ID | 事项 | 状态 | 当前进度 | 唯一下一步 |\n| --- | --- | --- | --- | --- | --- |\n| P0 | DC-YYYYMMDD-001 | （首个任务） | 待规划 | （未开始） | 说「上班啦」开始 |\n\n> 规则：任务状态变化时，在上方【修订记录】追加一行，并同步 `state/tasks.json` 与 `state/archive_index.json`。\n',
        'docs/ai_memory/tasks/task_finished.md': '# 已完成任务\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立完成任务视图。 |\n\n## 已完成条目（示例格式）\n\n```markdown\n## DC-YYYYMMDD-NNN｜<简短主题>\n\n- 完成日期：YYYY-MM-DD\n- 用户验收：通过 / 未验收\n- 结果：（做了什么、交付了什么）\n- 证据：（命令 → 结果，可验证）\n- 边界：（没有动什么）\n- 关联：（相关文档路径）\n```\n\n> 规则：任务完成时，把条目从 `task_progress.md` / `task_todo.md` 移到这里，在上方【修订记录】追加一行，并同步 `state/tasks.json` 与 `state/archive_index.json`。\n',
        'docs/ai_memory/knowledge/tech_decision.md': '# 技术决策记录（ADR）\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立技术决策记录。 |\n\n## 决策条目模板（每条追加一个 `TD-YYYYMMDD-NNN`）\n\n```markdown\n## TD-YYYYMMDD-NNN｜<决策标题>\n\n- 状态：有效 / 已被 TD-YYYYMMDD-NNN 取代 / 已废弃\n- 适用模块/版本：\n- 最后验证日期：\n- 最后验证提交：`<sha>`（如适用）\n- 决策：（做了什么决定、为什么）\n- 替代方案：（考虑过但未选）\n- 取舍：（代价与收益）\n- 验证：（如何证明有效，命令 → 结果）\n- 边界：（没有覆盖什么）\n```\n\n> 规则：新决策追加到文件末尾；状态被取代时只改状态行并写明取代关系，不删除历史条目；同步 `state/archive_index.json`。\n',
        'docs/ai_memory/knowledge/pit_experience.md': '# 已验证坑点与解决方案\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立坑点经验记录。 |\n\n## 坑点条目模板（每条追加一个）\n\n```markdown\n## <坑点标题>\n\n- 状态：有效 / 已解决\n- 适用模块/版本：\n- 最后验证日期：\n- 最后验证提交：`<sha>`（如适用）\n- 现象：（发生了什么）\n- 根因：（为什么）\n- 稳定方案：（怎么修、以后怎么做）\n- 自测边界：（怎么证明修好了，命令 → 结果；只看表面现象不算）\n```\n\n> 规则：新坑点追加到文件末尾；只记录**已验证**的坑点（有命令/证据），猜测性坑点不得写入；同步 `state/archive_index.json`。\n',
        'docs/ai_memory/ui_spec/global.md': '# 全局设计规范\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立全局设计规范。 |\n\n## 保存设计规范的口令行为\n\n- 只保存**用户已确认、可复用**的设计事实（颜色、字体、间距、组件行为、页面结构、工作流），不保存推断。\n- 按分类写入：全局 → `ui_spec/global.md`；组件 → `ui_spec/component.md`；页面 → `ui_spec/page.md`；工作流 → `ui_spec/workflow.md`。\n- 冲突时保留历史、标注当前有效版本，并追加【修订记录】一行。\n- 同步 `state/archive_index.json`。\n\n## 当前有效规范\n\n（暂无。保存设计规范后在此积累）\n',
        'docs/ai_memory/ui_spec/component.md': '# 组件设计规范\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立组件设计规范。 |\n\n## 当前有效规范\n\n（暂无。保存设计规范后在此积累；冲突保留历史、标注当前有效版本）\n',
        'docs/ai_memory/ui_spec/page.md': '# 页面设计规范\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立页面设计规范。 |\n\n## 当前有效规范\n\n（暂无。保存设计规范后在此积累；冲突保留历史、标注当前有效版本）\n',
        'docs/ai_memory/ui_spec/workflow.md': '# 工作流设计规范\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立工作流设计规范。 |\n\n## 当前有效规范\n\n（暂无。保存设计规范后在此积累；冲突保留历史、标注当前有效版本）\n',
        'docs/ai_memory/requirements/requirements_YYYY-MM-DD_TEMPLATE.md': '# <需求主题> 需求基线\n\n> 任务：DC-YYYYMMDD-NNN\n> 状态：（待确认 / 已确认 / 已实现 / 已取代）\n> 确认日期：\n> 产品负责人：用户\n> 执行者：（当前执行 AI）\n\n## 【归档分卷索引】\n\n- 当前文件未达到分卷阈值；当前无归档分卷。\n\n## 【修订记录】\n\n| 日期 | 修改人 | 变更概要 |\n| --- | --- | --- |\n| ' + todayLocal() + ' | ' + initAgent + ' | Baton init 建立需求基线模板。 |\n\n## 文档状态\n\n- 关联任务：`DC-YYYYMMDD-NNN`\n- 状态：\n- 确认日期：\n- 取代范围：（本需求取代了哪些旧需求/文档）\n- 保留范围：（继续继承哪些既有原则/文档）\n\n## 1. 产品定位\n\n（待填：做什么、给谁用、不做什么）\n\n## 2. 问题陈述\n\n（待填：现在有什么问题，为什么要做）\n\n## 3. 需求清单\n\n| 编号 | 需求 | 优先级 | 状态 | 验收标准 |\n| --- | --- | --- | --- | --- |\n| RQ-001 | （待填） | P0 | 待确认 | （可验证） |\n\n## 4. 边界与约束\n\n- （待填：范围内/范围外、依赖、限制）\n\n> 规则：需求变更时在【修订记录】追加一行，并同步 `overview.md` 需求清单与 `state/archive_index.json`；文件按 `requirements_YYYY-MM-DD_<topic>.md` 命名。\n',
        'docs/ai_memory/daily_log/daily_TEMPLATE.md': '# YYYY-MM-DD 日报\n\n> 本文件是当日工作流水：交接条目/进度条目按时间追加，最新在末。\n> 文件名 `daily_YYYY-MM-DD.md`；每天一份，不跨天合并。\n\n## 今日条目\n\n（暂无。`更新项目文档` / `下班啦` / `完成` 会自动在此追加当日条目）\n\n## 条目格式示例\n\n```markdown\n## 下班收尾｜<关键词>｜YYYY-MM-DD HH:MM｜<Agent>\n\n- 时间：YYYY-MM-DD HH:MM（东八区；Agent = Cursor / Codex / Claude / DeepSeek / workbuddy）\n- 任务：`DC-YYYYMMDD-NNN`\n- 完成：（做了什么）\n- 验证：（命令 → 结果）\n- 未验证项及原因：\n- 唯一下一步：\n- 凭据检查：未记录敏感信息\n```\n',
        'docs/ai_memory/state/project_state.json': JSON.stringify({ schema_version: 1, revision: 1, updated_at: nowIso(), repository: { id: null, branch: null, dirty: false, remote_sha: null, last_published_sha: null }, current_task_id: null, active_work: null, ownership: { writer: null, logical_state: 'released', updated_at: nowIso() }, last_handoff: null }, null, 2),
        'docs/ai_memory/state/tasks.json': JSON.stringify({ schema_version: 1, revision: 1, updated_at: nowIso(), tasks: [] }, null, 2),
        'docs/ai_memory/state/archive_index.json': JSON.stringify({ schema_version: 1, revision: 1, updated_at: nowIso(), entries: [] }, null, 2),
        'docs/ai_memory/state/decisions.jsonl': '',
        'docs/ai_memory/state/issues.json': '[]',
        '.baton/config.json': JSON.stringify({
          schema_version: 1, project_name: name,
          remotes: { origin: 'REPLACE_WITH_REMOTE_URL', push_allowed: ['origin'], push_blocked: [] },
          branch: { base: 'master' },
          protected_paths: ['.github', '.env'],
          verify: { remote_sha: true, ff_only: true },
          model_pool: [
            { id: 'deepseek-v4-flash', provider: 'deepseek', tags: ['fast', 'cheap'], status: 'unverified' },
            { id: 'deepseek-v4-pro', provider: 'deepseek', tags: ['reasoning', 'review'], status: 'unverified' },
          ],
          routing: [
            { task: 'micro', mode: 'main-session' },
            { task: 'bounded', prefer: ['fast'], fallback: ['reasoning'], reasoning: 'high' },
            { task: 'complex', prefer: ['reasoning'], fallback: ['fast'], reasoning: 'high' },
            { task: 'architecture', prefer: ['reasoning'], fallback: [], reasoning: 'high' },
            { task: 'high_risk', prefer: ['reasoning'], fallback: [], reasoning: 'high' },
            { task: 'review', prefer: ['reasoning'], fallback: ['fast'], reasoning: 'high' },
          ],
          legacy: { doc_roles: null },
        }, null, 2),
      }
    }

    async function monthlyHtml(rootPath, monthDir, month, today, git, actualModel, reviewerModel, rawOverride) {
      const raw = typeof rawOverride === 'string' ? rawOverride : ((await readTextAt(rootPath, monthDir + '/runs.jsonl')) || '')
      const runs = []
      let badLines = 0
      for (const line of raw.split('\n')) {
        const s = line.trim()
        if (s === '') continue
        try {
          const r = JSON.parse(s)
          if (r && typeof r.ts === 'string') runs.push(r)
        } catch (e) { badLines += 1 }
      }
      const trustedSource = (s) => ['host_descriptor', 'host_reported', 'dispatch_confirmed', 'host_default'].indexOf(s) !== -1
      const completed = new Map()
      const actual = []
      const attempts = []
      const startedAttempts = new Map()
      const evaluatedAttempts = new Set()
      const lifecycleTaskIds = new Set()
      let clockOuts = 0
      for (const r of runs) {
        if (r.type === 'clock_out') { clockOuts += 1; continue }
        if (r.type === 'routing' || r.type === 'route_decided') continue
        if (r.type === 'attempt_started' && r.attempt_id) {
          if (!startedAttempts.has(r.attempt_id)) startedAttempts.set(r.attempt_id, r)
          if (r.task_id) lifecycleTaskIds.add(r.task_id)
          continue
        }
        if (r.type === 'task_complete' && r.task_id) {
          completed.set(r.task_id, { task_id: r.task_id, ts: r.ts, actual_model: r.actual_model || 'unknown', reasoning_effort: r.reasoning_effort || null, source: r.source || 'unknown', role: r.role || 'executor', result: 'succeeded', token: null, duration_ms: null })
        } else if (r.type === 'actual') {
          actual.push(r)
        } else if (r.type === 'attempt_evaluated') {
          if (r.attempt_id && evaluatedAttempts.has(r.attempt_id)) continue
          if (r.attempt_id) evaluatedAttempts.add(r.attempt_id)
          if (r.task_id) lifecycleTaskIds.add(r.task_id)
          attempts.push({ task_id: r.task_id || null, ts: r.ended_at || r.ts, actual_model: r.actual_model || r.model || 'unknown', reasoning_effort: r.actual_reasoning_effort || r.reasoning_effort || null, source: r.actual_source || r.source || 'unknown', role: r.role || 'executor', result: r.result || r.status || 'unknown', token: Number.isFinite(r.total_tokens) ? r.total_tokens : (Number.isFinite(r.tokens) ? r.tokens : null), duration_ms: Number.isFinite(r.duration_ms) ? r.duration_ms : null })
        }
      }
      for (const [attemptId, r] of startedAttempts.entries()) {
        if (!evaluatedAttempts.has(attemptId)) attempts.push({ task_id: r.task_id || null, ts: r.started_at || r.ts, actual_model: r.actual_model || 'unknown', reasoning_effort: r.reasoning_effort || null, source: r.source || 'unknown', role: r.role || 'executor', result: 'unarchived', token: null, duration_ms: null })
      }
      const recordedOnly = []
      for (const r of actual) {
        if (r.task_id && lifecycleTaskIds.has(r.task_id)) continue
        if (r.task_id && completed.has(r.task_id)) {
          const u = completed.get(r.task_id)
          if (trustedSource(r.source) && r.actual_model && r.actual_model !== 'unknown') {
            u.actual_model = r.actual_model
            u.reasoning_effort = r.reasoning_effort || null
            u.source = r.source
          }
        } else {
          recordedOnly.push({ task_id: r.task_id || null, ts: r.ts, actual_model: r.actual_model || 'unknown', reasoning_effort: r.reasoning_effort || null, source: r.source || 'unknown', role: r.role || 'executor', result: 'unarchived', token: null, duration_ms: null })
        }
      }
      const legacyCompleted = [...completed.values()].filter((u) => !lifecycleTaskIds.has(u.task_id))
      const units = legacyCompleted.concat(attempts, recordedOnly).map((u) => {
        const d = new Date(u.ts)
        const validDate = !Number.isNaN(d.getTime())
        const east8 = validDate ? east8Stamp(d) : null
        const day = east8 !== null ? east8.date : 'unknown'
        const trusted = trustedSource(u.source) && u.actual_model !== 'unknown'
        const model = trusted ? u.actual_model + (u.reasoning_effort ? ' / ' + u.reasoning_effort : '') : 'unknown / 声明（未证实）'
        return { task: u.task_id || 'n/a', ts: u.ts, day, hour: east8 !== null ? Number(east8.hm.slice(0, 2)) : null, model, trusted, role: u.role || 'executor', result: u.result || 'unknown', token: u.token, duration_ms: u.duration_ms }
      })
      const dates = [...new Set(units.map((u) => u.day).filter((d) => d !== 'unknown'))].sort()
      const monthPrefix = month.replace('/', '-')
      const defaultDate = today.indexOf(monthPrefix) === 0 ? today : (dates.length > 0 ? dates[dates.length - 1] : monthPrefix + '-01')
      const allDates = [...new Set(dates.concat([defaultDate]))].sort()
      const days = {}
      for (const d of allDates) days[d] = units.filter((u) => u.day === d)
      const knownResults = units.filter((u) => ['succeeded', 'needs_revision', 'failed', 'cancelled'].indexOf(u.result) !== -1)
      const data = {
        month,
        defaultDate,
        dates: allDates,
        bad_lines: badLines,
        monthSummary: {
          records: runs.length,
          work_units: units.length,
          tasks_completed: units.filter((u) => u.result === 'succeeded').length,
          clock_outs: clockOuts,
          rework: knownResults.length > 0 ? units.filter((u) => u.result === 'needs_revision').length : null,
          failed: knownResults.length > 0 ? units.filter((u) => u.result === 'failed').length : null,
          blocked: null,
          total_ms: units.some((u) => u.duration_ms !== null) ? units.reduce((n, u) => n + (u.duration_ms || 0), 0) : null,
        },
        days,
        orchestration: { provider_status: [], routing_modes: ['baton-static'], buckets: [], attempts: [] },
      }
      const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]))
      const safeJson = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
      const options = allDates.map((d) => '<option value="' + esc(d) + '"' + (d === defaultDate ? ' selected' : '') + '>' + esc(d) + '</option>').join('')
      const hourTargets = Array.from({ length: 24 }, (_, h) => '<rect class="hour-hit" data-hour="' + h + '" x="' + (48 + h * 37) + '" y="18" width="37" height="218" fill="transparent"/>').join('')
      const boardNames = ['综合推荐榜', '首次通过率榜', '低返修榜', '稳定性榜', 'Token 效率榜', '速度榜']
      const boards = boardNames.map((n, i) => '<section class="rank"><h3>' + n + '</h3><div id="rank' + i + '" class="muted">未记录</div></section>').join('')
      return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baton Metrics</title><style>' +
        'body{font-family:Segoe UI,sans-serif;background:#0c1422;color:#e8eef8;margin:0;padding:24px}.wrap{max-width:1200px;margin:auto}' +
        '.top,.filters{display:flex;justify-content:space-between;align-items:end;gap:16px}.filters{justify-content:flex-start;align-items:center;flex-wrap:wrap}' +
        '.muted{color:#8ea4bf;font-size:12px}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:20px 0}' +
        '.card,.panel,.rank{background:#122035;border:1px solid #29405d;border-radius:12px;padding:14px}.value{font-size:24px}' +
        '.panel{margin:14px 0}.chart-wrap{position:relative;overflow-x:auto}svg{width:100%;min-width:930px;height:280px}.axis{stroke:#29405d}.trend{fill:none;stroke-width:2.5}' +
        '#chartTooltip{position:absolute;display:none;pointer-events:none;white-space:pre;background:#08101d;border:1px solid #52749b;border-radius:8px;padding:8px;font-size:12px}' +
        '.ranks{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.rank h3,h2{font-size:14px;color:#9fb5cf;margin:4px 0 10px}' +
        'table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #29405d;text-align:left}select{background:#122035;color:#e8eef8;border:1px solid #52749b;padding:6px}' +
        '@media(max-width:760px){.cards{grid-template-columns:repeat(2,1fr)}.ranks{grid-template-columns:1fr}}' +
        '</style></head><body data-default-date="' + esc(defaultDate) + '"><main class="wrap"><div class="top"><div><div class="muted">BATON / MONTHLY METRICS</div><h1>执行效果月报</h1><div class="muted">' + esc(month) + ' ｜ 分支 ' + esc(git.branch) + '</div></div></div>' +
        '<section class="filters"><label>日期 <select id="dateSelect">' + options + '</select></label><label><input id="includeMain" type="checkbox"> 包含主会话</label><label><input id="mergeReasoning" type="checkbox"> 合并同模型推理档位</label><span id="dataWarning" class="muted"></span></section>' +
        '<section class="cards"><article class="card"><div class="muted">执行尝试</div><div id="attempts" class="value">0</div></article><article class="card"><div class="muted">成功</div><div id="success" class="value">未记录</div></article><article class="card"><div class="muted">返修</div><div id="revision" class="value">未记录</div></article><article class="card"><div class="muted">失败</div><div id="failure" class="value">未记录</div></article><article class="card"><div class="muted">Token</div><div id="tokens" class="value">未记录</div></article></section>' +
        '<section class="panel"><h2>0–23 小时模型使用趋势</h2><div class="chart-wrap"><svg id="hourlyChart" viewBox="0 0 960 270" role="img" aria-label="按小时模型使用次数折线图"><g id="axes"></g><g id="lines"></g>' + hourTargets + '</svg><div id="chartTooltip"></div></div><div id="legend" class="muted"></div></section>' +
        '<section class="panel"><h2>榜单</h2><div class="ranks">' + boards + '</div></section>' +
        '<section class="panel"><h2>所选日期执行明细</h2><div id="details"></div></section></main>' +
        '<script>window.__METRICS__=' + safeJson + ';</script>\n' +
        '<script>(function(){var D=window.__METRICS__,S=document.getElementById("dateSelect"),M=document.getElementById("includeMain"),G=document.getElementById("mergeReasoning"),svg=document.getElementById("hourlyChart"),tip=document.getElementById("chartTooltip"),colors=["#55c2ff","#ffb454","#79d98c","#c099ff","#ff718b","#d9d46c"];function val(v){return v===null||v===undefined?"未记录":String(v)}function html(v){var d=document.createElement("div");d.textContent=String(v);return d.innerHTML}function rows(){return(D.days[S.value]||[]).filter(function(u){return M.checked||u.role!=="main"}).map(function(u){var x=Object.assign({},u);if(G.checked)x.model=x.model.replace(/ \/ (low|medium|high|max)$/," ");return x})}function groups(rs){var o={};rs.forEach(function(u){(o[u.model]||(o[u.model]=[])).push(u)});return o}function set(id,v){document.getElementById(id).textContent=val(v)}function render(){var rs=rows(),known=rs.filter(function(u){return["succeeded","needs_revision","failed","cancelled"].indexOf(u.result)!==-1});set("attempts",rs.length);set("success",known.length?known.filter(function(u){return u.result==="succeeded"}).length:null);set("revision",known.length?known.filter(function(u){return u.result==="needs_revision"}).length:null);set("failure",known.length?known.filter(function(u){return u.result==="failed"}).length:null);var tk=rs.filter(function(u){return u.token!==null});set("tokens",tk.length?tk.reduce(function(n,u){return n+u.token},0):null);var ax="",ln="",gs=groups(rs),max=1;Object.keys(gs).forEach(function(k){for(var h=0;h<24;h++)max=Math.max(max,gs[k].filter(function(u){return u.hour===h}).length)});for(var h=0;h<24;h++){var x=66+h*37;ax+="<line class=\"axis\" x1=\""+x+"\" y1=\"20\" x2=\""+x+"\" y2=\"230\"/><text x=\""+x+"\" y=\"252\" fill=\"#8ea4bf\" font-size=\"10\" text-anchor=\"middle\">"+h+"</text>"}Object.keys(gs).forEach(function(k,i){var pts=[];for(var h=0;h<24;h++){var n=gs[k].filter(function(u){return u.hour===h}).length;pts.push((66+h*37)+","+(230-n/max*190))}ln+="<polyline class=\"trend\" stroke=\""+colors[i%colors.length]+"\" points=\""+pts.join(" ")+"\"/>"});document.getElementById("axes").innerHTML=ax;document.getElementById("lines").innerHTML=ln;document.getElementById("legend").textContent=Object.keys(gs).join(" ｜ ")||"未记录";var trusted=rs.filter(function(u){return u.trusted}),stats=groups(trusted),arr=Object.keys(stats).map(function(k){var a=stats[k],q=a.filter(function(u){return["succeeded","needs_revision","failed"].indexOf(u.result)!==-1}),s=q.filter(function(u){return u.result==="succeeded"}),t=s.filter(function(u){return u.token!==null}),d=s.filter(function(u){return u.duration_ms!==null}).map(function(u){return u.duration_ms}).sort(function(a,b){return a-b});return{model:k,n:a.length,pass:q.length?s.length/q.length:null,rework:q.length?q.filter(function(u){return u.result==="needs_revision"}).length/q.length:null,fail:q.length?q.filter(function(u){return u.result==="failed"}).length/q.length:null,tok:t.length?t.reduce(function(n,u){return n+u.token},0)/t.length:null,speed:d.length?d[Math.floor(d.length/2)]:null}});function board(id,metric,asc){var a=arr.filter(function(x){return x[metric]!==null}).sort(function(x,y){return asc?x[metric]-y[metric]:y[metric]-x[metric]});document.getElementById(id).innerHTML=a.length?"<table><tr><th>配置</th><th>指标</th><th>使用次数</th></tr>"+a.map(function(x){return"<tr><td>"+html(x.model)+"</td><td>"+(metric==="pass"||metric==="rework"||metric==="fail"?Math.round(x[metric]*100)+"%":Math.round(x[metric]))+"</td><td>"+x.n+"</td></tr>"}).join("")+"</table>":"未记录（无可信且覆盖该指标的模型执行结果）"}board("rank0","pass",false);board("rank1","pass",false);board("rank2","rework",true);board("rank3","fail",true);board("rank4","tok",true);board("rank5","speed",true);document.getElementById("details").innerHTML=rs.length?"<table><tr><th>时间</th><th>模型/档位</th><th>结果</th><th>Token</th><th>耗时(ms)</th></tr>"+rs.map(function(u){return"<tr><td>"+html(u.ts)+"</td><td>"+html(u.model)+"</td><td>"+html(u.result)+"</td><td>"+html(val(u.token))+"</td><td>"+html(val(u.duration_ms))+"</td></tr>"}).join("")+"</table>":"<span class=\"muted\">当天无执行记录</span>";document.getElementById("dataWarning").textContent=D.bad_lines?"数据警告：跳过 "+D.bad_lines+" 行损坏 JSON":""}svg.addEventListener("mousemove",function(e){var t=e.target.closest(".hour-hit");if(!t)return;var h=Number(t.getAttribute("data-hour")),rs=rows().filter(function(u){return u.hour===h}),gs=groups(rs),out=[String(h).padStart(2,"0")+":00"];Object.keys(gs).forEach(function(k){var a=gs[k];out.push(k+"：使用 "+a.length+"，成功 "+a.filter(function(u){return u.result==="succeeded"}).length+"，返修 "+a.filter(function(u){return u.result==="needs_revision"}).length+"，失败 "+a.filter(function(u){return u.result==="failed"}).length+"，Token "+val(a.some(function(u){return u.token!==null})?a.reduce(function(n,u){return n+(u.token||0)},0):null)+"，耗时 "+val(a.some(function(u){return u.duration_ms!==null})?a.reduce(function(n,u){return n+(u.duration_ms||0)},0):null))});tip.textContent=out.join("\\n");tip.style.display="block";tip.style.left=(e.offsetX+12)+"px";tip.style.top=(e.offsetY+8)+"px"});svg.addEventListener("mouseleave",function(){tip.style.display="none"});S.addEventListener("change",render);M.addEventListener("change",render);G.addEventListener("change",render);render()})();</script></body></html>'
    }
}
