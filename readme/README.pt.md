<!-- baton-src: README.md sha256:71680646d0ac status:stale -->
# 🥁 Baton — Passe o projeto adiante, não o seu contexto.

<p align="center">
  <img src="../gittop.png" alt="Baton — Pass your project, not your context" width="100%">
</p>

<h2 align="center">Troque de computador, de IA, de sessão — e continue o trabalho com uma frase.</h2>

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
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.es.md">Español</a> ·
  Português ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.ar.md">العربية</a> ·
  <a href="README.th.md">ไทย</a>
</p>

**Baton é um sistema de colaboração por revezamento de projetos.** Ele permite que Claude Code, Codex, Cursor e DeepSeek Harness se revezem mantendo **o mesmo projeto** em várias máquinas — progresso, memória, especificações de design, tarefas e Git permanecem consistentes. **Você fala normalmente; ele faz o resto.**

**Três promessas centrais:**

1. **🔄 Qualquer um pode assumir** — troque de ferramenta de IA ou de máquina, diga um comando e continue exatamente de onde parou. Sem reexplicar o projeto.
2. **🎯 Fazer o que foi pedido** — os limites das tarefas e os caminhos protegidos são verificados mecanicamente no encerramento, e os fatos de design são travados em especificações; o restante é guardado por regras e revisão — o desvio é detectado, não descoberto horas depois.
3. **✅ «Concluído» significa concluído de verdade** — o encerramento faz commit, push e **verifica o SHA remoto** — chega de «commit local, mas nunca no GitHub, e ainda assim dizem que está pronto».

---

<a id="quickstart"></a>
## 🚀 Início rápido (DeepSeek Harness — uma linha)

> Usa o DeepSeek Harness? Isto é tudo de que você precisa.

```powershell
dsh plugin --profile web add @kakadeka/dsh-baton
```

1. Instale a CLI do DSH uma vez: `npm i -g @deepseek-ai/dsh`
2. Cole a linha acima e pressione Enter.
3. Reinicie o `dsh` — pronto. As 16 ferramentas `baton_*` já estão ativas no seu perfil.

