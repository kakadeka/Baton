<!-- baton-src: README.md sha256:be1cbcf4ed42 status:current -->
# 🥁 Baton — 컨텍스트가 아니라 프로젝트를 넘기세요.

<p align="center">
  <img src="../gittop.png" alt="Baton — Pass your project, not your context" width="100%">
</p>

<h2 align="center">컴퓨터를 바꾸고, AI를 바꾸고, 세션을 바꿔도 — 한 문장으로 작업을 이어가세요.</h2>

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
  <a href="README.ja.md">日本語</a> ·
  한국어 ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.ar.md">العربية</a> ·
  <a href="README.th.md">ไทย</a>
</p>

**Baton은 프로젝트 릴레이(이어달리기) 협업 시스템입니다.** Claude Code, Codex, Cursor, DeepSeek Harness가 여러 머신에서 **같은 프로젝트**를 번갈아 가며 유지보수하도록 해줍니다 — 진행 상황, 메모리, 설계 스펙, 작업, Git이 일관되게 유지됩니다. **당신은 평소처럼 말하기만 하면 되고, 나머지는 Baton이 처리합니다.**

**세 가지 핵심 약속:**

1. **🔄 누구나 이어받을 수 있습니다** — AI 도구나 머신을 바꿔도 명령 한 번으로 중단했던 지점에서 정확히 이어갑니다. 프로젝트를 다시 설명할 필요가 없습니다.
2. **🎯 요청받은 일을 그대로 수행합니다** — 작업 경계와 보호 경로는 마감 시 기계적으로 검사되고, 설계 사실은 스펙에 고정됩니다. 나머지는 규칙과 리뷰로 지켜집니다 — 이탈(drift)은 몇 시간 뒤에 발견되는 게 아니라 즉시 잡힙니다.
3. **✅ "완료"는 정말로 완료를 뜻합니다** — 마감 시 자동으로 커밋하고, 푸시하고, **원격 SHA를 검증합니다** — 더 이상 "로컬에만 커밋되고 GitHub에는 올라가지 않았는데 완료라고 말하는" 일은 없습니다.

---

<a id="quickstart"></a>
## 🚀 빠른 시작 (DeepSeek Harness — 한 줄)

> DeepSeek Harness를 사용 중이라면? 이 한 줄이면 충분합니다.

```powershell
dsh plugin --profile web add @kakadeka/dsh-baton
```

1. DSH CLI를 한 번 설치합니다: `npm i -g @deepseek-ai/dsh`
2. 위의 줄을 붙여넣고 Enter를 누르세요.
3. `dsh`를 다시 시작하면 끝입니다. 이제 16개의 `baton_*` 도구가 프로필에서 활성화됩니다.

