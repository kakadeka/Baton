#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

function east8Date() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function arg(name) {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1]
}

function validHtml(s) {
  return typeof s === 'string' && s.startsWith('<!doctype html>') && s.includes('</html>')
}

function readExisting(file) {
  try { return fs.readFileSync(file, 'utf8') } catch { return null }
}

function output(result) {
  process.stdout.write(JSON.stringify(result) + '\n')
}

function has(name) {
  return process.argv.includes(name)
}

function east8Parts(input = new Date().toISOString()) {
  const shifted = new Date(new Date(input).getTime() + 8 * 60 * 60 * 1000).toISOString()
  return { day: shifted.slice(0, 10), month: shifted.slice(0, 7).replace('-', '/') }
}

function eventKey(raw) {
  try {
    const row = JSON.parse(raw)
    if (row && typeof row.event_id === 'string' && row.event_id !== '') return 'event:' + row.event_id
  } catch {}
  return 'raw:' + raw
}

function comparable(row) {
  const out = {}
  for (const key of Object.keys(row || {}).sort()) if (!['ts', 'started_at', 'ended_at'].includes(key)) out[key] = row[key]
  return JSON.stringify(out)
}

function jsonlFilesUnder(root) {
  const found = []
  const walk = (dir) => {
    let entries = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const target = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(target)
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) found.push(target)
    }
  }
  walk(root)
  return found
}

function allMetricRows(projectRoot) {
  const files = [
    ...jsonlFilesUnder(path.join(projectRoot, '.baton', 'local', 'metrics')),
    ...jsonlFilesUnder(path.join(projectRoot, 'docs', 'ai_memory', 'agent_metrics')).filter((file) => path.basename(file) === 'runs.jsonl'),
  ]
  const rows = []
  for (const file of files) {
    const raw = readExisting(file) || ''
    for (const line of raw.split('\n').filter((value) => value.trim() !== '')) {
      try { rows.push(JSON.parse(line)) } catch {}
    }
  }
  return rows
}

function appendLocalEvent(projectRoot, event) {
  const existing = allMetricRows(projectRoot).find((row) => row.event_id === event.event_id)
  if (existing) {
    if (comparable(existing) !== comparable(event)) return { ok: false, conflict: true, reason: 'event_id 冲突：拒绝覆盖已有统计事件' }
    return { ok: true, reused: true, event: existing, journal_path: null }
  }
  const day = east8Parts(event.ts).day
  const journalPath = path.join(projectRoot, '.baton', 'local', 'metrics', day + '.jsonl')
  fs.mkdirSync(path.dirname(journalPath), { recursive: true })
  fs.appendFileSync(journalPath, JSON.stringify(event) + '\n', 'utf8')
  return { ok: true, reused: false, event, journal_path: journalPath }
}

function syncLocalMetrics(projectRoot) {
  const localRoot = path.join(projectRoot, '.baton', 'local', 'metrics')
  const localFiles = jsonlFilesUnder(localRoot)
  const grouped = new Map()
  for (const file of localFiles) {
    const raw = readExisting(file) || ''
    for (const line of raw.split('\n').filter((value) => value.trim() !== '')) {
      let targetMonth = east8Parts().month
      try {
        const row = JSON.parse(line)
        targetMonth = east8Parts(row.ended_at || row.started_at || row.ts).month
      } catch {}
      if (!grouped.has(targetMonth)) grouped.set(targetMonth, [])
      grouped.get(targetMonth).push(line)
    }
  }
  let appended = 0
  for (const [targetMonth, lines] of grouped.entries()) {
    const runs = path.join(projectRoot, 'docs', 'ai_memory', 'agent_metrics', ...targetMonth.split('/'), 'runs.jsonl')
    const before = readExisting(runs) || ''
    const existing = new Map(before.split('\n').filter((value) => value.trim() !== '').map((line) => [eventKey(line), line]))
    const additions = []
    for (const line of lines) {
      const key = eventKey(line)
      if (existing.has(key)) {
        if (key.startsWith('event:') && comparable(JSON.parse(existing.get(key))) !== comparable(JSON.parse(line))) {
          return { ok: false, status: 'conflict', reason: 'metrics event_id 冲突：拒绝覆盖月度历史', conflict_event_id: key.slice(6) }
        }
        continue
      }
      existing.set(key, line)
      additions.push(line)
    }
    if (additions.length > 0) {
      fs.mkdirSync(path.dirname(runs), { recursive: true })
      fs.appendFileSync(runs, additions.join('\n') + '\n', 'utf8')
      appended += additions.length
    }
  }
  for (const file of localFiles) fs.writeFileSync(file, '', 'utf8')
  return { ok: true, status: 'synced', appended, local_files: localFiles }
}

const projectRoot = path.resolve(arg('--project') || process.cwd())

