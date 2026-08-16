---
name: baton
description: '项目接力协作系统 Baton。跨 AI 软件（Claude Code/Codex/Cursor/DeepSeek Harness）与跨电脑接力维护同一项目的进度、记忆、Git 与模型分派。用户说「上班啦」「下班啦」「继续工作」「保存设计规范」「完成」「更新项目文档」「Baton init」「看看项目状态」「一键验收」「释放工作区」「记录需求变更」「这个坑记下来」「这个决策记下来」，回复任务编号，或进行 Git 自然语言请求（拉取github/同步github/看看git状态）时必须使用本技能。英文触发词等价（English triggers, identical meaning）: "clock in"/"start work", "clock out"/"end work", "continue work"/"resume", "save design spec", "complete task", "update project docs", "Baton init", "check project status", "run acceptance check", "release workspace", "add/change requirement", "pull github"/"sync github"/"check git status", "remember this pitfall"/"record this decision"。本技能不依赖任何平台插件：有 baton_* 工具时自动使用，没有时按 SKILL 内「无插件模式」与「平台能力」章节手工执行等价动作，核心能力完全可用。Slogan: Pass your project, not your context.'
---

# Baton —— 项目接力协作系统

## 定位

Baton 让不同 AI 软件在同一项目中串行接力工作，同时保持需求、任务、代码、验证、知识和交接一致。

- **项目真相**：`docs/ai_memory/`（长期知识+机器状态，随 Git 同步）+ `.baton/`（本机私有配置与临时数据，gitignore 不进 Git；**例外：`.baton/config.json` 入库**，clone 后即恢复门禁/路由/verify 配置）
- **最高事实**：Git 与真实文件 > 状态文件 > 交接/文档 > AI 自述
- **目标**：用户说人话工作，Baton 后台自动管理；用户不当运维。

## 核心原则

1. **事实优先级**：Git/真实文件/新鲜验证 > `state/*.json` > 交接/日报 > 聊天记录与 AI 自述。AI 说"已完成/已 push"不是证据。
2. **单写入者**：同一工作区同一时刻只有一个 AI 写入。跨 AI 轮班靠交接文件的所有权状态（持有中/检查点/可接手/阻塞）；上班时检查交接末条的所有权状态（插件模式 baton_clock_in 会显式输出，`ownership_conflict: true` 时保持只读并报告；无插件模式手工读 handoff 末条判断）。
3. **交接最后写**：文档写入顺序 = 任务/知识/日报 → 索引 → handoff（handoff 最后写表示前序事务完成）。
4. **历史只增不改**：历史文档只追加或标「已取代/已废弃」，禁止覆盖重写、禁止自动删除。
5. **凭据红线**：API Key/Token 不进 Git、Memory、Metrics、日志、交接。
6. **完成≠下班**：任务完成是任务级收尾；下班是工作日级收尾，两者不同。
7. **假成功是红线**：任何关键断言（验证过/复核过/push 过/同步过）必须有真实输出或 SHA 证据，否则必须报 FAIL。
8. **查询历史先查索引**：需要历史信息时先用关键词命中索引（插件模式 baton_memory_query；无插件模式直接在 archive_index.json 里按关键词匹配），再只读命中文件片段；禁止为查一个决策全量读取 docs/ai_memory。所有收尾动作（下班/完成/存档/保存设计/记入记忆）会自动维护索引，无需手工维护。

## 口令

> **中英口令对照表（English trigger map）**：中英文触发语义完全等价，英文环境的 AI（Codex / Claude Code）与用户请用英文触发词，动作与规则不变。
>
> | 中文口令 | English triggers | 工具/动作 |
> |---|---|---|
> | 上班啦 | "clock in" / "start work" | baton_clock_in |
> | 下班啦 | "clock out" / "end work" | baton_clock_out + 远端 SHA 核验 |
> | 继续工作 | "continue work" / "resume" | baton_resume |
> | 看看项目状态 | "check project status" / "status" | baton_status |
> | 保存设计规范 | "save design spec" | baton_save_design |
> | 完成 | "complete task" / "mark task complete" | baton_complete |
> | 更新项目文档 | "update project docs" | baton_update_docs |
> | 这个坑/决策记下来 | "remember this pitfall" / "record this decision" | baton_remember |
> | 加个需求 / 需求变更 | "add requirement" / "change requirement" | 更新 overview.md |
> | Baton init | "Baton init" | baton_init |
> | 一键验收 | "run acceptance check" / "accept" | baton_accept |
> | 拉取/同步/看 git | "pull github" / "sync github" / "check git status" | baton_git + pwsh 网络 git |
> | 回复任务编号 | "reply the number" / task id | baton_select（持久化 current_task_id/active_work） |
> | 异常接手释放锁 | "release workspace" / "I confirm the previous agent stopped" | baton_release |
> | 任务验收通过 | "acceptance passed" / "accept" | baton_complete(action=accept) |
> | 检查更新 | "check update" / "check for updates" | 读版本锚 + pwsh 实查远端版本对比 |
> | 更新 Baton | "update baton" / "upgrade baton" | 按 source 分流执行更新 + 实查本地==远端 |