> Também instalável pelo GitHub: `dsh plugin --profile web add github:kakadeka/Baton`
> Usa **Codex / Claude Code / Cursor** em vez disso? Vá para [instalação para outras ferramentas de IA](#-install-for-other-ai-tools-codex--claude--cursor).

---

## 📖 Cenários (um por requisito, dor → resposta do Baton)

| # | Dor | Resposta do Baton |
|---|---|---|
| 1 | Toda manhã ou máquina nova: qual branch? o que foi feito ontem? o remoto está atualizado? | Diga **clock in** — verificações git automáticas + sincronização segura + ler handoff/tarefas → tabela de tarefas → responda um número |
| 2 | «Commit local, mas sem push»; git do PowerShell manual à noite | Diga **clock out** — verificar → docs/memória/métricas → commit → push → **SHA remoto == HEAD local antes de «pronto»** |
| 3 | Concluir uma tarefa e «fim de expediente» se confundiram | Diga **complete task** — feche a tarefa, registre resultados, sugira o próximo. Tarefa concluída ≠ fim de expediente |
| 4 | Designs confirmados são esquecidos; a IA improvisa | Diga **save design spec** — trave fatos de design em especificações duradouras (conflitos preservam o histórico); tarefas de UI os referenciam automaticamente |
| 5 | Sessão perdida, conversa nova, reexplicar tudo | Diga **continue work** — restaure tarefa/branch/bloqueio/handoff/próximo passo. Uma frase, pronto |
| 6 | Várias pendências; a IA não deve decidir prioridades; digitar tarefas completas é cansativo | Tabela de tarefas com números — responda `1`/`2`/`3` |
| 7 | Projeto longo, histórico inacessível; reler tudo queima tokens | Decisões/armadilhas/especificações auto-indexadas; **consulte o índice, leia apenas o trecho encontrado** |
| 8 | Revezamento Codex/Claude/Cursor sem saber o que o anterior fez | Arquivo de handoff unificado — branch/HEAD/alterações/restrições/próximo passo. Leia a última entrada e continue |
| 9 | Modelo caro para tudo; modelo fraco erra; troca manual é dolorosa | Roteamento automático de modelos por dificuldade — micro: sessão principal, normal: flash, complexo/revisão: pro, com cadeias de fallback |
| 10 | «Qual modelo realmente rodou?» as contas não batem | recommended vs actual registrados separadamente, origem rotulada com honestidade (registro de despacho / descritor do host / desconhecido) |
| 11 | A IA se desvia do protótipo após horas de trabalho | Requisitos congelados + caminhos permitidos/protegidos + verificações mecânicas de escopo + revisão independente + sem git perigoso |
| 12 | Trocar a cor de um botão levou uma hora | Caminho rápido micro — sem delegação, sem revisor, sem testes irrelevantes. Tarefas simples levam minutos |
| 13 | Tarefas complexas não podem ser escritas de qualquer jeito | Portões escalonados: contrato, modelo forte, revisor independente, fidelidade à especificação congelada, plano de reversão |
| 14 | Máquinas do escritório e de casa dessincronizadas; medo de perder trabalho local | Fetch seguro + sincronização ff-only (nunca sobrescreve), commit/push automáticos, verificação do SHA remoto; force/reset/clean proibidos |
| 15 | Escolher modelos no achismo, sem dados reais | Cada tarefa registra o modelo real e a conclusão → painel mensal; sucesso/falha/duração ainda não coletados aparecem como «não registrado», nunca inventados |
| 16 | Reutilizar/compartilhar o sistema com um projeto novo | Framework e instância de projeto totalmente separados; `Baton init` de inicialização única; compartilhamento via pipeline de sanitização (sem chaves/caminhos/notas privadas) |
| 17 | Outros skills instalados que contornam as regras do projeto | Skills externos podem ajudar, mas os limites do projeto (caminhos, especificações de design, disciplina git) são impostos pelo Baton, coordenado com o AGENTS.md |

## ✨ Recursos (8 blocos de capacidade)

- **Automação de comandos** — clock in / clock out / continue work / save design spec / complete task / update project docs / remember / Baton init / confirmação por número / git em linguagem natural
- **Multi-IA e multi-máquina** — verdade do projeto em texto puro + adaptadores finos de um comando (Codex/Claude/Cursor) + revezamento por handoff
- **Memória de longo prazo** — decisões/armadilhas/especificações auto-arquivadas + índice leve; leituras progressivas, sem releituras completas
- **Anti-desvio** — restrições CONGELADAS + verificações de caminhos permitidos/protegidos + lista de mudanças proibidas + revisão independente + sem git perigoso
- **Laço de verdade do Git** — sincronização ff-only, commit/push automáticos, **SHA remoto == HEAD local**, registro de publicação (`last_published_sha`)
- **Roteamento automático de modelos** — nível da tarefa × tabela de regras (flash/pro + alto/máx + fallback); recommended vs actual registrados com transparência
- **Painel mensal** — ranking de modelos / atividade por hora / detalhe diário / detalhe por agente, com dados reais de execução
- **Aceitação em um clique** — `baton_accept`: verificações de esqueleto/estado/segurança/volume → PASS/FAIL + lista de bloqueios

## 🗣️ Comandos (quando usar cada um)

Diga qualquer uma destas frases em inglês — o significado é idêntico em qualquer IA. Os gatilhos em chinês estão na versão chinesa (link no topo).

| Comando | Quando | O que acontece |
|---|---|---|
| **clock in** / *start work* | início diário / máquina nova / IA nova | verificações git → sincronização segura → handoff e tarefas → tabela de tarefas |
| **clock out** / *end work* | fim do expediente | verificar → docs/memória/métricas → commit → push → **verificação do SHA remoto** |
| **continue work** / *resume* | sessão perdida / ferramenta trocada | restaurar tarefa, branch, bloqueio, fim do handoff, próximo passo |
| **save design spec** | após você confirmar um design | travar em especificação duradoura + índice; tarefas de UI a obedecem |
| **complete task** | uma tarefa está pronta e há mais a fazer | fechar tarefa, registrar resultado, sugerir o próximo (sem encerramento completo) |
| **update project docs** | ponto de controle no meio do trabalho | escrever progresso + ponto de controle do handoff (o espaço continua retido) |
| **remember this pitfall** / *record this decision* | topou com uma armadilha / tomou uma decisão | escrever na memória de longo prazo + auto-índice |
| **Baton init** | primeira vez em um projeto novo | gerar esqueleto de memória + configuração (nunca sobrescreve) |
| responda `1` / `2` / `3` | tabela de tarefas exibida | o número é persistido como tarefa atual e o trabalho começa |
| **release workspace** / *I confirm the previous agent stopped* | conflito de posse no clock in | destravar o cadeado de escritor único + escrever nota de liberação |
| **pull github** / *sync github* / *check git status* | intenção git manual | caminho git leve, sem cerimônia de contrato/revisão |
| **check update** | Há uma versão nova do Baton? | Ler a âncora de versão local + consultar a versão mais recente no GitHub/npm e relatar o resultado |
| **update baton** / *upgrade baton* | Saiu uma versão nova | A IA executa a atualização completa (git pull + reinstalar / npm update) e verifica local == remoto |

## 🛠️ Instalação para outras ferramentas de IA (Codex / Claude / Cursor)

> **Instalar = copiar um comando, pressionar Enter, esperar terminar e então verificar um comando.** Sem criação manual de pastas, sem cópia manual de arquivos.
> Usuários do DeepSeek Harness podem pular esta seção — use o início rápido acima.

### Passo 0: Decida qual instalação você precisa (10 segundos)

| Sua situação | Instale isto | Depois |
|---|---|---|
| Vários projetos — você quer o Baton disponível em **cada projeto desta máquina** | **Nível usuário** (uma vez por máquina) | Global nesta máquina; qualquer projeto reconhece os comandos |
| Um **projeto específico** que você quer que outras máquinas/IAs assumam | **Nível projeto** (uma vez por projeto) | O projeto carrega seu esqueleto de memória + adaptadores de 3 ferramentas; `git clone` e continue |
| Ambos | Primeiro nível usuário, depois nível projeto | O mais completo |

> 💡 **Recomendado**: execute o nível usuário (30 s) e depois o nível projeto no seu projeto real (30 s).

### Passo 1: Baixe o Baton (uma vez)

Abra o PowerShell (pressione `Win`, digite `powershell`, Enter) e cole esta linha:

```powershell
git clone https://github.com/kakadeka/Baton.git $HOME\Baton
```

> Sem git? Instale em https://git-scm.com/download/win, reabra o PowerShell e cole novamente.

### Passo 2: Escolha um tipo de instalação e cole o comando

**Opção A — Nível usuário (uma vez por máquina, todos os projetos)**

```powershell
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope User
```

Você verá `ok: [Codex] ...`, `ok: [Claude Code] ...`, `ok: [Cursor] ...` — o skill global das três ferramentas de IA está instalado.

**Opção B — Nível projeto (uma vez por projeto, torna o projeto portátil)**

```powershell
cd C:\your\project\path
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope Project
```

Você verá uma linha de sucesso (instalação de nível projeto concluída) mais a lista criada (esqueleto de memória `docs/ai_memory`, configuração `.baton`, três espelhos de skill e entradas em `AGENTS.md` / `CLAUDE.md` / `.cursorrules`). Se disser que não há `.git`, execute os comandos `git init` que ele imprime.

> A instalação de nível projeto é totalmente automática e **funciona sem o plugin do DeepSeek Harness** (modo sem plugin).

### Passo 3: Verifique (o importante — um comando)

No projeto, diga à sua IA:

```
clock in
```

**✅ Sucesso**: a IA age conforme o Baton e emite um relatório de status com branch, HEAD, estado da árvore de trabalho, tarefa atual e resumo do handoff, seguido de uma tabela de tarefas como —

```
Task table: 1) ...
```

**❌ Nada acontece?** Verifique em ordem:

1. Qual IA você usa? Claude Code → `~\.claude\skills\baton\SKILL.md`; Codex → `~\.agents\skills\baton\SKILL.md`; Cursor → `~\.cursor\skills\baton\SKILL.md` (a instalação de nível usuário cria os três)
2. O projeto tem `.git`? (senão `git init` + primeiro commit)
3. O comando é exatamente **clock in**, sem mais nada?
4. O projeto tem `docs/ai_memory/`? (a instalação de nível projeto o cria)

### Passo 4: Entrar em um projeto Baton existente (máquina nova / IA nova)

Na máquina nova: instale o git → `git clone` do seu projeto → diga à sua IA:

```
clock in  ou  continue work
```

Memória, handoff e tarefas vêm com o código. Continue diretamente — não há mais nada a instalar.

### O que o script de um clique faz (transparente)

| Modo | Faz automaticamente |
|---|---|
| Nível usuário | Copia `SKILL.md` para as pastas de skill globais das três ferramentas de IA (Codex / Claude Code / Cursor) |
| Nível projeto | ① esqueleto `docs/ai_memory/` (com registro de revisões + índice de arquivo) ② `.baton/config.json` ③ acréscimo ao `.gitignore` ④ três espelhos de skill ⑤ três segmentos de entrada (`AGENTS.md` / `CLAUDE.md` / `.cursorrules`, nunca sobrescreve suas regras) |

Idempotente: executar novamente nunca sobrescreve seus documentos e regras existentes; apenas preenche o que falta.

## 📁 Onde vive a verdade

```
project/
├── docs/ai_memory/            ← memória de longo prazo (sincronizada com Git, agnóstica de IA)
│   ├── index.md               ← leia-me primeiro
│   ├── current.md             ← o que está acontecendo agora
│   ├── handoff_current.md     ← registro de handoff (última entrada = verdade)
│   ├── state/                 ← tasks.json, archive_index.json, project_state.json
│   ├── knowledge/             ← tech_decision.md, pit_experience.md
│   ├── ui_spec/               ← especificações de design
│   ├── daily_log/             ← registros diários
│   └── agent_metrics/YYYY/MM/index.html  ← painel mensal
└── .baton/                    ← local da máquina (gitignored exceto config.json): configuração, métricas, evidências
```

## 🛡️ Segurança e design

- O git perigoso (force push / reset --hard / clean arriscado / rebase não autorizado) não existe
- As sincronizações são ff-only; a divergência para e informa; conflitos nunca são resolvidos automaticamente
- Credenciais nunca entram no Git / memória / métricas / registros
- O histórico é somente-anexar ou marcado como «substituído» — nunca sobrescrito
- «Pronto» = evidência mecânica (SHA remoto + registro de publicação), não uma afirmação
- Economizar tokens é objetivo de primeira ordem: índice primeiro, modelos por risco, saídas limitadas, sem chamadas redundantes

## 📦 Repositório e licença

- Código aberto: https://github.com/kakadeka/Baton (somente pacote público, sincronizado por pipeline de sanitização — sem planos privados, notas de sessão ou credenciais)
- npm: [@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- Licença: [Apache-2.0](../LICENSE)