if (has('--record-start')) {
  const taskId = String(arg('--task-id') || '').trim()
  const runId = String(arg('--run-id') || '').trim()
  const executorId = String(arg('--executor-id') || '').trim()
  const effort = String(arg('--effort') || '').trim().toLowerCase()
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(taskId) || (effort !== '' && !['low', 'medium', 'high', 'max'].includes(effort))) {
    output({ ok: false, status: 'invalid', reason: 'task-id 或 effort 非法' })
    process.exit(2)
  }
  const identity = runId || executorId
  if (identity === '') {
    output({ ok: false, status: 'invalid', reason: 'run-id 与 executor-id 至少提供一个' })
    process.exit(2)
  }
  const attemptId = 'attempt-' + crypto.createHash('sha256').update([taskId, identity, arg('--host-id') || 'host-default'].join('|')).digest('hex').slice(0, 16)
  const startedAt = new Date().toISOString()
  const event = {
    ts: startedAt, started_at: startedAt, event_id: attemptId + '-start', type: 'attempt_started', attempt_id: attemptId,
    task_id: taskId, task_title: arg('--task-name') || null, task_type: arg('--task-type') || null,
    host_id: arg('--host-id') || 'host-default', executor_id: executorId || identity, run_id: runId || null,
    actual_model: arg('--model') || 'unknown', reasoning_effort: effort || null, source: arg('--source') || 'requested',
  }
  const written = appendLocalEvent(projectRoot, event)
  output({ ...written, status: written.ok ? 'started' : 'conflict', attempt_id: attemptId })
  process.exit(written.ok ? 0 : 2)
}

if (has('--record-end')) {
  const taskId = String(arg('--task-id') || '').trim()
  const attemptId = String(arg('--attempt-id') || '').trim()
  const result = String(arg('--result') || '').trim()
  const started = allMetricRows(projectRoot).find((row) => row.type === 'attempt_started' && row.attempt_id === attemptId && row.task_id === taskId)
  if (!started || !['succeeded', 'needs_revision', 'failed', 'cancelled'].includes(result)) {
    output({ ok: false, status: 'invalid', reason: '找不到 started 事件，或 result 非法' })
    process.exit(2)
  }
  const durationRaw = arg('--duration-ms')
  let durationMs = durationRaw === null || durationRaw === '' ? null : Number(durationRaw)
  if (durationMs !== null && (!Number.isSafeInteger(durationMs) || durationMs < 0)) {
    output({ ok: false, status: 'invalid', reason: 'duration-ms 必须是非负整数或留空' })
    process.exit(2)
  }
  const endedAt = new Date().toISOString()
  if (durationMs === null) {
    const startMs = Date.parse(started.started_at || started.ts)
    const endMs = Date.parse(endedAt)
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) durationMs = endMs - startMs
  }
  const event = {
    ts: endedAt, ended_at: endedAt, event_id: attemptId + '-eval', type: 'attempt_evaluated', attempt_id: attemptId,
    task_id: taskId, task_title: started.task_title || null, task_type: started.task_type || null,
    host_id: started.host_id || 'host-default', executor_id: started.executor_id || null, run_id: started.run_id || null,
    actual_model: started.actual_model || 'unknown', reasoning_effort: started.reasoning_effort || null,
    source: started.source || 'unknown', result, duration_ms: durationMs,
  }
  const written = appendLocalEvent(projectRoot, event)
  output({ ...written, status: written.ok ? 'evaluated' : 'conflict', attempt_id: attemptId, result, duration_ms: durationMs })
  process.exit(written.ok ? 0 : 2)
}

let syncInfo = null
if (has('--sync-local')) {
  syncInfo = syncLocalMetrics(projectRoot)
  if (!syncInfo.ok) {
    output(syncInfo)
    process.exit(2)
  }
}

const month = arg('--month') || east8Date().slice(0, 7).replace('-', '/')
if (!/^\d{4}\/\d{2}$/.test(month)) {
  output({ ok: false, status: 'missing', reason: '--month 必须为 YYYY/MM', project_root: projectRoot })
  process.exit(2)
}

const monthDir = path.join(projectRoot, 'docs', 'ai_memory', 'agent_metrics', ...month.split('/'))
const runsPath = path.join(monthDir, 'runs.jsonl')
const htmlPath = path.join(monthDir, 'index.html')
const oldHtml = readExisting(htmlPath)
let raw
try {
  raw = fs.readFileSync(runsPath, 'utf8')
} catch (error) {
  const status = validHtml(oldHtml) ? 'old' : 'missing'
  output({
    ok: true,
    status,
    html_absolute_path: htmlPath,
    runs_absolute_path: runsPath,
    generated_at: null,
    status_message: status === 'old' ? '统计 HTML（旧版，本次未刷新）：' + htmlPath : '统计 HTML：未生成（' + error.message + '）；目标路径：' + htmlPath,
    reason: error.message,
  })
  process.exit(0)
}

const runs = []
let badLines = 0
for (const line of raw.split('\n')) {
  if (line.trim() === '') continue
  try {
    const value = JSON.parse(line)
    if (value && typeof value.ts === 'string') runs.push(value)
  } catch { badLines += 1 }
}

