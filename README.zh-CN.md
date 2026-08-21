# 🥁 Baton — 把你的项目传下去，而不是把你的上下文传下去。

<p align="center">
  <img src="./gittop.png" alt="Baton — 把你的项目传下去，而不是把你的上下文传下去" width="100%">
</p>

<h2 align="center">换电脑、换 AI、换会话，一句话接着干。</h2>

<p align="center">
  <a href="https://github.com/kakadeka/Baton"><img src="https://img.shields.io/github/stars/kakadeka/Baton?style=social" alt="GitHub stars"></a>
  <a href="https://www.npmjs.com/package/@kakadeka/dsh-baton"><img src="https://img.shields.io/npm/v/@kakadeka/dsh-baton?logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@kakadeka/dsh-baton"><img src="https://img.shields.io/npm/dm/@kakadeka/dsh-baton" alt="npm downloads"></a>
  <a href="https://github.com/kakadeka/Baton/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="license"></a>
  <a href="https://bundlephobia.com/package/@kakadeka/dsh-baton"><img src="https://img.shields.io/bundlephobia/minzip/@kakadeka/dsh-baton" alt="bundle size"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/git-required-F05032?logo=git&logoColor=white" alt="git required">
  <img src="https://img.shields.io/badge/pwsh-5.1%2B-5391FE?logo=powershell&logoColor=white" alt="pwsh">
  <img src="https://img.shields.io/badge/DSH-plugin-4D6BFE?logo=deepseek&logoColor=white" alt="DSH plugin">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="platform">
</p>

<p align="center">
  <strong>简体中文</strong> · <a href="README.md">English</a>
</p>

**Baton 是一个「项目接力协作系统」**：让 Claude Code、Codex、Cursor、DeepSeek Harness 这些 AI 在不同电脑上轮流维护**同一个项目**——进度、记忆、设计规范、任务、Git 全部一致，**你只需要说人话，剩下的它自动做**。

**三个核心承诺：**

1. **🔄 谁都能接手**——AI 换着用、电脑换着开，说一句口令就接着干，从不需要重新解释项目
2. **🎯 说好做什么就做什么**——任务范围与受保护路径在收尾时被机械核对，设计事实固化进规范；其余靠规则 + 审查守住，AI 跑偏会被抓住，而不是几小时后才发现
3. **✅ 说"完成"就真的完成**——下班自动 commit + push + 核验 GitHub 远端，绝不出现"本地提交了、GitHub 没有、却告诉你完成了"

---

<a id="quickstart"></a>
## 🚀 快速开始（DeepSeek Harness 用户——一行命令）

> 用 DeepSeek Harness 的话，这一节就够。

```powershell
dsh plugin --profile web add @kakadeka/dsh-baton
```

1. 先装一次 DSH 命令行：`npm i -g @deepseek-ai/dsh`
2. 粘贴上面那行，回车。
3. 重启 `dsh`——完成。19 个 `baton_*` 工具已在你的 profile 里生效。