### 上班啦（clock in / start work）
1. 用 baton_clock_in 做本地三查与任务表；**有 upstream 时必须先按 sync_hint 执行 `git fetch origin --prune`（fetch-before-lock：clock_in 的 ahead/behind 基于本地 remote-tracking 引用，不 fetch 就不知道真实落后）**；本地落后且无分叉时再 `git merge --ff-only`；同步完成前不得把任务表当开工依据（落后时 clock_in 会阻断抢锁，返回 behind_remote=true，同步后重跑）。（DSH 里用 pwsh 工具执行；无插件模式直接执行 git 命令。）
2. 门禁：`ownership_conflict: true`（插件模式含机械判定：state 持有锁 holding、交接末条他人「持有中/检查点」、交接 HEAD 不是当前 HEAD 的祖先、交接分支与当前分支不一致）或出现无法归属的修改 → **保持只读并报告**，等用户确认。**解除方式**：用户说「异常接手，我确认上一位代理已经停止」→ 调用 baton_release 释放持有锁（写交接释放条目）→ 重新 clock_in；用户确认前禁止任何写入。
3. **单写入者锁**：clock_in 门禁通过后自动写 `state.ownership = holding`（写后立即回读复核：并发双开只有一个胜者 claimed=true，败者如实报冲突；60ms 静置窗口放大竞态可见性），下班/释放时置 released。**所有写工具（clock_out/select/complete/save_design/remember/update_docs/record_actual/route/commit_all）执行前必须核对持有锁**：未持有或持有者非本会话（DSH 可识别会话身份时）一律拒绝。同一会话内再次「上班啦」前必须先「下班啦」或 baton_release。
4. **直接用 clock_in 返回的 task_table 输出任务表**（推荐项编号 1），无任务明说、单任务直接推荐。**待验收任务在 awaiting_tasks 单列展示、不占编号**（编号与 baton_select 的候选集严格一致，杜绝错位）。**禁止重复读 current/handoff/tasks.json**（clock_in 已返回 current_summary/handoff_tail/任务表，重复读取是浪费 token）。
5. **版本提示**：clock_in 返回的 `version_info.check_hint` 非空（距上次检查更新超过 config.update.check_interval_days 或从未检查）→ 在任务表后输出该提示（纯本地判断，clock_in 不做网络）；无插件模式读 `.baton/version.json` 的 `last_check_at` 同规则判断。用户说「检查更新」才实查远端。
6. 禁止：覆盖 dirty、reset、rebase、擅自 merge、擅自解 divergence、假装已同步。
7. **无插件等价**：手工执行三查（`git branch --show-current` / `git rev-parse HEAD` / `git status --short`）+ 读 current/handoff 末条/tasks.json，按「任务表格式」输出。同步提示命令照常可用。

### 下班啦（clock out / end work）
1. 检查改动与任务范围：把允许清单传给 baton_clock_out 的 allowed_files（存在非 Baton 管理域的改动时**必填**）；插件会机械核对 config.protected_paths 与允许范围——**任一越界或 protected 命中 = 阻断**（不写任何文件、不提交，返回 FAIL 清单，修正后重试）；体积告警不阻断。**Contract 预锁**：当前任务若开工时经 baton_select 预锁了 allowed_paths，预锁范围外的改动必须用户在 allowed_files 中以 `user:<路径>` 明确豁免（执行者事后自报不构成豁免），否则阻断。插件还会**机械核对推流远端**：remote 指向 Baton 开源发布仓库（github.com/kakadeka/Baton）或 config.remotes.push_blocked 清单 → **硬阻断**（不写不提交；把 remote 改指私密库/本地仓库后重试）；「上班啦」时命中会提前给出 push_blocked_warning。
2. 按分类执行必要验证与审查（见「审查规则」）。
3. baton_clock_out：更新日报/状态/交接（handoff 最后写）→ metrics 固化 + 月度报表 → 两次本地提交（收尾产物 + 发布记录，随一次 push 全部推送）。**两阶段事务 + 文档阶段写前日志**：closeout token 记录 head_at_start/commit1_head 与文档阶段 step——commit1 失败重试只重跑 commit1、commit2 失败重试只补发布记录、文档阶段中途失败（如文件瞬时被锁）重试从断点续跑；任何重试都不会重复追加日报/索引/交接（另有按摘要去重的内容级双保险）。发布记录 state 写 `push_state=pending`——**此时不得宣称「已发布」**。
4. 按 clock_out 返回的 next_step 执行 push：`git push origin <branch>`（DSH 里用 pwsh 工具；无插件模式直接执行 git）。
5. 调用 baton_verify_push 做**只读**机械核验（该工具绝不写文件、绝不提交）：**有远端时工具必须自取远端证据**——优先自行 `git ls-remote refs/heads/<分支>` 实查真实远端 SHA 与本地 HEAD 比对，且要求工作区干净（强核验，调用方传什么 SHA 都伪造不了）；ls-remote 受限时对 GitHub 远端改走 `gh api repos/<owner>/<repo>/git/refs/heads/<分支>` 实查；**两通道均不可用 = 直接拒绝**（source/remote_sha 是调用方字符串，不构成证据，不设声明式弱核验通过路径）。此时由主会话 pwsh 执行 ls-remote 取真实 SHA 写入交接并明示「弱核验·主会话实查」。**无远端本地仓库**时传 `remote_sha=本地 HEAD、source=local`。不一致或工作区有未提交改动 = 「下班未完成」，输出八项诊断。
6. 核验通过后调用 baton_record_push 记账：有远端时工具**再次 ls-remote / gh api 实查并绑定远端==本地 HEAD==传入 SHA**，任一不符或两通道不可用即拒绝（无实查证据不记账）；凭证写 `strong=true`（实查）供 accept 强核验。**核验结果同时写入 Git 内 project_state.json（push_state=verified + push_verified_sha）**——跨电脑 clone 后 clock_in 不再误报 pending、accept 可直接通过；该 state 写入由下次收尾提交入库（accept 对「仅此记账未入库」的脏态有干净性豁免）。
7. 单分支工作流：Baton 直接在项目当前分支收尾（commit+push+核验），不做分支切换、不 merge、不建任务分支；如需多分支并行，由用户自行管理分支，Baton 在哪个分支上班就在哪个分支收尾。已完成任务：终审后按配置整合稳定分支（默认不 merge，需用户授权）。
8. 正常情况下绝不要求用户手动 git add/commit/push。
9. **无插件等价**：`git status --short` 核对范围 → 追加日报（建带头文件）→ 更新 current/handoff（保留修订记录+分卷索引，handoff 最后写）→ `git add -A && git commit` → push 前 `git remote get-url <目标remote>` 核对**不得指向开源发布库 github.com/kakadeka/Baton** → `git push origin <分支>` → `git ls-remote origin <分支>` 与本地 HEAD 比对，一致才算完成；protected 命中必须 FAIL。

### 继续工作（continue work / resume，别名：接手继续）
用 baton_resume 恢复：git 快照 + 当前工作摘要 + handoff 末条 + 未完成任务 + 最近记忆条目 + 下一步。禁止要求用户重讲项目。需要同步远端时按 sync_hint 用 pwsh 执行 fetch/ff-only。
**与「上班啦」的区别**：上班啦 = 正式开工（三查+任务表+门禁+sync_hint），是每个工作段的起点；继续工作 = 跨会话/换电脑后快速恢复上下文（只读快照+下一步），不做门禁写入、不产生任务表确认流。同一会话内二次询问进度时也用「继续工作」口径回复，不要重跑 clock_in。
**无插件等价**：三查 git → 读 current.md + handoff 末条 + tasks.json 未完成任务 + archive_index.json 最近条目，输出下一步。

