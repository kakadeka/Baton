<!-- baton-src: README.md sha256:be1cbcf4ed42 status:current -->
# 🥁 Baton — 交接你的專案，而不是你的上下文。

<p align="center">
  <img src="../gittop.png" alt="Baton — Pass your project, not your context" width="100%">
</p>

<h2 align="center">換電腦、換 AI、換工作階段——一句話就能繼續工作。</h2>

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
  <a href="../README.md">English</a> ·
  <a href="README.zh.md">简体中文</a> ·
  繁體中文 ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.ar.md">العربية</a> ·
  <a href="README.th.md">ไทย</a>
</p>

**Baton 是一套專案接力協作系統。** 它讓 Claude Code、Codex、Cursor 與 DeepSeek Harness 輪流維護跨機器的**同一個專案**——進度、記憶、設計規範、任務與 Git 始終保持一致。**你只要正常說話，其餘交給它。**

**三大核心承諾：**

1. **🔄 任何人都能接手** —— 換 AI 工具或換機器，說一句指令，就能從你上次停下的地方精準接續。不必重新解釋專案。
2. **🎯 做到所要求的事** —— 任務邊界與受保護路徑在收尾時會進行機械式檢查，設計事實被鎖定進規範；其餘部分由規則加審核把關——偏差當下就被攔下，而不是幾小時後才發現。
3. **✅ 「完成」真的代表完成** —— 收尾會自動 commit、push，並**核驗遠端 SHA**——不再有「只在本地 commit、卻從未上 GitHub，卻被告知已完成」的情況。

---

<a id="quickstart"></a>
## 🚀 快速開始（DeepSeek Harness —— 一行指令）

> 正在使用 DeepSeek Harness？這裡就是你需要的一切。

```powershell
dsh plugin --profile web add @kakadeka/dsh-baton
```

1. 先安裝一次 DSH CLI：`npm i -g @deepseek-ai/dsh`
2. 貼上上面那行指令，按下 Enter。
3. 重新啟動 `dsh` —— 完成。全部 16 個 `baton_*` 工具現已在你的設定檔中生效。

