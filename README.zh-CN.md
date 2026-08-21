# 🥁 Baton — 换个 AI，项目也别失忆

<p align="center">
  <img src="./gittop.png" alt="Baton — 把项目传下去，不必反复解释上下文" width="100%">
</p>

<p align="center">
  <a href="https://github.com/kakadeka/Baton"><img src="https://img.shields.io/github/stars/kakadeka/Baton?style=social" alt="GitHub stars"></a>
  <a href="https://www.npmjs.com/package/@kakadeka/dsh-baton"><img src="https://img.shields.io/npm/v/@kakadeka/dsh-baton?logo=npm" alt="npm version"></a>
  <a href="https://github.com/kakadeka/Baton/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="license"></a>
</p>

<p align="center">
  <strong>简体中文</strong> · <a href="README.md">English</a>
</p>

你有没有经历过这种循环：

> 换了个 AI。它眨眨眼：这个项目做到哪了？
>
> 你深吸一口气，又从盘古开天开始讲。

Baton 就是给 AI 项目准备的接力棒。它把任务、进度、设计规范、踩过的坑和交接记录放进项目，再通过 Git 带到下一台电脑、下一个 AI。

支持 **Codex、Cursor、Claude Code、DeepSeek Harness**。

## 先用 20 秒搞懂：到底在哪里输入？

这个表请先看一眼。真的能少绕半小时。

| 你要输入的东西 | 输入到哪里 | 它在干什么 |
|---|---|---|
| <code>git clone ...</code> | **PowerShell / 终端** | 把 Baton 下载到电脑 |
| <code>baton-install.ps1</code> | **PowerShell / 终端** | 让 AI 认识 Baton |
| <code>Baton init</code> | **AI 聊天框** | 给你当前打开的项目建立记忆 |
| <code>上班啦</code> | **AI 聊天框** | 开始读取进度并继续工作 |

一句话版：

> **终端负责安装，聊天框负责使用。**<br>
> <code>Baton init</code> 不是 Git 命令，别把它塞进 PowerShell，它会一脸无辜地看着你。

## 🛝 新手三步上车

这是推荐路线。第一次用，先只看这一节。

开始前确认电脑里有：