const esc = (value) => String(value).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]))
const taskById = new Map()
try {
  const taskState = JSON.parse(fs.readFileSync(path.join(projectRoot, 'docs', 'ai_memory', 'state', 'tasks.json'), 'utf8'))
  for (const task of Array.isArray(taskState.tasks) ? taskState.tasks : []) if (task && task.id) taskById.set(task.id, task)
} catch {}
const east8 = (input) => {
  const d = new Date(new Date(input).getTime() + 8 * 60 * 60 * 1000)
  if (Number.isNaN(d.getTime())) return { day: 'unknown', hour: null, time_display: '未采集' }
  const iso = d.toISOString()
  return { day: iso.slice(0, 10), hour: d.getUTCHours(), time_display: iso.slice(0, 19).replace('T', ' ') }
}
const tierLabel = (value) => ({ low: '低', medium: '中', high: '高', max: '极高' }[String(value || '').toLowerCase()] || '未采集')
const resultLabel = (value) => ({ succeeded: '成功', needs_revision: '返修', failed: '失败', cancelled: '取消', unarchived: '执行中' }[value] || '未采集')
const durationLabel = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) return '未采集'
  const seconds = Math.round(value / 1000)
  if (seconds < 60) return seconds + '秒'
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) return minutes + '分' + String(rest).padStart(2, '0') + '秒'
  const hours = Math.floor(minutes / 60)
  return hours + '时' + String(minutes % 60).padStart(2, '0') + '分' + String(rest).padStart(2, '0') + '秒'
}
const elapsedMs = (start, end) => {
  const startMs = Date.parse(start)
  const endMs = Date.parse(end)
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs ? endMs - startMs : null
}
const enrichUnit = (unit) => {
  const task = taskById.get(unit.task) || null
  const modelKnown = typeof unit.model === 'string' && unit.model !== '' && unit.model !== 'unknown'
  const time = east8(unit.ts)
  return {
    ...unit,
    ...time,
    task_id: unit.task,
    task_name: unit.task_title || (task && task.title) || '未采集',
    model: modelKnown ? unit.model : '未采集',
    tier: tierLabel(unit.reasoning_effort),
    record_type: modelKnown && unit.source !== 'unknown' ? '实际' : '未采集',
    result_display: resultLabel(unit.result),
    duration_display: durationLabel(unit.duration_ms),
    trusted: unit.source === 'host_descriptor' || unit.source === 'host_reported',
  }
}
const completed = new Map()
const actual = []
const attempts = []
const startedAttempts = new Map()
const evaluatedAttempts = new Set()
const lifecycleTaskIds = new Set()
let clockOuts = 0
for (const r of runs) {
  if (r.type === 'clock_out') { clockOuts += 1; continue }
  if (['routing', 'route_decided'].includes(r.type)) continue
  if (r.type === 'attempt_started' && r.attempt_id) {
    if (!startedAttempts.has(r.attempt_id)) startedAttempts.set(r.attempt_id, r)
    if (r.task_id) lifecycleTaskIds.add(r.task_id)
    continue
  }
  if (r.type === 'task_complete' && r.task_id) {
    completed.set(r.task_id, { task: r.task_id, task_title: r.task_title || null, ts: r.ts, model: r.actual_model || 'unknown', reasoning_effort: r.reasoning_effort || null, source: r.source || 'unknown', role: r.role || 'executor', result: 'succeeded', token: null, duration_ms: Number.isSafeInteger(r.duration_ms) ? r.duration_ms : null })
  } else if (r.type === 'actual') {
    actual.push(r)
  } else if (r.type === 'attempt_evaluated') {
    if (r.attempt_id && evaluatedAttempts.has(r.attempt_id)) continue
    if (r.attempt_id) evaluatedAttempts.add(r.attempt_id)
    if (r.task_id) lifecycleTaskIds.add(r.task_id)
    const started = r.attempt_id ? startedAttempts.get(r.attempt_id) : null
    const endedAt = r.ended_at || r.ts
    const durationMs = Number.isSafeInteger(r.duration_ms) ? r.duration_ms : (started ? elapsedMs(started.started_at || started.ts, endedAt) : null)
    attempts.push({ task: r.task_id || 'n/a', task_title: r.task_title || (started && started.task_title) || null, ts: endedAt, model: r.actual_model || r.model || (started && started.actual_model) || 'unknown', reasoning_effort: r.reasoning_effort || r.actual_reasoning_effort || (started && started.reasoning_effort) || null, source: r.actual_source || r.source || (started && started.source) || 'unknown', role: r.role || (started && started.role) || 'executor', result: r.result || r.status || 'unknown', token: Number.isFinite(r.total_tokens) ? r.total_tokens : (Number.isFinite(r.tokens) ? r.tokens : null), duration_ms: durationMs })
  }
}
for (const [attemptId, r] of startedAttempts.entries()) {
  if (!evaluatedAttempts.has(attemptId)) attempts.push({ task: r.task_id || 'n/a', task_title: r.task_title || null, ts: r.started_at || r.ts, model: r.actual_model || 'unknown', reasoning_effort: r.reasoning_effort || null, source: r.source || 'unknown', role: r.role || 'executor', result: 'unarchived', token: null, duration_ms: null })
}
const recordedOnly = []
for (const r of actual) {
  if (r.task_id && lifecycleTaskIds.has(r.task_id)) continue
  if (r.task_id && completed.has(r.task_id)) {
    const unit = completed.get(r.task_id)
    if (r.source !== 'unknown' && r.actual_model && r.actual_model !== 'unknown') {
      unit.model = r.actual_model
      unit.source = r.source
    }
  } else {
    recordedOnly.push({ task: r.task_id || 'n/a', task_title: r.task_title || null, ts: r.ts, model: r.actual_model || 'unknown', reasoning_effort: r.reasoning_effort || null, source: r.source || 'unknown', role: r.role || 'executor', result: 'unarchived', token: null, duration_ms: null })
  }
}
const legacyCompleted = [...completed.values()].filter((unit) => !lifecycleTaskIds.has(unit.task))
const units = [...legacyCompleted, ...attempts, ...recordedOnly].map(enrichUnit)
const dates = [...new Set(units.map((u) => u.day).filter((d) => d !== 'unknown'))].sort()
const currentEast8Date = east8Date()
const defaultDate = month === currentEast8Date.slice(0, 7).replace('-', '/') ? currentEast8Date : (dates.length > 0 ? dates[dates.length - 1] : month.replace('/', '-') + '-01')
const days = Object.fromEntries([...new Set([...dates, defaultDate])].sort().map((day) => [day, units.filter((u) => u.day === day)]))
const data = {
  month,
  defaultDate,
  dates: Object.keys(days),
  bad_lines: badLines,
  monthSummary: { records: runs.length, work_units: units.length, tasks_completed: units.filter((u) => u.result === 'succeeded').length, clock_outs: clockOuts, factual_coverage: units.length ? units.filter((u) => u.record_type === '实际').length / units.length : null },
  days,
}
const safeJson = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
const options = data.dates.map((d) => '<option value="' + esc(d) + '"' + (d === defaultDate ? ' selected' : '') + '>' + esc(d) + '</option>').join('')
const hourTargets = Array.from({ length: 24 }, (_, h) => '<rect class="hour-hit" data-hour="' + h + '" x="' + (48 + h * 37) + '" y="18" width="37" height="218" fill="transparent"/>').join('')
const boards = ['综合推荐榜', '首次通过率榜', '低返修榜', '稳定性榜', 'Token 效率榜', '速度榜'].map((name, i) => '<section class="rank"><h3>' + name + '</h3><div id="rank' + i + '" class="muted">未记录</div></section>').join('')
const htmlRaw = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baton Metrics</title><style>' +
  'body{font-family:Segoe UI,sans-serif;background:#0c1422;color:#e8eef8;margin:0;padding:24px}.wrap{max-width:1200px;margin:auto}.filters{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:18px 0}.muted{color:#8ea4bf;font-size:12px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.card,.panel,.rank{background:#122035;border:1px solid #29405d;border-radius:12px;padding:14px}.panel{margin:14px 0}.value{font-size:24px}.chart-wrap,#details{position:relative;overflow-x:auto}svg{width:100%;min-width:930px;height:280px}.axis{stroke:#29405d}.trend{fill:none;stroke-width:2.5}#chartTooltip{position:absolute;display:none;pointer-events:none;white-space:pre;background:#08101d;border:1px solid #52749b;border-radius:8px;padding:8px;font-size:12px}.ranks{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.rank h3,h2{font-size:14px;color:#9fb5cf;margin:4px 0 10px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #29405d;text-align:left}select{background:#122035;color:#e8eef8;border:1px solid #52749b;padding:6px}@media(max-width:760px){.cards{grid-template-columns:repeat(2,1fr)}.ranks{grid-template-columns:1fr}}' +
  '</style></head><body data-default-date="' + esc(defaultDate) + '"><main class="wrap"><div class="muted">BATON / MONTHLY METRICS</div><h1>执行效果月报</h1><div class="muted">' + esc(month) + '</div><section class="filters"><label>日期 <select id="dateSelect">' + options + '</select></label><label><input id="includeMain" type="checkbox"> 包含主会话</label><label><input id="mergeReasoning" type="checkbox"> 合并同模型推理档位</label><label><input id="includeEstimated" type="checkbox"> 包含估算（参考排行）</label><span id="dataWarning" class="muted"></span></section><section class="cards">' +
  '<article class="card"><div class="muted">执行尝试</div><div id="attempts" class="value">0</div></article><article class="card"><div class="muted">成功</div><div id="success" class="value">未记录</div></article><article class="card"><div class="muted">返修</div><div id="revision" class="value">未记录</div></article><article class="card"><div class="muted">失败</div><div id="failure" class="value">未记录</div></article><article class="card"><div class="muted">Token</div><div id="tokens" class="value">未记录</div></article><article class="card"><div class="muted">真实覆盖率</div><div id="verifiedCoverage" class="value">未记录</div></article><article class="card"><div class="muted">估算覆盖率</div><div id="estimatedCoverage" class="value">未记录</div></article></section>' +
  '<section class="panel"><h2>0–23 小时模型使用趋势</h2><div class="chart-wrap"><svg id="hourlyChart" viewBox="0 0 960 270" role="img" aria-label="按小时模型使用次数折线图"><g id="axes"></g><g id="lines"></g>' + hourTargets + '</svg><div id="chartTooltip"></div></div><div id="legend" class="muted"></div></section><section class="panel"><h2>榜单</h2><div class="muted" id="rankingMode">可信榜单（仅已核实数据）</div><div class="ranks">' + boards + '</div></section><section class="panel"><h2>所选日期执行明细</h2><div id="details"></div></section><section class="panel"><h2>数据口径</h2><p class="muted">原始 JSONL 只保存事实或 null；页面可从任务 owner/type/生命周期生成带置信度和依据的估算区间。估算默认不进入可信榜单，开启“包含估算”后只用于参考排行，不参与自动路由。</p></section></main>' +
  '<script>window.__METRICS__=' + safeJson + ';</script><script>(function(){var D=window.__METRICS__,S=document.getElementById("dateSelect"),M=document.getElementById("includeMain"),G=document.getElementById("mergeReasoning"),E=document.getElementById("includeEstimated"),svg=document.getElementById("hourlyChart"),tip=document.getElementById("chartTooltip"),colors=["#55c2ff","#ffb454","#79d98c","#c099ff","#ff718b","#d9d46c"];function val(v){return v===null||v===undefined?"未记录":String(v)}function html(v){var d=document.createElement("div");d.textContent=String(v);return d.innerHTML}function rows(){return(D.days[S.value]||[]).filter(function(u){return M.checked||u.role!=="main"}).map(function(u){var x=Object.assign({},u);if(G.checked)x.model=x.model.replace(/ \/ (low|medium|high|max)$/," ");return x})}function groups(rs){var o={};rs.forEach(function(u){(o[u.model]||(o[u.model]=[])).push(u)});return o}function set(id,v){document.getElementById(id).textContent=val(v)}function render(){var rs=rows(),known=rs.filter(function(u){return["succeeded","needs_revision","failed","cancelled"].indexOf(u.result)!==-1});set("attempts",rs.length);set("success",known.length?known.filter(function(u){return u.result==="succeeded"}).length:null);set("revision",known.length?known.filter(function(u){return u.result==="needs_revision"}).length:null);set("failure",known.length?known.filter(function(u){return u.result==="failed"}).length:null);var tk=rs.filter(function(u){return u.token!==null});set("tokens",tk.length?tk.reduce(function(n,u){return n+u.token},0):null);set("verifiedCoverage",rs.length?Math.round(rs.filter(function(u){return u.data_level==="已核实"}).length/rs.length*100)+"%":null);set("estimatedCoverage",rs.length?Math.round(rs.filter(function(u){return u.estimated}).length/rs.length*100)+"%":null);var ax="",ln="",gs=groups(rs),max=1;Object.keys(gs).forEach(function(k){for(var h=0;h<24;h++)max=Math.max(max,gs[k].filter(function(u){return u.hour===h}).length)});for(var h=0;h<24;h++){var x=66+h*37;ax+="<line class=\\"axis\\" x1=\\""+x+"\\" y1=\\"20\\" x2=\\""+x+"\\" y2=\\"230\\"/><text x=\\""+x+"\\" y=\\"252\\" fill=\\"#8ea4bf\\" font-size=\\"10\\" text-anchor=\\"middle\\">"+h+"</text>"}Object.keys(gs).forEach(function(k,i){var pts=[];for(var h=0;h<24;h++){var n=gs[k].filter(function(u){return u.hour===h}).length;pts.push((66+h*37)+","+(230-n/max*190))}ln+="<polyline class=\\"trend\\" stroke=\\""+colors[i%colors.length]+"\\" points=\\""+pts.join(" ")+"\\"/>"});document.getElementById("axes").innerHTML=ax;document.getElementById("lines").innerHTML=ln;document.getElementById("legend").textContent=Object.keys(gs).join(" ｜ ")||"未记录";var rankingRows=rs.filter(function(u){return (u.trusted&&!u.estimated)||(E.checked&&u.estimated)}).map(function(u){var x=Object.assign({},u);if(E.checked&&x.token===null)x.token=x.estimated_token_midpoint;if(E.checked&&x.duration_ms===null)x.duration_ms=x.estimated_duration_midpoint_ms;return x}),stats=groups(rankingRows),arr=Object.keys(stats).map(function(k){var a=stats[k],q=a.filter(function(u){return["succeeded","needs_revision","failed"].indexOf(u.result)!==-1}),s=q.filter(function(u){return u.result==="succeeded"}),t=s.filter(function(u){return u.token!==null}),d=s.filter(function(u){return u.duration_ms!==null}).map(function(u){return u.duration_ms}).sort(function(a,b){return a-b});return{model:k,n:a.length,pass:q.length?s.length/q.length:null,rework:q.length?q.filter(function(u){return u.result==="needs_revision"}).length/q.length:null,fail:q.length?q.filter(function(u){return u.result==="failed"}).length/q.length:null,tok:t.length?t.reduce(function(n,u){return n+u.token},0)/t.length:null,speed:d.length?d[Math.floor(d.length/2)]:null}});function board(id,metric,asc){var a=arr.filter(function(x){return x[metric]!==null}).sort(function(x,y){return asc?x[metric]-y[metric]:y[metric]-x[metric]});document.getElementById(id).innerHTML=a.length?"<table><tr><th>配置</th><th>指标</th><th>使用次数</th></tr>"+a.map(function(x){return"<tr><td>"+html(x.model)+"</td><td>"+((metric==="pass"||metric==="rework"||metric==="fail")?Math.round(x[metric]*100)+"%":Math.round(x[metric]))+"</td><td>"+x.n+"</td></tr>"}).join("")+"</table>":"未记录（无可信且覆盖该指标的模型执行结果）"}board("rank0","pass",false);board("rank1","pass",false);board("rank2","rework",true);board("rank3","fail",true);board("rank4","tok",true);board("rank5","speed",true);document.getElementById("details").innerHTML=rs.length?"<table><tr><th>时间</th><th>任务</th><th>模型/档位</th><th>结果</th><th>Token</th><th>耗时</th><th>数据级别</th><th>依据</th></tr>"+rs.map(function(u){return"<tr><td>"+html(u.ts)+"</td><td>"+html(u.task)+"</td><td>"+html(u.model)+"</td><td>"+html(u.result)+"</td><td>"+html(u.token_display)+"</td><td>"+html(u.duration_display)+"</td><td>"+html(u.data_level+" / "+u.confidence)+"</td><td>"+html(u.basis)+"</td></tr>"}).join("")+"</table>":"<span class=\\"muted\\">当天无执行记录</span>";document.getElementById("dataWarning").textContent=D.bad_lines?"数据警告：跳过 "+D.bad_lines+" 行损坏 JSON":"";document.getElementById("rankingMode").textContent=E.checked?"参考排行（包含明确标注的估算）":"可信榜单（仅已核实数据）"}svg.addEventListener("mousemove",function(e){var t=e.target.closest(".hour-hit");if(!t)return;var h=Number(t.getAttribute("data-hour")),rs=rows().filter(function(u){return u.hour===h}),gs=groups(rs),out=[String(h).padStart(2,"0")+":00"];Object.keys(gs).forEach(function(k){var a=gs[k];out.push(k+"：使用 "+a.length+"，成功 "+a.filter(function(u){return u.result==="succeeded"}).length+"，返修 "+a.filter(function(u){return u.result==="needs_revision"}).length+"，失败 "+a.filter(function(u){return u.result==="failed"}).length+"，Token "+val(a.some(function(u){return u.token!==null})?a.reduce(function(n,u){return n+(u.token||0)},0):null)+"，耗时 "+val(a.some(function(u){return u.duration_ms!==null})?a.reduce(function(n,u){return n+(u.duration_ms||0)},0):null))});tip.textContent=out.join("\\n");tip.style.display="block";tip.style.left=(e.offsetX+12)+"px";tip.style.top=(e.offsetY+8)+"px"});svg.addEventListener("mouseleave",function(){tip.style.display="none"});S.addEventListener("change",render);M.addEventListener("change",render);G.addEventListener("change",render);E.addEventListener("change",render);render()})();</script></body></html>'

