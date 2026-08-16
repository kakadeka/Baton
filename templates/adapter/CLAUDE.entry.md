## Baton 项目协作入口（Claude Code 端，勿删此段）

本项目使用 Baton 协作系统（skill：`baton`，位于 `.claude/skills/baton/SKILL.md`）。规则：

1. 用户说「上班啦」「下班啦」「继续工作」「保存设计规范」「完成」「更新项目文档」「Baton init」、回复任务编号、或 Git 自然语言请求时，**必须按 baton skill 执行**；本环境没有 `baton_*` 工具时，按 SKILL 的「无插件模式」章节用 git+文件手工等价执行。
2. 项目真相 = `docs/ai_memory/`（Git 同步，唯一长期记忆，禁止另建第二套）；`.baton/` 为本机私有。
3. 事实优先级：Git / 真实文件 / 新鲜验证 > `state/*.json` > 交接/日报 > 聊天自述。
4. 历史只增不改（只追加或标「已取代」）；危险 Git（force push / reset --hard / 危险 clean / 未授权 rebase）禁止。
5. 未做远端 SHA 核验（`git ls-remote origin <分支>` == 本地 HEAD）不得报告「下班完成」。
6. 查询历史先查 `state/archive_index.json`，再只读命中文件片段；禁止全量读取 `docs/ai_memory`。
