# baton-migrate.ps1 —— 一次性迁移：旧 skill 项目 → Baton 新结构
# ------------------------------------------------------------------
# 流程（四步，全部幂等可重跑，绝不删除任何内容，全部可回滚）：
#   ① 扫描旧 skill 目录 + 旧命名文档，生成对照报告
#   ② 创建新文档（如 overview.md），把旧文档内容搬入（复制而非移动）
#   ③ 批量替换入口文件（AGENTS.md/CLAUDE.md/.cursorrules）中的旧引用 → 新路径
#   ④ 把旧 skill 目录 + 已迁移的旧文档 移出原位 → 项目根目录 .baton-legacy/ 备份
#
# 用法:
#   pwsh -File baton-migrate.ps1 -ProjectRoot C:\你的项目路径 [-DryRun] [-BackupDir .baton-legacy]
#
# 说明:
#   - 默认只做 ①②③（安全侧）；④（备份下线）需加 -Archive 参数或分步确认
#   - 备份目录默认项目根 .baton-legacy/（随 Git 提交，可随时回滚）
# ------------------------------------------------------------------
param(
  [string]$ProjectRoot = (Get-Location).Path,
  [string]$BackupDir = '.baton-legacy',
  [switch]$Archive,      # 执行第 ④ 步：把旧 skill 与已迁移旧文档移入备份目录
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
function Step($m) { Write-Host "==> $m" }
function Ok($m) { Write-Host "    ok: $m" }

function Ensure-LongDocStructure([string]$path, [string]$relativePath) {
  if (-not (Test-Path $path)) { return }
  $content = Get-Content $path -Raw -Encoding UTF8
  $missingArchive = $content -notmatch '【归档分卷索引】'
  $missingRevision = $content -notmatch '【修订记录】'
  if (-not $missingArchive -and -not $missingRevision) { return }
  if ($DryRun) {
    Step "  (DryRun) 将补齐 $relativePath 的强制结构"
    return
  }
  $lines = [regex]::Split($content, "`r?`n")
  $title = if ($lines.Count -gt 0 -and $lines[0] -match '^#\s') { $lines[0] } else { '# 迁移文档' }
  $bodyStart = if ($lines.Count -gt 0 -and $lines[0] -match '^#\s') { 1 } else { 0 }
  $body = if ($lines.Count -gt $bodyStart) { ($lines[$bodyStart..($lines.Count - 1)] -join "`n").TrimStart() } else { '' }
  $insert = @()
  if ($missingArchive) { $insert += "## 【归档分卷索引】`n`n- 当前文件未达到分卷阈值；当前无归档分卷。" }
  if ($missingRevision) { $insert += "## 【修订记录】`n`n| 日期 | 修改人 | 变更概要 |`n| --- | --- | --- |`n| $(Get-Date -Format 'yyyy-MM-dd') | Codex | Baton 迁移补齐长期文档强制结构。 |" }
  $newContent = $title + "`n`n" + ($insert -join "`n`n") + $(if ($body -ne '') { "`n`n" + $body } else { '' }) + "`n"
  [System.IO.File]::WriteAllText($path, $newContent, (New-Object System.Text.UTF8Encoding $false))
  Ok "$relativePath 已补齐归档分卷索引/修订记录，原正文保留"
}

if (-not (Test-Path $ProjectRoot)) { throw "项目目录不存在：$ProjectRoot" }
$backup = Join-Path $ProjectRoot $BackupDir

# ---------- ① 对照表：旧文档 → 新文档（内容搬入目标） ----------
$docMap = @(
  @{ Old = 'docs\ai_memory\00_项目总览架构.md'; New = 'docs\ai_memory\overview.md';        Note = '项目总览 → 权威项目卷' },
  @{ Old = 'docs\ai_memory\INDEX.md';           New = 'docs\ai_memory\index.md';           Note = '索引 → 规范索引' },
  @{ Old = 'docs\ai_memory\COMMANDS.md';        New = 'docs\ai_memory\commands.md';        Note = '口令 → 规范口令（内容合并，模板新增部分保留）' },
  @{ Old = 'docs\ai_memory\handoff_latest.md';  New = 'docs\ai_memory\handoff_current.md';  Note = '交接：需人工确认合并（新旧两套交接以 handoff_current 为准）' },
  @{ Old = 'docs\ai_memory\01_encoding_constraint.md'; New = 'docs\ai_memory\constraints.md'; Note = '编码约束 → 红线文档' }
)
# 入口文件中的旧引用替换对（含 skill 路径、文档路径、裸文件名三种形式）
# 注意：ebowork 主 skill 引用 → baton；ebowork-* 子 skill 引用 → 删除（改为指向 baton 主入口）
$refReplace = @(
  @{ From = '.agents/skills/ebowork/SKILL.md';      To = '.agents/skills/baton/SKILL.md' },
  @{ From = '.claude/skills/ebowork/SKILL.md';      To = '.claude/skills/baton/SKILL.md' },
  @{ From = '.cursor/skills/workday_knowledge_manager/SKILL.md'; To = '.cursor/skills/baton/SKILL.md' },
  @{ From = '.cursor/skills/workday_knowledge_manager'; To = '.cursor/skills/baton' },
  @{ From = '.cursor/skills/ebowork/SKILL.md';          To = '.cursor/skills/baton/SKILL.md' },
  @{ From = '.cursor/skills/ebowork';                   To = '.cursor/skills/baton' },
  @{ From = 'docs/ai_memory/00_项目总览架构.md';     To = 'docs/ai_memory/overview.md' },
  @{ From = '00_项目总览架构.md';                    To = 'overview.md' },
  @{ From = 'docs/ai_memory/INDEX.md';              To = 'docs/ai_memory/index.md' },
  @{ From = 'docs/ai_memory/INDEX';                 To = 'docs/ai_memory/index' },
  @{ From = 'docs/ai_memory/COMMANDS.md';           To = 'docs/ai_memory/commands.md' },
  @{ From = 'docs/ai_memory/handoff_latest.md';     To = 'docs/ai_memory/handoff_current.md' },
  @{ From = 'docs/ai_memory/01_encoding_constraint.md'; To = 'docs/ai_memory/constraints.md' }
)
# 裸文件名（不带路径）也替换——注意顺序：先全路径后裸名，避免 INDEX.md 在路径内被二次替换
$refReplace += @(
  @{ From = 'INDEX.md';      To = 'index.md' },
  @{ From = 'COMMANDS.md';   To = 'commands.md' },
  @{ From = 'handoff_latest.md'; To = 'handoff_current.md' },
  @{ From = '01_encoding_constraint.md'; To = 'constraints.md' }
)
# ebowork-* 子 skill 引用：整段指向 baton 主入口（原 ebowork 系列已下线，不映射为 baton-xxx）
$refReplace += @(
  @{ From = '.agents/skills/ebowork-core/scripts/ebowork-state.mjs'; To = '.agents/skills/baton/SKILL.md' },
  @{ From = '.agents/skills/ebowork-core/SKILL.md';  To = '.agents/skills/baton/SKILL.md' },
  @{ From = '.agents/skills/ebowork-guard/SKILL.md'; To = '.agents/skills/baton/SKILL.md' },
  @{ From = '.agents/skills/ebowork-init/SKILL.md';  To = '.agents/skills/baton/SKILL.md' },
  @{ From = '.agents/skills/ebowork-memory/SKILL.md'; To = '.agents/skills/baton/SKILL.md' },
  @{ From = '.agents/skills/ebowork-metrics/SKILL.md'; To = '.agents/skills/baton/SKILL.md' },
  @{ From = '.agents/skills/ebowork-model-policy/SKILL.md'; To = '.agents/skills/baton/SKILL.md' },
  @{ From = '.agents/skills/ebowork-protocol/SKILL.md'; To = '.agents/skills/baton/SKILL.md' },
  @{ From = '.agents/skills/ebowork-publish/SKILL.md'; To = '.agents/skills/baton/SKILL.md' },
  @{ From = '.agents/skills/ebowork-guard/references/execution-policy.md'; To = 'baton 审查规则（SKILL「审查规则」章节）' },
  @{ From = '.agents/skills/ebowork-core';            To = '.agents/skills/baton' },
  @{ From = '.agents/skills/ebowork';                 To = '.agents/skills/baton' },
  @{ From = '.claude/skills/ebowork';                 To = '.claude/skills/baton' },
  @{ From = 'ebowork-core/SKILL.md';                  To = 'baton/SKILL.md' },
  @{ From = 'ebowork-state.mjs status';               To = 'baton 状态查询' },
  @{ From = 'ebowork-state.mjs';                      To = 'baton 状态' }
)

# 名称替换：把旧版 skill 的口语名称/块标记/命令引用统一改为 Baton（应用范围：入口文件 + 迁移的新文档 + 现行同名文档）。
# 注意：只替换"现行规则"里的名称；历史记录（交接条目 ID、版本史、修订记录）与机器状态（分支名、projection 标记）不在替换范围。
$nameReplace = @(
  @{ From = '<!-- EBOWORK:START -->'; To = '<!-- BATON:START -->' },
  @{ From = '<!-- EBOWORK:END -->';   To = '<!-- BATON:END -->' },
  @{ From = '<!-- EBOWORK:CANONICAL-PROJECTION:BEGIN -->'; To = '<!-- BATON:CANONICAL-PROJECTION:BEGIN -->' },
  @{ From = '<!-- EBOWORK:CANONICAL-PROJECTION:END -->';   To = '<!-- BATON:CANONICAL-PROJECTION:END -->' },
  @{ From = '## EboWork 入口';        To = '## Baton 入口' },
  @{ From = 'EboWork_Publish';        To = 'Baton 发布' },
  @{ From = 'EboWork Memory';         To = 'Baton Memory' },
  @{ From = 'EboWork Protocol';       To = 'Baton Protocol' },
  @{ From = 'EboWork_Guard';          To = 'Baton Guard' },
  @{ From = 'EboWork 子 Skill';       To = 'Baton 子 Skill' },
  @{ From = 'EboWork 子技能';         To = 'Baton 子技能' },
  @{ From = 'EboWork 主入口';         To = 'Baton 主入口' },
  @{ From = 'EboWork 入口';           To = 'Baton 入口' },
  @{ From = 'EboWork 模块';           To = 'Baton 模块' },
  @{ From = 'EboWork skill';          To = 'Baton skill' },
  @{ From = '继续EboWork';            To = '继续工作' },
  @{ From = 'EboWork';                To = 'Baton' },
  @{ From = 'workday_knowledge_manager'; To = 'baton' },
  @{ From = 'workday-knowledge-manager'; To = 'baton' },
  @{ From = 'Workday Knowledge Manager'; To = 'Baton' },
  @{ From = 'workday_knowledge';      To = 'baton' }
)
# 文件名引用保护：历史文件名（EboWork_Migration_Report.md、ebowork-state.mjs、workday_knowledge_manager-workspace 等）
# 在名称替换中保持原文，防止引用被改写成指向不存在文件的悬空路径。旧名后紧跟 . - / \ 等文件名/路径特征才保护，
# 模块名（EboWork Memory / EboWork_Publish 等）不受影响照常替换。
function Replace-NamesProtected([string]$text, $pairs) {
  $tokens = New-Object System.Collections.Generic.List[string]
  $text = [regex]::Replace($text, '(?i)(?:workday|ebowork)[A-Za-z0-9_]*[\.\-/\\][A-Za-z0-9_\-\./\\]*', [System.Text.RegularExpressions.MatchEvaluator]{
    param($m)
    $tokens.Add($m.Value)
    return ('§§PROTECT' + ($tokens.Count - 1) + '§§')
  })
  foreach ($r in $pairs) { $text = $text.Replace($r.From, $r.To) }
  for ($i = 0; $i -lt $tokens.Count; $i++) { $text = $text.Replace('§§PROTECT' + $i + '§§', $tokens[$i]) }
  return $text
}

Step "① 扫描旧资产"
# 磁盘实际名已不是旧名（如磁盘是 index.md 而查询 INDEX.md）→ 大小写改名已完成，幂等重跑不再报/不再迁移
function Test-DiskNameRenamed($path, $oldName) {
  $dir = Split-Path $path -Parent
  $hits = [System.IO.Directory]::GetFiles($dir, $oldName)
  if ($hits.Count -eq 0) { return $false }
  return ([System.IO.Path]::GetFileName($hits[0]) -cne $oldName)
}
$oldSkills = @()
foreach ($tool in @('.agents', '.claude', '.cursor')) {
  $skillsDir = Join-Path $ProjectRoot ($tool + '\skills')
  if (Test-Path $skillsDir) {
    Get-ChildItem $skillsDir -Directory | Where-Object { $_.Name -match 'workday|ebowork' } | ForEach-Object {
      $oldSkills += $_.FullName
      Write-Host "    旧 skill: $($tool)/skills/$($_.Name) ($( (Get-ChildItem $_.FullName -Recurse -File).Count ) 个文件)"
    }
  }
}
$oldDocs = @()
foreach ($m in $docMap) {
  $oldScan = Join-Path $ProjectRoot $m.Old
  if (-not (Test-Path $oldScan)) { continue }
  # Windows 大小写等价幂等：磁盘实际名已是规范名（如 index.md 而非 INDEX.md）→ 改名已完成，不再报旧文档
  if (Test-DiskNameRenamed $oldScan ([System.IO.Path]::GetFileName($m.Old))) { continue }
  $oldDocs += $m.Old
  Write-Host "    旧文档: $($m.Old) → $($m.New)  [$($m.Note)]"
}
$entryFiles = @('AGENTS.md', 'CLAUDE.md', '.cursorrules') | Where-Object { Test-Path (Join-Path $ProjectRoot $_) }
Write-Host "    入口文件: $($entryFiles -join ', ')"
$ebwExists = Test-Path (Join-Path $ProjectRoot '.ebowork')
# 入口旧引用检测：只有入口残留旧引用（无旧目录/旧文档）的项目也必须继续走替换，不能提前退出
$entryRefPattern = 'workday-knowledge-manager|workday_knowledge|继续EboWork|EboWork init|\.agents/skills/ebowork|\.claude/skills/ebowork|\.cursor/skills/ebowork|\.cursor/skills/workday|handoff_latest|00_项目总览架构|INDEX\.md|COMMANDS\.md'
$entryOldRefs = @()
foreach ($ef in $entryFiles) {
  $efc = Get-Content (Join-Path $ProjectRoot $ef) -Raw -Encoding UTF8
  if ($efc -match $entryRefPattern) { $entryOldRefs += $ef }
}
if ($entryOldRefs.Count -gt 0) { Write-Host "    入口旧引用: $($entryOldRefs -join ', ')" }
$preflightLongDocs = @(
  'docs\ai_memory\index.md','docs\ai_memory\current.md','docs\ai_memory\commands.md','docs\ai_memory\handoff_current.md',
  'docs\ai_memory\overview.md','docs\ai_memory\constraints.md','docs\ai_memory\validation_matrix.md',
  'docs\ai_memory\tasks\task_schema.md','docs\ai_memory\tasks\task_todo.md','docs\ai_memory\tasks\task_progress.md','docs\ai_memory\tasks\task_finished.md',
  'docs\ai_memory\knowledge\tech_decision.md','docs\ai_memory\knowledge\pit_experience.md',
  'docs\ai_memory\ui_spec\global.md','docs\ai_memory\ui_spec\component.md','docs\ai_memory\ui_spec\page.md','docs\ai_memory\ui_spec\workflow.md'
)
$structureRepairNeeded = $false
foreach ($rel in $preflightLongDocs) {
  $p = Join-Path $ProjectRoot $rel
  if (-not (Test-Path $p)) { continue }
  $c = Get-Content $p -Raw -Encoding UTF8
  if ($c -notmatch '【归档分卷索引】' -or $c -notmatch '【修订记录】') { $structureRepairNeeded = $true; break }
}
if ($oldSkills.Count -eq 0 -and $oldDocs.Count -eq 0 -and -not $ebwExists -and $entryOldRefs.Count -eq 0 -and -not $structureRepairNeeded) { Write-Host "    未发现旧资产或结构缺口，无需迁移。"; exit 0 }

# ---------- ② 建新文档，搬内容 ----------
Step "② 创建新文档并搬入旧内容（复制，不移动）"
$migrated = @()
foreach ($m in $docMap) {
  $oldPath = Join-Path $ProjectRoot $m.Old
  $newPath = Join-Path $ProjectRoot $m.New
  if (-not (Test-Path $oldPath)) { continue }
  # 大小写改名已完成（磁盘实际名已是规范名）→ 幂等重跑直接跳过
  if (Test-DiskNameRenamed $oldPath ([System.IO.Path]::GetFileName($m.Old))) { continue }
  # 交接不自动合并：旧交接内容直接追加到 handoff 末尾会让旧记录重新成为「最新事实」，
  # 淹没新交接；改为只提示人工确认合并，旧文件由第④步 -Archive 备份下线。
  if ($m.New -eq 'docs\ai_memory\handoff_current.md') {
    Write-Host "    ⚠ 旧交接 $($m.Old) 不自动合并：请人工核对旧交接末条后，把仍有价值的条目手动并入 handoff_current.md（第④步 -Archive 会把旧文件备份下线）"
    continue
  }
  if ($DryRun) { Step "  将创建 $($m.New) 并复制 $($m.Old) 内容"; continue }
  New-Item -ItemType Directory -Force (Split-Path $newPath -Parent) | Out-Null
  $oldContent = Get-Content $oldPath -Raw -Encoding UTF8
  # 迁移文档内容里的旧文档交叉引用 → 新路径（如 00_项目总览架构.md → overview.md）+ 旧名称 → Baton
  foreach ($r in $refReplace) { $oldContent = $oldContent.Replace($r.From, $r.To) }
  $oldContent = Replace-NamesProtected $oldContent $nameReplace
  # Windows 大小写不敏感陷阱：INDEX.md → index.md 是同一个文件。
  # 处理：若新旧路径按平台语义相同（同一文件），用「写临时→校验→改名替换」；否则走「复制→保留旧（第④步再备份）」。
  # Linux/macOS 大小写敏感，INDEX.md 与 index.md 是不同文件，不得误判为同一文件。
  $isWindowsPlatform = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
  $sameFile = if ($isWindowsPlatform) {
    [System.IO.Path]::GetFullPath($oldPath).ToLowerInvariant() -eq [System.IO.Path]::GetFullPath($newPath).ToLowerInvariant()
  } else {
    [System.IO.Path]::GetFullPath($oldPath) -eq [System.IO.Path]::GetFullPath($newPath)
  }
  if ($sameFile) {
    # 大小写重命名场景：内容已读入 oldContent（含迁移头与引用替换）——
    # 新内容先写 sibling temp 并读回校验，通过后才改名替换（Move-Item 覆盖 = 原子替换）；
    # 任何写盘/校验失败时唯一旧文件仍在（可恢复），不存在「删旧未写新」的丢失窗口。
    if ($oldContent -notmatch [regex]::Escape('由旧文档迁移')) {
      $oldContent = "# 迁移自 $($m.Old)`n`n> 本文件由旧文档迁移而来（$($m.Note)），保留全部历史内容。`n`n" + $oldContent
    }
    $tmpPath = $newPath + '.baton-rename-tmp'
    Remove-Item $tmpPath -Force -ErrorAction SilentlyContinue
    [System.IO.File]::WriteAllText($tmpPath, $oldContent, (New-Object System.Text.UTF8Encoding $false))
    $verifyTmp = Get-Content $tmpPath -Raw -Encoding UTF8
    if ($verifyTmp -ne $oldContent) { Write-Error "大小写迁移临时文件写入校验失败（旧文件未动，可恢复）：$($m.Old)"; exit 1 }
    Move-Item $tmpPath $newPath -Force
    # 后验：新路径内容必须等于迁移后的 oldContent（防静默丢失）
    $verifyContent = Get-Content $newPath -Raw -Encoding UTF8
    if ($verifyContent -ne $oldContent) { Write-Error "大小写迁移后验失败：$($m.New) 内容与迁移结果不一致，已中止"; exit 1 }
    $migrated += $m.New
    Ok "$($m.Old) → $($m.New)（大小写重命名：临时写盘校验 + 原子改名 + 后验）"
    # 大小写重命名后旧路径不存在了，从 oldDocs 移除避免第④步重复删除
    $oldDocs = @($oldDocs | Where-Object { $_ -ne $m.Old })
    continue
  }
  if (Test-Path $newPath) {
    # 新文档已存在（可能是 init 生成的空模板）→ 追加旧内容并标注来源，不覆盖
    $newContent = Get-Content $newPath -Raw -Encoding UTF8
    if ($newContent.Trim() -eq '') {
      # 空目标（init 空模板）：直接写入迁移头 + 旧内容，绝不产出空文件丢失迁移结果
      $newContent = "# 迁移自 $($m.Old)`n`n> 本文件由旧文档迁移而来（$($m.Note)），保留全部历史内容。`n`n" + $oldContent
    } elseif ($newContent -notmatch [regex]::Escape('由旧文档迁移')) {
      $newContent = $newContent.TrimEnd() + "`n`n> 以下内容由旧文档 $($m.Old) 迁移而来（$($m.Note)）`n`n" + $oldContent
    }
  } else {
    $newContent = "# 迁移自 $($m.Old)`n`n> 本文件由旧文档迁移而来（$($m.Note)），保留全部历史内容。`n`n" + $oldContent
  }
  [System.IO.File]::WriteAllText($newPath, $newContent, (New-Object System.Text.UTF8Encoding $false))
  $migrated += $m.New
  Ok "$($m.Old) → $($m.New)"
}

# ---------- ③ 批量替换入口文件中的旧引用与旧名称 ----------
Step "③ 替换入口文件中的旧引用与旧名称 → 新路径 / Baton"
$replaced = @()
foreach ($ef in $entryFiles) {
  $efPath = Join-Path $ProjectRoot $ef
  $content = Get-Content $efPath -Raw -Encoding UTF8
  $before = $content
  foreach ($r in $refReplace) {
    $content = $content.Replace($r.From, $r.To)
  }
  $content = Replace-NamesProtected $content $nameReplace
  if ($content -ne $before) {
    if (-not $DryRun) {
      [System.IO.File]::WriteAllText($efPath, $content, (New-Object System.Text.UTF8Encoding $false))
      Ok "$ef 引用与名称已替换"
    }
    $replaced += $ef
  }
}
if ($DryRun) { Step "  (DryRun) 将替换入口引用：$($replaced -join ', ')" }

# ---------- ⑤ 现行同名文档中的旧名称替换（保护历史记录） ----------
# 只处理"现行规则载体"：current.md / validation_matrix.md / development_workflow.md / handoff_current.md 的现行部分。
# 保护规则：跳过历史载体行——交接条目标题（### HO-）、版本史、修订记录行（| YYYY- 开头）、机器状态（分支名/投影块）。
Step "⑤ 现行同名文档中的旧名称替换（历史记录与机器状态除外）"
$liveDocs = @('docs\ai_memory\current.md', 'docs\ai_memory\validation_matrix.md', 'docs\ai_memory\development_workflow.md', 'docs\ai_memory\handoff_current.md', 'docs\ai_memory\tasks\task_schema.md')
foreach ($ld in $liveDocs) {
  $ldPath = Join-Path $ProjectRoot $ld
  if (-not (Test-Path $ldPath)) { continue }
  if ($DryRun) { Step "  (DryRun) 将扫描 $ld"; continue }
  $lines = Get-Content $ldPath -Encoding UTF8
  $changed = $false
  $out = @()
  $inHoEntry = $false
  foreach ($line in $lines) {
    $isHistoryLine = $line -match '^#{1,3}\s+HO-' -or $line -match 'Workday\s+V\d' -or $line -match '^\|\s*20\d\d-\d\d-\d\d' -or $line -match 'ebowork-runtime'
    if ($isHistoryLine) { $inHoEntry = $true; $out += $line; continue }
    # 历史交接条目正文整体保护：进入条目后直到下一个标题行都不做名称替换（只保护标题行是不够的）
    if ($inHoEntry) {
      if ($line -match '^#{1,3}\s') { $inHoEntry = $false } else { $out += $line; continue }
    }
    $new = $line
    foreach ($r in $refReplace) { $new = $new.Replace($r.From, $r.To) }
    $new = Replace-NamesProtected $new $nameReplace
    if ($new -ne $line) { $changed = $true }
    $out += $new
  }
  if ($changed) {
    [System.IO.File]::WriteAllText($ldPath, ($out -join "`n"), (New-Object System.Text.UTF8Encoding $false))
    Ok "$ld 现行内容旧名称已替换（历史行保留）"
  }
}

# ---------- ⑥ 旧 .ebowork/ 本机目录改名 .baton/（内容不动，仅改名；.gitignore 忽略行同步替换） ----------
Step "⑥ 旧 .ebowork/ 目录改名 .baton/（本机目录，内容不动）"
$ebwDir = Join-Path $ProjectRoot '.ebowork'
$batDir = Join-Path $ProjectRoot '.baton'
if (Test-Path $ebwDir) {
  if (Test-Path $batDir) {
    Write-Host "    ⚠ .ebowork 与 .baton 并存：保持只读，请人工核对合并后手工下线 .ebowork（本脚本不自动删除）"
  } elseif ($DryRun) {
    Step "  将 .ebowork/ 改名为 .baton/ 并同步 .gitignore 忽略行"
  } else {
    Rename-Item $ebwDir $batDir
    Ok ".ebowork/ → .baton/（已改名）"
    $giP = Join-Path $ProjectRoot '.gitignore'
    if (Test-Path $giP) {
      # 宽泛整目录忽略行（.ebowork/ 或 .baton/）→ 替换为精细忽略清单（config.json 必须入库可跨机恢复；本机与运行时文件才忽略）
      $giLines = Get-Content $giP -Encoding UTF8
      $giOut = @()
      $changedGi = $false
      foreach ($gl in $giLines) {
        $t = $gl.Trim()
        if ($t -eq '.ebowork/' -or $t -eq '.ebowork' -or $t -eq '.baton/' -or $t -eq '.baton') {
          $giOut += '.baton/private-patterns.txt'
          $giOut += '.baton/publish-identity.txt'
          $giOut += '.baton/local/'
          $giOut += '.baton/version.json'
          $changedGi = $true
        } else {
          $giOut += $gl
        }
      }
      if ($changedGi) {
        [System.IO.File]::WriteAllText($giP, ($giOut -join "`n"), (New-Object System.Text.UTF8Encoding $false))
        Ok ".gitignore 宽泛忽略行已替换为精细清单（.baton/config.json 入库，本机与运行时文件仍忽略）"
      }
    }
  }
} else {
  Write-Host "    未发现 .ebowork/，跳过。"
}

# ---------- ⑦ 同步机器层指针：archive_index.json 的 path/modules 与 project_state.json 的 handoff 指针 ----------
Step "⑦ 同步索引与状态指针（指向改名后的真实文件）"
if ($DryRun) {
  Step "  将同步 archive_index.json 的 path/modules 指针与 project_state.json 的 handoff 指针"
} else {
  $idxP = Join-Path $ProjectRoot 'docs\ai_memory\state\archive_index.json'
  if (Test-Path $idxP) {
    $rawIdx = Get-Content $idxP -Raw -Encoding UTF8
    $idxMap = @{
      '00_项目总览架构.md' = 'overview.md'; 'COMMANDS.md' = 'commands.md'; 'INDEX.md' = 'index.md'; 'handoff_latest.md' = 'handoff_current.md'
      'docs/ai_memory/00_项目总览架构.md' = 'docs/ai_memory/overview.md'
      'docs/ai_memory/COMMANDS.md' = 'docs/ai_memory/commands.md'
      'docs/ai_memory/INDEX.md' = 'docs/ai_memory/index.md'
      'docs/ai_memory/handoff_latest.md' = 'docs/ai_memory/handoff_current.md'
    }
    $changedIdx = $false
    foreach ($k in $idxMap.Keys) {
      $esc = [regex]::Escape($k)
      $before = $rawIdx
      # 只改指针字段：path 值 + modules 数组里的独立元素行；title/summary/keywords 等历史描述不动
      $rawIdx = [regex]::Replace($rawIdx, '("path":\s*")' + $esc + '(")', ('${1}' + $idxMap[$k] + '${2}'))
      $rawIdx = [regex]::Replace($rawIdx, '^(\s*")' + $esc + '(",?)\s*$', ('${1}' + $idxMap[$k] + '${2}'), [System.Text.RegularExpressions.RegexOptions]::Multiline)
      if ($rawIdx -ne $before) { $changedIdx = $true }
    }
    if ($changedIdx) {
      [System.IO.File]::WriteAllText($idxP, $rawIdx, (New-Object System.Text.UTF8Encoding $false))
      Ok "archive_index.json 的 path/modules 指针已同步"
    } else { Write-Host "    archive_index.json 无需要同步的旧指针。" }
  }
  $stP = Join-Path $ProjectRoot 'docs\ai_memory\state\project_state.json'
  if (Test-Path $stP) {
    $stC = Get-Content $stP -Raw -Encoding UTF8
    $stC2 = $stC.Replace('docs/ai_memory/handoff_latest.md', 'docs/ai_memory/handoff_current.md')
    if ($stC2 -ne $stC) {
      [System.IO.File]::WriteAllText($stP, $stC2, (New-Object System.Text.UTF8Encoding $false))
      Ok "project_state.json 的 handoff 指针已同步"
    } else { Write-Host "    project_state.json 无需要同步的旧指针。" }
  }
}

# ---------- ④ 备份下线（仅 -Archive 时执行） ----------
# ---------- ⑧ 初始化后验：迁移后的长期文档必须满足 Baton 强制结构 ----------
Step "⑧ 补齐并核验长期文档强制结构"
$longDocs = $preflightLongDocs
foreach ($rel in $longDocs) { Ensure-LongDocStructure (Join-Path $ProjectRoot $rel) $rel }
if (-not $DryRun) {
  $structureFailures = @()
  foreach ($rel in $longDocs) {
    $p = Join-Path $ProjectRoot $rel
    if (-not (Test-Path $p)) { continue }
    $c = Get-Content $p -Raw -Encoding UTF8
    if ($c -notmatch '【归档分卷索引】' -or $c -notmatch '【修订记录】') { $structureFailures += $rel }
  }
  if ($structureFailures.Count -gt 0) { Write-Error "迁移后长期文档结构校验失败：$($structureFailures -join '、')"; exit 1 }
}

# ---------- ④ 备份下线（仅 -Archive 时执行） ----------
if ($Archive) {
  Step "④ 备份旧 skill 与已迁移旧文档 → $BackupDir"
  if (-not $DryRun) {
    New-Item -ItemType Directory -Force $backup | Out-Null
    $n = 0
    foreach ($s in $oldSkills) {
      $rel = $s.Substring($ProjectRoot.Length).TrimStart('\')
      $dest = Join-Path $backup $rel
      New-Item -ItemType Directory -Force (Split-Path $dest -Parent) | Out-Null
      Copy-Item $s $dest -Recurse -Force
      Remove-Item $s -Recurse -Force
      $n++
      Ok "旧 skill 已备份并下线: $rel"
    }
    foreach ($d in $oldDocs) {
      $src = Join-Path $ProjectRoot $d
      if (-not (Test-Path $src)) { continue }  # 已在②中重命名或迁移，跳过
      $dest = Join-Path $backup $d
      New-Item -ItemType Directory -Force (Split-Path $dest -Parent) | Out-Null
      Copy-Item $src $dest -Force
      Remove-Item $src -Force
      $n++
      Ok "旧文档已备份并下线: $d"
    }
    Write-Host "  已备份 $n 项到 $BackupDir（随 Git 提交，可回滚）"
  } else {
    Write-Host "  (DryRun) 将备份 $($oldSkills.Count) 个旧 skill + $($oldDocs.Count) 个旧文档到 $BackupDir 并下线"
  }
} else {
  Write-Host ""
  Write-Host "⚠ 未执行第④步（备份下线）。确认迁移正确后，加 -Archive 重跑一次即可把旧 skill/旧文档移入 $BackupDir。"
}

Write-Host ""
Write-Host "完成。请验证："
Write-Host "  1) docs/ai_memory/ 下新文档已含旧内容"
Write-Host "  2) AGENTS.md / CLAUDE.md / .cursorrules 旧引用已替换"
if ($Archive) { Write-Host "  3) 旧 skill/文档已备份到 $BackupDir 并下线（git status 可见）" }
Write-Host "  4) 本机目录已改名 .baton/（若原存在 .ebowork/）"
Write-Host "  5) archive_index.json 与 project_state.json 的指针已指向真实文件"
Write-Host "  6) 最后说「上班啦」验证"