const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baton 模型执行统计</title><style>' +
  ':root{--ink:#152033;--muted:#6b778c;--line:#dce3ec;--soft:#f5f7fa;--blue:#2f5cff;--green:#087a55;--amber:#9a5a00;--red:#b4232c}*{box-sizing:border-box}body{margin:0;background:#edf1f6;color:var(--ink);font-family:"Microsoft YaHei UI","Segoe UI",sans-serif}.wrap{max-width:1280px;margin:auto;padding:28px 24px 48px}.eyebrow{color:var(--blue);font-size:11px;font-weight:800;letter-spacing:.14em}.top{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:6px 0 20px}.top h1{margin:0;font-size:28px}.month{color:var(--muted);font-size:13px}.filters{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.filters label{font-size:12px;color:var(--muted)}select{margin-left:6px;padding:8px 30px 8px 10px;background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:7px}.cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}.card,.panel{background:#fff;border:1px solid var(--line);border-radius:10px}.card{min-height:82px;padding:14px}.label{color:var(--muted);font-size:11px}.value{margin-top:7px;font-size:22px;font-weight:750}.panel{margin-top:14px;overflow:hidden}.panel-head{display:flex;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid var(--line)}h2{margin:0;font-size:14px}.muted{color:var(--muted);font-size:11px}.chart-wrap{position:relative;overflow-x:auto;padding:8px 12px 0}svg{display:block;width:100%;min-width:930px;height:270px}.axis{stroke:#e4e9f0}.trend{fill:none;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}#chartTooltip{position:absolute;display:none;pointer-events:none;white-space:pre;background:#152033;color:#fff;border-radius:7px;padding:8px 10px;font-size:11px;box-shadow:0 8px 24px rgba(21,32,51,.2)}#legend{padding:0 16px 13px}.table-wrap{overflow-x:auto}.metrics{width:100%;min-width:1040px;table-layout:fixed;border-collapse:collapse;font-size:12px}.metrics th{padding:10px 9px;color:#56647a;background:var(--soft);border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}.metrics td{padding:11px 9px;border-bottom:1px solid #e8edf3;vertical-align:middle;line-height:1.4}.metrics tbody tr:last-child td{border-bottom:0}.metrics col:nth-child(1){width:150px}.metrics col:nth-child(2){width:132px}.metrics col:nth-child(3){width:270px}.metrics col:nth-child(4){width:78px}.metrics col:nth-child(5){width:68px}.metrics col:nth-child(6){width:72px}.metrics col:nth-child(7){width:72px}.metrics col:nth-child(8){width:96px}.mono{font-family:Consolas,monospace;font-size:11px}.task-name{font-weight:650}.pill{display:inline-flex;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:750;white-space:nowrap}.actual,.success{color:var(--green);background:#dff7ec}.missing{color:#667085;background:#eef1f4}.revision{color:var(--amber);background:#fff0ce}.failed{color:var(--red);background:#ffe4e6}.note{padding:12px 16px;color:var(--muted);font-size:11px;border-top:1px solid var(--line)}@media(max-width:800px){.wrap{padding:20px 14px 36px}.top{align-items:flex-start;flex-direction:column}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.card:last-child{grid-column:1/-1}}' +
  '</style></head><body data-default-date="' + esc(defaultDate) + '"><main class="wrap"><div class="eyebrow">BATON / AGENT METRICS</div><div class="top"><div><h1>模型执行统计</h1><div class="month">' + esc(month) + ' · 所有时间均为东八区</div></div><section class="filters"><label>查看日期<select id="dateSelect">' + options + '</select></label><span id="dataWarning" class="muted"></span></section></div><section class="cards"><article class="card"><div class="label">执行任务</div><div id="attempts" class="value">0</div></article><article class="card"><div class="label">成功</div><div id="success" class="value">0</div></article><article class="card"><div class="label">返修</div><div id="revision" class="value">0</div></article><article class="card"><div class="label">失败</div><div id="failure" class="value">0</div></article><article class="card"><div class="label">准确耗时覆盖</div><div id="durationCoverage" class="value">0%</div></article></section><section class="panel"><div class="panel-head"><h2>0–23 小时模型使用趋势</h2><span class="muted">按任务完成时间统计</span></div><div class="chart-wrap"><svg id="hourlyChart" viewBox="0 0 960 270" role="img" aria-label="按小时模型使用次数折线图"><g id="axes"></g><g id="lines"></g>' + hourTargets + '</svg><div id="chartTooltip"></div></div><div id="legend" class="muted"></div></section><section class="panel"><div class="panel-head"><h2>所选日期执行明细</h2><span class="muted">分配即记录，结束即结算</span></div><div id="details" class="table-wrap"></div><div class="note">旧记录确实缺失的字段显示“未采集”；不再根据任务 owner、类型或生命周期反推模型、Token 与耗时。</div></section></main>' +
  '<script>window.__METRICS__=' + safeJson + ';</script><script>(function(){var D=window.__METRICS__,S=document.getElementById("dateSelect"),svg=document.getElementById("hourlyChart"),tip=document.getElementById("chartTooltip"),colors=["#2f5cff","#e78b00","#0b8f68","#a04dd8","#cf3c55","#5d6b82"];function html(v){var d=document.createElement("div");d.textContent=String(v===null||v===undefined?"未采集":v);return d.innerHTML}function rows(){return D.days[S.value]||[]}function groups(rs){var o={};rs.filter(function(u){return u.model!=="未采集"}).forEach(function(u){(o[u.model]||(o[u.model]=[])).push(u)});return o}function set(id,v){document.getElementById(id).textContent=String(v)}function badge(value,kind){return"<span class=\"pill "+kind+"\">"+html(value)+"</span>"}function render(){var rs=rows(),known=rs.filter(function(u){return["succeeded","needs_revision","failed","cancelled"].indexOf(u.result)!==-1});set("attempts",rs.length);set("success",known.filter(function(u){return u.result==="succeeded"}).length);set("revision",known.filter(function(u){return u.result==="needs_revision"}).length);set("failure",known.filter(function(u){return u.result==="failed"}).length);set("durationCoverage",rs.length?Math.round(rs.filter(function(u){return u.duration_ms!==null}).length/rs.length*100)+"%":"0%");var ax="",ln="",gs=groups(rs),max=1;Object.keys(gs).forEach(function(k){for(var h=0;h<24;h++)max=Math.max(max,gs[k].filter(function(u){return u.hour===h}).length)});for(var h=0;h<24;h++){var x=66+h*37;ax+="<line class=\"axis\" x1=\""+x+"\" y1=\"20\" x2=\""+x+"\" y2=\"230\"/><text x=\""+x+"\" y=\"252\" fill=\"#7b8799\" font-size=\"10\" text-anchor=\"middle\">"+h+"</text>"}Object.keys(gs).forEach(function(k,i){var pts=[];for(var h=0;h<24;h++){var n=gs[k].filter(function(u){return u.hour===h}).length;pts.push((66+h*37)+","+(230-n/max*190))}ln+="<polyline class=\"trend\" stroke=\""+colors[i%colors.length]+"\" points=\""+pts.join(" ")+"\"/>"});document.getElementById("axes").innerHTML=ax;document.getElementById("lines").innerHTML=ln;document.getElementById("legend").textContent=Object.keys(gs).join(" ｜ ")||"当天无已记录模型";document.getElementById("details").innerHTML=rs.length?"<table class=\"metrics\"><colgroup><col><col><col><col><col><col><col><col></colgroup><thead><tr><th>时间</th><th>任务ID</th><th>任务名称</th><th>模型</th><th>档位</th><th>类型</th><th>结果</th><th>耗时</th></tr></thead><tbody>"+rs.map(function(u){var resultKind=u.result==="succeeded"?"success":u.result==="needs_revision"?"revision":u.result==="failed"?"failed":"missing";return"<tr><td class=\"mono\">"+html(u.time_display)+"</td><td class=\"mono\">"+html(u.task_id)+"</td><td class=\"task-name\">"+html(u.task_name)+"</td><td>"+html(u.model)+"</td><td>"+html(u.tier)+"</td><td>"+badge(u.record_type,u.record_type==="实际"?"actual":"missing")+"</td><td>"+badge(u.result_display,resultKind)+"</td><td>"+html(u.duration_display)+"</td></tr>"}).join("")+"</tbody></table>":"<div class=\"note\">当天无执行记录</div>";document.getElementById("dataWarning").textContent=D.bad_lines?"跳过 "+D.bad_lines+" 行损坏数据":""}svg.addEventListener("mousemove",function(e){var t=e.target.closest(".hour-hit");if(!t)return;var h=Number(t.getAttribute("data-hour")),list=rows().filter(function(u){return u.hour===h}),gs=groups(list),out=[String(h).padStart(2,"0")+":00"];Object.keys(gs).forEach(function(k){out.push(k+"："+gs[k].length+" 次")});tip.textContent=out.join("\n");tip.style.display="block";tip.style.left=(e.offsetX+12)+"px";tip.style.top=(e.offsetY+8)+"px"});svg.addEventListener("mouseleave",function(){tip.style.display="none"});S.addEventListener("change",render);render()})();</script></body></html>'