### 查看项目状态（check project status，自然语言）
「看看项目状态」「现在什么进度」→ baton_status（只读六层快照：git + 当前任务 + 交接摘要 + 文档角色）。不写任何文件、不改状态、不要求用户确认。

### 保存设计规范（save design spec）
1. 用 baton_save_design 保存用户已确认、可复用的设计事实（全局/组件/页面/工作流分类），写入 `ui_spec/` 对应分册。
2. 临时审美尝试、未确认想法不固化（进日报）。
3. 冲突处理：旧版本标「已取代」，新决策记录决策 ID 与日期，标注当前有效版本。
4. 后续 UI 任务必须自动引用相关设计规范；FROZEN UI 任务 Fidelity 必须用它作比对事实。

### 完成（complete task）
任务级收尾两步（状态机闭环，缺一不可）：
1. **finish**：`baton_complete(task_id, action=finish)` 更新任务状态与记录 → 写必要 Memory → 记 Metrics → 给下一步。任务状态**置为「待验收」**（用户未验收前不置 completed）；插件机械移除 task_todo/task_progress 表行；验收证据按 DoD（命令 → 结果）补齐。**不跑工作日 closeout**（不 commit 不 push，除非任务本身要求）。
2. **accept**：用户明确验收通过后，`baton_complete(task_id, action=accept)` 把「待验收」置为「已完成」（写验收记录、清当前任务指针）。工具幂等防重复；**未验收不得置 completed**（此前状态机缺少这一步导致任务永远无法真正完成）。

### 更新项目文档（update project docs）
用 baton_update_docs 把当前工作增量写入文档与交接后停止写入（中途存档，不跑下班流程）。

### Baton init
初始化项目实例：见 baton_init 工具（自动生成骨架、检测旧 skill/旧文档、给出迁移计划，绝不覆盖已有文档）。
**无插件等价**：运行 `pwsh -File scripts/baton-install.ps1 -Scope Project`（脚本随框架包分发，不在项目目录内；用户级安装的项目请从框架包目录运行该脚本，或先用插件 `baton_init` 生成骨架与提示、再由 install 脚本完成三端 SKILL 镜像与入口段；无插件也能装，见 README 安装章）。

### 数字确认（reply the number）
任务表给出后，用户回复编号即确认选择：**编号 = 任务表 ID 列的值**，一一对应。**插件模式必须调用 baton_select(number=N[, allowed_paths=...]) 持久化**——把编号解析为任务 ID、置为当前任务（in_progress）并写 current_task_id/active_work、同步视图表；**开工时就应把本任务的允许改动路径经 allowed_paths 预锁**（范围已知时必填，收尾时超出预锁必须用户豁免）；无插件模式手工更新 tasks.json 的 current_task_id/active_work/allowed_paths 与 task_progress 表。持久化后直接按该任务执行。**禁止反问**「您指的是任务 1 吗」。

### Git 自然语言（pull github / sync github / check git status）
「拉取github」「同步github」「看看git状态」→ 走 baton_git 轻量路径（本地 status/commit_all）。**commit_all 与下班同款门禁**：protected 命中或非管理域改动未在 allowed_files 声明即阻断（封死 git add -A 绕过）。fetch/sync/push 属网络 git：用 pwsh 工具执行（插件沙箱内网络 git 受 msys 限制），结果照常用 baton_verify_push 核验。不建 Contract、不启动审查、只读操作不污染状态。
**无插件等价**：直接执行对应 git 命令（status / fetch / push），push 后用 `git ls-remote origin <分支>` 与本地 HEAD 比对核验。

### 检查更新 / 更新 Baton（check update / update baton）

Baton 版本闭环：安装留版本锚、可检查、可更新。**用户不当运维**：检查/更新由 AI 按本口令全流程执行。

1. **版本锚**：`baton-install.ps1` 安装时自动写 `version.json`——用户级在三端全局 skill 目录（与 SKILL.md 并列，如 `~/.agents/skills/baton/version.json`），项目级在 `.baton/version.json`（本机私有，gitignore）。字段：`source`（git/npm）、`version`、`sha`、`installed_at`、`last_check_at`。旧项目没有该文件 = 从未留痕，检查时视为「未知版本」，提示重跑 install 补锚。
2. **检查更新**（check update，只读动作）：读版本锚 → 用主会话 pwsh 实查远端（网络操作，插件沙箱受限）：
   - 版本号（首选，任何环境）：`npm view @kakadeka/dsh-baton version`（受限环境若报 npm-cache EPERM，加 `--cache <工作区内临时目录>`）
   - GitHub 通道：远端 SHA `git ls-remote https://github.com/kakadeka/Baton refs/heads/master`；版本号备选 `(Invoke-RestMethod https://raw.githubusercontent.com/kakadeka/Baton/master/package.json).version`（或 `git ls-remote ... refs/tags/v*` 看 tag 列表）
   - 与本地 `version.json` 对比 → 报告「已是最新 vX.Y.Z / 有新版 vX.Y.Z（本地 vA.B.C）」。
   - **check 本身零写入**：不自动回写 `last_check_at`。报告后提示用户「是否记录本次检查时间（回写 last_check_at 至两处版本锚）」——用户明确同意才回写（显式 record-check），保持「检查=只读」的承诺。
3. **更新 Baton**（update baton）：检查发现新版，用户确认后执行，按 source 分流：
   - skill 用户（Claude/Codex/Cursor，source=git）：`git -C $HOME\Baton pull`（框架副本）；**pull 报 unrelated histories / 分叉失败 = 历史不连续的旧克隆，删除后重新 `git clone https://github.com/kakadeka/Baton.git $HOME\Baton`**；无副本则直接 clone → 重跑 `pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope User`（更新三端全局 skill）→ 对相关项目重跑 `-Scope Project`（更新 SKILL 镜像/入口段，脚本幂等）→ install 自动刷新版本锚。
   - DSH 用户（source=npm）：dsh 部署目录内 `npm update @kakadeka/dsh-baton` → 重启 dsh web。
   - 更新后提示：SKILL 变更新会话生效（DSH 内当前会话的 skill 已加载，下个会话生效）；DSH 组合包变更重启后生效。
4. **假更新红线**：更新后必须实查本地==远端才可宣称完成——skill：三端/项目 SKILL.md 版本锚 version 与远端一致；npm：`npm list @kakadeka/dsh-baton` 输出与远端一致。实查不符 = 更新失败，如实报告，不重试硬凑。
5. **上班提示**：见「上班啦」第 5 条——超 `config.update.check_interval_days`（默认 7 天）未检查时提示，clock_in 纯本地判断、不做网络。
6. **无插件等价**：手工读 `version.json` → pwsh 实查远端（同上命令）→ 对比报告；更新按 source 分流手工执行；更新后同样实查本地==远端才可宣称完成。