> 也可以從 GitHub 安裝：`dsh plugin --profile web add github:kakadeka/Baton`
> 使用的是 **Codex / Claude Code / Cursor**？請跳到[安裝到其他 AI 工具](#-install-for-other-ai-tools-codex--claude--cursor)。

---

## 📖 使用情境（每種需求一則，痛點 → Baton 的解法）

| # | 痛點 | Baton 的解法 |
|---|---|---|
| 1 | 每天早上或換新機器時：是哪個分支？昨天做了什麼？遠端更新了嗎？ | 說 **clock in** —— 自動 git 檢查 + 安全同步 + 讀取交接/待辦 → 任務表 → 回覆一個編號 |
| 2 | 「本地已 commit 但沒 push」；晚上手動用 PowerShell 操作 git | 說 **clock out** —— 核驗 → 文件/記憶/指標 → commit → push → **「完成」前遠端 SHA == 本地 HEAD** |
| 3 | 完成任務和「結束一天」被混為一談 | 說 **complete task** —— 關閉任務、記錄成果、建議下一步。任務完成 ≠ 一天結束 |
| 4 | 已確認的設計被遺忘；AI 隨意發揮 | 說 **save design spec** —— 把設計事實鎖定進長期規範（衝突保留歷史）；UI 任務會自動參照它們 |
| 5 | 工作階段丟失、開新對話、一切都要重講 | 說 **continue work** —— 還原任務/分支/阻塞/交接/下一步。一句話，搞定 |
| 6 | 多個待辦；AI 不該自行決定優先順序；輸入完整任務很繁瑣 | 帶編號的任務表 —— 回覆 `1`/`2`/`3` |
| 7 | 專案歷史久遠、歷史難以取得；全部重讀耗費 token | 決策/坑點/規範自動建立索引；**查詢索引，只讀命中的片段** |
| 8 | Codex/Claude/Cursor 接力卻不知道上一個做了什麼 | 統一的交接檔案 —— 分支/HEAD/變更/約束/下一步。讀最後一條記錄，接著做 |
| 9 | 什麼都用昂貴模型；弱模型會出錯；手動切換很痛苦 | 依任務難度自動路由模型 —— 微型：主工作階段、一般：flash、複雜/審核：pro，並附帶備援鏈 |
| 10 | 「到底是哪個模型執行的？」帳單對不上 | 建議模型與實際模型分開記錄，來源如實標註（分派記錄 / 宿主描述子 / 未知） |
| 11 | 工作幾小時後 AI 偏離原型 | 凍結的需求 + 允許/受保護路徑 + 機械式範圍檢查 + 獨立審核 + 無危險 git |
| 12 | 改個按鈕顏色花了一小時 | 微型快速路徑 —— 無委派、無審核者、無不相關測試。簡單任務幾分鐘搞定 |
| 13 | 複雜任務不能寫得草率 | 逐級把關：契約、強模型、獨立審核者、對凍結規範的保真度、回滾計畫 |
| 14 | 辦公室與家裡的機器不同步；害怕丟失本地工作 | 安全 fetch + 僅 ff-only 同步（從不覆寫）、自動 commit/push、遠端 SHA 核驗；禁止 force/reset/clean |
| 15 | 憑感覺挑模型，沒有真實資料 | 每個任務都記錄實際模型與完成情況 → 每月儀表板；尚未收集的成功/失敗/耗時顯示為「未記錄」，絕不捏造 |
| 16 | 在新專案中重用/分享這套系統 | 框架與專案實例完全分離；`Baton init` 一鍵初始化；透過脫敏管線分享（無金鑰/路徑/私有筆記） |
| 17 | 安裝了其他會繞過專案規則的技能 | 外部技能可能有用，但專案邊界（路徑、設計規範、git 紀律）由 Baton 強制執行，並與 AGENTS.md 協調 |

## ✨ 功能特色（8 大能力區塊）

- **指令自動化** —— clock in / clock out / continue work / save design spec / complete task / update project docs / remember / Baton init / 數字確認 / git 自然語言
- **跨 AI 與跨機器** —— 純文字專案真相 + 一條指令的輕量轉接器（Codex/Claude/Cursor）+ 交接接力
- **長期記憶** —— 決策/坑點/規範自動歸檔 + 輕量索引；漸進式讀取，無需全部重讀
- **防偏離** —— 凍結（FROZEN）約束 + 允許/受保護路徑檢查 + 禁止變更清單 + 獨立審核 + 無危險 git
- **Git 真相迴路** —— 僅 ff-only 同步、自動 commit/push、**遠端 SHA == 本地 HEAD**、發布記錄（`last_published_sha`）
- **自動模型路由** —— 任務層級 × 規則表（flash/pro + high/max + 備援）；建議模型與實際模型透明記錄
- **每月儀表板** —— 模型排行 / 每小時活動 / 每日明細 / 代理明細，皆來自真實執行資料
- **一鍵驗收** —— `baton_accept`：骨架/狀態/安全/數量檢查 → PASS/FAIL + 阻塞清單

## 🗣️ 指令（何時使用哪一個）

說出以下任何一句英文短語——在每個 AI 中意義都相同。中文使用者可以用中文說相同的指令（請透過頂部的連結查看中文版本）。

| Command | 何時 | 會發生什麼 |
|---|---|---|
| **clock in** / *start work* | 每天開始 / 新機器 / 新 AI | git 檢查 → 安全同步 → 交接與待辦 → 任務表（超過 7 天未檢查更新會順帶提示） |
| **clock out** / *end work* | 一天工作結束 | 核驗 → 文件/記憶/指標 → commit → push → **遠端 SHA 核驗** |
| **continue work** / *resume* | 工作階段丟失 / 更換工具 | 還原任務、分支、阻塞、交接末尾、下一步 |
| **save design spec** | 在你確認某項設計之後 | 鎖定進長期規範 + 索引；UI 任務會遵循它 |
| **complete task** | 某個任務完成、還有後續工作 | 關閉任務、記錄成果、建議下一步（不做完整收尾） |
| **update project docs** | 工作中途的檢查點 | 寫入進度 + 交接檢查點（工作區保持持有） |
| **remember this pitfall** / *record this decision* | 遇到坑點 / 做出決策 | 寫入長期記憶 + 自動索引 |
| **Baton init** | 第一次進入新專案 | 生成記憶骨架 + 設定（絕不覆寫） |
| 回覆 `1` / `2` / `3` | 任務表顯示時 | 該編號被持久化為當前任務，然後開始工作 |
| **release workspace** / *I confirm the previous agent stopped* | clock in 時發生持有權衝突 | 解鎖單一寫入者鎖 + 寫入釋放記錄 |
| **pull github** / *sync github* / *check git status* | 想手動操作 git | 輕量 git 路徑，無契約/審核流程 |
| **check update** | 想知道 Baton 有沒有新版 | 讀本機版本錨 + 實查 GitHub/npm 最新版，回報「已是最新 / 有新版」 |
| **update baton** / *upgrade baton* | 有新版想升級 | AI 全流程更新（git pull + 重跑安裝腳本 / npm update）並核驗版本一致 |

## 🛠️ 安裝到其他 AI 工具（Codex / Claude / Cursor）

> **安裝 = 複製一條指令、按下 Enter、等它跑完、再核驗一條指令。** 無需手動建立資料夾，無需手動複製檔案。
> DeepSeek Harness 使用者可以跳過這節——改用上面的一行式 Quick start 即可。

### 步驟 0：決定你需要哪種安裝方式（10 秒）

| 你的情況 | 安裝這個 | 安裝之後 |
|---|---|---|
| 多個專案——你想讓 Baton 在**這台機器上的每個專案**都能用 | **使用者層級**（每台機器一次） | 全機器通用；任何專案都能辨識這些指令 |
| 你想讓其他機器/AI 接手的**某一個特定專案** | **專案層級**（每個專案一次） | 專案自帶記憶骨架 + 三工具轉接器；`git clone` 後即可接續 |
| 兩者都要 | 先使用者層級，再專案層級 | 最完整 |

> 💡 **建議**：先跑使用者層級（30 秒），再在你真正的專案上跑專案層級（30 秒）。

### 步驟 1：下載 Baton（一次）

開啟 PowerShell（按下 `Win`、輸入 `powershell`、Enter），貼上這行：

```powershell
git clone https://github.com/kakadeka/Baton.git $HOME\Baton
```

> 沒有 git？請從 https://git-scm.com/download/win 安裝，重新開啟 PowerShell 後再貼一次。

### 步驟 2：選一種安裝類型並貼上它的指令

**選項 A——使用者層級（每台機器一次，涵蓋所有專案）**

```powershell
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope User
```

你會看到 `ok: [Codex] ...`、`ok: [Claude Code] ...`、`ok: [Cursor] ...` —— 三種 AI 工具的全域技能皆已安裝。

**選項 B——專案層級（每個專案一次，讓專案可攜）**

```powershell
cd C:\your\project\path
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope Project
```

你會看到一行成功訊息（專案層級安裝完成）以及建立的清單（記憶骨架 `docs/ai_memory`、設定 `.baton`、三份技能鏡像，以及 `AGENTS.md` / `CLAUDE.md` / `.cursorrules` 中的條目）。如果它說沒有 `.git`，請執行它印出的 `git init` 指令。

> 專案層級安裝完全自動，而且**無需 DeepSeek Harness 外掛即可運作**（免外掛模式）。

### 步驟 3：驗證（最重要的一步——一條指令）

在專案中，告訴你的 AI：

```
clock in
```

**✅ 成功**：AI 依 Baton 行事，並輸出一份狀態報告，包含分支、HEAD、工作樹狀態、當前任務與交接摘要，接著是類似這樣的任務表——

```
Task table: 1) ...
```

**❌ 沒反應？** 請依序檢查：

1. 你用的是哪個 AI？Claude Code → `~\.claude\skills\baton\SKILL.md`；Codex → `~\.agents\skills\baton\SKILL.md`；Cursor → `~\.cursor\skills\baton\SKILL.md`（使用者層級安裝會建立這三份）
2. 專案有沒有 `.git`？（沒有就 `git init` + 首次 commit）
3. 指令是否恰好是 **clock in**、沒有其他內容？
4. 專案有沒有 `docs/ai_memory/`？（專案層級安裝會建立它）

### 步驟 4：加入現有的 Baton 專案（新機器 / 新 AI）

在新機器上：安裝 git → `git clone` 你的專案 → 告訴你的 AI：

```
clock in  or  continue work
```

記憶、交接與任務都隨程式碼而來。直接接續——無需再安裝任何東西。

### 步驟 5：如何檢查 / 更新 Baton 版本

安裝時 Baton 會自動留下「版本錨」：使用者層級在三個全域技能資料夾（`version.json`），專案層級在 `.baton/version.json`。**你不需要自己記版本號**，對你的 AI 說：

| 指令 | 作用 |
|---|---|
| **check update** | AI 讀本機版本錨 + 實查 GitHub/npm 最新版，回報「已是最新」或「有新版 X.Y.Z」 |
| **update baton** | 有新版時 AI 全流程更新（git pull + 重跑安裝腳本 / npm update），並核驗本機版本與遠端一致才算完成 |

貼心提示：每天 **clock in** 時，如果超過 7 天沒檢查過更新，Baton 會順帶提醒一句「可檢查更新」。新版 SKILL 在**新工作階段**生效；DSH 組合包更新後需重啟。

### 一鍵腳本做了什麼（透明公開）

| 模式 | 自動執行的動作 |
|---|---|
| 使用者層級 | 把 `SKILL.md` 複製到三種 AI 工具（Codex / Claude Code / Cursor）的全域技能資料夾 |
| 專案層級 | ① `docs/ai_memory/` 骨架（含修訂紀錄 + 歸檔索引）② `.baton/config.json` ③ 追加 `.gitignore` ④ 三份技能鏡像 ⑤ 三個入口段（`AGENTS.md` / `CLAUDE.md` / `.cursorrules`，絕不覆寫你的規則） |

冪等：重複執行絕不覆寫你既有的文件與規則；只會補上缺少的部分。

## 📁 真相存放在哪裡

```
project/
├── docs/ai_memory/            ← long-term memory (Git-synced, AI-agnostic)
│   ├── index.md               ← read me first
│   ├── current.md             ← what's happening now
│   ├── handoff_current.md     ← handoff log (last entry = truth)
│   ├── state/                 ← tasks.json, archive_index.json, project_state.json
│   ├── knowledge/             ← tech_decision.md, pit_experience.md
│   ├── ui_spec/               ← design specs
│   ├── daily_log/             ← daily logs
│   └── agent_metrics/YYYY/MM/index.html  ← monthly dashboard
└── .baton/                    ← machine-local (gitignored): config, metrics, evidence
```

## 🛡️ 安全與設計

- 危險的 git 操作（force push / reset --hard / 危險的 clean / 未授權的 rebase）並不存在
- 同步一律僅 ff-only；出現分歧即停止並回報；絕不自動解決衝突
- 憑證絕不進入 Git / 記憶 / 指標 / 日誌
- 歷史只可追加，或標記為「已取代」——絕不覆寫
- 「完成」= 機械式證據（遠端 SHA + 發布記錄），而非口頭宣稱
- 節省 token 是一等公民目標：索引優先、依風險選模型、輸出有界、無冗餘呼叫

## 📦 儲存庫與授權

- 開放原始碼：https://github.com/kakadeka/Baton （僅公開套件，經由脫敏管線同步——不含私有計畫、工作階段筆記或憑證）
- npm: [@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- 授權：[Apache-2.0](../LICENSE)
