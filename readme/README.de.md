<!-- baton-src: README.md sha256:be1cbcf4ed42 status:current -->
# 🥁 Baton — Gib das Projekt weiter, nicht deinen Kontext.

<p align="center">
  <img src="../gittop.png" alt="Baton — Pass your project, not your context" width="100%">
</p>

<h2 align="center">Rechner wechseln, KI wechseln, Session wechseln — und mit einem Satz weiterarbeiten.</h2>

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
  <a href="README.ko.md">한국어</a> ·
  <a href="README.fr.md">Français</a> ·
  Deutsch ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.ar.md">العربية</a> ·
  <a href="README.th.md">ไทย</a>
</p>

**Baton ist ein Projekt-Staffellauf-Kollaborationssystem.** Es lässt Claude Code, Codex, Cursor und DeepSeek Harness abwechselnd **dasselbe Projekt** über mehrere Rechner hinweg pflegen — Fortschritt, Gedächtnis, Design-Specs, Aufgaben und Git bleiben konsistent. **Du redest normal; es erledigt den Rest.**

**Drei Kernversprechen:**

1. **🔄 Jeder kann übernehmen** — KI-Tool oder Rechner wechseln, einen Befehl sagen und genau dort weitermachen, wo du aufgehört hast. Kein erneutes Erklären des Projekts.
2. **🎯 Tun, was verlangt wurde** — Aufgabengrenzen und geschützte Pfade werden beim Abschluss mechanisch geprüft, Design-Fakten in Specs eingefroren; der Rest wird durch Regeln plus Review gehütet — Abweichungen werden erwischt, nicht erst Stunden später entdeckt.
3. **✅ „Fertig" heißt wirklich fertig** — der Abschluss committet, pusht und **verifiziert den Remote-SHA** — Schluss mit „lokal committet, aber nie auf GitHub, trotzdem als fertig gemeldet".

---

<a id="quickstart"></a>
## 🚀 Schnellstart (DeepSeek Harness — eine Zeile)

> Du nutzt DeepSeek Harness? Das ist alles, was du brauchst.

```powershell
dsh plugin --profile web add @kakadeka/dsh-baton
```

1. Installiere einmal die DSH-CLI: `npm i -g @deepseek-ai/dsh`
2. Füge die Zeile oben ein, drücke Enter.
3. Starte `dsh` neu — fertig. Alle 19 `baton_*`-Tools sind in deinem Profil aktiv.

