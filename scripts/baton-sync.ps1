# Baton 跨 AI 安装脚本（Codex / Claude Code / Cursor 薄适配器）
# 用法: pwsh -File baton-sync.ps1 -ProjectRoot <项目根目录> [-SkillSource <SKILL.md 路径>]
# 功能: ① 镜像 SKILL.md 到三端 skills 目录（幂等）② 在三端入口文件插入/更新 Baton 入口段（幂等，不覆盖原有内容）
#       ③ 写入 Cursor 规则 .cursor/rules/baton.mdc（整文件模板，不含 HTML marker）
param(
  [string]$ProjectRoot = '',
  [string]$SkillSource = (Join-Path $PSScriptRoot '..\skills\baton\SKILL.md'),
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
function Write-Step($m) { Write-Host "==> $m" }
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  Write-Host '用法: pwsh -File baton-sync.ps1 -ProjectRoot <项目根目录> [-SkillSource <SKILL.md 路径>] [-DryRun]'
  exit 1
}

if (-not (Test-Path $SkillSource)) { throw "找不到 SKILL.md: $SkillSource" }
$skill = Get-Content $SkillSource -Raw

# ① 镜像 skill 到三端
$targets = @(
  (Join-Path $ProjectRoot '.agents\skills\baton\SKILL.md'),
  (Join-Path $ProjectRoot '.claude\skills\baton\SKILL.md'),
  (Join-Path $ProjectRoot '.cursor\skills\baton\SKILL.md')
)
foreach ($t in $targets) {
  if ($DryRun) { Write-Step "将复制 skill -> $t"; continue }
  $dir = Split-Path $t -Parent
  New-Item -ItemType Directory -Force $dir | Out-Null
  Copy-Item $SkillSource $t -Force
  Write-Step "已镜像 skill -> $t"
}

