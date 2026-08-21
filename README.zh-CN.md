# 🥁 Baton — 把项目传下去，不必反复解释上下文

<p align="center">
  <img src="./gittop.png" alt="Baton — 把项目传下去，不必反复解释上下文" width="100%">
</p>

<p align="center">
  <a href="https://github.com/kakadeka/Baton"><img src="https://img.shields.io/github/stars/kakadeka/Baton?style=social" alt="GitHub stars"></a>
  <a href="https://www.npmjs.com/package/@kakadeka/dsh-baton"><img src="https://img.shields.io/npm/v/@kakadeka/dsh-baton?logo=npm" alt="npm version"></a>
  <a href="https://github.com/kakadeka/Baton/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="license"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=nodedotjs&logoColor=white" alt="Node.js 18+">
  <img src="https://img.shields.io/badge/git-required-F05032?logo=git&logoColor=white" alt="Git required">
  <img src="https://img.shields.io/badge/PowerShell-5.1%2B-5391FE?logo=powershell&logoColor=white" alt="PowerShell 5.1+">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Windows, macOS and Linux">
</p>

<p align="center">
  <strong>简体中文</strong> · <a href="README.md">English</a>
</p>

Baton 是一个基于 **Skill + 项目内 Markdown/JSON + Git** 的 AI 项目接力系统。它让 Codex、Cursor、Claude Code 和 DeepSeek Harness 从同一套任务、记忆、设计规范与交接记录继续工作。

Baton 不会替代 Git，也不能保证所有 AI 宿主拥有同等级的机械能力。DeepSeek Harness 安装的是带 19 个 `baton_*` 工具的原生插件；Codex、Cursor 和 Claude Code 使用 Skill 与项目规则执行等价流程，具体自动化程度仍受当前宿主、权限、网络和 Git 凭据影响。

## 导航