### 记入记忆（remember this pitfall / record this decision，自然语言）
「这个坑记下来」「把这个决策记进知识库」「记个 issue」→ baton_remember（decision/pit/issue）。记忆是长期资产：换 AI、换电脑后靠 baton_memory_query 命中，禁止重新解释或重复踩坑。

### 记录需求变更（add/change requirement，自然语言）
「加个需求：xxx」「这个需求不要了」「需求改成 xxx」→ 同步更新项目总览（权威项目卷，防止做着做着忘掉目标和需求）。**总览文件固定为 `overview.md`**（旧项目先经 baton-migrate 一次性迁移成规范名，不保留旧命名）：
1. 需求清单增/改/删一行（编号 RQ-NNN；移除时状态标「已移除」而非删除行）
2. 「变更记录」表追加一行（日期/变更内容/类型：新增·修改·移除/原因）
3. 同步更新技术栈/功能点/架构概要（如受影响）
4. 将本次变更摘要追加进 `state/archive_index.json` 便于历史查询

铁律：历史只追加不覆盖；需求变更必须留痕。

## 平台能力（跨工具通用 / 平台机制 / DSH 增强）

**Baton 是一个 skill + 一份项目状态目录，不绑定任何 AI 平台。** 插件（baton_* 工具）只是 DeepSeek Harness 上的机械化加速器，**不是必需项**。下表说清每块能力在四种工具下怎么用：

| 能力 | 跨工具通用？ | 说明 |
|---|---|---|
| 口令（上班/下班/继续/完成/存档/记忆/需求变更） | ✅ 完全通用 | 纯文件+Git 层，任何 AI 照本 SKILL 规则执行 |
| 记忆骨架与文档规范（修订记录/分卷索引） | ✅ 完全通用 | 纯 Markdown/JSON，零依赖 |
| Git 真闭环（ff-only / commit / push / 远端 SHA 核验） | ✅ 完全通用 | 标准 git 命令，无插件模式手工执行 |
| 防跑偏（冻结 / 允许路径 / 审查 / Fidelity） | ✅ 完全通用 | 规则 + 人工核对，不依赖工具 |
| 任务分类与分级 | ✅ 完全通用 | 规则表，任何工具可读 |
| **模型路由规则**（该用哪档模型） | ✅ 规则通用 | 规则写在 config.json + 本 SKILL；**执行靠各平台自己的机制** |
| **派发执行代理** | ⚠️ 平台机制 | DSH：subagent 工具；Claude Code：内置 Task/Subagents；Codex：内置子代理；Cursor：Agent 模式（详见「自动模型分派协议」各平台小节） |
| **记录实际模型** | ⚠️ 降级 | DSH 可查宿主身份（host_descriptor）；其它平台只能记 requested/unknown —— **诚实原则不变**。月报模型排行**只计入 host_descriptor（宿主身份事件证据）**；requested（声明）与自报字符串只展示并标「声明/自报」，不污染排行 |
| baton_* 工具（19 个） | ❌ DSH 专属增强 | 无插件模式按「无插件模式」章节手工等价执行 |

**结论**：在 Claude / Codex / Cursor 上，Baton 的核心能力（接力、记忆、Git 闭环、防跑偏）**全部可用**；只有"自动派代理 + 核实实际模型"退化为平台自带机制 + 诚实记录。这不是失效，是降级，且降级路径是显式的。

## 任务分类与分派（规则表）

**Contract 定义（任务边界，轻量预锁实现）**：Contract 不是独立文件，是每个任务在**开工时**固定的边界三要素——①约束级别（FROZEN=用户已确认的需求/原型/设计规范，禁止自由发挥；BOUNDED=明确范围内实现；OPEN=真探索型）②允许范围（allowed_paths，经 baton_select 的 allowed_paths 参数预锁进任务条目）③验收标准。默认：有原型/设计规范/冻结需求的按 FROZEN 处理，禁止把明确需求当 OPEN。**预锁机械强制**：任务条目带 allowed_paths 时，「下班啦」/commit_all 用真实 diff 核对——预锁范围内的改动直接放行；范围外改动必须用户在 allowed_files 中以 `user:<路径>` 明确豁免，执行者事后自报不构成豁免。无插件模式由 AI 严格自检同一规则。

| 级别 | 例子 | 执行者 | 复核 |
|---|---|---|---|
| Micro | 改颜色/文字/查文件 | 主会话直接做 | 不复核（简报说明改动即可） |
| Bounded | 普通功能 | 主会话或 flash 代理 | 主会话复核 |
| Complex | 跨模块复杂逻辑 | pro 代理 | 主会话复核 |
| Architecture | 架构设计 | pro 高推理 | 独立 pro 代理 |
| High-risk | 数据/发布/安全 | pro + 用户授权 + 备份 | 独立复核，证据失败即 FAIL |

- **执行与复核不得同源**：代理执行的 → 主会话复核；主会话执行的 → 独立代理复核。
- 模型池/路由/fallback 见 `.baton/config.json`；实际使用模型必须写入简报与 Metrics（actual ≠ recommended 时写明 fallback 原因）。
- **模型池按平台改写**：config.json 的 model_pool 默认是 deepseek 示例，Claude Code / Codex / Cursor 用户应把自己平台的模型（如 claude-sonnet-4、gpt-5 等）按 tags（fast/reasoning）填入后标 status=verified；路由表结构不变。改策略只改 config.json。**status=verified 的定义**：该 provider 已完成真实 health/credential/dispatch 验证（真实调用成功）；未验证的模型 status 留空或标 unverified，**禁止自报 verified、禁止使用未验证模型**。
- **中断接管**：子代理因 provider/额度失败 → 主会话按 fallback 链用下一模型重新分派，提示词=读检查点+「从这里继续，不重做」；同根因两次失败 → 停 + 报告，不无限重试。

## 自动模型分派协议（用户只设默认模型，AI 按任务自动选模型+high/max）

**规则跨平台一致；执行用各平台自己的机制。** 本协议分三层：①分类（所有平台相同）②路由（规则在 config.json，DSH 用 baton_route 机械读取，其它平台直接读 config.json 的 routing 表）③分派与记录（见各平台小节）。