# ② 入口文件：插入 Baton 入口段（幂等：已有标记则不重复）
$entries = @(
  @{ File = (Join-Path $ProjectRoot 'AGENTS.md');   Segment = (Get-Content (Join-Path $PSScriptRoot '..\templates\adapter\AGENTS.entry.md') -Raw) },
  @{ File = (Join-Path $ProjectRoot 'CLAUDE.md');   Segment = (Get-Content (Join-Path $PSScriptRoot '..\templates\adapter\CLAUDE.entry.md') -Raw) },
  @{ File = (Join-Path $ProjectRoot '.cursorrules'); Segment = (Get-Content (Join-Path $PSScriptRoot '..\templates\adapter\CURSOR.rules.md') -Raw) }
)
foreach ($e in $entries) {
  $marker = 'Baton 项目协作入口'
  if ($DryRun) { Write-Step "将更新入口 $($e.File)"; continue }
  $existing = if (Test-Path $e.File) { Get-Content $e.File -Raw } else { '' }
  $norm = { param($s) ($s -replace "`r`n", "`n") }
  # 成对 marker：优先只替换 BEGIN/END 之间；旧单 marker 沿用反推逻辑并升级
  $beginMark = '<!-- BATON:BEGIN -->'
  $endMark = '<!-- BATON:END -->'
  $bIdx = $existing.IndexOf($beginMark)
  $eIdx = $existing.IndexOf($endMark)
  if ($bIdx -ge 0 -and $eIdx -gt $bIdx) {
    $eolP = if ($existing.Contains("`r`n")) { "`r`n" } else { "`n" }
    $candidateP = $existing.Substring(0, $bIdx) + $beginMark + $eolP + $e.Segment.TrimEnd() + $eolP + $existing.Substring($eIdx)
    if ((& $norm $candidateP) -eq (& $norm $existing)) {
      Write-Step "入口 $($e.File) 已是最新（零写入）"
    } else {
      Set-Content $e.File $candidateP -Encoding UTF8
      Write-Step "已更新入口 $($e.File)（成对 marker）"
    }
    continue
  }
  if ($existing -match [regex]::Escape($marker)) {
    # 已存在（旧单 marker）→ 只替换 Baton 段本身（任意级 # 标题定位；EOL 不敏感；段后无标题用户内容 → 拒绝重写保护尾部），并升级为成对
    $start = $existing.IndexOf($marker)
    $head = $existing.Substring(0, $start)
    $heads = [regex]::Matches($head, '(?m)^#{1,6} ')
    $segStart = if ($heads.Count -gt 0) { $heads[$heads.Count - 1].Index } else { 0 }
    $tail = $existing.Substring($start)
    $next = [regex]::Match($tail, '(?m)^#{1,6} ')
    $segEnd = if ($next.Success) { $start + $next.Index } else { -1 }
    $eol = if ($existing.Contains("`r`n")) { "`r`n" } else { "`n" }
    $wrapped = $beginMark + $eol + $e.Segment.TrimEnd() + $eol + $endMark
    if ($segEnd -lt 0 -and (& $norm ($existing.Substring($segStart))).Trim() -ne (& $norm $wrapped).Trim()) {
      Write-Step "⚠ $($e.File) 段后有无标题内容，跳过自动更新，请人工核对"
      continue
    }
    $prefix = $existing.Substring(0, $segStart).TrimEnd()
    $suffix = if ($segEnd -ge 0) { $existing.Substring($segEnd) } else { '' }
    $candidate = if ($prefix -eq '' -and $suffix -eq '') { $wrapped.TrimEnd() + $eol } else { $prefix + $eol + $eol + $wrapped.TrimEnd() + $eol + $eol + $suffix }
    if ((& $norm $candidate) -eq (& $norm $existing)) {
      Write-Step "入口 $($e.File) 已是最新（零写入）"
      continue
    }
    Set-Content $e.File $candidate -Encoding UTF8
    Write-Step "已更新入口 $($e.File)（升级成对 marker）"
  } else {
    $eol2 = if ($existing.Contains("`r`n")) { "`r`n" } else { "`n" }
    # 新文件不写前导空行
    $wrapped2 = $beginMark + $eol2 + $e.Segment.TrimEnd() + $eol2 + $endMark
    $newContent = if ($existing -eq '') { $wrapped2.TrimEnd() + $eol2 } else { $existing.TrimEnd() + $eol2 + $eol2 + $wrapped2.TrimEnd() + $eol2 }
    Set-Content $e.File $newContent -Encoding UTF8
    Write-Step "已写入入口 $($e.File)（成对 marker）"
  }
}

# ③ Cursor 现代规则文件（整文件覆盖；不含 BATON HTML marker，以免破坏 YAML frontmatter）
$mdcSrc = Join-Path $PSScriptRoot '..\templates\adapter\CURSOR.rules.mdc'
$mdcDest = Join-Path $ProjectRoot '.cursor\rules\baton.mdc'
if (Test-Path $mdcSrc) {
  $mdcSeg = Get-Content $mdcSrc -Raw -Encoding UTF8
  if ($DryRun) {
    Write-Step "将写入 $mdcDest"
  } else {
    $mdcExisting = if (Test-Path $mdcDest) { Get-Content $mdcDest -Raw -Encoding UTF8 } else { '' }
    $mdcNorm = { param($s) ($s -replace "`r`n", "`n") }
    if ($mdcExisting -ne '' -and $mdcExisting -notmatch 'Baton 项目协作入口') {
      Write-Step "跳过 $mdcDest（已有非 Baton 内容，不覆盖）"
    } elseif ((& $mdcNorm $mdcExisting) -eq (& $mdcNorm $mdcSeg)) {
      Write-Step "Cursor 规则 $mdcDest 已是最新（零写入）"
    } else {
      New-Item -ItemType Directory -Force (Split-Path $mdcDest -Parent) | Out-Null
      [System.IO.File]::WriteAllText($mdcDest, ((& $mdcNorm $mdcSeg).TrimEnd() + "`n"), (New-Object System.Text.UTF8Encoding $false))
      Write-Step "已写入 Cursor 规则 $mdcDest"
    }
  }
}

if ($DryRun) { Write-Step 'DryRun 完成：未做任何写入' } else { Write-Step '完成：三端 skill 已镜像、入口已写入（幂等）' }