- [先选安装层级](#choose-level)
- [安装前准备](#prerequisites)
- [Codex 安装](#install-codex)
- [Cursor 安装](#install-cursor)
- [Claude Code 安装](#install-claude)
- [DeepSeek Harness 安装](#install-dsh)
- [第一次使用与验证](#first-run)
- [换电脑或换 AI](#switch-host)
- [常用口令](#commands)
- [目录与能力边界](#truth-and-capabilities)
- [更新、卸载与排错](#maintenance)

<a id="choose-level"></a>
## 先选安装层级

安装前先决定你要解决哪一类问题。

| 安装层级 | 什么时候用 | 会做什么 | 不会做什么 |
|---|---|---|---|
| **用户级** | 希望这台电脑上的 AI 在任意项目里都认识 Baton 口令 | 把 Baton 主 Skill 和 3 个只读专项 Skill 安装到用户目录 | 不会给具体项目创建 `docs/ai_memory/`，也不会让项目自动具备跨电脑记忆 |
| **项目级** | 希望某个项目能被不同电脑或不同 AI 接手 | 在项目内生成记忆骨架、配置、三端 Skill 镜像和入口规则 | 不会替你安装 Git、AI 软件或 DeepSeek Harness profile 插件 |
| **两者都装** | 这是你的常用电脑，而且项目需要长期接力 | 用户级负责“任何项目都认识口令”，项目级负责“这个项目真的有可同步记忆” | — |

推荐做法：常用电脑先装一次用户级；每个需要接力的真实项目再装一次项目级。

> Codex、Cursor、Claude Code 的用户级安装命令相同，而且**执行一次会同时安装三端 Skill**。下面仍按工具分章，是为了让第一次使用的人能直接找到与自己相关的路径和验证方法；不要重复执行三遍。

<a id="prerequisites"></a>
## 安装前准备

| 环境 | 需要准备 |
|---|---|
| Windows | Git、Node.js 18+；系统自带 Windows PowerShell 5.1 可以运行安装脚本，也可以使用 PowerShell 7 |
| macOS / Linux | Git、Node.js 18+；另外安装 PowerShell 7，并在 `pwsh` 里执行下面的 PowerShell 命令 |
| DeepSeek Harness | Node.js 18+；如果还没有 DSH CLI，执行 `npm install -g @deepseek-ai/dsh@latest` |

检查命令：

```powershell
git --version
node --version
$PSVersionTable.PSVersion
```

如果 `git` 不存在，请先从 [git-scm.com](https://git-scm.com/downloads) 安装。Windows 安装完成后要重新打开 PowerShell。

下面的自举命令会把 Baton 源仓放到 `$HOME/Baton`。如果该目录已经是 Baton Git 仓库，只允许 `ff-only` 更新；如果同名目录存在但不是 Git 仓库，命令会停止并告诉你先改名或移走，不会覆盖它。

<a id="install-codex"></a>
## 安装到 Codex

### Codex 用户级安装

适合：希望本机 Codex 在任何项目里都能识别“上班啦”“继续工作”等 Baton 口令。

在 PowerShell 中复制整行：

```powershell
$baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton 已存在但不是 Git 仓库；请先改名或移走该目录，然后重试。" } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Baton 下载或更新失败，请检查上面的 Git 报错。' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope User
```

与 Codex 相关的结果：

- `~/.agents/skills/baton/SKILL.md`
- `~/.agents/skills/baton-lean-review/SKILL.md`
- `~/.agents/skills/baton-debt/SKILL.md`
- `~/.agents/skills/baton-doctor/SKILL.md`
- `~/.agents/skills/baton/version.json`

安装完成后新建一个 Codex 任务或会话，让 Skill 重新加载。用户级安装只让 Codex 认识 Baton，不会改动你当前的项目。

### Codex 项目级安装

适合：这个项目需要保存长期记忆，并随 Git 在不同电脑或 AI 之间同步。

先进入项目目录，再复制第二行：

```powershell
cd C:\你的项目路径
$project = (Get-Location).Path; $baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton 已存在但不是 Git 仓库；请先改名或移走该目录，然后重试。" } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Baton 下载或更新失败，请检查上面的 Git 报错。' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope Project -ProjectRoot $project
```

macOS / Linux 把第一行换成自己的路径，例如 `cd /Users/me/my-project`。

与 Codex 相关的项目文件包括 `AGENTS.md`、`.agents/skills/baton/`、`docs/ai_memory/` 和 `.baton/config.json`。安装器还会同时生成 Cursor 与 Claude Code 的项目适配器，方便以后换工具。

<a id="install-cursor"></a>
## 安装到 Cursor

### Cursor 用户级安装

适合：希望本机 Cursor 在任意项目里都能发现 Baton Skill。

在 PowerShell 中复制整行：

```powershell
$baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton 已存在但不是 Git 仓库；请先改名或移走该目录，然后重试。" } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Baton 下载或更新失败，请检查上面的 Git 报错。' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope User
```

与 Cursor 相关的结果：

- `~/.cursor/skills/baton/SKILL.md`
- `~/.cursor/skills/baton-lean-review/SKILL.md`
- `~/.cursor/skills/baton-debt/SKILL.md`
- `~/.cursor/skills/baton-doctor/SKILL.md`
- `~/.cursor/skills/baton/version.json`

安装后重新打开 Cursor 或新建 Agent 会话。用户级安装不会在项目里创建记忆目录。

### Cursor 项目级安装

```powershell
cd C:\你的项目路径
$project = (Get-Location).Path; $baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton 已存在但不是 Git 仓库；请先改名或移走该目录，然后重试。" } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Baton 下载或更新失败，请检查上面的 Git 报错。' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope Project -ProjectRoot $project
```

与 Cursor 相关的项目文件包括 `.cursorrules`、`.cursor/rules/baton.mdc`、`.cursor/skills/baton/`、`docs/ai_memory/` 和 `.baton/config.json`。如果项目已有非 Baton 的 `.cursor/rules/baton.mdc`，安装器会跳过而不是覆盖。

<a id="install-claude"></a>
## 安装到 Claude Code

### Claude Code 用户级安装

适合：希望本机 Claude Code 在任意项目里都能识别 Baton Skill。

在 PowerShell 中复制整行：

```powershell
$baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton 已存在但不是 Git 仓库；请先改名或移走该目录，然后重试。" } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Baton 下载或更新失败，请检查上面的 Git 报错。' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope User
```

与 Claude Code 相关的结果：

- `~/.claude/skills/baton/SKILL.md`
- `~/.claude/skills/baton-lean-review/SKILL.md`
- `~/.claude/skills/baton-debt/SKILL.md`
- `~/.claude/skills/baton-doctor/SKILL.md`
- `~/.claude/skills/baton/version.json`

安装完成后新建 Claude Code 会话。用户级安装不会给当前项目生成 `CLAUDE.md` 或记忆骨架。

### Claude Code 项目级安装

```powershell
cd C:\你的项目路径
$project = (Get-Location).Path; $baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton 已存在但不是 Git 仓库；请先改名或移走该目录，然后重试。" } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Baton 下载或更新失败，请检查上面的 Git 报错。' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope Project -ProjectRoot $project
```

与 Claude Code 相关的项目文件包括 `CLAUDE.md`、`.claude/skills/baton/`、`docs/ai_memory/` 和 `.baton/config.json`。安装器只更新带 Baton 成对标记的入口段，不覆盖 `CLAUDE.md` 里的其他内容。

<a id="install-dsh"></a>
## 安装到 DeepSeek Harness

DeepSeek Harness 有两个层级：先把插件安装到某个 DSH profile，再在具体项目里执行 `Baton init`。

DSH 不使用 Codex/Cursor/Claude Code 那套“用户级 Skill 目录”；与用户级最接近的是 **profile 级插件安装**。

### DSH profile 级安装

如果还没有 DSH CLI：

```powershell
npm install -g @deepseek-ai/dsh@latest
```

把 Baton 安装到 `web` profile：

```powershell
dsh plugin --profile web add @kakadeka/dsh-baton
```

如果你使用 `tui`、`headless` 或自定义 profile，把 `web` 替换成真实 profile 名。安装后重启对应 DSH profile。这个步骤会提供 19 个原生 `baton_*` 工具，但还没有初始化你的项目。

也可以直接从 GitHub 安装：

```powershell
dsh plugin --profile web add github:kakadeka/Baton
```

### DSH 项目级初始化

1. 用目标项目作为当前工作目录启动 DSH。
2. 在新会话中说：

```text
Baton init
```

3. 初始化完成后检查项目中是否出现 `docs/ai_memory/`、`.baton/config.json` 和三端入口文件。

DSH 的 profile 插件不会随项目 Git 自动复制到另一台电脑；换电脑后要在那台电脑的对应 profile 再安装一次插件。项目级的记忆与配置则应随项目 Git 同步。

<a id="first-run"></a>
## 第一次使用与验证

### 1. 确认项目是 Git 仓库

Baton 的同步、交接和远端 SHA 核验依赖 Git。如果安装器提示没有 `.git`，请先检查将要提交的文件，再初始化：

```powershell
git init
git add -A
git commit -m "init: add Baton project memory"
```

如果 Git 要求姓名和邮箱，按 Git 提示先配置，再重新提交。已有 Git 仓库不要重复执行 `git init`。

### 2. 新建 AI 会话

Skill 与项目规则通常在会话开始时加载。安装完成后，请新建 Codex / Cursor / Claude Code 会话，或重启 DSH profile。

### 3. 说出口令

中文环境：

```text
上班啦
```

英文环境：

```text
clock in
```

成功时应看到分支、HEAD、工作区状态、同步结论、最近交接和任务表。具体格式可能因宿主不同而略有差异。

> 用户级安装但没有项目级安装时，AI 可以认识口令，但项目里还没有完整记忆骨架。要长期接力，请补做项目级安装或说 `Baton init`。

<a id="switch-host"></a>
## 换电脑或换 AI

### 已做过项目级安装

1. 在新电脑安装 Git 和你要使用的 AI 工具。
2. `git clone` 你的项目。
3. 在项目目录新建会话，说“上班啦”或“继续工作”。

项目中的 `docs/ai_memory/`、三端 Skill 镜像与入口规则会随 Git 到新电脑。Codex、Cursor、Claude Code 在这个项目内通常不要求再次做用户级安装。

DeepSeek Harness 例外：项目记忆会跟着 Git，但 DSH profile 插件必须在每台电脑/profile 单独安装。

### 只做过用户级安装

用户级 Skill 不会把项目记忆写进 Git。换电脑或换项目时，无法仅靠用户级安装恢复任务与交接；请对需要接力的项目补做项目级安装。

<a id="commands"></a>
## 常用口令

| 中文口令 | 英文口令 | 作用 |
|---|---|---|
| 上班啦 | `clock in` / `start work` | 检查 Git、同步状态、读取交接与待办并给出任务表 |
| 继续工作 | `continue work` / `resume` | 从当前任务、交接末条与唯一下一步恢复 |
| 完成 | `complete task` | 把当前任务转为待验收；用户明确验收后才进入已完成 |
| 下班啦 | `clock out` / `end work` | 验证、更新文档、提交、推送并核对远端 SHA；网络或凭据失败会明确报告未完成 |
| 更新项目文档 | `update project docs` | 写入当前进度与交接检查点，不执行全天收尾 |
| 保存设计规范 | `save design spec` | 保存用户已确认的设计事实，供后续 UI 任务引用 |
| 这个坑记下来 | `remember this pitfall` | 把已验证坑点写入长期记忆与索引 |
| 这个决策记下来 | `record this decision` | 保存技术决策、取舍与验证边界 |
| Baton init | `Baton init` | 初始化项目记忆、配置和三端适配器 |
| 检查更新 | `check update` | 只读比较本机版本锚与 GitHub/npm 最新版 |
| 更新 Baton | `update baton` | 经确认后更新安装源并重跑安装，再核对版本 |

<a id="truth-and-capabilities"></a>
## 项目真相与能力边界

### 项目级安装会创建什么

```text
你的项目/
├── AGENTS.md                       # Codex 入口段
├── CLAUDE.md                       # Claude Code 入口段
├── .cursorrules                    # Cursor 兼容入口
├── .agents/skills/baton/           # Codex 项目 Skill 镜像
├── .claude/skills/baton/           # Claude Code 项目 Skill 镜像
├── .cursor/skills/baton/           # Cursor 项目 Skill 镜像
├── .cursor/rules/baton.mdc         # Cursor 现代规则
├── docs/ai_memory/                 # 随 Git 同步的长期项目真相
│   ├── current.md
│   ├── handoff_current.md
│   ├── overview.md
│   ├── state/
│   ├── tasks/
│   ├── knowledge/
│   └── ui_spec/
└── .baton/
    ├── config.json                 # 例外：应入 Git，保存项目门禁与路由配置
    ├── version.json                # 本机版本锚，忽略
    ├── manifest.json               # managed 文件 hash，应入 Git，供跨机安全卸载
    └── local/                      # 本机指标与临时证据，忽略
```

`.baton/` 不是“整个目录都不入库”。真实规则是：`config.json` 与 `manifest.json` 入库；`version.json`、`local/`、私有扫描清单等本机文件通过 `.gitignore` 忽略。

### 四个宿主的能力差异

| 能力 | Codex / Cursor / Claude Code | DeepSeek Harness |
|---|---|---|
| 项目记忆、任务、交接、设计规范 | 通过 Skill + Markdown/JSON | 同一套项目文件 |
| Git 同步与远端 SHA 核验 | AI 按 Skill 调用宿主命令；受权限、网络、凭据影响 | 原生工具编排，仍受网络和凭据影响 |
| `baton_*` 原生工具 | 无；按无插件流程执行 | 有，当前组合包提供 19 个 |
| 单写入者锁 | 文件/Git 级规则约束，无法声称宿主级原子保证 | 插件可提供更强机械门禁 |
| 用户授权回执、实际模型身份 | 取决于宿主是否暴露；无法确认时必须记 unknown | 插件可使用 DSH 宿主事件与授权服务 |
| 子 Agent / 模型路由 | 只使用当前宿主真实提供的能力，不跨宿主硬塞模型名 | 只使用已配置且已验证的 DSH provider/model |

所以，“功能流程通用”不等于“四个宿主的机械保证完全相同”。

<a id="maintenance"></a>
## 更新、卸载与排错

### 更新 Baton

最简单的方式是对 AI 说：

```text
检查更新
```

检查更新是只读操作。确认有新版后再说“更新 Baton”。Codex、Cursor、Claude Code 会更新 `$HOME/Baton` 并重跑对应安装；DSH 会更新 profile 内的 npm 组合包。更新后新建会话或重启 DSH profile。

你也可以直接重跑本 README 中对应的用户级或项目级安装命令；命令只允许 `ff-only` 更新 Baton 源仓。

### 项目级安全卸载

先演练，不写文件：

```powershell
$baton = Join-Path $HOME 'Baton'; & (Join-Path $baton 'scripts\baton-uninstall.ps1') -ProjectRoot 'C:\你的项目路径' -DryRun
```

确认输出后，去掉 `-DryRun` 执行。默认保留 `docs/ai_memory/` 与 `.baton/config.json`；只有显式加 `-RemoveMemory` 才会删除项目真相。安装后被你修改过的 managed 文件会因 hash 不一致而保留。

当前卸载脚本只处理**项目级**文件，不会删除用户级全局 Skill。要移除用户级安装，只删除以下三个根目录中名为 `baton`、`baton-lean-review`、`baton-debt`、`baton-doctor` 的子目录；不要删除整个 `skills` 目录：

- `~/.agents/skills/`
- `~/.cursor/skills/`
- `~/.claude/skills/`

DSH profile 卸载：

```powershell
dsh plugin --profile web remove @kakadeka/dsh-baton
```

### 常见问题

#### 报错：`baton-install.ps1 is not recognized` / `脚本文件不存在`

你执行的是旧版、只调用脚本的命令，但 `$HOME/Baton` 尚未下载。请回到对应 AI 章节，复制包含 `git clone` 的完整自举命令。

#### 报错：`pwsh` 不是命令

- Windows：直接打开系统自带 PowerShell，使用本 README 中以 `$baton = ...` 开头的命令；它不要求 `pwsh`。
- macOS / Linux：安装 PowerShell 7 后进入 `pwsh` 再运行命令。

#### `$HOME/Baton` 已存在但不是 Git 仓库

命令会主动停止，避免覆盖同名目录。把该目录改名或移走后重试。

#### 安装成功，但说“上班啦”没有反应

1. 新建 AI 会话或重启 DSH profile。
2. 检查与你的 AI 对应的 `SKILL.md` 是否存在。
3. 检查项目是否做过项目级安装，是否有 `docs/ai_memory/`。
4. 检查项目是否有可读取的 Git HEAD；新仓库需要首次提交。
5. 对 AI 明确说“请按 Baton skill 执行上班啦”，观察它是否报告 Skill 未加载或权限不足。

#### `git pull --ff-only` 报分叉或无法快进

命令会停止，不会 rebase、reset 或覆盖本地修改。先查看 `$HOME/Baton` 的 `git status` 和分支差异，再决定如何处理；不要为了安装强行 `reset --hard`。

#### 下班时没有 push 成功

Baton 只有在 `git push` 成功并且远端 SHA 与本地 HEAD 一致时才应报告“下班完成”。网络、权限、凭据或分支保护失败时，正确结果是明确报告未完成，而不是假装成功。

## 安全原则

- 禁止 force push、`reset --hard`、危险 `clean` 和未授权 rebase。
- 同步只允许 `ff-only`；分叉时停止并报告。
- API Key、Token、密码和私钥不得写入 Git、项目记忆、报表或交接。
- 历史记录只追加，或明确标记“已取代”；不静默覆盖旧决策。
- 任务范围、受保护路径、验证证据与远端 SHA 必须以真实文件和命令输出为准。
- 非 DSH 宿主的机械保证会按平台能力降级，README 与 AI 都不应把规则约束宣传成插件级原子保证。

## 仓库与许可证

- GitHub：<https://github.com/kakadeka/Baton>
- npm：[@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- License：[Apache-2.0](./LICENSE)

公开仓库只包含运行 Baton 所需的发布面。项目自己的 `docs/ai_memory/`、内部计划、会话记录与凭据不属于公开包。