1. **分类**：按「任务分类与分派」表判定 micro/bounded/complex/architecture/high-risk/review。
2. **路由**：读 `.baton/config.json` 的 routing 表取 recommended（provider/model/reasoning + fallback 链）。DSH 调 baton_route（机械读取并记 Metrics）；其它平台直接读 config.json 对应行。改模型策略只改 config.json，不改代码。
3. **分派与记录**：
   - **DeepSeek Harness**：micro → 主会话直做；bounded → 默认主会话，需隔离/繁忙时按推荐派 flash；complex/architecture → subagent 分派，参数填 provider/recommended.provider、model/recommended.model，疑难场景 reasoning 提到 max；review/fidelity → 独立 subagent 派 pro。用 baton_route 记录 recommended，baton_record_actual 记录 actual（source=requested / host_descriptor / unknown，禁止模型自报）。
   - **Claude Code**：micro/bounded → 主会话直接做（用当前会话模型）；complex/architecture/high-risk → 用 Claude Code 内置 **Subagents/Task 工具**派子任务，在派发提示词里写明任务范围+检查点+「从这里继续，不重做」；模型档位通过会话内 `/model` 切换实现（简报里写明 recommended 档位供用户确认，切换后实际档位如实记入简报与 Metrics）。actual 记录：主会话知道自己当前模型，但 source 只能记 requested 或 unknown（Claude 宿主不暴露子代理身份），**禁止自报为已核实**。
   - **Codex**：micro/bounded → 主会话直做；complex/architecture/high-risk → 用 Codex 内置子代理/Task 机制派发，规则同上；模型档位通过 Codex 会话配置选择，简报写明 recommended 与实际；actual 同样只记 requested/unknown。
   - **Cursor**：micro/bounded → 主 Agent 直做；复杂任务用 Cursor 的 Agent/子代理机制，或分步引导用户切换模型；实际档位如实记录，无法确认记 unknown。
   - **兜底（所有平台）**：未配/未验证的模型永不使用；provider/额度失败 → 按 fallback 链重派（读检查点+「从这里继续，不重做」）；同根因两次失败 → 停 + 报告。**无法确认实际模型时记 unknown，绝不编造。**
4. **记录（不造假，所有平台）**：recommended 与 actual 分开记；source 如实标注（requested=主会话分派记录；host_descriptor=宿主身份事件，仅 DSH 可读；unknown=无法确认）。完成后 complete/clock_out 传 actual_model。DSH 一次性子代理的 model 在宿主侧是隐藏设计，continuable 子代理可读 agentModel；无法确认一律记 unknown。**Reviewer 独立性不可由调用者自证**：`reviewer_agent_id` 等参数只是声明（unverified），独立复核的可信身份必须以宿主签发的 session/run/agent/host 事件为准；无法证明独立时该任务保持「未满足独立复核」，不得假装 PASS。

## Lean Gate（最小实现决策阶梯）

优先级永远：**用户明确要求/FROZEN > 安全与数据完整性 > Contract/DoD/Fidelity > 正确性 > 记忆闭环 > 精简目标 > 输出风格**。精简不得牺牲前六项。

### 模式（任务 Contract 可选字段 implementation_policy）

| 模式 | 语义 |
|---|---|
| `off` | 不施加精简策略（照常实现） |
| `lite` | 按要求实现，同时指出一个更小备选，不擅自缩需求 |
| `full` | 执行完整决策阶梯（默认）；select 必须提供 reuse/native/minimum_check 机械证据字段 |
| `strict` | full + 预算机械阻断：新增依赖/文件/抽象超预算必须用户例外 |

### 机械执行（baton_select + baton_clock_out）

- **select 开工**：full/strict 缺 reuse_candidates（复用搜索结果）、native_candidates（stdlib/native/已装依赖检查结果）、minimum_check（最小检查 test/evidence id）任一 → 拒绝 select（机械字段门禁）。
- **预算窗口**：select 把 Contract 快照进 state.contract——base SHA（窗口锚定任务开工，重选同一任务不重置）+ 依赖基线 + dependency_budget/new_file_budget/abstraction_budget（自然数；缺省=该维度不设限）+ lean_exceptions（用户明确例外，JSON 数组）。
- **closeout 机械计算 delta**：新增文件（`git diff --name-status base` 的 A 状态 + `git ls-files --others` 未跟踪文件）、新增依赖（当前 package.json vs base 提交版本，含 dependencies/devDependencies/peerDependencies/optionalDependencies）、新增抽象（行级启发式：function/class/const 箭头赋值声明；不解析语义，边界如实记录）。
- **strict 阻断**：任一维度超预算 → closeout 零写入阻断；只有契约内预锁例外可放行；执行者事后自报无效（例外必须来自用户明确确认并写入 select 契约）。
- **不可削弱**：框架管理域（docs/ai_memory/、.baton/ 等）不计预算；off/lite 不施加预算；任何策略不得削弱凭据/范围/边界门禁（均在 Lean 门禁上游执行）。

### 决策阶梯（必须先理解任务与现有实现，按顺序停止在第一个可行层级）

1. 这项需求是否真实需要？推测性未来需求先不做。
2. 仓库是否已有 helper/类型/模式/组件？优先复用。
3. 标准库是否覆盖？
4. OS/浏览器/数据库/框架原生能力是否覆盖？
5. 已安装依赖是否覆盖？
6. 能否通过删除、配置或组合现有能力完成？
7. 前六项都不成立，才新增最小实现。

### 不可精简项（永远不能为减少代码删除）

信任边界输入校验；防数据丢失的错误处理与恢复；鉴权/授权/凭据/注入防护；无障碍基础；用户明确要求与 FROZEN/Fidelity；DoD 与非平凡逻辑的最小可运行检查；外部系统必需的校准参数。

### 根因优先

Bug 修复前搜索共享函数的全部调用方，优先在共同根因处修一次，不在每个调用者复制 guard；不同调用者语义不同时记录证据。

### 债务标记

任何故意简化且存在真实上限的实现必须标记（禁止「以后有空」「未来可能」这类不可测触发器）：

```text
BATON-DEBT: task=<id>; ceiling=<上限>; revisit_when=<可测触发器>; upgrade=<升级路径>
```

## 平台能力分级与子代理治理

### 能力分级

