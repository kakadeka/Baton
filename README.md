<!-- baton-src: README.zh-CN.md sha256:32b7252025e2 status:current -->
# 🥁 Baton — Pass the project, not the repeated explanation

<p align="center">
  <img src="./gittop.png" alt="Baton — Pass the project, not the repeated explanation" width="100%">
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
  <a href="README.zh-CN.md">简体中文</a> · <strong>English</strong>
</p>

Baton is an AI project handoff system built from **skills, project-local Markdown/JSON, and Git**. It lets Codex, Cursor, Claude Code, and DeepSeek Harness continue from the same tasks, memory, design specifications, and handoff records.

Baton does not replace Git, and its mechanical guarantees are not identical on every AI host. DeepSeek Harness installs a native plugin with 19 `baton_*` tools. Codex, Cursor, and Claude Code follow the equivalent workflow through skills and project rules; their automation still depends on host capabilities, permissions, network access, and Git credentials.

## Contents

- [Choose an installation level](#choose-level)
- [Prerequisites](#prerequisites)
- [Install for Codex](#install-codex)
- [Install for Cursor](#install-cursor)
- [Install for Claude Code](#install-claude)
- [Install for DeepSeek Harness](#install-dsh)
- [First run and verification](#first-run)
- [Switch computers or AI tools](#switch-host)
- [Common commands](#commands)
- [Project files and capability boundaries](#truth-and-capabilities)
- [Update, uninstall, and troubleshooting](#maintenance)

<a id="choose-level"></a>
## Choose an installation level

Decide which problem you want to solve before installing.

| Level | Use it when | What it does | What it does not do |
|---|---|---|---|
| **User-level** | You want the AI tools on this computer to recognize Baton commands in any project | Installs the main Baton skill and three read-only specialist skills under your user directory | Does not create `docs/ai_memory/` in a project and does not give that project Git-synced memory |
| **Project-level** | One project must be handed between computers or AI tools | Creates the memory skeleton, config, three skill mirrors, and host entry rules inside the project | Does not install Git, an AI application, or a DeepSeek Harness profile plugin |
| **Both** | This is your regular computer and the project needs long-term handoff | User-level makes Baton discoverable everywhere; project-level gives this project portable memory | — |

Recommended: install user-level once on your regular computer, then install project-level once in each real project that needs handoff.

> Codex, Cursor, and Claude Code use the same user-level command. One run installs the skills for all three tools. The sections below repeat the command so a first-time user can stay inside the section for their tool; do not run it three times.

<a id="prerequisites"></a>
## Prerequisites

| Environment | Requirements |
|---|---|
| Windows | Git and Node.js 18+. The built-in Windows PowerShell 5.1 can run the installer; PowerShell 7 also works |
| macOS / Linux | Git, Node.js 18+, and PowerShell 7. Run the PowerShell commands below from `pwsh` |
| DeepSeek Harness | Node.js 18+. If the DSH CLI is missing, run `npm install -g @deepseek-ai/dsh@latest` |

Check your environment:

```powershell
git --version
node --version
$PSVersionTable.PSVersion
```

If Git is missing, install it from [git-scm.com](https://git-scm.com/downloads). On Windows, reopen PowerShell after installation.

The bootstrap commands below place the Baton source checkout at `$HOME/Baton`. If that directory is already a Baton Git checkout, only an `ff-only` update is allowed. If a non-Git directory already uses that name, the command stops and asks you to move or rename it; it never overwrites the directory.

<a id="install-codex"></a>
## Install for Codex

### Codex user-level installation

Use this when you want Codex on this computer to recognize commands such as `clock in` and `continue work` in any project.

Paste this complete line into PowerShell:

```powershell
$baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton exists but is not a Git checkout. Move or rename it, then retry." } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Could not download or update Baton. Check the Git error above.' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope User
```

Codex-related output:

- `~/.agents/skills/baton/SKILL.md`
- `~/.agents/skills/baton-lean-review/SKILL.md`
- `~/.agents/skills/baton-debt/SKILL.md`
- `~/.agents/skills/baton-doctor/SKILL.md`
- `~/.agents/skills/baton/version.json`

Start a new Codex task or session after installation so skills are reloaded. User-level installation teaches Codex about Baton but does not modify the current project.

### Codex project-level installation

Use this when the project needs durable memory that travels through Git.

Enter the project directory, then paste the second line:

```powershell
cd C:\path\to\your-project
$project = (Get-Location).Path; $baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton exists but is not a Git checkout. Move or rename it, then retry." } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Could not download or update Baton. Check the Git error above.' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope Project -ProjectRoot $project
```

On macOS or Linux, replace the first line with your path, for example `cd /Users/me/my-project`.

Codex-related project files include `AGENTS.md`, `.agents/skills/baton/`, `docs/ai_memory/`, and `.baton/config.json`. The installer also creates the Cursor and Claude Code adapters so the project can switch tools later.

<a id="install-cursor"></a>
## Install for Cursor

### Cursor user-level installation

Use this when you want Cursor on this computer to discover Baton in any project.

Paste this complete line into PowerShell:

```powershell
$baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton exists but is not a Git checkout. Move or rename it, then retry." } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Could not download or update Baton. Check the Git error above.' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope User
```

Cursor-related output:

- `~/.cursor/skills/baton/SKILL.md`
- `~/.cursor/skills/baton-lean-review/SKILL.md`
- `~/.cursor/skills/baton-debt/SKILL.md`
- `~/.cursor/skills/baton-doctor/SKILL.md`
- `~/.cursor/skills/baton/version.json`

Restart Cursor or open a new Agent session after installation. User-level installation does not create project memory.

### Cursor project-level installation

```powershell
cd C:\path\to\your-project
$project = (Get-Location).Path; $baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton exists but is not a Git checkout. Move or rename it, then retry." } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Could not download or update Baton. Check the Git error above.' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope Project -ProjectRoot $project
```

Cursor-related project files include `.cursorrules`, `.cursor/rules/baton.mdc`, `.cursor/skills/baton/`, `docs/ai_memory/`, and `.baton/config.json`. If a non-Baton `.cursor/rules/baton.mdc` already exists, the installer skips it instead of overwriting it.

<a id="install-claude"></a>
## Install for Claude Code

### Claude Code user-level installation

Use this when you want Claude Code on this computer to discover the Baton skill in any project.

Paste this complete line into PowerShell:

```powershell
$baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton exists but is not a Git checkout. Move or rename it, then retry." } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Could not download or update Baton. Check the Git error above.' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope User
```

Claude Code-related output:

- `~/.claude/skills/baton/SKILL.md`
- `~/.claude/skills/baton-lean-review/SKILL.md`
- `~/.claude/skills/baton-debt/SKILL.md`
- `~/.claude/skills/baton-doctor/SKILL.md`
- `~/.claude/skills/baton/version.json`

Open a new Claude Code session after installation. User-level installation does not create `CLAUDE.md` or project memory.

### Claude Code project-level installation

```powershell
cd C:\path\to\your-project
$project = (Get-Location).Path; $baton = Join-Path $HOME 'Baton'; if (Test-Path (Join-Path $baton '.git')) { git -C $baton pull --ff-only } elseif (Test-Path $baton) { throw "$baton exists but is not a Git checkout. Move or rename it, then retry." } else { git clone https://github.com/kakadeka/Baton.git $baton }; if ($LASTEXITCODE -ne 0) { throw 'Could not download or update Baton. Check the Git error above.' }; & (Join-Path $baton 'scripts\baton-install.ps1') -Scope Project -ProjectRoot $project
```

Claude Code-related project files include `CLAUDE.md`, `.claude/skills/baton/`, `docs/ai_memory/`, and `.baton/config.json`. The installer updates only the marker-bounded Baton entry inside `CLAUDE.md`; it does not overwrite unrelated content.

<a id="install-dsh"></a>
## Install for DeepSeek Harness

DeepSeek Harness has two levels: install the plugin into a DSH profile, then run `Baton init` in each project that needs Baton memory.

DSH does not use the user-level skill directories used by Codex, Cursor, and Claude Code. Its closest equivalent to user-level installation is **profile-level plugin installation**.

### DSH profile-level installation

If the DSH CLI is not installed:

```powershell
npm install -g @deepseek-ai/dsh@latest
```

Install Baton into the `web` profile:

```powershell
dsh plugin --profile web add @kakadeka/dsh-baton
```

If you use `tui`, `headless`, or a custom profile, replace `web` with the real profile name. Restart that DSH profile after installation. This supplies 19 native `baton_*` tools, but it does not initialize a project yet.

You can also install directly from GitHub:

```powershell
dsh plugin --profile web add github:kakadeka/Baton
```

### DSH project-level initialization

1. Start DSH with the target project as the working directory.
2. In a new conversation, say:

```text
Baton init
```

3. Confirm that `docs/ai_memory/`, `.baton/config.json`, and the host entry files appear in the project.

A DSH profile plugin does not travel with the project repository. Install the plugin again for the corresponding profile on every computer. Project memory and config should travel through the project's Git repository.

<a id="first-run"></a>
## First run and verification

### 1. Confirm that the project is a Git repository

Baton's sync, handoff, and remote-SHA verification require Git. If the installer reports that `.git` is missing, review the files to be committed, then initialize the repository:

```powershell
git init
git add -A
git commit -m "init: add Baton project memory"
```

If Git asks for your name and email, configure them as instructed and retry the commit. Do not run `git init` again in an existing repository.

### 2. Start a new AI session

Skills and project rules are normally loaded when a session starts. Open a new Codex, Cursor, or Claude Code session, or restart the DSH profile.

### 3. Say the command

```text
clock in
```

In a Chinese session, you can say `上班啦` instead. Success should show the branch, HEAD, working-tree state, sync result, latest handoff, and a task table. Exact formatting can differ by host.

> With user-level installation only, the AI can recognize Baton, but the project still lacks the full memory skeleton. For durable handoff, install project-level or say `Baton init`.

<a id="switch-host"></a>
## Switch computers or AI tools

### The project already has project-level installation

1. Install Git and the AI tool you want on the new computer.
2. Clone your project.
3. Open a new session in the project and say `clock in` or `continue work`.

`docs/ai_memory/`, the three project skill mirrors, and the entry rules travel through Git. Codex, Cursor, and Claude Code normally do not need user-level installation again for that project.

DeepSeek Harness is the exception: project memory travels through Git, but the DSH profile plugin must be installed separately on every computer/profile.

### The computer only has user-level installation

User-level skills do not write project memory into Git. They cannot restore tasks and handoffs on another computer by themselves. Add project-level installation to every project that needs durable handoff.

<a id="commands"></a>
## Common commands

| Command | Purpose |
|---|---|
| `clock in` / `start work` | Check Git and sync state, read the handoff and todos, then show a task table |
| `continue work` / `resume` | Restore the current task, handoff tail, and single next step |
| `complete task` | Move the current task to awaiting acceptance; it becomes completed only after explicit user acceptance |
| `clock out` / `end work` | Verify, update docs, commit, push, and compare the remote SHA. Network or credential failure must be reported as incomplete |
| `update project docs` | Write the current progress and a handoff checkpoint without a full workday closeout |
| `save design spec` | Save user-confirmed design facts for future UI work |
| `remember this pitfall` | Store a verified pitfall in long-term memory and the index |
| `record this decision` | Store a technical decision, trade-offs, and validation boundary |
| `Baton init` | Initialize project memory, config, and three host adapters |
| `check update` | Read-only comparison of local version anchors with the latest GitHub/npm version |
| `update baton` | After confirmation, update the source/package, rerun installation, and verify the installed version |

<a id="truth-and-capabilities"></a>
## Project files and capability boundaries

### What project-level installation creates

```text
your-project/
├── AGENTS.md                       # Codex entry segment
├── CLAUDE.md                       # Claude Code entry segment
├── .cursorrules                    # Cursor compatibility entry
├── .agents/skills/baton/           # Codex project skill mirror
├── .claude/skills/baton/           # Claude Code project skill mirror
├── .cursor/skills/baton/           # Cursor project skill mirror
├── .cursor/rules/baton.mdc         # Cursor modern rule
├── docs/ai_memory/                 # Git-synced long-term project truth
│   ├── current.md
│   ├── handoff_current.md
│   ├── overview.md
│   ├── state/
│   ├── tasks/
│   ├── knowledge/
│   └── ui_spec/
└── .baton/
    ├── config.json                 # Exception: commit this project gate/routing config
    ├── version.json                # Local version anchor, ignored
    ├── manifest.json               # Managed-file hashes; commit for cross-machine safe uninstall
    └── local/                      # Local metrics and temporary evidence, ignored
```

`.baton/` is not entirely ignored. Commit `config.json` and `manifest.json`; ignore `version.json`, `local/`, private scan lists, and other machine-local files.

### Capability differences between hosts

| Capability | Codex / Cursor / Claude Code | DeepSeek Harness |
|---|---|---|
| Project memory, tasks, handoffs, design specs | Skills + Markdown/JSON | The same project files |
| Git sync and remote-SHA verification | The AI invokes host commands according to the skill; permissions, network, and credentials still apply | Native tool orchestration; network and credentials still apply |
| Native `baton_*` tools | No; uses the plugin-free workflow | Yes; the current bundle provides 19 |
| Single-writer lock | File/Git-level rule enforcement; not a host-atomic guarantee | The plugin can provide stronger mechanical gates |
| Approval receipts and actual model identity | Depends on what the host exposes; unknown facts must remain `unknown` | The plugin can use DSH host events and approval services |
| Subagent/model routing | Uses only capabilities actually offered by the current host | Uses only configured and verified DSH providers/models |

Shared workflow does not mean identical mechanical guarantees on all four hosts.

<a id="maintenance"></a>
## Update, uninstall, and troubleshooting

### Update Baton

The simplest method is to tell your AI:

```text
check update
```

Checking is read-only. If a new version exists, say `update baton` after you decide to update. Codex, Cursor, and Claude Code update `$HOME/Baton` and rerun the relevant installer. DSH updates the npm bundle inside the profile. Start a new session or restart DSH afterward.

You can also rerun the user-level or project-level command from this README. The command allows only an `ff-only` update of the Baton source checkout.

### Safe project-level uninstall

Preview first without writing:

```powershell
$baton = Join-Path $HOME 'Baton'; & (Join-Path $baton 'scripts\baton-uninstall.ps1') -ProjectRoot 'C:\path\to\your-project' -DryRun
```

After reviewing the output, remove `-DryRun` to execute. The default keeps `docs/ai_memory/` and `.baton/config.json`. Only explicit `-RemoveMemory` deletes project truth. Managed files changed since installation are kept when their hashes do not match.

The current uninstall script handles **project-level** files only. It does not remove user-level global skills. To remove user-level installation, delete only the `baton`, `baton-lean-review`, `baton-debt`, and `baton-doctor` subdirectories under each of these roots; do not delete the entire `skills` directory:

- `~/.agents/skills/`
- `~/.cursor/skills/`
- `~/.claude/skills/`

Remove the DSH profile plugin with:

```powershell
dsh plugin --profile web remove @kakadeka/dsh-baton
```

### Troubleshooting

#### `baton-install.ps1 is not recognized` or the script file does not exist

You used an old command that invokes the script directly, but `$HOME/Baton` has not been downloaded. Return to the section for your AI tool and copy the complete bootstrap command containing `git clone`.

#### `pwsh` is not recognized

- Windows: open the built-in PowerShell and use the commands beginning with `$baton = ...`; they do not require `pwsh`.
- macOS / Linux: install PowerShell 7, enter `pwsh`, and then run the commands.

#### `$HOME/Baton` exists but is not a Git checkout

The command stops to avoid overwriting the directory. Move or rename that directory, then retry.

#### Installation succeeded, but `clock in` does nothing

1. Start a new AI session or restart the DSH profile.
2. Confirm that the `SKILL.md` path for your AI tool exists.
3. Confirm that the project has project-level installation and `docs/ai_memory/`.
4. Confirm that the repository has a readable Git HEAD; a new repository needs its first commit.
5. Ask the AI to “run `clock in` according to the Baton skill” and check whether it reports a missing skill or insufficient permissions.

#### `git pull --ff-only` reports divergence

The command stops. It does not rebase, reset, or overwrite local work. Inspect `git status` and the branch difference inside `$HOME/Baton` before deciding what to do. Do not use `reset --hard` merely to force installation.

#### Workday closeout did not push successfully

Baton should report closeout complete only after `git push` succeeds and the remote SHA equals local HEAD. Network, permission, credential, or branch-protection failures must be reported as incomplete.

## Safety principles

- No force push, `reset --hard`, risky `clean`, or unauthorized rebase.
- Sync is `ff-only`; divergence stops and reports.
- API keys, tokens, passwords, and private keys must not enter Git, project memory, metrics, or handoffs.
- History is append-only or explicitly marked superseded; old decisions are not silently overwritten.
- Task scope, protected paths, validation evidence, and remote SHA claims must come from real files and command output.
- Non-DSH hosts degrade mechanical guarantees according to platform capability. Documentation and AI responses must not describe rule-level constraints as plugin-level atomic guarantees.

## Repository and license

- GitHub: <https://github.com/kakadeka/Baton>
- npm: [@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- License: [Apache-2.0](./LICENSE)

The public repository contains only the published runtime surface. A user's own `docs/ai_memory/`, internal plans, session records, and credentials are not part of the public package.
