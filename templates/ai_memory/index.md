# {{NAME}} AI 记忆索引

## 【归档分卷索引】

- 当前文件未达到分卷阈值；当前无归档分卷。
- 分卷规则：单文件超过 3MB 时按完整条目或章节分卷，主文件保留当前有效内容、摘要和读取顺序；分卷只生成清单，用户确认后再归档。

## 【修订记录】

| 日期 | 修改人 | 变更概要 |
| --- | --- | --- |
| {{DATE}} | Cursor | Baton init 建立记忆索引。 |

更新时间：{{DATE}}

## 开工必读

按顺序读取：

1. `current.md`（当前工作摘要）
2. `handoff_current.md` 末条（最近交接事实）
3. `tasks/task_progress.md`（进行中任务）
4. `tasks/task_todo.md`（待办）
5. `overview.md`（项目总览）
6. 当前任务关联的需求、协议、原型或文档

## 当前主线

- 当前任务：（无）
- 当前阶段：（未开始）
- 唯一下一步：说「上班啦」开始工作

## 权威入口

- 项目总览与需求清单：`overview.md`
- 编码与开发红线：`constraints.md`
- 用户口令：`commands.md`
- 交接审计：`handoff_current.md`
- 验证矩阵：`validation_matrix.md`
- 任务：`tasks/`
- 技术决策：`knowledge/tech_decision.md`
- 坑点经验：`knowledge/pit_experience.md`
- 设计规范：`ui_spec/`
- 需求基线：`requirements/`
- 日报：`daily_log/`
- 历史索引（机器层）：`state/archive_index.json`

## 未来新文档命名规则

- `current.md`、`handoff_current.md`、`index.md`、`commands.md` 与 `state/` 下结构化文件保持固定名称。
- 新任务/计划/决策/坑点文档有稳定 ID 时以 ID 开头，再接简短主题和类型，例如 `DC-YYYYMMDD-NNN_<topic>_plan.md`；日报使用 `daily_YYYY-MM-DD.md`。
- 既有历史文件保留原名，不为统一外观批量改名；合法迁移必须保持稳定 ID，并同步引用与 `archive_index.json`。