| 等级 | 能力 |
|---|---|
| L0 | 文档手动读取 |
| L1 | AGENTS/CLAUDE/Cursor rule 自动加载 |
| L2 | Skill 可发现和调用 |
| L3 | 会话及子代理 hook 持续注入 |
| L4 | 原生工具、事件、权限、诊断完整 |

当前目标（不做 20 个平台适配器，只维护四端）。**实测等级**：Codex=L2（AGENTS.md rule + skill 自动加载，无 hook 注入）、Claude Code=L2（CLAUDE.md + skill）、Cursor=L1/L2（.cursorrules + skill）、DeepSeek Harness=L4（插件原生工具/事件/权限）。**L3（会话及子代理 hook 持续注入）为四端共同目标，当前无任何实现，不得宣称已达**。

### 薄适配器

能指向共享 `skills/` 就不复制逻辑；宿主强制不同格式时由 install/sync 生成器产生，并纳入漂移检查（check-drift）。

### 专项能力映射

| 能力 | Baton 落点 | 只读边界 | 一致性保障 |
|---|---|---|---|
| core + review | `skills/baton/SKILL.md`（主流程 + 审查规则） | 审查只读 changed files/diff | 全量回归 + 漂移检查 |
| audit（过度工程审查） | `skills/baton-lean-review/SKILL.md` | 只读，不修改/不提交/不 push | drift 四 skill 一致 + SKILL 只读自述 |
| debt（技术债扫描） | `skills/baton-debt/SKILL.md` | 只读扫描；持久化只进 Baton 现有 truth | 同上 |
| portability（可移植/诊断） | `skills/baton-doctor/SKILL.md` | 只读诊断（版本/漂移/锁/宿主等级/CI） | 同上 |

### 项目级模式隔离

模式 key 至少包含 `repo_id + worktree_path + session_id`；优先级：`用户本次显式指令 > 任务 Contract > 项目 config > 用户默认 > full`。共享进程内项目 A 的模式不得影响项目 B。

### 子代理 Context Capsule（分派执行型子代理必须携带）

```text
project/repo/worktree ID：
branch / base SHA：
task ID 与 Contract（FROZEN/BOUNDED/OPEN + allowed/protected paths + Lean 模式）：
checkpoint/handoff 摘要与唯一下一步：
必做验证（命令 → 结果）：
agent_id/run_id/session_id（不可验证写 unknown）：
证据格式与禁止事项（凭据红线、历史只增、不 force push）：
「从这里继续，不重做」
```

只读搜索代理可减少业务上下文，但安全、路径与隐私边界不能省略；宿主不报告 agent type 时默认安全注入。

> **诚实边界**：本模板是 SKILL 规则——执行者按模板填写分派提示词。Baton 当前**无宿主持续注入实现**（无 matcher、无自动注入），项目/会话模式不串值由「插件全部按 path 参数读写、无跨项目进程内状态」保证（双项目隔离回归）。如实标 L2（规则层），不得宣称 L3/L4。

### Hook 永不阻塞（设计规范，非当前已实现能力）

> **诚实边界**：Baton 当前**没有 hook 实现**，本节是「宿主支持 hook 时」的设计规范；无故障测试可跑，故不在 COMPLETE 能力清单。若未来实现，必须满足：短超时；stdin error/EOF 缺失时安全退出；hook 不进行网络写入；一次调用只输出一条协议消息；路径使用 allowlist/结构化参数；失败静默降级但写本机诊断，不卡死主会话。

## 审查规则

- Micro: NEVER；Bounded: CONDITIONAL；Complex: DEFAULT；Architecture/High-risk: ALWAYS。
- 审查者只看真实 changed files/diff/验证输出/Contract 范围/protected 违规/未验证项。**不重新开发**。
- Fidelity：对照冻结需求/原型/设计规范逐项比对，输出差异清单；不通过→带差异清单定向返修→再查；同根因两轮不过→停+问用户。

## 防跑偏四层

1. **执行前**：有原型/设计稿的任务一律 FROZEN；分派提示词附原型/规范文件路径；allowed_paths 限定范围。
2. **执行中**：小步+检查点；Change Budget 超预期 → 暂停告警。
3. **执行后**：独立 Fidelity 对照；执行者自述不算证据。
4. **机械**：DSH 沙箱限写范围；closeout 用真实 diff 对比 allowed 范围，越界 FAIL。（无插件模式：靠 closeout 时人工核对 `git status`/diff 与允许范围。）

## 简报模板

任务开始：任务类型｜执行者（实际模型）｜修改范围｜验收标准。
任务结束：完成情况｜关键验证｜复核结果｜Git 状态｜是否已同步远端｜下一步。
下班结束：验证/复核结果｜文档更新｜commit 数｜push 结果｜**远端 SHA 是否与本地一致**｜月度报表链接。

## 任务表格式

| ID | 任务/下一步 | 说明 | 建议 | 确认口令 |
|---|---|---|---|---|
| 1 | 推荐事项 | 当前状态与影响 | 推荐 | 回复 `1` |

## 目录结构

```
docs/ai_memory/                ← 长期真相（Git 同步，跨 AI 通用）
  index.md  current.md  commands.md  handoff_current.md
  overview.md  constraints.md  validation_matrix.md
  state/{project_state.json, tasks.json, archive_index.json, decisions.jsonl, issues.json}
  tasks/{task_schema, task_todo, task_progress, task_finished}.md
  knowledge/{tech_decision, pit_experience}.md
  ui_spec/*.md  daily_log/daily_YYYY-MM-DD.md  plans/  requirements/  standards/
  agent_metrics/YYYY/MM/{runs.jsonl, index.html}
.baton/                        ← 本机私有（gitignore；config.json 例外入库跨机恢复）
  config.json  local/metrics/YYYY-MM-DD.jsonl
```

老项目兼容（workday-knowledge-manager / ebowork 系列旧 skill 项目接入时）——**一次性迁移，不留双轨**：

