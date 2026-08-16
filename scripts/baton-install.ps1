# baton-install.ps1 —— Baton 一键安装（用户级 / 项目级）
# ------------------------------------------------------------------
# 用法（两种装法二选一）：
#
#   用户级（每台电脑只装一次，全电脑所有项目都能用）：
#     pwsh -File baton-install.ps1 -Scope User
#
#   项目级（跟随具体项目，把 Baton 装进这个项目）：
#     pwsh -File baton-install.ps1 -Scope Project -ProjectRoot C:\你的项目路径
#
# 可选参数：
#   -ProjectName  项目名（项目级时用于 config.json；默认取目录名）
#   -RemoteUrl    Git 远端地址（可选；填了会写进 config.json）
#   -DryRun       只预览要做什么，不写任何文件
#
# 项目级会自动完成 6 件事（幂等，绝不覆盖已有文件）：
#   1) docs/ai_memory/ 记忆骨架（含模板 + 修订记录 + 分卷索引）
#   2) .baton/config.json 项目配置
#   3) .gitignore 追加 .baton/ 忽略
#   4) 三端 skill 镜像（.agents/.claude/.cursor/skills/baton/）
#   5) 三端入口段（AGENTS.md / CLAUDE.md / .cursorrules）
#   6) 检测旧 skill（workday/EboWork）给出迁移建议
# ------------------------------------------------------------------
param(
  [ValidateSet('User', 'Project')][string]$Scope = 'User',
  [string]$ProjectRoot = (Get-Location).Path,
  [string]$ProjectName = '',
  [string]$RemoteUrl = '',
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
function Step($m) { Write-Host "==> $m" }
function Ok($m) { Write-Host "    ok: $m" }

$RepoRoot = Split-Path $PSScriptRoot -Parent
$SkillSource = Join-Path $RepoRoot 'skills\baton\SKILL.md'
$TplMemory = Join-Path $RepoRoot 'templates\ai_memory'
$TplConfig = Join-Path $RepoRoot 'templates\baton\config.json'
$TplGitignore = Join-Path $RepoRoot 'templates\gitignore.append'

# 版本锚：install 留痕，供「检查更新/更新 Baton」口令与本机版本对比。
# source=git（框架仓库副本）| npm（DSH 组合包内）；version 读源 package.json（权威版本号）；
# sha 读源 git HEAD（git 源才有）；last_check_at 由「检查更新」刷新，null=从未检查。
# 重跑 install 会覆盖刷新（重装语义），是幂等安全的设计（版本来自安装源本身，不会假升级）。
function Get-BatonVersionInfo($repoRoot) {
  $source = 'git'
  if ($repoRoot -match 'node_modules') { $source = 'npm' }
  $version = $null
  $pkgJson = Join-Path $repoRoot 'package.json'
  if (Test-Path $pkgJson) {
    try {
      $pkg = Get-Content $pkgJson -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($pkg.version) { $version = [string]$pkg.version }
    } catch { }
  }
  $sha = $null
  if (Test-Path (Join-Path $repoRoot '.git')) {
    try {
      $h = git -C $repoRoot rev-parse HEAD 2>$null
      if ($LASTEXITCODE -eq 0 -and $h -match '^[0-9a-f]{40}$') { $sha = $h.Trim() }
    } catch { }
  }
  $info = [ordered]@{
    source        = $source
    version       = $version
    sha           = $sha
    installed_at  = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    last_check_at = $null
  }
  return $info
}

if (-not (Test-Path $SkillSource)) { throw "找不到 SKILL.md：$SkillSource" }

# ---------------- 用户级：三端全局 skill ----------------
if ($Scope -eq 'User') {
  Step "用户级安装：把 baton 与专项 skill 装到本机三个 AI 工具的全局 skill 目录"
  # 跨平台 home 语义：优先 USERPROFILE（Windows），回落 $HOME（macOS/Linux）
  $homeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
  $userTargets = @(
    @{ Tool = 'Codex';        Dir = Join-Path $homeDir '.agents\skills' },
    @{ Tool = 'Claude Code';  Dir = Join-Path $homeDir '.claude\skills' },
    @{ Tool = 'Cursor';       Dir = Join-Path $homeDir '.cursor\skills' }
  )
  # 镜像清单：baton 主 skill + 专项 skill
  $skillDirs = @('baton', 'baton-lean-review', 'baton-debt', 'baton-doctor')
  $verInfo = Get-BatonVersionInfo $RepoRoot
  foreach ($t in $userTargets) {
    foreach ($s in $skillDirs) {
      $sSrc = Join-Path $RepoRoot ("skills\" + $s + '\SKILL.md')
      if (-not (Test-Path $sSrc)) { continue }
      $target = Join-Path $t.Dir ($s + '\SKILL.md')
      if ($DryRun) { Step "将安装 -> [$($t.Tool)] $target"; continue }
      New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
      Copy-Item $sSrc $target -Force
      Ok "[$($t.Tool)] $target"
    }
    # 版本锚：baton 主 skill 目录写 version.json，供「检查更新」读本机版本（覆盖刷新）
    $verPath = Join-Path $t.Dir 'baton\version.json'
    New-Item -ItemType Directory -Force (Split-Path $verPath -Parent) | Out-Null
    [System.IO.File]::WriteAllText($verPath, ($verInfo | ConvertTo-Json), (New-Object System.Text.UTF8Encoding $false))
    Ok "[$($t.Tool)] $verPath (v$($verInfo.version))"
  }
  if (-not $DryRun) {
    Write-Host ""
    Write-Host "用户级安装完成。接下来："
    Write-Host "  1) 在任何项目里说口令即可（skill 已全局生效，AI 会自动找到）"
    Write-Host "  2) 想让某个具体项目被所有电脑/AI 认识，再对该项目跑项目级安装："
    Write-Host "     pwsh -File baton-install.ps1 -Scope Project -ProjectRoot C:\项目路径"
  }
  exit 0
}

# ---------------- 项目级：完整骨架 + 三端适配 ----------------
Step "项目级安装：$ProjectRoot"
if (-not (Test-Path $ProjectRoot)) { throw "项目目录不存在：$ProjectRoot" }
if ([string]::IsNullOrWhiteSpace($ProjectName)) { $ProjectName = Split-Path $ProjectRoot -Leaf }
if ($DryRun) { Write-Host "    (DryRun 模式：以下仅预览)" }

$created = @(); $skipped = @(); $migration = @()

# 1) docs/ai_memory 记忆骨架（幂等：已存在则跳过）
if (-not (Test-Path $TplMemory)) { throw "找不到模板目录：$TplMemory" }
$today = Get-Date -Format 'yyyy-MM-dd'
$files = Get-ChildItem $TplMemory -Recurse -File
foreach ($f in $files) {
  $rel = $f.FullName.Substring($TplMemory.Length).TrimStart('\')
  $target = Join-Path $ProjectRoot ('docs\ai_memory\' + $rel)
  # 文件存在且非空 → 跳过；空文件视为缺失，补模板
  if (Test-Path $target) {
    $existingContent = Get-Content $target -Raw -Encoding UTF8
    if (-not [string]::IsNullOrWhiteSpace($existingContent)) { $skipped += $rel; continue }
  }
  if ($DryRun) { Step "将生成 docs/ai_memory/$rel"; continue }
  New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
  $content = Get-Content $f.FullName -Raw -Encoding UTF8
  if ($null -eq $content) { $content = '' }  # 空模板文件（如 decisions.jsonl）读回 $null，防空引用
  $content = $content.Replace('{{NAME}}', $ProjectName).Replace('{{DATE}}', $today)
  $content = $content.Replace('INIT_TIME', (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ'))
  [System.IO.File]::WriteAllText($target, $content, (New-Object System.Text.UTF8Encoding $false))
  $created += $rel
}

# 2) .baton/config.json（幂等；旧实例先跑 baton-migrate 改名 .ebowork → .baton，避免双配置）
$configTarget = Join-Path $ProjectRoot '.baton\config.json'
$legacyConfig = Join-Path $ProjectRoot '.ebowork\config.json'
if (-not (Test-Path $configTarget)) {
  if (Test-Path $legacyConfig) {
    $migration += "旧目录 .ebowork/（含 config.json）→ 先运行 scripts/baton-migrate.ps1 -ProjectRoot $ProjectRoot 改名为 .baton/，再重跑本脚本"
  } elseif (-not $DryRun) {
    New-Item -ItemType Directory -Force (Split-Path $configTarget -Parent) | Out-Null
    $cfg = Get-Content $TplConfig -Raw -Encoding UTF8
    # 项目名 JSON 安全写入：引号/反斜杠/换行等经 JSON 转义后塞进值位，杜绝非法 JSON
    $nameJson = ($ProjectName | ConvertTo-Json -Compress)
    $cfg = $cfg.Replace('"PROJECT_NAME"', $nameJson)
    if ($RemoteUrl) {
      # 凭据绝不入库：只剥「含冒号」的 userinfo（user:token@ 是凭据；
      # git@host 纯用户名是账号不是凭据，保留）。覆盖 https/ssh/scp 三种形式与凭据类查询参数。
      if ($RemoteUrl -match '^https?://[^/@\s]+:[^/@\s]+@') {
        $RemoteUrl = $RemoteUrl -replace '^https?://[^/@\s]+:[^/@\s]+@', 'https://'
        Write-Host "    ⚠ RemoteUrl 含凭据已剥离（凭据绝不写入 config.json），请用 gh/ssh 提供认证"
      }
      if ($RemoteUrl -match '^ssh://[^/@\s]+:[^/@\s]+@') {
        $RemoteUrl = $RemoteUrl -replace '^ssh://[^/@\s]+:[^/@\s]+@', 'ssh://'
        Write-Host "    ⚠ RemoteUrl 含凭据已剥离（凭据绝不写入 config.json），请用 ssh key 提供认证"
      }
      # SCP 形式（无 scheme）：user:password@host:path → 剥 userinfo 保留 host:path
      if ($RemoteUrl -match '^[A-Za-z0-9_.-]+:[^@\s]+@[^@\s:]+:') {
        $RemoteUrl = $RemoteUrl -replace '^[A-Za-z0-9_.-]+:[^@\s]+@', ''
        Write-Host "    ⚠ RemoteUrl 含凭据已剥离（凭据绝不写入 config.json），请用 ssh key 提供认证"
      }
      if ($RemoteUrl -match '[?&](access_token|token|password|auth|key)=[^&]*') {
        $RemoteUrl = $RemoteUrl -replace '[?&](access_token|token|password|auth|key)=[^&]*', ''
        Write-Host "    ⚠ RemoteUrl 查询参数含凭据已剥离，请用 gh/ssh 提供认证"
      }
      # JSON 安全写入：URL 必须经 JSON 转义后塞进值位，杜绝反斜杠/引号破坏 JSON
      $remoteJson = ($RemoteUrl | ConvertTo-Json -Compress)
      $cfg = $cfg.Replace('"REPLACE_WITH_REMOTE_URL"', $remoteJson)
    }
    [System.IO.File]::WriteAllText($configTarget, $cfg, (New-Object System.Text.UTF8Encoding $false))
    $created += '.baton/config.json'
  } else { Step "将生成 .baton/config.json" }
} else {
  # 通用递归 schema merge：config 已存在时按模板递归补齐缺失键——
  # 用户字段一律保留不覆盖；JSON 损坏 = 硬失败，绝不以成功安装收尾。
  $cfgRaw = Get-Content $configTarget -Raw -Encoding UTF8
  $cfgObj = $null
  try { $cfgObj = $cfgRaw | ConvertFrom-Json } catch {
    Write-Error "config.json JSON 损坏：安装中止（fail-closed）。请先修复 $configTarget 或备份后删除再重跑本脚本。"
    exit 1
  }
  function Merge-TplInto($existing, $template) {
    foreach ($prop in $template.PSObject.Properties) {
      $key = $prop.Name
      $ev = $existing.PSObject.Properties[$key]
      if ($null -eq $ev) {
        $existing | Add-Member -NotePropertyName $key -NotePropertyValue $prop.Value
      } elseif ($prop.Value -is [PSCustomObject] -and $ev.Value -is [PSCustomObject]) {
        Merge-TplInto $ev.Value $prop.Value
      }
      # 其余（标量/数组）已有值一律保留
    }
  }
  $tplObj = Get-Content $TplConfig -Raw -Encoding UTF8 | ConvertFrom-Json
  Merge-TplInto $cfgObj $tplObj
  $mergedJson = $cfgObj | ConvertTo-Json -Depth 10
  if (-not $DryRun) {
    if (($mergedJson -replace '\s', '') -ne ($cfgRaw -replace '\s', '')) {
      [System.IO.File]::WriteAllText($configTarget, $mergedJson, (New-Object System.Text.UTF8Encoding $false))
      $created += '.baton/config.json（按模板补齐缺失键，保留用户配置）'
    } else { $skipped += '.baton/config.json' }
  } else { Step "将按模板补齐 config.json 缺失键" }
}

# 3) .gitignore 追加（精细忽略：config.json 入库可跨机恢复，本机与运行时文件仍忽略；旧版整目录忽略行自动升级）
$giTarget = Join-Path $ProjectRoot '.gitignore'
$giAppend = Get-Content $TplGitignore -Raw -Encoding UTF8
if (Test-Path $giTarget) {
  $gi = Get-Content $giTarget -Raw -Encoding UTF8
  if ($gi -match '# \.baton 配置入库') {
    $skipped += '.gitignore（已按精细清单配置）'
  } else {
    if (-not $DryRun) {
      # 升级路径：移除旧模板遗留的整目录忽略行（精确匹配才动，用户自己的规则不碰）
      $lines = @($gi -split "`r?`n") | Where-Object { $_ -ne '.baton/' }
      [System.IO.File]::WriteAllText($giTarget, (($lines -join "`n").TrimEnd() + "`n`n" + $giAppend), (New-Object System.Text.UTF8Encoding $false))
      $created += '.gitignore（精细忽略：config.json 入库）'
    } else { Step "将更新 .gitignore（精细忽略，config.json 入库）" }
  }
} else {
  if (-not $DryRun) { [System.IO.File]::WriteAllText($giTarget, $giAppend, (New-Object System.Text.UTF8Encoding $false)); $created += '.gitignore（新建）' }
  else { Step "将新建 .gitignore" }
}

# 4) 三端 skill 镜像（幂等覆盖，SKILL 以框架为准：baton 主 skill + 专项 skill）
$skillDirsProject = @('baton', 'baton-lean-review', 'baton-debt', 'baton-doctor')
foreach ($tool in @('.agents', '.claude', '.cursor')) {
  foreach ($s in $skillDirsProject) {
    $sSrcP = Join-Path $RepoRoot ("skills\" + $s + '\SKILL.md')
    if (-not (Test-Path $sSrcP)) { continue }
    $dir = Join-Path $ProjectRoot ($tool + '\skills\' + $s)
    if (-not $DryRun) {
      New-Item -ItemType Directory -Force $dir | Out-Null
      Copy-Item $sSrcP (Join-Path $dir 'SKILL.md') -Force
      $created += ($tool + '/skills/' + $s + '/SKILL.md')
    } else { Step "将镜像 skill -> $tool/skills/$s/SKILL.md" }
  }
}

# 5) 三端入口段（幂等：已有 Baton 入口则替换，绝不覆盖其他内容）
$entries = @(
  @{ File = 'AGENTS.md';    Seg = Join-Path $RepoRoot 'templates\adapter\AGENTS.entry.md';    Marker = 'Baton 项目协作入口' },
  @{ File = 'CLAUDE.md';    Seg = Join-Path $RepoRoot 'templates\adapter\CLAUDE.entry.md';    Marker = 'Baton 项目协作入口' },
  @{ File = '.cursorrules'; Seg = Join-Path $RepoRoot 'templates\adapter\CURSOR.rules.md';   Marker = 'Baton 项目协作入口' }
)
foreach ($e in $entries) {
  $target = Join-Path $ProjectRoot $e.File
  $seg = Get-Content $e.Seg -Raw -Encoding UTF8
  if ($DryRun) { Step "将更新入口 $($e.File)"; continue }
  $existing = if (Test-Path $target) { Get-Content $target -Raw -Encoding UTF8 } else { '' }
  $norm = { param($s) ($s -replace "`r`n", "`n") }
  # 成对 marker：优先只替换 BEGIN/END 之间，绝不动段外用户内容；
  # 无成对 marker 时沿用旧单 marker 反推逻辑（并升级为成对）。
  $beginMark = '<!-- BATON:BEGIN -->'
  $endMark = '<!-- BATON:END -->'
  $bIdx = $existing.IndexOf($beginMark)
  $eIdx = $existing.IndexOf($endMark)
  if ($bIdx -ge 0 -and $eIdx -gt $bIdx) {
    $eolP = if ($existing.Contains("`r`n")) { "`r`n" } else { "`n" }
    $candidateP = $existing.Substring(0, $bIdx) + $beginMark + $eolP + $seg.TrimEnd() + $eolP + $existing.Substring($eIdx)
    if ((& $norm $candidateP) -ne (& $norm $existing)) {
      [System.IO.File]::WriteAllText($target, $candidateP, (New-Object System.Text.UTF8Encoding $false))
      $created += $e.File + '（入口段成对更新）'
    }
    continue
  }
  if ($existing -match [regex]::Escape($e.Marker)) {
    # 已有入口（旧单 marker）→ 只替换 Baton 段本身（任意级 # 标题定位；EOL 不敏感比较；段后无标题用户内容 → 拒绝重写保护尾部），并升级为成对 marker
    $start = $existing.IndexOf($e.Marker)
    $head = $existing.Substring(0, $start)
    $heads = [regex]::Matches($head, '(?m)^#{1,6} ')
    $segStart = if ($heads.Count -gt 0) { $heads[$heads.Count - 1].Index } else { 0 }
    $tail = $existing.Substring($start)
    $next = [regex]::Match($tail, '(?m)^#{1,6} ')
    $segEnd = if ($next.Success) { $start + $next.Index } else { -1 }
    $eol = if ($existing.Contains("`r`n")) { "`r`n" } else { "`n" }
    $wrapped = $beginMark + $eol + $seg.TrimEnd() + $eol + $endMark
    if ($segEnd -lt 0 -and (& $norm ($existing.Substring($segStart))).Trim() -ne (& $norm $wrapped).Trim()) {
      $created += $e.File + '（⚠ 段后有无标题内容，跳过自动更新，请人工核对）'
      continue
    }
    $prefix = $existing.Substring(0, $segStart).TrimEnd()
    $suffix = if ($segEnd -ge 0) { $existing.Substring($segEnd) } else { '' }
    $candidate = if ($prefix -eq '' -and $suffix -eq '') { $wrapped.TrimEnd() + $eol } else { $prefix + $eol + $eol + $wrapped.TrimEnd() + $eol + $eol + $suffix }
    if ((& $norm $candidate) -ne (& $norm $existing)) {
      [System.IO.File]::WriteAllText($target, $candidate, (New-Object System.Text.UTF8Encoding $false))
      $created += $e.File + '（入口更新·升级成对 marker）'
    }
  } else {
    $eol2 = if ($existing.Contains("`r`n")) { "`r`n" } else { "`n" }
    # 新文件不写前导空行
    $wrapped2 = $beginMark + $eol2 + $seg.TrimEnd() + $eol2 + $endMark
    $newContent = if ($existing -eq '') { $wrapped2.TrimEnd() + $eol2 } else { $existing.TrimEnd() + $eol2 + $eol2 + $wrapped2.TrimEnd() + $eol2 }
    [System.IO.File]::WriteAllText($target, $newContent, (New-Object System.Text.UTF8Encoding $false))
    $created += $e.File + '（入口新建·成对 marker）'
  }
}

# 6) 旧 skill 检测（workday / ebowork 系列，含拆分后的 ebowork-*；只提示不删除）
foreach ($tool in @('.agents', '.claude', '.cursor')) {
  $skillsDir = Join-Path $ProjectRoot ($tool + '\skills')
  if (Test-Path $skillsDir) {
    Get-ChildItem $skillsDir -Directory | Where-Object { $_.Name -match 'workday|ebowork' } | ForEach-Object {
      $migration += "旧 skill：$($tool)/skills/$($_.Name) → 建议归档到 .baton-legacy/（不自动删除）"
    }
  }
}
# 旧命名文档检测（提示运行 baton-migrate 一次性迁移，不手动配置）
# 规范名映射：检测到旧名时，若规范名文件已存在（Windows 大小写不敏感下同一文件），跳过不报
$legacyDocHits = @(
  @{ Role = 'overview'; Old = 'docs\ai_memory\00_项目总览架构.md'; New = 'docs\ai_memory\overview.md' },
  @{ Role = 'constraints'; Old = 'docs\ai_memory\01_encoding_constraint.md'; New = 'docs\ai_memory\constraints.md' },
  @{ Role = 'index'; Old = 'docs\ai_memory\INDEX.md'; New = 'docs\ai_memory\index.md' },
  @{ Role = 'commands'; Old = 'docs\ai_memory\COMMANDS.md'; New = 'docs\ai_memory\commands.md' },
  @{ Role = 'handoff_latest'; Old = 'docs\ai_memory\handoff_latest.md'; New = '' }
)
$legacyDocFound = $false
foreach ($d in $legacyDocHits) {
  if (-not (Test-Path (Join-Path $ProjectRoot $d.Old))) { continue }
  # 规范文件已存在 → 同一文件的大小写变体，不报旧文档
  if ($d.New -ne '' -and (Test-Path (Join-Path $ProjectRoot $d.New))) { continue }
  $legacyDocFound = $true
  $migration += "旧文档：$($d.Old)（角色 $($d.Role)）→ 运行 scripts/baton-migrate.ps1 -ProjectRoot $ProjectRoot 一次性迁移为规范名并备份旧文件"
}
$oldRefPattern = 'workday-knowledge-manager|workday_knowledge|继续EboWork|EboWork init'
foreach ($f in @('AGENTS.md', 'CLAUDE.md')) {
  $fp = Join-Path $ProjectRoot $f
  if (Test-Path $fp) {
    $c = Get-Content $fp -Raw -Encoding UTF8
    if ($c -match $oldRefPattern) { $migration += "$f 含旧 skill 引用 → 建议替换为 Baton 入口段" }
  }
}
# 旧 .ebowork/ 本机目录检测（提示运行 baton-migrate 一次性改名，不自动处理）
if ((Test-Path (Join-Path $ProjectRoot '.ebowork')) -and (-not (Test-Path (Join-Path $ProjectRoot '.baton')))) {
  $migration += "旧目录 .ebowork/ → 运行 scripts/baton-migrate.ps1 -ProjectRoot $ProjectRoot 一次性改名为 .baton/（内容不动）"
}
if ($migration.Count -gt 0) { $migration += "提示：旧资产统一用 scripts/baton-migrate.ps1 迁移（建新文档搬内容→改引用→备份下线），勿手工零散处理" }

# 7) 版本锚（.baton/version.json，本机 gitignore 忽略；重跑 install 覆盖刷新，供「检查更新/更新 Baton」）
$verPath = Join-Path $ProjectRoot '.baton\version.json'
if ($DryRun) { Step "将生成 .baton/version.json（版本锚）" } else {
  New-Item -ItemType Directory -Force (Split-Path $verPath -Parent) | Out-Null
  $verInfo = Get-BatonVersionInfo $RepoRoot
  [System.IO.File]::WriteAllText($verPath, ($verInfo | ConvertTo-Json), (New-Object System.Text.UTF8Encoding $false))
  $created += '.baton/version.json（版本锚 v' + $verInfo.version + '）'
}

# 7.5) 安装 manifest：记录本脚本管理的文件与其内容 hash——
# 卸载只删 hash 未变的 managed 文件；用户修改过的文件保留并报告，绝不误删。
$manifestTarget = Join-Path $ProjectRoot '.baton\manifest.json'
if ($DryRun) { Step "将生成 .baton/manifest.json（managed 文件 hash 清单）" } else {
  $manifestRel = @('.baton/version.json')
  foreach ($tool in @('.agents', '.claude', '.cursor')) {
    foreach ($s in @('baton', 'baton-lean-review', 'baton-debt', 'baton-doctor')) {
      $manifestRel += ($tool + '/skills/' + $s + '/SKILL.md')
    }
  }
  $manifestManaged = [ordered]@{}
  foreach ($rel in $manifestRel) {
    $mp = Join-Path $ProjectRoot $rel
    if (Test-Path $mp) {
      $h = (Get-FileHash $mp -Algorithm SHA256).Hash.ToLowerInvariant()
      $manifestManaged[$rel.Replace('\', '/')] = $h
    }
  }
  $manifestObj = [ordered]@{ schema = 1; installed_at = (Get-Date).ToString('o'); version = $verInfo.version; managed = $manifestManaged }
  [System.IO.File]::WriteAllText($manifestTarget, ($manifestObj | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding $false))
  $created += '.baton/manifest.json（managed hash 清单）'
}

$hasGit = Test-Path (Join-Path $ProjectRoot '.git')
Write-Host ""
if ($DryRun) { Write-Host "DryRun 完成：以上为将要执行的操作，未写任何文件。"; exit 0 }
Write-Host "项目级安装完成 ✅"
Write-Host "  新建：$($created.Count) 项（$($created -join '、')）"
if ($skipped.Count -gt 0) { Write-Host "  跳过（已存在）：$($skipped -join '、')" }
if ($migration.Count -gt 0) { Write-Host "  迁移建议："; $migration | ForEach-Object { Write-Host "    - $_" } }
Write-Host ""
if (-not $hasGit) {
  Write-Host "⚠ 未检测到 .git：请先执行以下命令完成首次提交（Baton 的上班/下班依赖 Git）："
  Write-Host "   git init"
  Write-Host "   git add -A"
  Write-Host "   git commit -m ""init: Baton 接入"""
  Write-Host "   git remote add origin <你的远端地址>   # 如有远端"
  Write-Host "   git push -u origin master              # 如有远端"
} else {
  Write-Host "已检测到 .git。现在到项目里说「上班啦」验证即可。"
}