const interactiveScript = String.raw`(function(){
  var D=window.__METRICS__,S=document.getElementById('dateSelect'),svg=document.getElementById('hourlyChart'),tip=document.getElementById('chartTooltip'),colors=['#2f5cff','#e78b00','#0b8f68','#a04dd8','#cf3c55','#5d6b82'];
  function html(v){var d=document.createElement('div');d.textContent=String(v==null?'未采集':v);return d.innerHTML}
  function rows(){return D.days[S.value]||[]}
  function groups(rs){var o={};rs.filter(function(u){return u.model!=='未采集'}).forEach(function(u){(o[u.model]||(o[u.model]=[])).push(u)});return o}
  function set(id,v){document.getElementById(id).textContent=String(v)}
  function badge(v,k){return '<span class="pill '+k+'">'+html(v)+'</span>'}
  function render(){
    var rs=rows(),known=rs.filter(function(u){return ['succeeded','needs_revision','failed','cancelled'].indexOf(u.result)!==-1});
    set('attempts',rs.length);set('success',known.filter(function(u){return u.result==='succeeded'}).length);set('revision',known.filter(function(u){return u.result==='needs_revision'}).length);set('failure',known.filter(function(u){return u.result==='failed'}).length);set('durationCoverage',rs.length?Math.round(rs.filter(function(u){return u.duration_ms!==null}).length/rs.length*100)+'%':'0%');
    var ax='',ln='',gs=groups(rs),max=1;Object.keys(gs).forEach(function(k){for(var h=0;h<24;h++)max=Math.max(max,gs[k].filter(function(u){return u.hour===h}).length)});
    for(var h=0;h<24;h++){var x=66+h*37;ax+='<line class="axis" x1="'+x+'" y1="20" x2="'+x+'" y2="230"/><text x="'+x+'" y="252" fill="#7b8799" font-size="10" text-anchor="middle">'+h+'</text>'}
    Object.keys(gs).forEach(function(k,i){var pts=[];for(var h=0;h<24;h++){var n=gs[k].filter(function(u){return u.hour===h}).length;pts.push((66+h*37)+','+(230-n/max*190))}ln+='<polyline class="trend" stroke="'+colors[i%colors.length]+'" points="'+pts.join(' ')+'"/>'});
    document.getElementById('axes').innerHTML=ax;document.getElementById('lines').innerHTML=ln;document.getElementById('legend').textContent=Object.keys(gs).join(' ｜ ')||'当天无已记录模型';
    document.getElementById('details').innerHTML=rs.length?'<table class="metrics"><colgroup><col><col><col><col><col><col><col><col></colgroup><thead><tr><th>时间</th><th>任务ID</th><th>任务名称</th><th>模型</th><th>档位</th><th>类型</th><th>结果</th><th>耗时</th></tr></thead><tbody>'+rs.map(function(u){var k=u.result==='succeeded'?'success':u.result==='needs_revision'?'revision':u.result==='failed'?'failed':'missing';return '<tr><td class="mono">'+html(u.time_display)+'</td><td class="mono">'+html(u.task_id)+'</td><td class="task-name">'+html(u.task_name)+'</td><td>'+html(u.model)+'</td><td>'+html(u.tier)+'</td><td>'+badge(u.record_type,u.record_type==='实际'?'actual':'missing')+'</td><td>'+badge(u.result_display,k)+'</td><td>'+html(u.duration_display)+'</td></tr>'}).join('')+'</tbody></table>':'<div class="note">当天无执行记录</div>';
    document.getElementById('dataWarning').textContent=D.bad_lines?'跳过 '+D.bad_lines+' 行损坏数据':'';
  }
  svg.addEventListener('mousemove',function(e){var t=e.target.closest('.hour-hit');if(!t)return;var h=Number(t.getAttribute('data-hour')),gs=groups(rows().filter(function(u){return u.hour===h})),out=[String(h).padStart(2,'0')+':00'];Object.keys(gs).forEach(function(k){out.push(k+'：'+gs[k].length+' 次')});tip.textContent=out.join('\n');tip.style.display='block';tip.style.left=(e.offsetX+12)+'px';tip.style.top=(e.offsetY+8)+'px'});svg.addEventListener('mouseleave',function(){tip.style.display='none'});S.addEventListener('change',render);render();
})();`
const finalHtml = html.replace(/<script>\(function\(\)\{[\s\S]*?<\/script><\/body><\/html>$/, '<script>' + interactiveScript + '</script></body></html>')
const tempPath = htmlPath + '.tmp-' + process.pid
try {
  fs.mkdirSync(monthDir, { recursive: true })
  fs.writeFileSync(tempPath, finalHtml, 'utf8')
  const verify = fs.readFileSync(tempPath, 'utf8')
  if (!validHtml(verify)) throw new Error('生成文件完整性校验失败')
  fs.renameSync(tempPath, htmlPath)
  output({
    ok: true,
    status: 'generated',
    html_absolute_path: htmlPath,
    runs_absolute_path: runsPath,
    generated_at: new Date().toISOString(),
    status_message: '统计 HTML：' + htmlPath,
    summary: data,
  })
} catch (error) {
  try { fs.unlinkSync(tempPath) } catch {}
  const status = validHtml(oldHtml) ? 'old' : 'missing'
  output({
    ok: true,
    status,
    html_absolute_path: htmlPath,
    runs_absolute_path: runsPath,
    generated_at: null,
    status_message: status === 'old' ? '统计 HTML（旧版，本次未刷新）：' + htmlPath : '统计 HTML：未生成（' + error.message + '）；目标路径：' + htmlPath,
    reason: error.message,
  })
}