1. **迁移工具**：运行 `pwsh -File scripts/baton-migrate.ps1 -ProjectRoot <项目根> [-Archive]`。它按对照表自动完成：
   - ① 扫描旧 skill 目录（workday / ebowork 及 ebowork-* 系列）与旧命名文档（`00_项目总览架构.md` / `INDEX.md` / `COMMANDS.md` / `handoff_latest.md` / `01_encoding_constraint.md`），输出对照报告；
   - ② 创建新文档（`overview.md` / `index.md` / `commands.md` / `constraints.md` 等），把旧文档内容搬入（含内容内的旧交叉引用与旧名称一并替换），标注"由旧文档迁移"；
   - ③ 批量替换入口文件（AGENTS.md / CLAUDE.md / .cursorrules）中的旧引用与旧名称 → 新路径 / Baton（skill 路径、文档路径、裸文件名、口语名称如 `EboWork Memory/Protocol/Publish`、块标记 `EBOWORK:START/END` 全覆盖）；
   - ④（加 `-Archive` 执行）把旧 skill 目录与已迁移旧文档移入项目根 `.baton-legacy/` 备份并下线；
   - ⑤ 现行同名文档（current.md / validation_matrix.md / development_workflow.md / handoff_current.md）中的旧名称替换为 Baton——**保护规则**：历史记录（交接条目标题、Workday V8 版本史、修订记录行）、机器状态（分支名如 `codex/ebowork-runtime-router-v1`）与历史文件名引用（如 `EboWork_Migration_Report.md`、`ebowork-state.mjs`）一律不动，只改现行规则叙述。
   - ⑥ 旧 `.ebowork/` 本机私有目录改名为 `.baton/`（内容不动，`.gitignore` 忽略行同步替换）；若 `.ebowork` 与 `.baton` 并存 → 保持只读并报告，人工核对合并后再手工下线旧目录。