> GitHub에서도 설치할 수 있습니다: `dsh plugin --profile web add github:kakadeka/Baton`
> **Codex / Claude Code / Cursor**를 사용 중이라면? [다른 AI 도구용 설치](#%EB%8B%A4%EB%A5%B8-ai-%EB%8F%84%EA%B5%AC%EC%9A%A9-%EC%84%A4%EC%B9%98-codex--claude--cursor)로 이동하세요.

---

## 📖 시나리오 (요구사항별 하나씩, 문제 → Baton의 해답)

| # | 문제 | Baton의 해답 |
|---|---|---|
| 1 | 매일 아침이나 새 머신에서: 어떤 브랜치지? 어제 뭘 했지? 원격이 갱신됐나? | **clock in**이라고 말하세요 — 자동 git 점검 + 안전한 동기화 + 인수인계/할 일 읽기 → 작업 테이블 → 번호로 답장 |
| 2 | "로컬에 커밋만 하고 푸시는 안 함"; 밤마다 수동 PowerShell git | **clock out**이라고 말하세요 — 검증 → 문서/메모리/지표 → 커밋 → 푸시 → **"완료" 전에 원격 SHA == 로컬 HEAD** |
| 3 | 작업 완료와 "하루 마감"이 뒤섞임 | **complete task**라고 말하세요 — 작업 종료, 결과 기록, 다음 단계 제안. 작업 완료 ≠ 하루 마감 |
| 4 | 확정된 설계가 잊히고 AI가 제멋대로 함 | **save design spec**이라고 말하세요 — 설계 사실을 장기 스펙에 고정(충돌은 이력 보존); UI 작업이 자동 참조 |
| 5 | 세션을 잃고 새 대화에서 전부 다시 설명 | **continue work**라고 말하세요 — 작업/브랜치/막힌 점/인수인계/다음 단계 복원. 한 문장이면 끝 |
| 6 | 할 일이 많음; AI가 우선순위를 정하면 안 됨; 전체 작업을 타이핑하기 번거로움 | 번호가 붙은 작업 테이블 — `1`/`2`/`3`로 답장 |
| 7 | 긴 프로젝트, 이력 접근 불가; 전부 다시 읽으면 토큰 낭비 | 결정/함정/스펙 자동 인덱싱; **인덱스를 조회하고, 일치하는 조각만 읽기** |
| 8 | Codex/Claude/Cursor가 이전 AI가 뭘 했는지 모른 채 릴레이 | 통합 인수인계 파일 — 브랜치/HEAD/변경사항/제약/다음 단계. 마지막 항목을 읽고 계속 |
| 9 | 모든 일에 비싼 모델 사용; 약한 모델은 실수; 수동 전환은 고통 | 작업 난이도별 자동 모델 라우팅 — micro: 메인 세션, normal: flash, complex/review: pro, 폴백 체인 포함 |
| 10 | "실제로 어떤 모델이 돌았지?" 비용이 안 맞음 | 추천 모델 vs 실제 모델을 분리 기록, 출처를 정직하게 표기 (디스패치 기록 / 호스트 디스크립터 / 알 수 없음) |
| 11 | 몇 시간 작업 후 AI가 프로토타입에서 이탈 | 동결된 요구사항 + 허용/보호 경로 + 기계적 범위 검사 + 독립 리뷰 + 위험한 git 없음 |
| 12 | 버튼 색 하나 바꾸는 데 한 시간이 걸림 | Micro 고속 경로 — 위임 없음, 리뷰어 없음, 불필요한 테스트 없음. 단순 작업은 몇 분이면 끝 |
| 13 | 복잡한 작업은 대충 작성하면 안 됨 | 단계적 게이트: 계약, 강력한 모델, 독립 리뷰어, 동결 스펙 대비 충실도, 롤백 계획 |
| 14 | 회사와 집 머신이 동기화 안 됨; 로컬 작업 유실 걱정 | 안전한 fetch + ff-only 동기화 (덮어쓰지 않음), 자동 커밋/푸시, 원격 SHA 검증; force/reset/clean 금지 |
| 15 | 감으로 모델 선택, 실제 데이터 없음 | 모든 작업이 실제 모델과 완료 여부를 기록 → 월간 대시보드; 아직 수집되지 않은 성공/실패/소요시간은 "기록 없음"으로 표시, 절대 조작 안 함 |
| 16 | 새 프로젝트에 시스템 재사용/공유 | 프레임워크와 프로젝트 인스턴스 완전 분리; `Baton init` 일회성 부트스트랩; 민감정보 제거 파이프라인으로 공유 (키/경로/비공개 메모 없음) |
| 17 | 프로젝트 규칙을 우회하는 다른 스킬 설치 | 외부 스킬도 도움이 되지만, 프로젝트 경계(경로, 설계 스펙, git 규율)는 Baton이 강제하며 AGENTS.md와 조율 |

## ✨ 기능 (8개 역량 블록)

- **명령 자동화** — clock in / clock out / continue work / save design spec / complete task / update project docs / remember / Baton init / 번호 확인 / git 자연어
- **AI·머신 간 교차** — 평문(plain-text) 프로젝트 진실 + 명령 하나짜리 경량 어댑터 (Codex/Claude/Cursor) + 인수인계 릴레이
- **장기 메모리** — 결정/함정/스펙 자동 보관 + 경량 인덱스; 점진적 읽기, 전체 재독서 없음
- **이탈 방지** — 동결된(FROZEN) 제약 + 허용/보호 경로 검사 + 변경 금지 목록 + 독립 리뷰 + 위험한 git 없음
- **Git 진실 루프** — ff-only 동기화, 자동 커밋/푸시, **원격 SHA == 로컬 HEAD**, 게시 기록 (`last_published_sha`)
- **자동 모델 라우팅** — 작업 등급 × 규칙 테이블 (flash/pro + high/max + 폴백); 추천 vs 실제를 투명하게 기록
- **월간 대시보드** — 모델 순위 / 시간대별 활동 / 일별 상세 / 에이전트 상세, 실제 실행 데이터 기반
- **원클릭 수용** — `baton_accept`: 뼈대/상태/보안/볼륨 검사 → PASS/FAIL + 차단 목록

## 🗣️ 명령어 (각각 언제 사용할까)

다음 영어 문구 중 하나를 말하세요 — 모든 AI에서 의미가 동일합니다. 중국어 사용자는 같은 명령을 중국어로 사용할 수 있습니다(상단 링크의 중국어 버전 참조).

| 명령어 | 사용 시점 | 동작 |
|---|---|---|
| **clock in** / *start work* | 매일 시작 / 새 머신 / 새 AI | git 점검 → 안전한 동기화 → 인수인계 & 할 일 → 작업 테이블 |
| **clock out** / *end work* | 하루 업무 종료 시 | 검증 → 문서/메모리/지표 → 커밋 → 푸시 → **원격 SHA 검증** |
| **continue work** / *resume* | 세션을 잃었거나 도구를 바꿨을 때 | 작업, 브랜치, 막힌 점, 인수인계 꼬리, 다음 단계 복원 |
| **save design spec** | 설계를 확정한 후 | 장기 스펙 + 인덱스에 고정; UI 작업이 이를 따름 |
| **complete task** | 작업 하나가 끝났고 할 일이 더 남았을 때 | 작업 종료, 결과 기록, 다음 단계 제안 (전체 마감 없음) |
| **update project docs** | 작업 중간 체크포인트 | 진행 상황 + 인수인계 체크포인트 기록 (작업공간 유지) |
| **remember this pitfall** / *record this decision* | 함정에 빠졌거나 결정을 내렸을 때 | 장기 메모리에 기록 + 자동 인덱싱 |
| **Baton init** | 새 프로젝트에서 처음일 때 | 메모리 뼈대 + 설정 생성 (덮어쓰지 않음) |
| reply `1` / `2` / `3` | 작업 테이블이 표시되었을 때 | 번호가 현재 작업으로 저장되고 작업이 시작됨 |
| **release workspace** / *I confirm the previous agent stopped* | clock in 시 소유권 충돌이 있을 때 | 단일 작성자 잠금 해제 + 해제 메모 기록 |
| **pull github** / *sync github* / *check git status* | 수동 git 작업 의도 | 경량 git 경로, 계약/리뷰 절차 없음 |
| **check update** | Baton 새 버전이 있는지? | 로컬 버전 앵커를 읽고 GitHub/npm 최신 버전을 조회하여 결과 보고 |
| **update baton** / *upgrade baton* | 새 버전이 나왔을 때 | AI가 전체 업데이트를 실행(git pull + 설치 재실행 / npm update)하고 로컬 == 원격을 검증 |

## 🛠️ 다른 AI 도구용 설치 (Codex / Claude / Cursor)

> **설치 = 명령 하나 복사 → Enter → 완료 대기 → 명령 하나로 검증.** 수동 폴더 생성도, 수동 파일 복사도 없습니다.
> DeepSeek Harness 사용자는 이 단계를 건너뛰세요 — 위의 한 줄 빠른 시작을 사용하면 됩니다.

### 0단계: 어떤 설치가 필요한지 결정 (10초)

| 당신의 상황 | 설치할 것 | 설치 후 |
|---|---|---|
| 여러 프로젝트 — Baton을 **이 머신의 모든 프로젝트**에서 사용 가능하게 하려면 | **사용자 레벨** (머신당 1회) | 이 머신에서 전역; 어떤 프로젝트든 명령을 인식 |
| 다른 머신/AI가 이어받기를 원하는 **특정 프로젝트 하나** | **프로젝트 레벨** (프로젝트당 1회) | 프로젝트가 자체 메모리 뼈대 + 3개 도구 어댑터를 포함; `git clone` 후 계속 |
| 둘 다 | 사용자 레벨 먼저, 그다음 프로젝트 레벨 | 가장 완전함 |

> 💡 **권장**: 사용자 레벨(30초) 실행 후, 실제 프로젝트에 프로젝트 레벨(30초) 실행.

### 1단계: Baton 다운로드 (1회)

PowerShell을 열고(`Win` 키, `powershell` 입력, Enter), 이 줄을 붙여넣으세요:

```powershell
git clone https://github.com/kakadeka/Baton.git $HOME\Baton
```

> git이 없나요? https://git-scm.com/download/win 에서 설치하고, PowerShell을 다시 연 뒤 다시 붙여넣으세요.

### 2단계: 설치 유형 하나를 골라 해당 명령을 붙여넣기

**옵션 A — 사용자 레벨 (머신당 1회, 모든 프로젝트)**

```powershell
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope User
```

`ok: [Codex] ...`, `ok: [Claude Code] ...`, `ok: [Cursor] ...` 가 보이면 — 세 AI 도구 모두에 대한 전역 스킬이 설치된 것입니다.

**옵션 B — 프로젝트 레벨 (프로젝트당 1회, 프로젝트를 이식 가능하게)**

```powershell
cd C:\your\project\path
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope Project
```

성공 줄(프로젝트 레벨 설치 완료)과 생성 목록(메모리 뼈대 `docs/ai_memory`, 설정 `.baton`, 스킬 미러 3개, `AGENTS.md` / `CLAUDE.md` / `.cursorrules` 항목)이 표시됩니다. `.git`이 없다고 나오면, 출력되는 `git init` 명령을 실행하세요.

> 프로젝트 레벨 설치는 완전 자동이며 **DeepSeek Harness 플러그인 없이도 동작합니다** (플러그인 프리 모드).

### 3단계: 검증 (중요한 단계 — 명령 하나)

프로젝트에서 AI에게 다음과 같이 말하세요:

```
clock in
```

**✅ 성공**: AI가 Baton에 따라 동작하며 브랜치, HEAD, 작업 트리 상태, 현재 작업, 인수인계 요약이 담긴 상태 보고서를 출력하고, 이어서 다음과 같은 작업 테이블이 표시됩니다 —

```
Task table: 1) ...
```

**❌ 아무 일도 안 일어나나요?** 순서대로 확인하세요:

1. 어떤 AI를 사용 중인가요? Claude Code → `~\.claude\skills\baton\SKILL.md`; Codex → `~\.agents\skills\baton\SKILL.md`; Cursor → `~\.cursor\skills\baton\SKILL.md` (사용자 레벨 설치는 세 개를 모두 생성)
2. 프로젝트에 `.git`이 있나요? (없으면 `git init` + 첫 커밋)
3. 명령이 정확히 **clock in**이고 다른 것이 섞이지 않았나요?
4. 프로젝트에 `docs/ai_memory/`가 있나요? (프로젝트 레벨 설치가 생성)

### 4단계: 기존 Baton 프로젝트에 합류 (새 머신 / 새 AI)

새 머신에서: git 설치 → 프로젝트를 `git clone` → AI에게 말하세요:

```
clock in  or  continue work
```

메모리, 인수인계, 작업이 코드와 함께 옵니다. 바로 계속하세요 — 추가로 설치할 것은 없습니다.

### 원클릭 스크립트가 하는 일 (투명하게 공개)

| 모드 | 자동으로 하는 일 |
|---|---|
| 사용자 레벨 | 세 AI 도구(Codex / Claude Code / Cursor)의 전역 스킬 폴더에 `SKILL.md` 복사 |
| 프로젝트 레벨 | ① `docs/ai_memory/` 뼈대 (개정 로그 + 보관 인덱스 포함) ② `.baton/config.json` ③ `.gitignore` 추가 ④ 스킬 미러 3개 ⑤ 진입 세그먼트 3개 (`AGENTS.md` / `CLAUDE.md` / `.cursorrules`, 사용자 규칙을 절대 덮어쓰지 않음) |

멱등성: 다시 실행해도 기존 문서와 규칙을 절대 덮어쓰지 않으며, 빠진 것만 채웁니다.

## 📁 진실이 사는 곳

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

## 🛡️ 안전성 & 설계

- 위험한 git(force push / reset --hard / 위험한 clean / 승인되지 않은 rebase)은 존재하지 않습니다
- 동기화는 ff-only입니다. 분기가 갈리면 중단하고 보고하며, 충돌을 자동 해결하지 않습니다
- 자격 증명은 절대 Git / 메모리 / 지표 / 로그에 들어가지 않습니다
- 이력은 추가 전용이거나 "superseded(대체됨)"로 표시되며 — 절대 덮어쓰지 않습니다
- "완료" = 기계적 증거 (원격 SHA + 게시 기록), 주장이 아닙니다
- 토큰 절약은 1급 목표입니다: 인덱스 우선, 위험 기반 모델, 제한된 출력, 중복 호출 없음

## 📦 저장소 & 라이선스

- 오픈소스: https://github.com/kakadeka/Baton (공개 패키지만 제공, 민감정보 제거 파이프라인으로 동기화 — 비공개 계획, 세션 노트, 자격 증명 없음)
- npm: [@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- License: [Apache-2.0](../LICENSE)
