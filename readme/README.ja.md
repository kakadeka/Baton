<!-- baton-src: README.md sha256:be1cbcf4ed42 status:current -->
# 🥁 Baton — 引き継ぐのはプロジェクト。コンテキストではない。

<p align="center">
  <img src="../gittop.png" alt="Baton — Pass your project, not your context" width="100%">
</p>

<h2 align="center">PCを替えても、AIを替えても、セッションを替えても — たった一言で作業を続けられます。</h2>

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
  <a href="README.zh-TW.md">繁體中文</a> ·
  日本語 ·
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

**Baton は、プロジェクトを引き継ぐためのコラボレーションシステムです。** Claude Code、Codex、Cursor、DeepSeek Harness が、複数のマシンにまたがって**同じプロジェクト**を交代で保守できるようにします — 進捗・メモリ・設計仕様・タスク・Git が常に一貫します。**あなたは普通に話すだけ。あとは Baton がやります。**

**3つの核となる約束:**

1. **🔄 誰でも引き継げる** — AIツールやマシンを切り替えても、1つのコマンドを言うだけで、中断したところから正確に再開できます。プロジェクトを再説明する必要はありません。
2. **🎯 依頼されたことを確実に実行する** — タスクの境界と保護対象パスは締めの段階で機械的にチェックされ、設計上の事実は仕様にロックされます。それ以外はルールとレビューで守られ、逸脱は数時間後に発覚するのではなく、その場で検出されます。
3. **✅ 「完了」が本当に完了を意味する** — 締めでは自動でコミットとプッシュを行い、**リモート SHA を検証**します — 「ローカルではコミットしたが GitHub には無いのに、完了と言われた」ということがもう起こりません。

---

<a id="quickstart"></a>
## 🚀 クイックスタート（DeepSeek Harness — 1行）

> DeepSeek Harness をお使いですか？これだけで十分です。

```powershell
dsh plugin --profile web add @kakadeka/dsh-baton
```

1. DSH CLI を一度インストールします：`npm i -g @deepseek-ai/dsh`
2. 上の1行を貼り付けて、Enter を押します。
3. `dsh` を再起動すれば完了です。16個の `baton_*` ツールがすべてプロファイルで有効になります。

