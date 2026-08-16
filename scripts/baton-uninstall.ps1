# baton-uninstall.ps1 —— Baton 安全卸载
# 用法: pwsh -File baton-uninstall.ps1 -ProjectRoot <项目根目录> [-DryRun] [-RemoveMemory]
# 原则:
#   1) 只移除确认属于 Baton 的内容：SKILL 镜像（内容含 "name: baton" 才删）、入口文件的成对 marker 段（段外内容保留）、版本锚；
#   2) .baton/config.json 与 docs/ai_memory/ 默认保留（项目真相与配置），删除必须 -RemoveMemory 二次明确确认；
#   3) 用户自定义内容（statusline/其他配置）绝不触碰。
param(
  [Parameter(Mandatory = $true)][string]$ProjectRoot,
  [switch]$DryRun,
  [switch]$RemoveMemory
)
$ErrorActionPreference = 'Stop'
function Step($m) { Write-Host "==> $m" }
$removed = @()

# manifest（Codex C2）：install 记录 managed 文件 hash；卸载只删 hash 未变的文件，用户修改过的保留并报告
$manifest = $null
$manifestPath = Join-Path $ProjectRoot '.baton\manifest.json'
if (Test-Path $manifestPath) {
  try { $manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $manifest = $null }
}
function Test-ManagedHash($file, $rel) {
  if ($null -eq $manifest) { return $true }  # 无 manifest：按历史行为（内容含 name: baton 判定）
  $expected = $manifest.managed.($rel.Replace('\', '/'))
  if ($null -eq $expected -or $expected -eq '') { return $true }
  try {
    $actual = (Get-FileHash $file -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
      Write-Host "    保留（用户已修改，hash 不符，不删除）: $file"
      return $false
    }
  } catch { Write-Host "    保留（hash 读取失败，fail-closed 不删除）: $file"; return $false }
  return $true
}

Step "1/4 三端 skill 镜像（仅删内容含 name: baton 且 hash 未变的真镜像）"
foreach ($tool in @('.agents', '.claude', '.cursor')) {
  $skillsDir = Join-Path $ProjectRoot ($tool + '\skills')
  if (-not (Test-Path $skillsDir)) { continue }
  foreach ($s in @('baton', 'baton-lean-review', 'baton-debt', 'baton-doctor')) {
    $f = Join-Path $skillsDir ($s + '\SKILL.md')
    if (-not (Test-Path $f)) { continue }
    $rel = ($tool + '/skills/' + $s + '/SKILL.md')
    $c = Get-Content $f -Raw -Encoding UTF8
    if ($c -match 'name: baton') {
      if (-not (Test-ManagedHash $f $rel)) { continue }
      if ($DryRun) { Step "  将删除 $f"; continue }
      Remove-Item $f -Force
      $removed += $f
    } else { Write-Host "    跳过（非 Baton 内容，不触碰）: $f" }
  }
}

Step "2/4 入口文件成对 marker 段（仅删 BEGIN/END 之间，段外用户内容保留）"
$beginMark = '<!-- BATON:BEGIN -->'
$endMark = '<!-- BATON:END -->'
foreach ($f in @('AGENTS.md', 'CLAUDE.md', '.cursorrules')) {
  $p = Join-Path $ProjectRoot $f
  if (-not (Test-Path $p)) { continue }
  $c = Get-Content $p -Raw -Encoding UTF8
  $bIdx = $c.IndexOf($beginMark)
  $eIdx = $c.IndexOf($endMark)
  if ($bIdx -ge 0 -and $eIdx -gt $bIdx) {
    $after = $c.Substring(0, $bIdx) + $c.Substring($eIdx + $endMark.Length)
    $after = $after -replace "(`r?`n){3,}", "`$1`$1"
    if ($DryRun) { Step "  将移除 $f 的 Baton 入口段"; continue }
    [System.IO.File]::WriteAllText($p, $after, (New-Object System.Text.UTF8Encoding $false))
    $removed += ($f + '（入口段）')
  } elseif ($c -match 'Baton 项目协作入口') {
    Write-Host "    ⚠ $f 含旧式单 marker 入口段：成对 marker 缺失，跳过自动删除（请人工核对）"
  }
}

Step "3/4 版本锚（.baton/version.json，hash 未变才删）"
$verPath = Join-Path $ProjectRoot '.baton\version.json'
if (Test-Path $verPath) {
  if (-not (Test-ManagedHash $verPath '.baton/version.json')) { Write-Host "    版本锚保留（用户已修改）" }
  elseif ($DryRun) { Step "  将删除 $verPath" } else { Remove-Item $verPath -Force; $removed += $verPath }
}

# manifest 本身：卸载完成后删除（machine-local 清单，不属于项目内容）
if (Test-Path $manifestPath) {
  if ($DryRun) { Step "  将删除 .baton/manifest.json" } else { Remove-Item $manifestPath -Force; $removed += '.baton/manifest.json' }
}

Step "4/4 项目真相与配置（默认保留）"
if ($RemoveMemory) {
  Write-Host "    -RemoveMemory：将删除 docs/ai_memory/ 与 .baton/config.json（项目真相二次确认删除）"
  if (-not $DryRun) {
    $mem = Join-Path $ProjectRoot 'docs\ai_memory'
    if (Test-Path $mem) { Remove-Item $mem -Recurse -Force; $removed += 'docs/ai_memory/' }
    $cfg = Join-Path $ProjectRoot '.baton\config.json'
    if (Test-Path $cfg) { Remove-Item $cfg -Force; $removed += '.baton/config.json' }
  }
} else {
  Write-Host "    保留 docs/ai_memory/（项目真相）与 .baton/config.json；确认删除请加 -RemoveMemory"
}

if ($DryRun) { Write-Host "DryRun 完成：以上为将要执行的操作，未写任何文件。" }
else { Write-Host "卸载完成：移除 $($removed.Count) 项（$($removed -join '、')）" }
