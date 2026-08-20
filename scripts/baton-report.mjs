#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

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

const projectRoot = path.resolve(arg('--project') || process.cwd())
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

const trustedSources = new Set(['host_descriptor', 'host_reported', 'dispatch_confirmed', 'host_default'])
const esc = (value) => String(value).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]))
const east8 = (input) => {
  const d = new Date(new Date(input).getTime() + 8 * 60 * 60 * 1000)
  if (Number.isNaN(d.getTime())) return { day: 'unknown', hour: null }
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() }
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
    completed.set(r.task_id, { task: r.task_id, ts: r.ts, model: r.actual_model || 'unknown', source: r.source || 'unknown', role: r.role || 'executor', result: 'succeeded', token: null, duration_ms: null })
  } else if (r.type === 'actual') {
    actual.push(r)
  } else if (r.type === 'attempt_evaluated') {
    if (r.attempt_id && evaluatedAttempts.has(r.attempt_id)) continue
    if (r.attempt_id) evaluatedAttempts.add(r.attempt_id)
    if (r.task_id) lifecycleTaskIds.add(r.task_id)
    attempts.push({ task: r.task_id || 'n/a', ts: r.ended_at || r.ts, model: r.actual_model || r.model || 'unknown', source: r.actual_source || r.source || 'unknown', role: r.role || 'executor', result: r.result || r.status || 'unknown', token: Number.isFinite(r.total_tokens) ? r.total_tokens : (Number.isFinite(r.tokens) ? r.tokens : null), duration_ms: Number.isFinite(r.duration_ms) ? r.duration_ms : null })
  }
}
for (const [attemptId, r] of startedAttempts.entries()) {
  if (!evaluatedAttempts.has(attemptId)) attempts.push({ task: r.task_id || 'n/a', ts: r.started_at || r.ts, model: r.actual_model || 'unknown', source: r.source || 'unknown', role: r.role || 'executor', result: 'unarchived', token: null, duration_ms: null })
}
const recordedOnly = []
for (const r of actual) {
  if (r.task_id && lifecycleTaskIds.has(r.task_id)) continue
  if (r.task_id && completed.has(r.task_id)) {
    const unit = completed.get(r.task_id)
    if (trustedSources.has(r.source) && r.actual_model && r.actual_model !== 'unknown') {
      unit.model = r.actual_model
      unit.source = r.source
    }
  } else {
    recordedOnly.push({ task: r.task_id || 'n/a', ts: r.ts, model: r.actual_model || 'unknown', source: r.source || 'unknown', role: r.role || 'executor', result: 'unarchived', token: null, duration_ms: null })
  }
}
const legacyCompleted = [...completed.values()].filter((unit) => !lifecycleTaskIds.has(unit.task))
const units = [...legacyCompleted, ...attempts, ...recordedOnly].map((unit) => {
  const time = east8(unit.ts)
  const trusted = trustedSources.has(unit.source) && unit.model !== 'unknown'
  return { ...unit, ...time, trusted, model: trusted ? unit.model : 'unknown / 声明（未证实）' }
})
const dates = [...new Set(units.map((u) => u.day).filter((d) => d !== 'unknown'))].sort()
const defaultDate = dates.length > 0 ? dates[dates.length - 1] : month.replace('/', '-') + '-01'
const days = Object.fromEntries([...new Set([...dates, defaultDate])].sort().map((day) => [day, units.filter((u) => u.day === day)]))
const known = units.filter((u) => ['succeeded', 'needs_revision', 'failed', 'cancelled'].includes(u.result))
const trustedGroups = new Map()
for (const unit of units.filter((u) => u.trusted)) {
  if (!trustedGroups.has(unit.model)) trustedGroups.set(unit.model, [])
  trustedGroups.get(unit.model).push(unit)
}
const modelStats = [...trustedGroups.entries()].map(([model, values]) => {
  const judged = values.filter((u) => ['succeeded', 'needs_revision', 'failed'].includes(u.result))
  const succeeded = judged.filter((u) => u.result === 'succeeded')
  const tokens = succeeded.filter((u) => u.token !== null)
  const durations = succeeded.filter((u) => u.duration_ms !== null).map((u) => u.duration_ms).sort((a, b) => a - b)
  return {
    model, count: values.length,
    pass: judged.length ? succeeded.length / judged.length : null,
    rework: judged.length ? judged.filter((u) => u.result === 'needs_revision').length / judged.length : null,
    fail: judged.length ? judged.filter((u) => u.result === 'failed').length / judged.length : null,
    token: tokens.length ? tokens.reduce((n, u) => n + u.token, 0) / tokens.length : null,
    speed: durations.length ? durations[Math.floor(durations.length / 2)] : null,
  }
})
const data = {
  month,
  defaultDate,
  dates: Object.keys(days),
  bad_lines: badLines,
  monthSummary: { records: runs.length, work_units: units.length, tasks_completed: units.filter((u) => u.result === 'succeeded').length, clock_outs: clockOuts },
  days,
}
const safeJson = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
const value = (v, percent = false) => v === null ? '未记录' : (percent ? Math.round(v * 100) + '%' : Math.round(v))
const rank = (title, key, ascending) => {
  const rows = modelStats.filter((s) => s[key] !== null).sort((a, b) => ascending ? a[key] - b[key] : b[key] - a[key])
  return '<section class="rank"><h3>' + title + '</h3>' + (rows.length ? '<table><tr><th>配置</th><th>指标</th><th>次数</th></tr>' + rows.map((r) => '<tr><td>' + esc(r.model) + '</td><td>' + value(r[key], ['pass', 'rework', 'fail'].includes(key)) + '</td><td>' + r.count + '</td></tr>').join('') + '</table>' : '<p class="muted">未记录</p>') + '</section>'
}
const options = data.dates.map((d) => '<option value="' + esc(d) + '"' + (d === defaultDate ? ' selected' : '') + '>' + esc(d) + '</option>').join('')
const hours = Array.from({ length: 24 }, (_, h) => '<button class="hour" data-hour="' + h + '" title="' + h + ':00">' + h + '</button>').join('')
const details = units.length ? '<table><tr><th>时间</th><th>任务</th><th>模型</th><th>结果</th><th>Token</th><th>耗时(ms)</th></tr>' + units.map((u) => '<tr data-day="' + esc(u.day) + '"><td>' + esc(u.ts) + '</td><td>' + esc(u.task) + '</td><td>' + esc(u.model) + '</td><td>' + esc(u.result) + '</td><td>' + (u.token === null ? '未记录' : u.token) + '</td><td>' + (u.duration_ms === null ? '未记录' : u.duration_ms) + '</td></tr>').join('') + '</table>' : '<p class="muted">未记录</p>'
const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baton Metrics</title><style>' +
  'body{font-family:Segoe UI,sans-serif;background:#0c1422;color:#e8eef8;margin:0;padding:24px}.wrap{max-width:1100px;margin:auto}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.card,.panel,.rank{background:#122035;border:1px solid #29405d;border-radius:12px;padding:14px;margin:12px 0}.muted{color:#8ea4bf}.hours{display:grid;grid-template-columns:repeat(12,1fr);gap:5px}.hour{background:#19304c;color:#dce8f6;border:1px solid #355677;padding:7px}.ranks{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #29405d;text-align:left}@media(max-width:700px){.cards,.ranks{grid-template-columns:1fr}.hours{grid-template-columns:repeat(6,1fr)}}' +
  '</style></head><body data-default-date="' + esc(defaultDate) + '"><main class="wrap"><div class="muted">BATON / MONTHLY METRICS</div><h1>执行效果月报</h1><p>' + esc(month) + ' ｜ 日期 <select id="dateSelect">' + options + '</select></p><p class="muted">顶部卡片与榜单采用整月口径；日期选择仅筛选小时趋势与执行明细。</p><section class="cards">' +
  '<article class="card"><div class="muted">执行尝试</div><strong>' + units.length + '</strong></article><article class="card"><div class="muted">成功</div><strong>' + units.filter((u) => u.result === 'succeeded').length + '</strong></article><article class="card"><div class="muted">返修</div><strong>' + (known.length ? units.filter((u) => u.result === 'needs_revision').length : '未记录') + '</strong></article><article class="card"><div class="muted">失败</div><strong>' + (known.length ? units.filter((u) => u.result === 'failed').length : '未记录') + '</strong></article><article class="card"><div class="muted">Token</div><strong>' + (units.some((u) => u.token !== null) ? units.reduce((n, u) => n + (u.token || 0), 0) : '未记录') + '</strong></article></section>' +
  '<section class="panel"><h2>0–23 小时模型使用趋势</h2><div id="hourlyChart" class="hours">' + hours + '</div><div id="chartTooltip" class="muted">悬停小时查看时段</div></section><section class="panel"><h2>榜单</h2><div class="ranks">' + rank('综合推荐榜', 'pass', false) + rank('首次通过率榜', 'pass', false) + rank('低返修榜', 'rework', true) + rank('稳定性榜', 'fail', true) + rank('Token 效率榜', 'token', true) + rank('速度榜', 'speed', true) + '</div></section>' +
  '<section class="panel"><h2>所选日期执行明细</h2><div id="details">' + details + '</div></section><section class="panel"><h2>数据口径</h2><p class="muted">clock_out 不计为业务工作单元；requested/unknown 不进入模型排行；缺失 Token、耗时和可信模型身份时显示未记录，不推测补值。</p></section></main><script>window.__METRICS__=' + safeJson + ';(function(){var s=document.getElementById("dateSelect");function render(){document.querySelectorAll("#details tr[data-day]").forEach(function(r){r.style.display=r.getAttribute("data-day")===s.value?"":"none"});document.querySelectorAll(".hour").forEach(function(b){var h=Number(b.getAttribute("data-hour")),n=(window.__METRICS__.days[s.value]||[]).filter(function(u){return u.hour===h}).length;b.textContent=h+" · "+n;b.title=h+":00 使用 "+n+" 次"})}s.addEventListener("change",render);render()})();</script></body></html>'

const tempPath = htmlPath + '.tmp-' + process.pid
try {
  fs.mkdirSync(monthDir, { recursive: true })
  fs.writeFileSync(tempPath, html, 'utf8')
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
