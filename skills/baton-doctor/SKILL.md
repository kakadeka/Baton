---
name: baton-doctor
description: Baton 项目健康诊断与能力自检（版本/漂移/骨架/发布面/凭据清单）。只读，不修改任何文件。触发：用户要求体检、诊断、看 Baton 状态、为什么口令没反应时使用。
---

# baton-doctor（只读健康诊断）

## 检查清单

1. **版本锚**：读项目 `.baton/version.json` 与三端全局 skill 目录 `version.json`；报告本地版本 / npm latest（`npm view @kakadeka/dsh-baton version`，受限环境加 `--cache <工作区临时目录>`）/ 公开库 SHA（`git ls-remote https://github.com/kakadeka/Baton refs/heads/master`）。锚缺失 = 提示重跑 install 补锚。
2. **Skill 漂移**：四份 SKILL（canonical + 三端镜像）内容一致？项目内可用 `node scripts/check-drift.mjs`（有脚本时）。
3. **骨架完整**：`docs/ai_memory/` 关键文件存在且含【归档分卷索引】+【修订记录】两区块；`.baton/config.json` 可解析。
4. **Git 状态**：分支/HEAD/工作区干净/远端同步（`git fetch` 只读检查 ahead/behind；**不做任何写入**）。
5. **单写入者锁**：`git show-ref refs/baton/ownership-lock` 是否存在、state.ownership 状态。
6. **发布面**（框架仓库场景）：公开库 CI（GitHub Actions）最近 run 结论、npm latest 与 tag 对齐、公开库历史连续（`git log --oneline`）。
7. **凭据红线自检**：最近 diff 与待提交文件扫描（`git status --porcelain` + 敏感模式）——报告命中清单，**绝不显示命中正文**。

## 输出格式

```text
## Baton doctor 报告 <时间>
- 版本：本地 vX / npm latest vY / 公开 SHA <8位>（对齐/落后/漂移）
- Skill：四份一致 / 漂移点名
- 骨架：完整 / 缺失清单
- Git：分支 / HEAD / 干净 / ahead/behind
- 锁：holding(<owner 前 8 位>) / released / 无 ref
- 发布面：CI 最近 <成功/失败> / tag 对齐 / 历史连续
- 凭据：命中 N 处（只列文件名）/ 零命中
- 建议：<唯一下一步>
```

## 边界

- 只读：不修改、不 commit、不 push、不抢锁。
- 诊断结论标注证据来源（命令 → 结果）；无法验证的写「未验证」，不得 PASS。
- 修复动作（补锚/同步镜像/修复骨架）必须回到 Baton 正常口令流程，doctor 不越权执行。