2. **新旧对照表**：`00_项目总览架构.md→overview.md`、`INDEX.md→index.md`、`COMMANDS.md→commands.md`、`01_encoding_constraint.md→constraints.md`、`handoff_latest.md→handoff_current.md`（两套交接以 handoff_current 为准，需人工确认合并）；无对应文档（如 development_workflow.md）保留现行名但内容改称 Baton。
3. **铁律**：绝不删除任何内容（旧资产全部进 `.baton-legacy/` 备份，随 Git 提交可回滚）；不洗数据（历史只增不改）；**分支名与历史记录永不改写**；迁移幂等可重跑。
4. **迁移后**：`docs/ai_memory/` 全部为规范名，现行规则无 EboWork/Workday 字样；AGENTS/CLAUDE/.cursorrules 无旧引用；`.ebowork/` 已改名 `.baton/`；说「上班啦」验证。
5. **state/*.json、tasks/、knowledge/、ui_spec/ 等目录结构新旧一致**，无需映射，直接兼容读写。

## 文档规范（每个长期 md 的强制结构）

**所有长期 md 文件必须含【归档分卷索引】与【修订记录】两个区块**，缺失时先补齐再写入。单文件超过 3MB 时按完整条目或章节分卷（先列清单，用户确认后归档），主文件保留当前有效内容、摘要和读取顺序。

| 文件 | 更新记录 | 详略 | 内容要点 |
|---|---|---|---|
| `index.md` | ✅ 修订记录+更新时间 | 详细 | 归档分卷索引、修订记录、开工必读（有序）、当前主线、权威入口、命名规则 |
| `current.md` | ✅ 修订记录 | **简写** | 只放当前事实与投影块（Task/Phase/Next/Branch/HEAD），不存历史 |
| `commands.md` | ✅ 修订记录 | 详细 | 口令含义与触发条件 |
| `handoff_current.md` | ✅ 修订记录 | 详细（追加式） | 交接条目 `HO-YYYYMMDD-HHMM-<Agent>`，最新在末；含交接状态/任务/分支/改动文件/已验证/未验证/唯一下一步/凭据检查 |
| `overview.md` | ✅ 修订记录+变更记录 | 详细 | 一句话定义、目标、需求清单（RQ-编号）、技术栈、功能点、架构概要、变更记录（旧项目经 baton-migrate 迁移，旧内容标注"由旧文档迁移"） |
| `constraints.md` | ✅ 修订记录 | 详细 | 硬性红线清单、处理流程、文档约束 |
| `validation_matrix.md` | ✅ 修订记录 | 详细 | 范围→最低验证→高风险补充表 + 变更级别→验证强度表 |
| `tasks/task_schema.md` | ✅ 修订记录 | 详细 | ID 规则、状态机、DoR、DoD |
| `tasks/task_todo.md` | ✅ 修订记录 | 表（简写） | 优先级/任务ID/事项/状态/完成条件 |
| `tasks/task_progress.md` | ✅ 修订记录 | 表（简写） | 进行中任务 + 当前进度 + 唯一下一步 |
| `tasks/task_finished.md` | ✅ 修订记录 | 详细（追加式） | 完成条目：日期/验收/结果/证据/边界/关联 |
| `knowledge/tech_decision.md` | ✅ 修订记录 | 详细（追加式） | 决策条目 `TD-YYYYMMDD-NNN`：状态/适用模块/最后验证/决策/替代方案/取舍/验证/边界 |
| `knowledge/pit_experience.md` | ✅ 修订记录 | 详细（追加式） | 坑点条目：状态/现象/根因/稳定方案/自测边界；只记已验证坑点 |
| `ui_spec/*.md` | ✅ 修订记录 | 详细（追加式） | 保存设计规范的分册；冲突保留历史、标当前有效 |
| `requirements/*.md` | ✅ 修订记录 | 详细 | 文档状态（关联任务/确认日期/取代/保留）、定位、问题陈述、需求清单、边界 |
| `daily_log/daily_YYYY-MM-DD.md` | 天然追加（无修订记录） | 简写 | 当日条目流水，最新在末；每天一份 |
| `state/*.json` | N/A（机器层） | 结构化 | 只读投影/任务/索引；人工不手改 |

**写档顺序**：先更新最具体文件（tasks/日报/handoff），再更新索引层（archive_index.json）。handoff 最后写，写完即视为可接手点。
**事实优先级**：Git/真实文件/新鲜验证 > state/*.json > 交接/日报 > 聊天自述。

## 纪律清单（Forbidden Change）

禁止：自由扩大需求｜擅自改架构｜顺手大重构｜删除成熟功能｜修改冻结设计｜无关格式化｜增加未批准模块｜把用户原型改成自己喜欢的样子｜为"清理现场"执行危险 Git（force push / reset --hard / 危险 clean / 未授权 rebase / 丢弃 dirty）。

## 验收红线清单（20 条，任一条存在 = 总验收 FAIL）

> baton_accept = 结构验收（骨架/状态/安全/发布核验）+ 行为机械核对：**已验收（completed）任务必须有 baton_record_actual 执行证据**；月报中 actual_model == reviewer_model 且均非 unknown 的记录 = 假 Reviewer → FAIL。Contract/Fidelity/证据质量等行为红线由 AI 按本清单自检。

> 来源：需求清单 §58「最终不可接受的情况」。每次「下班啦」、每个里程碑、每次 baton_accept 都必须对照本清单自检。

| # | 红线 | 判定方式 |
|---|---|---|
| 1 | 改按钮/文案/颜色花一小时 | Micro 任务必须主会话直做，不改动时长超过必要 |
| 2 | 普通任务烧大量 Pro Token | micro/bounded 走主会话或 flash，complex 以上才 pro |
| 3 | AI 偏离已确认原型 | Fidelity 对照冻结原型，偏差即 FAIL |
| 4 | 自由改架构 | 冻结点改动必须退回用户确认并留痕 |
| 5 | 随便扩大需求范围 | 开工预锁 allowed_paths；closeout 用真实 diff 对比，越界且无 user: 豁免 FAIL |
| 6 | 存过设计规范又自由设计 | UI 任务必须先定位 ui_spec 相关分册并引用 |
| 7 | 假 Reviewer（自审自说通过） | 审查者必须独立；执行者自述不算证据 |
| 8 | 假 Fidelity | Fidelity 必须对照冻结需求/原型/设计规范输出差异清单 |
| 9 | 假 actual model | actual 以宿主记录为准，无法确认记 unknown，禁止自报 |
| 10 | 插件逻辑对但真实环境没生效 | 关键断言必须有真实命令输出/SHA 证据 |
| 11 | 本地 commit 误报远端成功 | 远端 SHA == 本地 HEAD 才算 push 完成 |
| 12 | 下班了 GitHub 没有代码 | verify_push 未通过 = 下班未完成 |
| 13 | 正常 Git 还要用户补 PowerShell | 下班全流程自动 commit/push/核验，用户零手工 |
| 14 | 管理成本比开发还高 | 口令自动化，用户不当运维 |
| 15 | 每 Bug 就整体重构 | 按 Bug 分类修对应模块，禁止推倒重来 |
| 16 | 换会话失忆 | 交接末条 + current + 索引可一句话恢复 |
| 17 | 换电脑无法恢复 | 记忆随 Git 同步，clone 后「上班啦」即恢复 |
| 18 | 历史 Memory 越积越大每次全读 | 索引先行、渐进式读取、3MB 分卷、禁止全量扫描 |
| 19 | 用 PASS 掩盖真实失败 | 有 FAIL 项必须报告 FAIL，禁止粉饰 |
| 20 | remote 指向开源发布库还继续 push（把项目记忆推公开） | 插件硬阻断（上班警告、下班不写不提交）；无插件模式 push 前必须 `git remote get-url` 核对，命中公开库即停 |

## 失败与恢复

- 失败刹车：同一根因两轮有证据尝试失败 → 停止编辑、不擅回滚、标阻塞、给一个诊断动作。
- 检查点：平台切换/长任务/高风险前写检查点（HEAD/修改文件/已验证/未验证/唯一下一步）；检查点不释放工作区。
- 异常接手：用户说「异常接手，我确认上一位代理已经停止」→ 只读清点 → 生成恢复方案 → 不删/不滚/不提交。

## 无插件模式（Claude / Cursor / Codex 等没有 baton_* 工具时）

**Baton 不依赖插件也能用，且不是阉割版**：所有状态文件都是普通 Markdown/JSON，按本规则手工读写即可。插件只是 DSH 上的机械化加速器（自动格式、自动索引、机械核验）；无插件时同一套规则由 AI 手工执行，**平台能力中的通用能力全部保留**。各口令的等价做法：

- **上班啦**：`git branch --show-current` / `git rev-parse HEAD` / `git status --short` 三查 → 读 `current.md`、`handoff_current.md` 末条、`state/tasks.json` 未完成任务 → 按「任务表格式」输出表格；交接末条含「持有中/检查点」则保持只读并报告。
- **下班啦**：`git status --short` 核对范围 → 追加日报（当日文件不存在时先建带头文件）→ 更新 current.md/handoff（handoff 最后写；均须保留【归档分卷索引】+【修订记录】并在修订记录追加一行）→ `git add -A && git commit` → `git push origin <分支>` → `git ls-remote origin <分支>` 与本地 HEAD 比对，一致才算完成；命中 protected_paths 必须 FAIL。
- **继续工作**：读 `current.md` + handoff 末条 + `state/archive_index.json` 最近条目，输出下一步。
- **保存设计规范 / 记入记忆**：按模板追加 `ui_spec/`、`knowledge/` 文件，并追加 archive_index.json 条目（标题/路径/摘要/关键词/行号）。
- **查历史**：先在 archive_index.json 里按关键词匹配，再只读命中文件片段；禁止全量读取。
- **自动模型分派**：规则照常生效——读 `.baton/config.json` 的 routing 表取 recommended；分派用本平台的子代理机制（Claude Code 用内置 Subagents/Task，Codex 用内置子代理，Cursor 用 Agent）；complex/architecture/high-risk 派发时提示词写明范围+检查点+「从这里继续，不重做」。**实际模型记录降级**：主会话知道自己当前模型则记 requested，无法核实子代理实际模型一律记 unknown，禁止编造。
- **完成 / 记录需求变更 / Git 自然语言**：按「口令」章节的规则手工执行等价动作（更新 tasks.json、overview.md、执行 git 命令）。

**唯一真实损失**（仅 DSH 用户对比插件模式）：手工执行没有自动格式纠错与一键机械核验，需要 AI 严格按模板自检。

## 常见错误表

| 错误 | 正确处理 |
|---|---|
| 把聊天当交接 | 要求文件与验证证据 |
| 用旧文档覆盖代码 | 以 Git/代码/新鲜验证纠偏 |
| 测试全绿就宣布完成 | 对照验收标准+独立复核 |
| 只说"已完成" | 转待验收、写交接、给出唯一下一步/可复制口令 |
| 假 fallback（推荐 A 实际 B 却报 A） | actual 以宿主记录为准，unknown 单列不污染统计 |
| 每遇 Bug 就重构 | 按 Bug 分类修对应模块（架构/实现/测试/Provider/Git/Memory） |
| 三端/多 AI 同时编辑同一工作区 | 单写入者：上班先查所有权，他人持有中保持只读并报告 |
| 未验证 Provider 却宣称可用 | 只有真实 health/credential/dispatch 验证过的模型才能标 verified 进池 |
| 全量扫描 docs/ai_memory 找一条记录 | 先 memory_query 命中索引，只读命中文件片段 |