> GitHub からもインストール可能です：`dsh plugin --profile web add github:kakadeka/Baton`
> 代わりに **Codex / Claude Code / Cursor** をお使いですか？[他のAIツールへのインストール](#-install-for-other-ai-tools-codex--claude--cursor)へ移動してください。

---

## 📖 シナリオ（要件ごとに1つ、課題 → Baton の答え）

| # | 課題 | Baton の答え |
|---|---|---|
| 1 | 毎朝や新しいマシンで：どのブランチ？昨日何をやった？リモートは最新？ | **clock in** と言う — 自動 git チェック＋安全な同期＋引き継ぎ/タスクの読み込み → タスク表 → 番号で返答 |
| 2 | 「ローカルではコミットしたがプッシュしていない」；夜に手作業の PowerShell git | **clock out** と言う — 検証 → ドキュメント/メモリ/メトリクス → コミット → プッシュ → **「完了」の前に リモート SHA == ローカル HEAD** |
| 3 | タスクの完了と「一日の終わり」が混同されてしまう | **complete task** と言う — タスクを閉じ、結果を記録し、次を提案。タスク完了 ≠ 一日の終わり |
| 4 | 確定したデザインが忘れられ、AI が勝手に変えてしまう | **save design spec** と言う — 設計上の事実を長期仕様にロック（競合は履歴を保持）；UI タスクは自動でそれを参照 |
| 5 | セッションが失われ、新しい会話で全部を再説明するはめになる | **continue work** と言う — タスク/ブランチ/ブロッカー/引き継ぎ/次のステップを復元。一言で完了 |
| 6 | タスクが複数；優先度は AI が決めるべきではない；全文入力は面倒 | 番号付きタスク表 — `1`/`2`/`3` で返答 |
| 7 | 長期プロジェクトで履歴にアクセスできない；全部を読み返すとトークンを浪費 | 決定/落とし穴/仕様を自動インデックス化；**インデックスを検索し、ヒットした断片だけを読む** |
| 8 | Codex/Claude/Cursor が前の担当者の作業内容を知らずに引き継ぐ | 統一された引き継ぎファイル — ブランチ/HEAD/変更/制約/次のステップ。最後のエントリを読んで続行 |
| 9 | 何にでも高価なモデルを使う；弱いモデルはミスをする；手動での切り替えは面倒 | タスク難易度によるモデル自動ルーティング — micro: メインセッション、normal: flash、complex/review: pro、フォールバックチェーン付き |
| 10 | 「実際に動いたモデルはどれ？」請求と合わない | 推奨と実際を分けて記録し、出所を正直にラベル付け（分派記録 / ホスト記述子 / 不明） |
| 11 | 何時間も作業した後、AI がプロトタイプから逸脱する | 凍結された要件＋許可/保護パス＋機械的なスコープチェック＋独立レビュー＋危険な git なし |
| 12 | ボタンの色を変えるのに1時間かかった | Micro ファストパス — 委譲なし、レビューアーなし、無関係なテストなし。単純なタスクは数分で完了 |
| 13 | 複雑なタスクをいい加減に書いてはいけない | 段階的なゲート：契約、強力なモデル、独立レビューアー、凍結仕様への忠実度、ロールバック計画 |
| 14 | 会社と自宅のマシンが同期していない；ローカルの作業を失う不安 | 安全な fetch＋ff-only 同期（決して上書きしない）、自動コミット/プッシュ、リモート SHA 検証；force/reset/clean は禁止 |
| 15 | 感覚でモデルを選び、実データがない | 全タスクが実際のモデルと完了状況を記録 → 月次ダッシュボード；まだ収集されていない成功/失敗/所要時間は「記録なし」と表示され、決して捏造されない |
| 16 | 新しいプロジェクトでシステムを再利用/共有する | フレームワークとプロジェクトインスタンスを完全分離；`Baton init` のワンショット・ブートストラップ；サニタイズパイプラインで共有（キー/パス/プライベートメモなし） |
| 17 | プロジェクトのルールを迂回する他のスキルがインストールされている | 外部スキルは役立つこともあるが、プロジェクトの境界（パス、設計仕様、git 規律）は Baton が強制し、AGENTS.md と連携する |

## ✨ 機能（8つの機能ブロック）

- **コマンド自動化** — clock in / clock out / continue work / save design spec / complete task / update project docs / remember / Baton init / number confirm / git natural language
- **AI横断・マシン横断** — プレーンテキストのプロジェクト真実＋1コマンドの薄いアダプタ（Codex/Claude/Cursor）＋引き継ぎリレー
- **長期メモリ** — 決定/落とし穴/仕様の自動アーカイブ＋軽量インデックス；段階的な読み取り、全量読み直しなし
- **逸脱防止** — FROZEN 制約＋許可/保護パスのチェック＋変更禁止リスト＋独立レビュー＋危険な git なし
- **Git 真実ループ** — ff-only 同期、自動コミット/プッシュ、**リモート SHA == ローカル HEAD**、公開記録（`last_published_sha`）
- **モデル自動ルーティング** — タスク階層 × ルール表（flash/pro＋high/max＋フォールバック）；推奨と実際を透過的に記録
- **月次ダッシュボード** — モデルランキング / 時間別アクティビティ / 日次詳細 / エージェント詳細。実際の実行データに基づく
- **ワンクリック受入** — `baton_accept`: 骨格/状態/セキュリティ/量のチェック → PASS/FAIL＋ブロックリスト

## 🗣️ コマンド（それぞれを使うタイミング）

以下の英語フレーズのどれかを言ってください — どの AI でも意味は同じです。中国語話者は同じコマンドを中国語で使えます（上部のリンクから中国語版をご覧ください）。

| Command | 使うタイミング | 何が起きるか |
|---|---|---|
| **clock in** / *start work* | 毎日の開始 / 新しいマシン / 新しい AI | git チェック → 安全な同期 → 引き継ぎ＆タスク → タスク表 |
| **clock out** / *end work* | 一日の作業終了時 | 検証 → ドキュメント/メモリ/メトリクス → コミット → プッシュ → **リモート SHA 検証** |
| **continue work** / *resume* | セッション消失 / ツール切り替え時 | タスク、ブランチ、ブロッカー、引き継ぎ末尾、次のステップを復元 |
| **save design spec** | デザインを確定した後 | 長期仕様＋インデックスにロック；UI タスクはそれに従う |
| **complete task** | タスクが1つ終わり、まだ残りがあるとき | タスクを閉じ、結果を記録し、次を提案（完全な締めではない） |
| **update project docs** | 作業途中のチェックポイント | 進捗＋引き継ぎチェックポイントを記録（ワークスペースは保持されたまま） |
| **remember this pitfall** / *record this decision* | 落とし穴にハマった / 決定を下したとき | 長期メモリに書き込み＋自動インデックス化 |
| **Baton init** | 新しいプロジェクトで初回 | メモリ骨格＋設定を生成（決して上書きしない） |
| reply `1` / `2` / `3` | タスク表が表示されたとき | その番号が現在のタスクとして永続化され、作業が始まる |
| **release workspace** / *I confirm the previous agent stopped* | clock in 時の所有権競合 | 単一書き手ロックを解除し、解放メモを記録 |
| **pull github** / *sync github* / *check git status* | 手動で git 操作したいとき | 軽量な git パス、契約/レビューの儀式なし |
| **check update** | Baton の新しいバージョンがあるか？ | ローカルのバージョンアンカーを読み、GitHub/npm の最新版を照会して結果を報告する |
| **update baton** / *upgrade baton* | 新しいバージョンが公開された | AI が更新をすべて実行し（git pull + インストール再実行 / npm update）、ローカル == リモートを検証する |

## 🛠️ 他のAIツールへのインストール（Codex / Claude / Cursor）

> **インストール＝コマンドを1つコピーし、Enter を押して完了を待ち、1つのコマンドを検証するだけ。** 手動でのフォルダ作成も、手動でのファイルコピーもありません。
> DeepSeek Harness ユーザーはここをスキップできます — 代わりに上の1行のクイックスタートを使ってください。

### ステップ 0: 必要なインストールを決める（10秒）

| あなたの状況 | インストールするもの | インストール後 |
|---|---|---|
| 複数プロジェクト — **このマシンのすべてのプロジェクト**で Baton を使いたい | **ユーザーレベル**（マシンごとに1回） | このマシン全体で有効；どのプロジェクトでもコマンドを認識 |
| 他のマシン/AI に引き継がせたい**特定のプロジェクト**が1つ | **プロジェクトレベル**（プロジェクトごとに1回） | プロジェクトが独自のメモリ骨格＋3ツール・アダプタを持つ；`git clone` して続行 |
| 両方 | まずユーザーレベル、次にプロジェクトレベル | 最も完全 |

> 💡 **推奨**：ユーザーレベル（30秒）を実行し、その後実際のプロジェクトでプロジェクトレベル（30秒）を実行。

### ステップ 1: Baton をダウンロード（1回）

PowerShell を開き（`Win` を押し、`powershell` と入力して Enter）、この1行を貼り付けます：

```powershell
git clone https://github.com/kakadeka/Baton.git $HOME\Baton
```

> git がありませんか？ https://git-scm.com/download/win からインストールし、PowerShell を開き直して、もう一度貼り付けてください。

### ステップ 2: インストール種別を1つ選び、そのコマンドを貼り付ける

**オプション A — ユーザーレベル（マシンごとに1回、すべてのプロジェクト）**

```powershell
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope User
```

`ok: [Codex] ...`、`ok: [Claude Code] ...`、`ok: [Cursor] ...` と表示されます — 3つのAIツールすべてのグローバルスキルがインストールされます。

**オプション B — プロジェクトレベル（プロジェクトごとに1回、プロジェクトをポータブルにする）**

```powershell
cd C:\your\project\path
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope Project
```

成功行（プロジェクトレベル・インストール完了）と、作成された一覧（メモリ骨格 `docs/ai_memory`、設定 `.baton`、3つのスキルミラー、`AGENTS.md` / `CLAUDE.md` / `.cursorrules` へのエントリ）が表示されます。`.git` が無いと言われた場合は、表示された `git init` コマンドを実行してください。

> プロジェクトレベル・インストールは完全に自動で、**DeepSeek Harness プラグインなしでも動作します**（プラグインフリーモード）。

### ステップ 3: 検証（重要なもの — 1コマンド）

プロジェクト内で、AI にこう伝えます：

```
clock in
```

**✅ 成功**：AI が Baton に従って動作し、ブランチ、HEAD、作業ツリーの状態、現在のタスク、引き継ぎサマリを含むステータスレポートを出力し、その後に次のようなタスク表が続きます —

```
Task table: 1) ...
```

**❌ 何も起きませんか？** 順番に確認してください：

1. どの AI を使っていますか？ Claude Code → `~\.claude\skills\baton\SKILL.md`；Codex → `~\.agents\skills\baton\SKILL.md`；Cursor → `~\.cursor\skills\baton\SKILL.md`（ユーザーレベル・インストールは3つすべてを作成）
2. プロジェクトに `.git` はありますか？（なければ `git init`＋最初のコミット）
3. コマンドは正確に **clock in** だけで、他に何も含まれていませんか？
4. プロジェクトに `docs/ai_memory/` はありますか？（プロジェクトレベル・インストールが作成します）

### ステップ 4: 既存の Baton プロジェクトに参加する（新しいマシン / 新しい AI）

新しいマシンで：git をインストール → プロジェクトを `git clone` → AI にこう伝えます：

```
clock in  or  continue work
```

メモリ、引き継ぎ、タスクはコードと一緒に付いてきます。そのまま続行してください — 他にインストールするものはありません。

### ワンクリック・スクリプトが行うこと（透明性）

| モード | 自動的に行うこと |
|---|---|
| ユーザーレベル | 3つのAIツール（Codex / Claude Code / Cursor）のグローバルスキルフォルダに `SKILL.md` をコピー |
| プロジェクトレベル | ① `docs/ai_memory/` 骨格（改訂ログ＋アーカイブインデックス付き）② `.baton/config.json` ③ `.gitignore` への追記 ④ 3つのスキルミラー ⑤ 3つのエントリセグメント（`AGENTS.md` / `CLAUDE.md` / `.cursorrules`、あなたのルールは決して上書きしない） |

冪等性：再実行しても既存のドキュメントやルールを決して上書きしません。不足しているものだけを補います。

## 📁 真実が存在する場所

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
└── .baton/                    ← machine-local (gitignored except config.json): config, metrics, evidence
```

## 🛡️ 安全性と設計

- 危険な git（force push / reset --hard / 危険な clean / 許可されていない rebase）は存在しない
- 同期は ff-only のみ。分岐したら停止して報告し、競合を自動解決することは決してない
- 資格情報は Git / メモリ / メトリクス / ログに決して入らない
- 履歴は追記のみ、または「置き換え済み」とマークされる — 決して上書きされない
- 「完了」＝機械的な証拠（リモート SHA＋公開記録）であり、口頭の主張ではない
- トークン節約は第一級の目標：インデックス優先、リスクベースのモデル、出力の上限、冗長な呼び出しなし

## 📦 リポジトリとライセンス

- オープンソース：https://github.com/kakadeka/Baton（公開パッケージのみ。サニタイズパイプラインで同期 — プライベートな計画、セッションメモ、資格情報は含まれない）
- npm: [@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- ライセンス: [Apache-2.0](../LICENSE)