> Auch von GitHub installierbar: `dsh plugin --profile web add github:kakadeka/Baton`
> Nutzt du stattdessen **Codex / Claude Code / Cursor**? Spring zu [Installation für andere KI-Tools](#-install-for-other-ai-tools-codex--claude--cursor).

---

## 📖 Szenarien (eins pro Anforderung, Schmerz → Batons Antwort)

| # | Schmerz | Batons Antwort |
|---|---|---|
| 1 | Jeden Morgen oder neuer Rechner: welcher Branch? was war gestern? ist das Remote aktuell? | Sag **clock in** — automatische Git-Checks + sichere Synchronisation + Handoff/Todos lesen → Aufgabenliste → eine Nummer antworten |
| 2 | „Lokal committet, aber nicht gepusht"; abends manuelles PowerShell-Git | Sag **clock out** — verifizieren → Docs/Gedächtnis/Metriken → Commit → Push → **Remote-SHA == lokaler HEAD vor „fertig"** |
| 3 | Aufgabe fertig und „Feierabend" wurden vermischt | Sag **complete task** — Aufgabe schließen, Ergebnisse festhalten, Nächstes vorschlagen. Aufgabe fertig ≠ Feierabend |
| 4 | Bestätigte Designs werden vergessen; die KI improvisiert | Sag **save design spec** — Design-Fakten in langfristige Specs einfrieren (Konflikte behalten die Historie); UI-Aufgaben referenzieren sie automatisch |
| 5 | Session verloren, neue Unterhaltung, alles neu erklären | Sag **continue work** — Aufgabe/Branch/Blocker/Handoff/nächsten Schritt wiederherstellen. Ein Satz, fertig |
| 6 | Mehrere Todos; die KI soll keine Prioritäten setzen; alles austippen ist mühsam | Aufgabenliste mit Nummern — antworte `1`/`2`/`3` |
| 7 | Langes Projekt, Historie unerreichbar; alles erneut lesen verbrennt Tokens | Entscheidungen/Stolperfallen/Specs automatisch indiziert; **Index abfragen, nur das gefundene Fragment lesen** |
| 8 | Codex/Claude/Cursor-Staffellauf, ohne zu wissen, was der letzte tat | Einheitliche Handoff-Datei — Branch/HEAD/Änderungen/Einschränkungen/nächster Schritt. Letzten Eintrag lesen, weitermachen |
| 9 | Teures Modell für alles; schwaches Modell macht Fehler; manuelles Umschalten nervt | Automatisches Modell-Routing nach Aufgabenschwierigkeit — micro: Hauptsession, normal: flash, komplex/review: pro, mit Fallback-Ketten |
| 10 | „Welches Modell lief wirklich?" Rechnungen passen nicht | recommended vs. actual getrennt erfasst, Quelle ehrlich gekennzeichnet (Dispatch-Datensatz / Host-Deskriptor / unbekannt) |
| 11 | Die KI driftet nach Stunden vom Prototyp ab | Eingefrorene Anforderungen + erlaubte/geschützte Pfade + mechanische Scope-Checks + unabhängiges Review + kein gefährliches Git |
| 12 | Eine Knopffarbe zu ändern dauerte eine Stunde | Micro-Schnellpfad — keine Delegation, kein Reviewer, keine irrelevanten Tests. Einfache Aufgaben dauern Minuten |
| 13 | Komplexe Aufgaben dürfen nicht schludrig umgesetzt werden | Eskalierende Hürden: Vertrag, starkes Modell, unabhängiger Reviewer, Fidelity gegen eingefrorene Spec, Rollback-Plan |
| 14 | Büro- und Heimrechner unsynchron; Angst, lokale Arbeit zu verlieren | Sicheres Fetch + ff-only-Synchronisation (überschreibt nie), automatischer Commit/Push, Remote-SHA-Prüfung; force/reset/clean verboten |
| 15 | Modelle nach Gefühl wählen, ohne echte Daten | Jede Aufgabe erfasst das tatsächliche Modell und den Abschluss → Monats-Dashboard; noch nicht erfasste Erfolge/Fehler/Dauern stehen als „nicht erfasst" da, nie erfunden |
| 16 | Das System mit einem neuen Projekt wiederverwenden/teilen | Framework und Projektinstanz vollständig getrennt; `Baton init` als Einmal-Bootstrap; Teilen über Sanitizing-Pipeline (keine Keys/Pfade/privaten Notizen) |
| 17 | Andere Skills installiert, die Projektregeln umgehen | Externe Skills dürfen helfen, aber Projektgrenzen (Pfade, Design-Specs, Git-Disziplin) setzt Baton durch, abgestimmt mit AGENTS.md |

## ✨ Funktionen (8 Fähigkeitsblöcke)

- **Befehlsautomatisierung** — clock in / clock out / continue work / save design spec / complete task / update project docs / remember / Baton init / Nummern-Bestätigung / Git in natürlicher Sprache
- **KI- & rechnerübergreifend** — Projektwahrheit als Klartext + schlanke Ein-Befehl-Adapter (Codex/Claude/Cursor) + Handoff-Staffellauf
- **Langzeitgedächtnis** — Entscheidungen/Stolperfallen/Specs automatisch archiviert + leichter Index; inkrementelles Lesen, kein Voll-Neulesen
- **Anti-Drift** — EINGEFRORENE Einschränkungen + Prüfungen erlaubter/geschützter Pfade + Liste verbotener Änderungen + unabhängiges Review + kein gefährliches Git
- **Git-Wahrheitsschleife** — ff-only-Synchronisation, automatischer Commit/Push, **Remote-SHA == lokaler HEAD**, Publikations-Datensatz (`last_published_sha`)
- **Automatisches Modell-Routing** — Aufgabenstufe × Regeltabelle (flash/pro + hoch/max + Fallback); recommended vs. actual transparent erfasst
- **Monats-Dashboard** — Modell-Rankings / Stundenaktivität / Tagesdetails / Agent-Details aus echten Ausführungsdaten
- **Ein-Klick-Abnahme** — `baton_accept`: Skeleton/Zustand/Sicherheit/Volumen-Prüfungen → PASS/FAIL + Blockierliste

## 🗣️ Befehle (wann welcher)

Sag eine dieser englischen Phrasen — die Bedeutung ist in jeder KI identisch. Die chinesischen Auslöser findest du in der chinesischen Fassung (Link oben).

| Befehl | Wann | Was passiert |
|---|---|---|
| **clock in** / *start work* | Tagesstart / neuer Rechner / neue KI | Git-Checks → sichere Synchronisation → Handoff & Todos → Aufgabenliste |
| **clock out** / *end work* | Arbeitstag endet | verifizieren → Docs/Gedächtnis/Metriken → Commit → Push → **Remote-SHA-Prüfung** |
| **continue work** / *resume* | Session verloren / Tool gewechselt | Aufgabe, Branch, Blocker, Handoff-Ende, nächsten Schritt wiederherstellen |
| **save design spec** | nachdem du ein Design bestätigt hast | in Langzeit-Spec + Index einfrieren; UI-Aufgaben befolgen sie |
| **complete task** | eine Aufgabe ist fertig, es gibt mehr zu tun | Aufgabe schließen, Ergebnis festhalten, Nächstes vorschlagen (kein kompletter Abschluss) |
| **update project docs** | Checkpoint mitten in der Arbeit | Fortschritt + Handoff-Checkpoint schreiben (Workspace bleibt gehalten) |
| **remember this pitfall** / *record this decision* | Stolperfalle getroffen / Entscheidung getroffen | ins Langzeitgedächtnis schreiben + Auto-Index |
| **Baton init** | erstes Mal in einem neuen Projekt | Gedächtnis-Skeleton + Konfiguration erzeugen (überschreibt nie) |
| antworte `1` / `2` / `3` | Aufgabenliste wird angezeigt | die Nummer wird als aktuelle Aufgabe persistiert, dann beginnt die Arbeit |
| **release workspace** / *I confirm the previous agent stopped* | Ownership-Konflikt beim Clock-in | Single-Writer-Sperre lösen + Freigabe-Notiz schreiben |
| **pull github** / *sync github* / *check git status* | manuelle Git-Absicht | leichter Git-Pfad, ohne Vertrags-/Review-Zeremonie |
| **check update** | Neue Baton-Version verfügbar? | Lokalen Versionsanker lesen + neueste Version von GitHub/npm abfragen und Ergebnis melden |
| **update baton** / *upgrade baton* | Neue Version vorhanden | KI führt das komplette Update aus (git pull + Installationsskript erneut / npm update) und prüft lokal == remote |

## 🛠️ Installation für andere KI-Tools (Codex / Claude / Cursor)

> **Installieren = einen Befehl kopieren, Enter drücken, Ende abwarten, dann einen Befehl verifizieren.** Kein manuelles Anlegen von Ordnern, kein manuelles Kopieren von Dateien.
> DeepSeek-Harness-Nutzer können diesen Abschnitt überspringen — nutze den Schnellstart oben.

### Schritt 0: Entscheide, welche Installation du brauchst (10 Sekunden)

| Deine Situation | Installiere das | Danach |
|---|---|---|
| Mehrere Projekte — Baton soll in **jedem Projekt auf diesem Rechner** verfügbar sein | **Benutzerebene** (einmal pro Rechner) | Global auf diesem Rechner; jedes Projekt erkennt die Befehle |
| Ein **bestimmtes Projekt**, das andere Rechner/KIs übernehmen sollen | **Projektebene** (einmal pro Projekt) | Das Projekt trägt sein Gedächtnis-Skeleton + 3-Tool-Adapter; `git clone` und weiter |
| Beides | Erst Benutzerebene, dann Projektebene | Am vollständigsten |

> 💡 **Empfohlen**: Benutzerebene ausführen (30 s), dann Projektebene in deinem echten Projekt (30 s).

### Schritt 1: Baton herunterladen (einmal)

Öffne PowerShell (drücke `Win`, tippe `powershell`, Enter), füge diese Zeile ein:

```powershell
git clone https://github.com/kakadeka/Baton.git $HOME\Baton
```

> Kein Git? Installiere von https://git-scm.com/download/win, öffne PowerShell neu, füge erneut ein.

### Schritt 2: Wähle einen Installationstyp und füge seinen Befehl ein

**Option A — Benutzerebene (einmal pro Rechner, alle Projekte)**

```powershell
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope User
```

Du siehst `ok: [Codex] ...`, `ok: [Claude Code] ...`, `ok: [Cursor] ...` — der globale Skill für alle drei KI-Tools ist installiert.

**Option B — Projektebene (einmal pro Projekt, macht das Projekt portabel)**

```powershell
cd C:\your\project\path
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope Project
```

Du siehst eine Erfolgszeile (Installation auf Projektebene abgeschlossen) plus die erzeugte Liste (Gedächtnis-Skeleton `docs/ai_memory`, Konfiguration `.baton`, drei Skill-Spiegel und Einträge in `AGENTS.md` / `CLAUDE.md` / `.cursorrules`). Sagt es „kein `.git`", führe die ausgegebenen `git init`-Befehle aus.

> Die Projektebenen-Installation ist vollautomatisch und **funktioniert ohne das DeepSeek-Harness-Plugin** (plugin-freier Modus).

### Schritt 3: Verifizieren (das Wichtige — ein Befehl)

Sag deiner KI im Projekt:

```
clock in
```

**✅ Erfolg**: Die KI handelt nach Baton und gibt einen Statusbericht mit Branch, HEAD, Arbeitsbaum-Zustand, aktueller Aufgabe und Handoff-Zusammenfassung aus, gefolgt von einer Aufgabenliste wie —

```
Task table: 1) ...
```

**❌ Nichts passiert?** Prüfe der Reihe nach:

1. Welche KI nutzt du? Claude Code → `~\.claude\skills\baton\SKILL.md`; Codex → `~\.agents\skills\baton\SKILL.md`; Cursor → `~\.cursor\skills\baton\SKILL.md` (die Benutzerebenen-Installation erzeugt alle drei)
2. Hat das Projekt `.git`? (sonst `git init` + erster Commit)
3. Ist der Befehl exakt **clock in**, ohne Zusatz?
4. Hat das Projekt `docs/ai_memory/`? (die Projektebenen-Installation erzeugt es)

### Schritt 4: Einem bestehenden Baton-Projekt beitreten (neuer Rechner / neue KI)

Auf dem neuen Rechner: Git installieren → dein Projekt per `git clone` holen → deiner KI sagen:

```
clock in  oder  continue work
```

Gedächtnis, Handoff und Aufgaben kommen mit dem Code. Direkt weitermachen — nichts weiter zu installieren.

### Was das Ein-Klick-Skript tut (transparent)

| Modus | Macht automatisch |
|---|---|
| Benutzerebene | Kopiert `SKILL.md` in die globalen Skill-Ordner aller drei KI-Tools (Codex / Claude Code / Cursor) |
| Projektebene | ① `docs/ai_memory/`-Skeleton (mit Revisionslog + Archivindex) ② `.baton/config.json` ③ `.gitignore`-Anhang ④ drei Skill-Spiegel ⑤ drei Einstiegssegmente (`AGENTS.md` / `CLAUDE.md` / `.cursorrules`, überschreibt deine Regeln nie) |

Idempotent: Erneutes Ausführen überschreibt niemals deine bestehenden Docs und Regeln; es füllt nur, was fehlt.

## 📁 Wo die Wahrheit lebt

```
project/
├── docs/ai_memory/            ← Langzeitgedächtnis (Git-synchronisiert, KI-agnostisch)
│   ├── index.md               ← zuerst lesen
│   ├── current.md             ← was gerade passiert
│   ├── handoff_current.md     ← Handoff-Log (letzter Eintrag = Wahrheit)
│   ├── state/                 ← tasks.json, archive_index.json, project_state.json
│   ├── knowledge/             ← tech_decision.md, pit_experience.md
│   ├── ui_spec/               ← Design-Specs
│   ├── daily_log/             ← Tageslogs
│   └── agent_metrics/YYYY/MM/index.html  ← Monats-Dashboard
└── .baton/                    ← maschinenlokal (gitignored außer config.json): Konfiguration, Metriken, Belege
```

## 🛡️ Sicherheit & Design

- Gefährliches Git (force push / reset --hard / riskantes clean / nicht autorisiertes rebase) existiert nicht
- Synchronisationen sind ff-only; Divergenz stoppt und meldet sich; Konflikte werden nie automatisch gelöst
- Zugangsdaten gelangen nie in Git / Gedächtnis / Metriken / Logs
- Historie ist append-only oder als „ersetzt" markiert — nie überschrieben
- „Fertig" = mechanischer Beleg (Remote-SHA + Publikations-Datensatz), keine Behauptung
- Token-Sparen ist ein erstklassiges Ziel: Index zuerst, risikobasierte Modelle, begrenzte Ausgaben, keine redundanten Aufrufe

## 📦 Repository & Lizenz

- Open Source: https://github.com/kakadeka/Baton (nur öffentliches Paket, synchronisiert über eine Sanitizing-Pipeline — keine privaten Pläne, Session-Notizen oder Zugangsdaten)
- npm: [@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- Lizenz: [Apache-2.0](../LICENSE)
