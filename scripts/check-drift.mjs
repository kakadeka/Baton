// check-drift.mjs —— Baton 漂移治理：
// 1) 四份 SKILL（canonical + .agents/.claude/.cursor 镜像）EOL 归一化后必须逐字节一致；
// 2) invariant canary：关键红线短语必须存在于 canonical SKILL（防核心规则被误删/漂移）；
// 3) 版本一致性：package.json version 与公开 tag 语义（tag 校验由发布脚本负责，这里查包内 version 合法性）；
// 4) 译文 source hash：每份 README 译文首行必须记录来源 README.md 的 sha256 与同步状态，
//    status=current 而 hash 不符 → FAIL（假装新鲜）；status=stale → 提示不 FAIL。
// 任何漂移 exit 1 并点名路径。公开仓库 CI 直接运行本脚本（纯 node，无依赖）。
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const norm = (s) => s.replace(/\r\n/g, '\n')
const read = (rel) => { try { return norm(readFileSync(join(ROOT, rel), 'utf8')) } catch (e) { return null } }

const fails = []
const canonical = read('skills/baton/SKILL.md')
if (canonical === null) {
  console.error('FAIL  canonical skills/baton/SKILL.md 缺失')
  process.exit(1)
}
// baton 主 skill + 专项 skill（lean-review/debt/doctor）逐一比对 canonical 与三端镜像；
// 公开库/干净 clone 无镜像（install 产物）属正常，仅提示不 FAIL。
for (const s of ['baton', 'baton-lean-review', 'baton-debt', 'baton-doctor']) {
  const canonicalS = read('skills/' + s + '/SKILL.md')
  if (canonicalS === null) {
    console.log('INFO  skills/' + s + '/SKILL.md 不存在，跳过')
    continue
  }
  for (const m of ['.agents/skills/' + s + '/SKILL.md', '.claude/skills/' + s + '/SKILL.md', '.cursor/skills/' + s + '/SKILL.md']) {
    const c = read(m)
    if (c === null) {
      console.log('INFO  ' + m + ' 不存在（公开面/CI 环境无镜像属正常；项目实例由 install 生成）')
      continue
    }
    if (c !== canonicalS) fails.push(m + ' 与 canonical skills/' + s + '/SKILL.md 漂移（内容不一致，请重跑 install -Scope Project 同步镜像）')
  }
}
if (!fails.some((f) => f.indexOf('漂移') !== -1)) console.log('PASS  skill 各 canonical 与三端镜像一致')

// invariant canary：核心红线不可从 SKILL 消失——机械防「改坏规则」回归。
// 注：只查公开面应有的通用红线；框架内部规则不在本清单。
const canaries = [
  ['单写入者', '单写入者锁'],
  ['历史只增不改', '历史只增不改'],
  ['凭据红线', '凭据红线'],
  ['远端 SHA', '远端 SHA 核验'],
  ['FROZEN', 'FROZEN 冻结约束'],
]
for (const [needle, label] of canaries) {
  if (canonical.indexOf(needle) === -1) fails.push('canonical SKILL 缺失 invariant canary「' + needle + '」（' + label + '）')
}
if (!fails.some((f) => f.indexOf('canary') !== -1)) console.log('PASS  invariant canary 全部在位')

// 版本合法性
const pkg = read('package.json')
if (pkg !== null) {
  try {
    const v = JSON.parse(pkg).version
    if (typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v)) console.log('PASS  package.json version 合法（' + v + '）')
    else fails.push('package.json version 非法或缺失')
  } catch (e) { fails.push('package.json JSON 解析失败') }
}

// 译文 source hash：readme/ 下每份 README 译文首行必须记录来源 README.md 的 sha256（EOL 归一化后前 12 位）
// 与同步状态；标记缺失 → FAIL；status=current 而 hash 与当前 README.md 不符 → FAIL（假装新鲜）；
// status=stale → 提示（STALE 声明即目标）。README.md 每次实质改动后，译文必须重译更新 hash 或明确标 stale。
const readmeText = read('README.md')
if (readmeText !== null) {
  const readmeHash = createHash('sha256').update(readmeText).digest('hex').slice(0, 12)
  let checked = 0
  let readmeDir = join(ROOT, 'readme')
  let names = []
  try { names = readdirSync(readmeDir) } catch (e) { console.log('INFO  readme/ 目录不存在（公开面最小发布场景）') }
  for (const name of names.filter((n) => /^README\.[a-z-]+\.md$/i.test(n)).sort()) {
    const t = read('readme/' + name)
    if (t === null) continue
    checked += 1
    const first = t.split('\n')[0]
    const m = /<!--\s*baton-src:\s*README\.md\s+sha256:([0-9a-f]+)\s+status:(current|stale)/.exec(first)
    if (m === null) fails.push('readme/' + name + ' 缺少译文 source hash 标记（首行需 <!-- baton-src: README.md sha256:' + readmeHash + ' status:current|stale -->）')
    else if (m[2] === 'current' && m[1] !== readmeHash) fails.push('readme/' + name + ' 标记 status=current 但 source hash 与 README.md 不符（重译后刷新 hash，或如实改标 status:stale）')
    else if (m[2] === 'stale') console.log('INFO  readme/' + name + ' 已标 stale（' + m[1] + ' ≠ 当前 ' + readmeHash + '）')
  }
  if (checked === 0) console.log('INFO  无 README 译文文件（公开面最小发布场景）')
  else if (!fails.some((f) => f.indexOf('译文') !== -1)) console.log('PASS  译文 source hash 标记全部有效（' + checked + ' 份）')
}

if (fails.length > 0) {
  console.error('FAIL  漂移检查未通过：')
  for (const f of fails) console.error('      - ' + f)
  process.exit(1)
}
console.log('PASS  漂移检查全部通过')