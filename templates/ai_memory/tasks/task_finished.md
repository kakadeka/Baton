# 已完成任务

## 【归档分卷索引】

- 当前文件未达到分卷阈值；当前无归档分卷。

## 【修订记录】

| 日期 | 修改人 | 变更概要 |
| --- | --- | --- |
| {{DATE}} | Cursor | Baton init 建立完成任务视图。 |

## 已完成条目（示例格式）

```markdown
## DC-YYYYMMDD-NNN｜<简短主题>

- 完成日期：YYYY-MM-DD
- 用户验收：通过 / 未验收
- 结果：（做了什么、交付了什么）
- 证据：（命令 → 结果，可验证）
- 边界：（没有动什么）
- 关联：（相关文档路径）
```

> 规则：任务完成时，把条目从 `task_progress.md` / `task_todo.md` 移到这里，在上方【修订记录】追加一行，并同步 `state/tasks.json` 与 `state/archive_index.json`。
