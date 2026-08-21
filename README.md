<!-- baton-src: README.zh-CN.md sha256:718df7f0a379 status:current -->

# 🥁 Baton — Switch AI, Not Your Project Memory

<p align="center">
  <img src="./gittop.png" alt="Baton — pass the project, not the context" width="100%">
</p>

<p align="center">
  <a href="https://github.com/kakadeka/Baton"><img src="https://img.shields.io/github/stars/kakadeka/Baton?style=social" alt="GitHub stars"></a>
  <a href="https://www.npmjs.com/package/@kakadeka/dsh-baton"><img src="https://img.shields.io/npm/v/@kakadeka/dsh-baton?logo=npm" alt="npm version"></a>
  <a href="https://github.com/kakadeka/Baton/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="license"></a>
</p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> · <strong>English</strong>
</p>

You switch to another AI. It looks at your project and asks:

> So... what were we doing?

You sigh and retell the entire story from the invention of electricity.

Baton is a relay baton for AI-assisted projects. It keeps tasks, progress, design rules, lessons learned, and handoffs inside your project, then carries them to another computer or AI through Git.

It supports **Codex, Cursor, Claude Code, and DeepSeek Harness**.

## The 20-second explanation: where do I type things?

Read this table first. It may save you half an hour of creative confusion.

| What you type | Where you type it | What it does |
|---|---|---|
| <code>git clone ...</code> | **PowerShell / terminal** | Downloads Baton |
| <code>baton-install.ps1</code> | **PowerShell / terminal** | Teaches your AI about Baton |
| <code>Baton init</code> | **AI chat** | Adds Baton memory to the project you opened |
| <code>clock in</code> | **AI chat** | Reads the project state and starts work |

The one-line version:

> **The terminal installs Baton. The AI chat uses Baton.**<br>
> <code>Baton init</code> is not a Git command. PowerShell has no idea what you mean.

## 🛝 Beginner quick start: three steps

This is the recommended path. On your first visit, this is the only section you need.

Before you start, install:

- [Git](https://git-scm.com/downloads)
- [Node.js 18+](https://nodejs.org/)
- Windows: the built-in Windows PowerShell 5.1 works
- macOS / Linux: install [PowerShell 7](https://learn.microsoft.com/powershell/scripting/install/installing-powershell), then run the commands inside <code>pwsh</code>

### Step 1: Install Baton in your terminal

#### If you use Codex, Cursor, or Claude Code

Open **PowerShell** and run these two lines:

~~~powershell
git clone https://github.com/kakadeka/Baton.git "$HOME/Baton"
& "$HOME/Baton/scripts/baton-install.ps1" -Scope User
~~~

That is it. The first line downloads Baton. The second installs it. No side quest.

One run installs the user-level Skills for Codex, Cursor, and Claude Code together. Do not run it three times.

Already have <code>$HOME/Baton</code>? Do not clone it again. Update it instead:

~~~powershell
git -C "$HOME/Baton" pull --ff-only
& "$HOME/Baton/scripts/baton-install.ps1" -Scope User
~~~

When installation finishes, **restart your AI or open a new session**. Skills are usually loaded when a session starts.

#### If you use DeepSeek Harness

Run this in your terminal:

~~~powershell
npm install -g @deepseek-ai/dsh@latest
dsh plugin --profile web add @kakadeka/dsh-baton
~~~

Restart the DSH <code>web</code> profile. If you use another profile, replace <code>web</code> with its real name.

### Step 2: Initialize your project in AI chat

Use Codex, Cursor, Claude Code, or DSH to **open the project you actually want to work on**.

Then send this message in the **AI chat**:

~~~text
Baton init
~~~

Send it to the AI, not PowerShell.

The AI prepares <code>docs/ai_memory/</code>, <code>.baton/config.json</code>, and the host entry files for the current project. Existing project documents are not silently overwritten; conflicts stop with an explanation.

When <code>docs/ai_memory/</code> appears in your project, this step worked.

### Step 3: Start work in AI chat

Open a new AI session and say:

~~~text
clock in
~~~

The AI should check Git, read the latest progress and handoff, then show a task table.

Congratulations. You have finished the installation guide. Everything below is optional detail.

## What did those three steps do?

~~~text
Step 1: Install Baton on this computer
                  ↓
Step 2: Add relay memory to this project
                  ↓
Step 3: Read the memory and start working
~~~

- **User-level installation**: usually once per computer. It teaches the AI Baton commands.
- **Project initialization**: once per project that needs handoffs. It adds the memory structure to the project.
- **Normal work**: no more installing. Say <code>clock in</code>, <code>continue work</code>, or <code>clock out</code>.

Step 1 alone lets the AI recognize Baton, but the project still has no long-term memory.<br>
Manual project installation also works, but beginners do not need to start there.

## Where did Baton install for my AI?

The daily commands are shared. The installation paths differ.

<a id="install-codex"></a>
### Codex

The user-level installation creates:

~~~text
~/.agents/skills/baton/SKILL.md
~/.agents/skills/baton-lean-review/SKILL.md
~/.agents/skills/baton-debt/SKILL.md
~/.agents/skills/baton-doctor/SKILL.md
~/.agents/skills/baton/version.json
~~~

After <code>Baton init</code>, the project also has <code>AGENTS.md</code> and <code>.agents/skills/baton/</code>.

<a id="install-cursor"></a>
### Cursor

The user-level installation creates:

~~~text
~/.cursor/skills/baton/SKILL.md
~/.cursor/skills/baton-lean-review/SKILL.md
~/.cursor/skills/baton-debt/SKILL.md
~/.cursor/skills/baton-doctor/SKILL.md
~/.cursor/skills/baton/version.json
~~~

After <code>Baton init</code>, the project also has <code>.cursorrules</code>, <code>.cursor/rules/baton.mdc</code>, and <code>.cursor/skills/baton/</code>.

<a id="install-claude"></a>
### Claude Code

The user-level installation creates:

~~~text
~/.claude/skills/baton/SKILL.md
~/.claude/skills/baton-lean-review/SKILL.md
~/.claude/skills/baton-debt/SKILL.md
~/.claude/skills/baton-doctor/SKILL.md
~/.claude/skills/baton/version.json
~~~

After <code>Baton init</code>, the project also has <code>CLAUDE.md</code> and <code>.claude/skills/baton/</code>.

<a id="install-dsh"></a>
### DeepSeek Harness

For DSH, Step 1 is a **profile-level plugin installation**:

~~~powershell
dsh plugin --profile web add @kakadeka/dsh-baton
~~~

It installs 19 native <code>baton_*</code> tools into that profile. Step 2 is still a message in the AI chat for the target project:

~~~text
Baton init
~~~

The profile plugin stays on this computer. It does not travel through the project Git repository. The project memory does.

## Manual project installation: the backup route

Most beginners do not need this section. Use it only when:

- the AI does not recognize <code>Baton init</code>; or
- you deliberately want to initialize from the terminal.

Enter your project and run:

~~~powershell
cd C:\path\to\your-project
& "$HOME/Baton/scripts/baton-install.ps1" -Scope Project -ProjectRoot (Get-Location).Path
~~~

This has the same goal as saying <code>Baton init</code>: it adds memory and host adapters to the **current project**. Pick one route. You do not need both.

If <code>$HOME/Baton</code> does not exist, complete Step 1 first.

## Before the first commit, look at Git

Baton uses Git to move project memory between computers. Existing Git repositories do not need another <code>git init</code>.

For a brand-new project:

~~~powershell
git init
git status
~~~

Use <code>git status</code> to see what will be committed before choosing when to run <code>git add</code> and <code>git commit</code>. Surprises belong at birthday parties, not in <code>git add -A</code>.

## Everyday commands

Send these to the **AI chat**, not the terminal.

| You say | Baton does |
|---|---|
| <code>clock in</code> | Checks Git, reads the handoff and tasks, then shows a task table |
| <code>continue work</code> | Continues from the last next step instead of excavating the whole project |
| <code>complete task</code> | Moves the task to awaiting acceptance; it is completed only after you accept |
| <code>update project docs</code> | Saves progress and a handoff without ending the workday |
| <code>remember this pitfall</code> | Adds a verified lesson to long-term memory |
| <code>record this decision</code> | Saves a technical decision and its trade-offs |
| <code>clock out</code> | Verifies, records, commits, pushes, and checks the remote SHA |
| <code>check update</code> | Checks for a Baton update without changing anything |
| <code>update baton</code> | Updates after confirmation, then verifies the installed version |

Chinese commands such as <code>上班啦</code>, <code>继续工作</code>, and <code>下班啦</code> are equivalent.

## Switching computers or AI tools

### Another AI, same project

Open the same project with another AI and say:

~~~text
continue work
~~~

Codex, Cursor, and Claude Code read the project Skills and <code>docs/ai_memory/</code>. DSH also needs the plugin installed in the relevant profile on this computer.

### Another computer

1. Install Git and the AI tool on the new computer.
2. <code>git clone</code> **your own project**.
3. Open it with the AI and say <code>clock in</code> or <code>continue work</code>.

This time you clone your project, not the Baton installer repository.<br>
If the new computer has no user-level Skills, repeat Step 1. DSH always needs its profile plugin installed on each computer.

## What appears in my project?

~~~text
your-project/
├── AGENTS.md                       # Codex entry
├── CLAUDE.md                       # Claude Code entry
├── .cursorrules                    # Cursor compatibility entry
├── .agents/skills/baton/           # Codex project Skill
├── .claude/skills/baton/           # Claude Code project Skill
├── .cursor/skills/baton/           # Cursor project Skill
├── .cursor/rules/baton.mdc         # Modern Cursor rule
├── docs/ai_memory/                 # Long-term project memory tracked by Git
└── .baton/
    ├── config.json                 # tracked: project gates and routing
    ├── manifest.json               # tracked: installer-managed file hashes
    ├── version.json                # ignored: local version anchor
    └── local/                      # ignored: local temporary data
~~~

Important: not all of <code>.baton/</code> is ignored. <code>config.json</code> and <code>manifest.json</code> should be tracked. <code>version.json</code>, <code>local/</code>, and private scan patterns stay local.

## The four hosts are not identical

| Capability | Codex / Cursor / Claude Code | DeepSeek Harness |
|---|---|---|
| Project memory, tasks, and handoffs | Skill + Markdown/JSON | The same project files |
| Git operations | The AI invokes host commands under Skill rules | Native tool orchestration |
| Native <code>baton_*</code> tools | No; follows the equivalent Skill workflow | Yes; currently 19 tools |
| Single-writer protection | File/Git rules, not a host-level atomic lock | Stronger mechanical gates from the plugin |
| Model identity and approval evidence | Recorded as <code>unknown</code> when the host does not expose it | Can use DSH host events and approval services |

The project memory and workflow are shared. The automation and mechanical guarantees are not. Baton does not pretend that four different hosts have identical internals.

## Updating and uninstalling

### Update

The easy route: say <code>check update</code> in AI chat. If an update exists, say <code>update baton</code>.

To update manually in the terminal:

~~~powershell
git -C "$HOME/Baton" pull --ff-only
& "$HOME/Baton/scripts/baton-install.ps1" -Scope User
~~~

Open a new AI session afterward. Restart the DSH profile after updating its plugin.

### Safe project uninstall

Preview first without writing:

~~~powershell
& "$HOME/Baton/scripts/baton-uninstall.ps1" -ProjectRoot "C:\path\to\your-project" -DryRun
~~~

Remove <code>-DryRun</code> after reviewing the output. Project memory in <code>docs/ai_memory/</code> and <code>.baton/config.json</code> is preserved by default. Only <code>-RemoveMemory</code> removes it.

The current uninstall script handles project-level files only. To remove user-level Skills, delete only the <code>baton</code>, <code>baton-lean-review</code>, <code>baton-debt</code>, and <code>baton-doctor</code> subdirectories below. Do not delete the entire <code>skills</code> directory:

- <code>~/.agents/skills/</code>
- <code>~/.cursor/skills/</code>
- <code>~/.claude/skills/</code>

Remove the DSH profile plugin with:

~~~powershell
dsh plugin --profile web remove @kakadeka/dsh-baton
~~~

## Stuck? Start here

### <code>git clone</code> says <code>$HOME/Baton</code> already exists

You downloaded it before. Do not clone it again:

~~~powershell
git -C "$HOME/Baton" pull --ff-only
~~~

If that directory is not a Git repository, inspect it for important files and rename it manually. Baton does not overwrite it for you.

### <code>baton-install.ps1</code> does not exist

The Step 1 clone probably failed. Read the Git error above it instead of skipping straight to the second command.

### macOS or Linux says <code>pwsh</code> does not exist

Install PowerShell 7, enter <code>pwsh</code>, and then run the PowerShell commands from this guide.

### Installation worked, but <code>Baton init</code> does nothing

1. Open a new AI session or restart the DSH profile.
2. Check that the user-level <code>SKILL.md</code> exists for your AI.
3. Confirm that the AI opened your project, not the <code>$HOME/Baton</code> installer directory.
4. Tell the AI: “Use the Baton skill to run <code>Baton init</code>.”

### <code>git pull --ff-only</code> cannot fast-forward

Baton stops. It does not secretly rebase, reset, or overwrite changes. Inspect the installer repository:

~~~powershell
git -C "$HOME/Baton" status
~~~

Understand the difference before choosing a fix. Do not use <code>reset --hard</code> just to update the installer.

### <code>clock out</code> did not push

Baton should report a completed clock-out only when <code>git push</code> succeeds and the remote SHA equals local HEAD. Network, permission, credential, or branch-protection failures mean “not finished yet.” No acting.

## Safety floor

- No force push, <code>reset --hard</code>, dangerous <code>clean</code>, or surprise rebase.
- Synchronization defaults to <code>ff-only</code>; divergence stops the workflow.
- API keys, tokens, passwords, and private keys stay out of Git, project memory, reports, and handoffs.
- History is append-only or explicitly marked as superseded.
- The public Baton repository contains runtime files only, never your project's <code>docs/ai_memory/</code>.

## Repository and license

- GitHub: <https://github.com/kakadeka/Baton>
- npm: [@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- License: [Apache-2.0](./LICENSE)

**Pass your project, not your context.** 🥁