- [Git](https://git-scm.com/downloads)
- [Node.js 18+](https://nodejs.org/)
- Windows：系统自带 PowerShell 5.1 就能用
- macOS / Linux：需要 [PowerShell 7](https://learn.microsoft.com/powershell/scripting/install/installing-powershell)，然后在 <code>pwsh</code> 里运行命令

### 第 1 步：安装 Baton（在终端里）

#### 如果你用 Codex、Cursor 或 Claude Code

打开 **PowerShell**，依次复制下面两行：

~~~powershell
git clone https://github.com/kakadeka/Baton.git "$HOME/Baton"
& "$HOME/Baton/scripts/baton-install.ps1" -Scope User
~~~

就两行。第一行下载，第二行安装。没有隐藏剧情。

这条命令会一次装好 Codex、Cursor、Claude Code 三端的用户级 Skill，所以不用重复跑三遍。

如果你以前已经下载过 <code>$HOME/Baton</code>，不要再 <code>clone</code>。改用：

~~~powershell
git -C "$HOME/Baton" pull --ff-only
& "$HOME/Baton/scripts/baton-install.ps1" -Scope User
~~~

安装完后，**重新打开 AI，或者新建一个会话**。Skill 通常在新会话启动时加载。

#### 如果你用 DeepSeek Harness

在终端里运行：

~~~powershell
npm install -g @deepseek-ai/dsh@latest
dsh plugin --profile web add @kakadeka/dsh-baton
~~~

然后重启 DSH 的 <code>web</code> profile。你用的不是 <code>web</code>？把它换成自己的 profile 名就行。

### 第 2 步：初始化你的项目（在 AI 聊天框里）

用 Codex、Cursor、Claude Code 或 DSH **打开你真正要开发的项目文件夹**。

然后在 **AI 聊天框** 发这句话：

~~~text
Baton init
~~~

注意，是发给 AI，不是发给 PowerShell。

AI 会为当前项目准备 <code>docs/ai_memory/</code>、<code>.baton/config.json</code> 和对应宿主入口。它不会覆盖你已有的项目文档；遇到冲突会停下来说明。

看到项目里出现 <code>docs/ai_memory/</code>，这一步就算成功。

### 第 3 步：开工（还是在 AI 聊天框里）

新建一个 AI 会话，然后说：

~~~text
上班啦
~~~

如果一切正常，AI 会检查 Git、读取最近进度和交接记录，再给你任务表。

恭喜，你已经用完安装教程了。下面都是“想多了解一点再看”的内容。

## 这三步分别做了什么？

~~~text
第 1 步：安装 Baton 到这台电脑
              ↓
第 2 步：给当前项目建立接力记忆
              ↓
第 3 步：让 AI 读取记忆，开始工作
~~~

- **用户级安装**：一台电脑通常只做一次。作用是让 AI 认识 Baton 口令。
- **项目初始化**：每个需要接力的项目做一次。作用是把记忆骨架放进项目。
- **以后工作**：不用再安装。直接说“上班啦”“继续工作”“下班啦”。

只做第 1 步，AI 虽然认识 Baton，但项目还没有自己的长期记忆。<br>
只做项目级手动安装也能用，但新手没必要先走那条路。

## 你的 AI 装到了哪里？

四个工具的日常口令相同，安装落点不同。下面按工具分开写，方便你对号入座。

<a id="install-codex"></a>
### Codex

第 1 步的用户级安装会写入：

~~~text
~/.agents/skills/baton/SKILL.md
~/.agents/skills/baton-lean-review/SKILL.md
~/.agents/skills/baton-debt/SKILL.md
~/.agents/skills/baton-doctor/SKILL.md
~/.agents/skills/baton/version.json
~~~

项目执行 <code>Baton init</code> 后，还会得到 <code>AGENTS.md</code> 和 <code>.agents/skills/baton/</code> 等项目入口。

<a id="install-cursor"></a>
### Cursor

第 1 步的用户级安装会写入：

~~~text
~/.cursor/skills/baton/SKILL.md
~/.cursor/skills/baton-lean-review/SKILL.md
~/.cursor/skills/baton-debt/SKILL.md
~/.cursor/skills/baton-doctor/SKILL.md
~/.cursor/skills/baton/version.json
~~~

项目执行 <code>Baton init</code> 后，还会得到 <code>.cursorrules</code>、<code>.cursor/rules/baton.mdc</code> 和 <code>.cursor/skills/baton/</code>。

<a id="install-claude"></a>
### Claude Code

第 1 步的用户级安装会写入：

~~~text
~/.claude/skills/baton/SKILL.md
~/.claude/skills/baton-lean-review/SKILL.md
~/.claude/skills/baton-debt/SKILL.md
~/.claude/skills/baton-doctor/SKILL.md
~/.claude/skills/baton/version.json
~~~

项目执行 <code>Baton init</code> 后，还会得到 <code>CLAUDE.md</code> 和 <code>.claude/skills/baton/</code>。

<a id="install-dsh"></a>
### DeepSeek Harness

DSH 的第 1 步叫 **profile 级插件安装**：

~~~powershell
dsh plugin --profile web add @kakadeka/dsh-baton
~~~

它会给这个 profile 安装 19 个原生 <code>baton_*</code> 工具。第 2 步仍然要在目标项目的 AI 聊天框说：

~~~text
Baton init
~~~

profile 插件属于这台电脑，不会跟着项目 Git 跑到另一台电脑；项目记忆会。

## 手动项目级安装（备用路线）

绝大多数新手不需要这一节。只有下面两种情况再用：

- AI 没有识别 <code>Baton init</code>
- 你明确想从终端初始化项目

先进入你的项目，再运行安装脚本：

~~~powershell
cd C:\你的项目路径
& "$HOME/Baton/scripts/baton-install.ps1" -Scope Project -ProjectRoot (Get-Location).Path
~~~

这和在聊天框说 <code>Baton init</code> 的目标相同：给**当前项目**创建记忆和四端适配器。两种方式选一种即可，不需要叠加施法。

如果 <code>$HOME/Baton</code> 还不存在，请先完成新手教程第 1 步。

## 第一次提交前，先看一眼 Git

Baton 靠 Git 把项目记忆带到下一台电脑。已有 Git 仓库不需要重复初始化。

如果这是一个全新项目，可以在终端运行：

~~~powershell
git init
git status
~~~

先用 <code>git status</code> 看清楚哪些文件会被提交，再决定什么时候 <code>git add</code> 和 <code>git commit</code>。不建议闭眼 <code>git add -A</code>，毕竟惊喜应该留给生日，不该留给 Git。

## 常用口令

这些都发到 **AI 聊天框**，不是终端。

| 你说 | Baton 会做什么 |
|---|---|
| <code>上班啦</code> | 检查 Git、读取交接和任务，给出任务表 |
| <code>继续工作</code> | 从上次唯一下一步继续，不从头考古 |
| <code>完成</code> | 把任务转为待验收；你确认后才算已完成 |
| <code>更新项目文档</code> | 保存当前进度和交接，不做全天收尾 |
| <code>这个坑记下来</code> | 把已验证的坑写进长期记忆 |
| <code>这个决策记下来</code> | 保存技术决策和取舍 |
| <code>下班啦</code> | 验证、记录、提交、推送，并核对远端 SHA |
| <code>检查更新</code> | 只读检查 Baton 是否有新版 |
| <code>更新 Baton</code> | 经确认后更新，并核对是否真的生效 |
| <code>修复 Baton</code> | 更新官方 Baton，并重装当前项目镜像、迁移骨架、执行 init/Doctor 后验；不修改业务代码 |

英文环境可以使用 <code>clock in</code>、<code>continue work</code>、<code>complete task</code>、<code>clock out</code> 等对应口令。

## 换电脑或换 AI

### 换 AI，不换项目

直接用另一个 AI 打开同一个项目，然后说：

~~~text
继续工作
~~~

Codex、Cursor、Claude Code 会读取项目里的 Skill 和 <code>docs/ai_memory/</code>。DSH 还要求当前电脑的对应 profile 已安装插件。

### 换电脑

1. 在新电脑安装 Git 和你要用的 AI。
2. <code>git clone</code> **你自己的项目**。
3. 用 AI 打开项目，说“上班啦”或“继续工作”。

这里 clone 的是你的项目，不是 Baton 安装仓库。<br>
如果新电脑还没有用户级 Skill，可重做第 1 步；DSH 必须在新电脑重新安装 profile 插件。

## 项目里会多出什么？

~~~text
你的项目/
├── AGENTS.md                       # Codex 入口
├── CLAUDE.md                       # Claude Code 入口
├── .cursorrules                    # Cursor 兼容入口
├── .agents/skills/baton/           # Codex 项目 Skill
├── .claude/skills/baton/           # Claude Code 项目 Skill
├── .cursor/skills/baton/           # Cursor 项目 Skill
├── .cursor/rules/baton.mdc         # Cursor 现代规则
├── docs/ai_memory/                 # 会跟 Git 走的长期项目记忆
└── .baton/
    ├── config.json                 # 入 Git：项目门禁与路由配置
    ├── manifest.json               # 入 Git：安装器管理文件清单
    ├── version.json                # 不入 Git：本机版本锚
    └── local/                      # 不入 Git：本机临时数据
~~~

重点：<code>.baton/</code> 不是整个目录都忽略。<code>config.json</code> 和 <code>manifest.json</code> 应进入 Git；<code>version.json</code>、<code>local/</code> 和私有扫描清单不进入 Git。

## 四个宿主并不是完全一样

| 能力 | Codex / Cursor / Claude Code | DeepSeek Harness |
|---|---|---|
| 项目记忆、任务、交接 | Skill + Markdown/JSON | 同一套项目文件 |
| Git 操作 | AI 按 Skill 调用宿主命令 | 原生工具编排 |
| <code>baton_*</code> 原生工具 | 没有，按 Skill 做等价流程 | 有，当前组合包提供 19 个 |
| 单写入者保护 | 文件/Git 级规则，不能冒充原子锁 | 插件可提供更强机械门禁 |
| 实际模型与授权证据 | 宿主不提供时如实记 <code>unknown</code> | 可使用 DSH 宿主事件与授权服务 |

共同点是项目记忆和工作流程；不同点是自动化和机械保证。Baton 不会假装四个平台底层能力一模一样。

## 更新与卸载

### 更新

最省心：在 AI 聊天框说 <code>检查更新</code>。确认有新版后再说 <code>更新 Baton</code>。

如果某个业务项目遇到已由 Baton 官方修复的 Bug，直接在该项目聊天框说 <code>修复 Baton</code>。Baton 会更新官方来源，重装用户级和当前项目级 Skill，必要时做不删除历史的迁移，然后执行 <code>Baton init</code> 与 Doctor 后验。业务项目不应复制、修改或维护 Baton 源码；如果官方还没有包含修复的新版本，正确结果是等待发布，而不是现场打补丁。

想自己更新也可以在终端运行：

~~~powershell
git -C "$HOME/Baton" pull --ff-only
& "$HOME/Baton/scripts/baton-install.ps1" -Scope User
~~~

更新后新建 AI 会话；DSH 更新插件后重启对应 profile。只有全局 Skill、项目 Skill 镜像、项目版本锚、报告脚本路径和 init/Doctor 都对齐，才算更新完成。

### 项目级安全卸载

先演练，不写文件：

~~~powershell
& "$HOME/Baton/scripts/baton-uninstall.ps1" -ProjectRoot "C:\你的项目路径" -DryRun
~~~

确认输出后去掉 <code>-DryRun</code>。默认保留 <code>docs/ai_memory/</code> 与 <code>.baton/config.json</code>；只有显式加 <code>-RemoveMemory</code> 才会删除项目记忆。

当前卸载脚本只处理项目级文件，不会删除用户级 Skill。删除用户级安装时，只删除下面三个根目录里的 <code>baton</code>、<code>baton-lean-review</code>、<code>baton-debt</code>、<code>baton-doctor</code> 子目录，别把整个 <code>skills</code> 文件夹一锅端：

- <code>~/.agents/skills/</code>
- <code>~/.cursor/skills/</code>
- <code>~/.claude/skills/</code>

DSH profile 卸载：

~~~powershell
dsh plugin --profile web remove @kakadeka/dsh-baton
~~~

## 卡住了？先看这里

### <code>git clone</code> 说 <code>$HOME/Baton</code> 已存在

说明以前下载过。不要重复 clone，运行更新命令：

~~~powershell
git -C "$HOME/Baton" pull --ff-only
~~~

如果它不是 Git 仓库，先确认里面有没有重要文件，再手动改名。Baton 不会替你覆盖它。

### <code>baton-install.ps1</code> 不存在

通常是第 1 步的 <code>git clone</code> 没成功。先看终端上方的 Git 报错，不要直接跳到第二行。

### macOS / Linux 提示 <code>pwsh</code> 不存在

先安装 PowerShell 7，再进入 <code>pwsh</code> 执行教程里的 PowerShell 命令。

### 安装成功，但 <code>Baton init</code> 没反应

1. 新建 AI 会话或重启 DSH profile。
2. 检查对应的用户级 <code>SKILL.md</code> 是否存在。
3. 确认 AI 打开的是你的项目目录，不是 <code>$HOME/Baton</code> 安装目录。
4. 明确告诉 AI：“请按 Baton skill 执行 <code>Baton init</code>。”

### <code>git pull --ff-only</code> 说无法快进

Baton 会停下来，不会偷偷 rebase、reset 或覆盖修改。先运行：

~~~powershell
git -C "$HOME/Baton" status
~~~

看清楚差异后再决定，不要为了更新安装器直接 <code>reset --hard</code>。

### “下班啦”但没有 push 成功

只有 <code>git push</code> 成功，而且远端 SHA 等于本地 HEAD，Baton 才应该报告“下班完成”。网络、权限或分支保护失败时，正确答案就是“还没完成”，不许演。

## 安全底线

- 不 force push，不 <code>reset --hard</code>，不危险 <code>clean</code>，不偷偷 rebase。
- 同步默认只允许 <code>ff-only</code>；遇到分叉先停。
- API Key、Token、密码和私钥不写进 Git、项目记忆、报表或交接。
- 历史只追加，或者明确标记“已取代”。
- 公开仓库只包含 Baton 运行所需文件，不包含你项目里的 <code>docs/ai_memory/</code>。

## 仓库与许可证

- GitHub：<https://github.com/kakadeka/Baton>
- npm：[@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- License：[Apache-2.0](./LICENSE)

**Pass your project, not your context.** 🥁