> 也可以从 GitHub 直接装：`dsh plugin --profile web add github:kakadeka/Baton`
> 用 **Codex / Claude Code / Cursor**？跳到下面的[其他 AI 工具安装](#-其他-ai-工具安装codex--claude--cursor)。

---

## 📖 场景故事（17 个，对照需求清单，痛点 → 答案）

| # | 场景 / 痛点 | Baton 的答案 |
|---|---|---|
| 1 | 每天开工/换电脑：不知道分支、昨天做到哪、远端有没有更新 | 「上班啦」：git 三查 + 安全同步 + 读交接待办 → 任务表回复编号即开始 |
| 2 | 本地 commit 了却没真 push，第二台电脑拉不到；晚上还要手动 git | 「下班啦」：验证 → 文档/记忆/报表 → commit → push → **远端 SHA==本地才算完成** |
| 3 | 完成任务和下班被混为一谈，白天没法逐个收尾 | 「完成」：只关当前任务、记结果、给下一步；完成任务≠下班 |
| 4 | 确认过的设计被 AI 忘记，又开始自由发挥 | 「保存设计规范」：固化长期规范（冲突保留历史），UI 任务自动引用 |
| 5 | 会话丢失/换工具，被迫重新解释项目、重烧 Token | 「继续工作」：一句话恢复任务/分支/卡点/交接/下一步 |
| 6 | 多个待办，AI 擅自定义优先级，重打任务名太累 | 任务表 `1/2/3` 编号选择，单任务直接恢复，无任务明说 |
| 7 | 项目久了历史找不到，全量读又烧 Token | 决策/坑/规范自动索引，查历史先命中索引、只读片段 |
| 8 | Codex/Claude/Cursor 轮班互不知情，重复施工漏约束 | 统一交接本记录一切，谁接手读末条，零重复 |
| 9 | 全程用贵模型烧额度，弱模型又做错，手动切换烦 | 先识别当前 AI 工具，再只用该工具可用的主会话/子 Agent/模型档位；绝不跨宿主硬塞模型名 |
| 10 | 实际跑哪个模型对不上账 | recommended 与 actual 分开记录；可推断项明确标注依据、置信度和“推测”，不冒充宿主实证 |
| 11 | 跑几小时后发现偏离原型、范围膨胀 | 冻结需求 + 允许/保护路径机械核对 + 独立复核 + 危险 Git 全禁 |
| 12 | 改个按钮颜色花一小时 | Micro 快速路径：不派代理、不审查、不跑无关测试，几分钟 |
| 13 | 复杂任务不能乱写 | 按复杂度升级：Contract、强模型、独立 Reviewer、Fidelity、回滚 |
| 14 | 公司/家里代码不同步，怕丢本地改动 | 安全 fetch + ff-only（不覆盖本地）+ 自动 push + SHA 核验 |
| 15 | 选模型靠感觉，没有真实数据 | 月度仪表盘优先展示真实事件；缺失项可按任务元数据给出明确标注的估算区间，并可一键排除估算样本 |
| 16 | 想搬到新项目/分享给别人 | 框架与实例分离，`Baton init` 一键初始化；分享走敏感词扫描（命中即中止导出/发布，绝不外泄） |
| 17 | 外部 Skill 绕过项目规矩 | 外部 Skill 可用但项目边界由 Baton 统一约束，与 AGENTS.md 协调 |

## ✨ 功能全景

| 能力块 | 包含什么 |
|---|---|
| **口令自动化** | 上班啦 / 下班啦 / 继续工作 / 保存设计规范 / 完成 / 更新项目文档 / 记入记忆 / Baton init / 数字确认 / Git 自然语言 |
| **跨 AI / 跨电脑** | 纯文本项目真相（Markdown+JSON）+ 三端薄适配器（Codex/Claude/Cursor 一键装）+ 交接本接力 |
| **长期记忆** | 决策/坑点/设计规范自动归档 + 轻量索引（archive_index）+ 渐进式读取（查历史不重读全库） |
| **防跑偏** | FROZEN 冻结约束 + allowed/protected 路径机械核对 + Forbidden Change 清单 + 独立复核 + 危险 Git 全禁 |
| **Git 真闭环** | ff-only 同步 / 自动 commit+push / **远端 SHA==本地 HEAD 才算完成** / 发布留痕（last_published_sha） |
| **宿主隔离的 Agent 路由** | 先识别 Codex / Claude Code / Cursor / DSH，再只调用当前宿主内置的主会话、子 Agent 与模型档位。DSH 不会收到 Sol/Luna，Codex 也不会收到 DSH 模型 ID；推荐与实际、事实与推测分开记录 |
| **月度报表** | 日期面板 / SVG 趋势折线 / 模型排行 / 按日与代理明细；真实数据优先，缺失值可显示带依据、置信度的估算区间，排行可排除估算样本 |
| **一键验收** | DSH 用户：`baton_accept` 全检查 PASS/FAIL；无插件用户：按 `docs/ai_memory/` 清单逐项核对（骨架/状态/安全/体积） |
| **Lean 精简门** | 任务级 `implementation_policy`（off/lite/full/strict）：strict 模式下新增依赖/文件/抽象有机械预算，超预算收尾会被阻断，直到用户确认例外才放行 |
| **专项 Skills** | `lean-review`（过度工程审查）、`debt`（技术债扫描）、`doctor`（健康诊断：版本/漂移/锁/发布面）——全部只读，随主 skill 一起安装 |
| **凭据卫生** | 所有持久化输入统一扫描，凭据绝不进 Git、记忆、报表或日志 |
| **可信发布** | npm 每次发布带 SLSA provenance（OIDC 可信发布，tag 触发） |

## 🗣️ 口令详解（什么场景下用）

每条口令都有对应的英文触发词（English trigger），说中文或英文都一样；英文环境的 AI（Codex / Claude Code）和英文用户请用英文触发词。

| 口令 | 英文触发词 | 什么时候用 | 会发生什么 |
|---|---|---|---|
| **上班啦** | *clock in / start work* | 每天开工 / 换了电脑 / 换了 AI 想接着干 | git 三查 → 安全同步 → 读交接和待办 → 任务表（回复编号开始；超 7 天未检查更新会顺带提示） |
| **下班啦** | *clock out / end work* | 一天工作结束，要真正收尾 | 验证 → 更新日报/交接/记忆/报表 → commit → push → **远端 SHA 核验** → 报"下班完成/未完成" |
| **继续工作** | *continue work / resume* | 会话丢失 / 新会话 / 换 AI 软件 | 恢复最近任务、分支、卡点、交接末条、下一步 |
| **保存设计规范** | *save design spec* | 你确认了一套设计（颜色/间距/组件/整站风格）后 | 固化为长期规范 + 进索引；以后 UI 任务自动遵守 |
| **完成** | *complete task* | 一个任务做完了，还要继续别的 | 只关当前任务、记结果、给下一步；不触发全天收尾 |
| **更新项目文档** | *update project docs* | 干到一半想存个盘 / 要切换上下文 | 进度写入日报+交接检查点（不释放工作区），随时可继续 |
| **这个坑记下来 / 这个决策记下来** | *remember this pitfall / record this decision* | 踩了个坑 / 做了个重要决策 | 写入长期记忆 + 自动索引，以后换谁都能查到 |
| **Baton init** | *Baton init* | 新项目第一次接入 | 生成记忆骨架 + 配置（绝不覆盖已有文件） |
| **1 / 2 / 3** | *reply the number* | 任务表出现后选择 | 编号被持久化为当前任务，随后开始执行 |
| **释放工作区** | *release workspace / I confirm the previous agent stopped* | 上班时遇到持有冲突 | 解除单写入者锁 + 写交接释放条目 |
| **拉取github / 同步github / 看看git状态** | *pull github / sync github / check git status* | 想手动操作 Git 时 | 走轻量 Git 路径，不建契约不启动审查 |
| **检查更新** | *check update* | 想知道 Baton 有没有新版 | 读本机版本锚 + 实查 GitHub/npm 最新版，报告「已是最新 / 有新版」 |
| **更新 Baton** | *update baton* | 有新版想升级 | AI 全流程更新（git pull + 重跑安装脚本 / npm update）并核验版本一致 |
| **精简审查 / 技术债盘点 / 健康诊断** | *lean review / scan debt / run doctor* | 想要代码审计 / 债单 / 体检 | 运行对应只读专项 Skill（过度工程审查 / BATON-DEBT 扫描 / 版本-漂移-锁诊断） |

## 🛠️ 其他 AI 工具安装（Codex / Claude / Cursor）

> **安装 = 复制一行命令，回车，等它跑完，然后验证口令。** 不需要手动建目录、不需要手动复制文件。
> DeepSeek Harness 用户可跳过本节——用上面的「快速开始」一行命令即可。

### 第 0 步：先花 10 秒决定装哪种（二选一）

| 你的情况 | 该装哪种 | 装完后 |
|---|---|---|
| 我有多个项目，想在这台电脑上**所有项目**都能用 Baton | **用户级**（每台电脑装一次） | 本机全局生效，任何项目里说口令都认识 |
| 我有个**具体项目**，想让它被不同电脑/AI 接手 | **项目级**（每个项目装一次） | 项目自带完整记忆骨架 + 三端入口，git clone 过去就能接手 |
| 两个都要 | 先用户级，再项目级 | 最完整：全局认识 + 项目自足 |

> 💡 **推荐**：先跑用户级（30 秒），再对你的真实项目跑项目级（30 秒），两个都装完最省心。

### 第 1 步：下载 Baton（只做一次）

打开 PowerShell（按 `Win`，输入 `powershell`，回车），复制这一整行：

```powershell
git clone https://github.com/kakadeka/Baton.git $HOME\Baton
```

> 如果提示没有 git：去 https://git-scm.com/download/win 装一个，装完重开 PowerShell 再复制上面那行。

### 第 2 步：选一种安装方式，复制对应命令

**方式 A：用户级安装（每台电脑一次，全电脑项目通用）**

复制这一整行，回车，等它跑完：

```powershell
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope User
```

跑完你会看到 `ok: [Codex] ...`、`ok: [Claude Code] ...`、`ok: [Cursor] ...` 三行——说明三个 AI 工具的全局 skill 都装好了。

**方式 B：项目级安装（每个项目一次，让项目被所有电脑/AI 认识）**

先 `cd` 进你的项目（把 `C:\你的项目路径` 换成真的）：

```powershell
cd C:\你的项目路径
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope Project
```

跑完你会看到 `项目级安装完成 ✅` 和新建清单（记忆骨架 docs/ai_memory、配置 .baton、三端 skill 和入口 AGENTS.md/CLAUDE.md/.cursorrules）。如果提示没有 `.git`，按它给的 `git init` 三连先初始化仓库。

> 项目级安装完全离线自动完成，**不需要 DeepSeek Harness 插件也能用**（无插件模式）。

### 第 3 步：验证（最重要！就验证一个口令）

在装好 Baton 的项目里，对你的 AI 说一句：

```
上班啦
```

**✅ 成功标准**：AI 按 Baton 执行，输出类似——

```
分支：master ｜ HEAD：a1b2c3 ｜ 工作区干净
任务表：1) 推荐事项 ...
```

**❌ 没反应？** 按顺序排查：

1. 你用的是哪个 AI？如果是 **Claude Code**：`~\.claude\skills\baton\` 里有没有 `SKILL.md`？如果是 **Codex**：`~\.agents\skills\baton\`？如果是 **Cursor**：`~\.cursor\skills\baton\`？（跑用户级安装就都有了）
2. 项目里有没有 `.git`？（没有就 `git init` + 首次提交）
3. 口令是不是只说「上班啦」三个字，没加别的？
4. 项目里有没有 `docs/ai_memory/`？（跑项目级安装就有了）

### 第 4 步：已有 Baton 项目，来了新电脑 / 新 AI

新电脑上：装好 git → `git clone` 你的项目 → 在项目里对你的 AI 说：

```
上班啦 或 继续工作
```

记忆、交接、任务全部随代码拉下来了，直接接着干，不需要重新装任何东西。

### 第 5 步：如何检查 / 更新 Baton 版本

安装时 Baton 会自动留下「版本锚」：用户级在三个全局 skill 目录（`version.json`），项目级在 `.baton/version.json`。**你不需要自己记版本号**，对你的 AI 说：

| 口令 | 英文 | 作用 |
|---|---|---|
| **检查更新** | *check update* | AI 读本机版本 + 实查 GitHub/npm 最新版，告诉你「已是最新」还是「有新版 X.Y.Z」 |
| **更新 Baton** | *update baton* | 有新版时 AI 全流程更新（git pull + 重跑安装脚本 / npm update），并核验本地版本与远端一致才算完成 |

贴心提示：每天「上班啦」时，如果超过 7 天没检查过更新，Baton 会顺带提醒一句「可检查更新」。新版 SKILL 在**新会话**生效；DSH 组合包更新后需重启。

### 第 6 步：安全卸载（只清自己，绝不碰你的内容）

```powershell
pwsh -File $HOME\Baton\scripts\baton-uninstall.ps1 -ProjectRoot C:\你的项目路径
```

- 只删除安装器创建的东西：三端 skill 镜像、入口文件里的 Baton 段（只删标记范围）、版本锚。
- 默认保留你的记忆（`docs/ai_memory/`）与配置——那是你的项目真相；加 `-RemoveMemory` 才是真的全删。
- 安装后被你改过的文件按内容 hash 检测，会**保留并提示**，绝不静默删除。
- `-DryRun` 先演练，不写任何文件。

### 一键脚本做了什么（透明可查）

| 安装模式 | 自动完成 |
|---|---|
| 用户级 | 把 `SKILL.md` 复制到本机三个 AI 工具的全局 skill 目录（Codex / Claude Code / Cursor） |
| 项目级 | ① 生成 `docs/ai_memory/` 记忆骨架（含修订记录+分卷索引）② 生成 `.baton/config.json` ③ `.gitignore` 追加 ④ 三端 skill 镜像 ⑤ 三端入口段（AGENTS.md / CLAUDE.md / .cursorrules，不覆盖原有内容） |

脚本幂等：重复跑不会覆盖你已有的文档和规则，只会补齐缺失部分。

## 📁 项目真相（目录结构）

```
你的项目/
├── docs/ai_memory/                  ← 长期记忆（随 Git 同步，所有 AI 共享）
│   ├── index.md                     ← 索引：归档分卷索引 + 修订记录 + 开工必读
│   ├── current.md                   ← 当前工作摘要（简写，只放当前事实）
│   ├── handoff_current.md           ← 交接本：最后一条 = 当前事实
│   ├── overview.md                  ← 权威项目卷：目标/需求清单/变更记录
│   ├── constraints.md               ← 编码红线/冻结点
│   ├── validation_matrix.md         ← 验证矩阵
│   ├── commands.md                  ← 口令说明
│   ├── state/
│   │   ├── tasks.json               ← 任务清单与状态机
│   │   ├── archive_index.json       ← 历史索引（自动维护）
│   │   └── project_state.json       ← 机器状态（所有权/发布记录）
│   ├── tasks/                       ← 任务表（todo/progress/finished + schema）
│   ├── knowledge/
│   │   ├── tech_decision.md         ← 技术决策 TD-YYYYMMDD-NNN（为什么这么选）
│   │   └── pit_experience.md        ← 踩坑记录（只记已验证坑点）
│   ├── ui_spec/                     ← 设计规范（「保存设计规范」写入这里）
│   ├── requirements/                ← 需求基线（requirements_YYYY-MM-DD_<topic>.md）
│   ├── daily_log/                   ← 日报（daily_YYYY-MM-DD.md，每天一份）
│   └── agent_metrics/
│       └── YYYY/MM/index.html       ← 月度仪表盘（下班自动生成）
└── .baton/                          ← 本机私有（gitignore；config.json 例外入库，clone 后即恢复配置）
    ├── config.json                  ← 项目配置（模型池/路由/保护路径；随 Git 同步跨机恢复）
    └── local/                       ← 当天 metrics、证据（gitignore）
```

> **每个长期 md 都带【归档分卷索引】+【修订记录】**：谁在何时改了什么，全部可追溯；超过 3MB 按条目分卷。

## 🛡️ 安全与设计原则

- **危险 Git 不存在**：force push / reset --hard / 危险 clean / 未授权 rebase 全部禁止
- **同步永远 ff-only**：分叉即停并报告，绝不自动解冲突、绝不覆盖本地改动
- **凭据永不落盘**：API Key/Token 不进 Git、Memory、Metrics、日志
- **历史只增不改**：只追加或标「已取代」，禁止覆盖重写
- **「完成」= 机械证据**：远端 SHA 核验 + 发布留痕，不是 AI 口头保证
- **省 Token 是正式目标**：索引先行、按风险选模型、输出有界、无冗余请求

## 📦 开源与仓库

- **开源仓库**：https://github.com/kakadeka/Baton（公开运行时与中英双语说明，经官方发布流程同步，不含任何项目隐私与凭据）
- **npm**：[@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- **协议**：[Apache-2.0](./LICENSE)
