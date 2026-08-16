<!-- baton-src: README.md sha256:71680646d0ac status:stale -->
# 🥁 Baton — Pasa el proyecto, no tu contexto.

<p align="center">
  <img src="../gittop.png" alt="Baton — Pass your project, not your context" width="100%">
</p>

<h2 align="center">Cambia de ordenador, de IA, de sesión — y sigue trabajando con una frase.</h2>

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
  Español ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.ar.md">العربية</a> ·
  <a href="README.th.md">ไทย</a>
</p>

**Baton es un sistema de colaboración por relevos para proyectos.** Permite que Claude Code, Codex, Cursor y DeepSeek Harness se turnen para mantener **el mismo proyecto** en distintas máquinas — progreso, memoria, especificaciones de diseño, tareas y Git se mantienen consistentes. **Tú hablas con normalidad; él hace el resto.**

**Tres promesas centrales:**

1. **🔄 Cualquiera puede tomar el relevo** — cambia de herramienta de IA o de máquina, di un comando y retoma exactamente donde lo dejaste. Sin volver a explicar el proyecto.
2. **🎯 Hacer lo que se pidió** — los límites de las tareas y las rutas protegidas se comprueban mecánicamente al cerrar, y los hechos de diseño quedan fijados en especificaciones; el resto lo custodian reglas y revisión — las desviaciones se detectan, no se descubren horas después.
3. **✅ «Hecho» significa hecho de verdad** — el cierre confirma, sube y **verifica el SHA remoto** — se acabó el «confirmado en local pero nunca en GitHub, y aun así te dicen que está hecho».

---

<a id="quickstart"></a>
## 🚀 Inicio rápido (DeepSeek Harness — una línea)

> ¿Usas DeepSeek Harness? Esto es todo lo que necesitas.

```powershell
dsh plugin --profile web add @kakadeka/dsh-baton
```

1. Instala la CLI de DSH una vez: `npm i -g @deepseek-ai/dsh`
2. Pega la línea de arriba y pulsa Enter.
3. Reinicia `dsh` — listo. Las 16 herramientas `baton_*` ya están activas en tu perfil.

> También instalable desde GitHub: `dsh plugin --profile web add github:kakadeka/Baton`
> ¿Usas **Codex / Claude Code / Cursor** en su lugar? Salta a [instalación para otras herramientas de IA](#-install-for-other-ai-tools-codex--claude--cursor).

---

## 📖 Escenarios (uno por requisito, dolor → respuesta de Baton)

| # | Dolor | Respuesta de Baton |
|---|---|---|
| 1 | Cada mañana o máquina nueva: ¿qué rama? ¿qué se hizo ayer? ¿está actualizado el remoto? | Di **clock in** — comprobaciones git automáticas + sincronización segura + leer el handoff y las tareas → tabla de tareas → responde un número |
| 2 | «Confirmado en local pero no subido»; git de PowerShell manual por la noche | Di **clock out** — verificar → docs/memoria/métricas → commit → push → **SHA remoto == HEAD local antes de «hecho»** |
| 3 | Terminar una tarea y «fin de jornada» se confundieron | Di **complete task** — cierra la tarea, registra resultados, sugiere lo siguiente. Tarea terminada ≠ fin de jornada |
| 4 | Los diseños confirmados se olvidan; la IA improvisa | Di **save design spec** — fija los hechos de diseño en especificaciones duraderas (los conflictos conservan el historial); las tareas de UI las referencian automáticamente |
| 5 | Sesión perdida, conversación nueva, volver a explicarlo todo | Di **continue work** — restaura tarea/rama/bloqueo/handoff/siguiente paso. Una frase y listo |
| 6 | Varios pendientes; la IA no debe decidir prioridades; escribir tareas completas es tedioso | Tabla de tareas con números — responde `1`/`2`/`3` |
| 7 | Proyecto largo, historial inaccesible; releerlo todo quema tokens | Decisiones/trampas/especificaciones auto-indexadas; **consulta el índice, lee solo el fragmento encontrado** |
| 8 | Relevo entre Codex/Claude/Cursor sin saber qué hizo el anterior | Archivo de handoff unificado — rama/HEAD/cambios/restricciones/siguiente paso. Lee la última entrada y continúa |
| 9 | Modelo caro para todo; el modelo débil se equivoca; cambiar a mano es un dolor | Enrutado automático de modelos por dificultad — micro: sesión principal, normal: flash, complejo/revisión: pro, con cadenas de respaldo |
| 10 | «¿Qué modelo se ejecutó de verdad?» las facturas no cuadran | recommended vs actual registrados por separado, fuente etiquetada con honestidad (registro de despacho / descriptor del host / desconocido) |
| 11 | La IA se desvía del prototipo tras horas de trabajo | Requisitos congelados + rutas permitidas/protegidas + comprobaciones mecánicas de alcance + revisión independiente + sin git peligroso |
| 12 | Cambiar el color de un botón tardó una hora | Vía rápida micro — sin delegación, sin revisor, sin pruebas irrelevantes. Las tareas simples tardan minutos |
| 13 | Las tareas complejas no deben escribirse a lo chapucero | Puertas escalonadas: contrato, modelo fuerte, revisor independiente, fidelidad frente a la especificación congelada, plan de retroceso |
| 14 | Máquinas de oficina y casa desincronizadas; miedo a perder el trabajo local | Fetch seguro + sincronización ff-only (nunca sobrescribe), commit/push automáticos, verificación del SHA remoto; force/reset/clean prohibidos |
| 15 | Elegir modelos a ojo, sin datos reales | Cada tarea registra el modelo real y su finalización → panel mensual; éxito/fallo/duración aún no recogidos se muestran como «no registrado», nunca inventados |
| 16 | Reutilizar/compartir el sistema con un proyecto nuevo | Marco y instancia de proyecto totalmente separados; `Baton init` de arranque en un paso; compartir mediante tubería de saneado (sin claves/rutas/notas privadas) |
| 17 | Otros skills instalados que se saltan las reglas del proyecto | Los skills externos pueden ayudar, pero los límites del proyecto (rutas, especificaciones de diseño, disciplina git) los impone Baton, coordinado con AGENTS.md |

## ✨ Funciones (8 bloques de capacidad)

- **Automatización de comandos** — clock in / clock out / continue work / save design spec / complete task / update project docs / remember / Baton init / confirmación por número / git en lenguaje natural
- **Multi-IA y multi-máquina** — verdad del proyecto en texto plano + adaptadores finos de un comando (Codex/Claude/Cursor) + relevo por handoff
- **Memoria a largo plazo** — decisiones/trampas/especificaciones auto-archivadas + índice ligero; lecturas progresivas, sin relecturas completas
- **Anti-desvío** — restricciones CONGELADAS + comprobaciones de rutas permitidas/protegidas + lista de cambios prohibidos + revisión independiente + sin git peligroso
- **Bucle de verdad de Git** — sincronización ff-only, commit/push automáticos, **SHA remoto == HEAD local**, registro de publicación (`last_published_sha`)
- **Enrutado automático de modelos** — nivel de tarea × tabla de reglas (flash/pro + alto/máx + respaldo); recommended vs actual registrados con transparencia
- **Panel mensual** — ranking de modelos / actividad por hora / detalle diario / detalle por agente, con datos reales de ejecución
- **Aceptación en un clic** — `baton_accept`: comprobaciones de esqueleto/estado/seguridad/volumen → PASS/FAIL + lista de bloqueos

## 🗣️ Comandos (cuándo usar cada uno)

Di cualquiera de estas frases en inglés — el significado es idéntico en cualquier IA. Los disparadores en chino están en la versión china (enlace arriba).

| Comando | Cuándo | Qué ocurre |
|---|---|---|
| **clock in** / *start work* | inicio diario / máquina nueva / IA nueva | comprobaciones git → sincronización segura → handoff y tareas → tabla de tareas |
| **clock out** / *end work* | fin de jornada | verificar → docs/memoria/métricas → commit → push → **verificación del SHA remoto** |
| **continue work** / *resume* | sesión perdida / herramienta cambiada | restaurar tarea, rama, bloqueo, final del handoff, siguiente paso |
| **save design spec** | tras confirmar un diseño | fijar en especificación duradera + índice; las tareas de UI la obedecen |
| **complete task** | una tarea está hecha y quedan más | cerrar tarea, registrar resultado, sugerir lo siguiente (sin cierre completo) |
| **update project docs** | punto de control a mitad de trabajo | escribir progreso + punto de control del handoff (el espacio sigue retenido) |
| **remember this pitfall** / *record this decision* | topaste con una trampa / tomaste una decisión | escribir en memoria a largo plazo + auto-índice |
| **Baton init** | primera vez en un proyecto nuevo | generar esqueleto de memoria + configuración (nunca sobrescribe) |
| responde `1` / `2` / `3` | tabla de tareas mostrada | el número se persiste como tarea actual y empieza el trabajo |
| **release workspace** / *I confirm the previous agent stopped* | conflicto de propiedad al entrar | desbloquear el candado de escritor único + escribir nota de liberación |
| **pull github** / *sync github* / *check git status* | intención git manual | vía git ligera, sin ceremonia de contrato/revisión |
| **check update** | ¿Hay una versión nueva de Baton? | Leer el ancla de versión local + consultar la última versión en GitHub/npm e informar del resultado |
| **update baton** / *upgrade baton* | Hay una versión nueva | La IA ejecuta la actualización completa (git pull + reinstalar / npm update) y verifica local == remoto |

## 🛠️ Instalación para otras herramientas de IA (Codex / Claude / Cursor)

> **Instalar = copiar un comando, pulsar Enter, esperar a que termine y luego verificar un comando.** Sin crear carpetas a mano, sin copiar archivos a mano.
> Los usuarios de DeepSeek Harness pueden saltarse esta sección — usa el inicio rápido de arriba.

### Paso 0: Decide qué instalación necesitas (10 segundos)

| Tu situación | Instala esto | Después |
|---|---|---|
| Varios proyectos — quieres Baton disponible en **cada proyecto de esta máquina** | **Nivel usuario** (una vez por máquina) | Global en esta máquina; cualquier proyecto reconoce los comandos |
| Un **proyecto concreto** que quieres que otras máquinas/IAs retomen | **Nivel proyecto** (una vez por proyecto) | El proyecto lleva su esqueleto de memoria + adaptadores de 3 herramientas; `git clone` y a continuar |
| Ambos | Primero nivel usuario, luego nivel proyecto | Lo más completo |

> 💡 **Recomendado**: ejecuta el nivel usuario (30 s) y luego el nivel proyecto en tu proyecto real (30 s).

### Paso 1: Descarga Baton (una vez)

Abre PowerShell (pulsa `Win`, escribe `powershell`, Enter) y pega esta línea:

```powershell
git clone https://github.com/kakadeka/Baton.git $HOME\Baton
```

> ¿Sin git? Instálalo desde https://git-scm.com/download/win, vuelve a abrir PowerShell y pega de nuevo.

### Paso 2: Elige un tipo de instalación y pega su comando

**Opción A — Nivel usuario (una vez por máquina, todos los proyectos)**

```powershell
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope User
```

Verás `ok: [Codex] ...`, `ok: [Claude Code] ...`, `ok: [Cursor] ...` — el skill global de las tres herramientas de IA queda instalado.

**Opción B — Nivel proyecto (una vez por proyecto, hace el proyecto portátil)**

```powershell
cd C:\your\project\path
pwsh -File $HOME\Baton\scripts\baton-install.ps1 -Scope Project
```

Verás una línea de éxito (instalación de nivel proyecto completada) más la lista creada (esqueleto de memoria `docs/ai_memory`, configuración `.baton`, tres espejos de skill y entradas en `AGENTS.md` / `CLAUDE.md` / `.cursorrules`). Si dice que no hay `.git`, ejecuta los comandos `git init` que imprime.

> La instalación de nivel proyecto es totalmente automática y **funciona sin el plugin de DeepSeek Harness** (modo sin plugin).

### Paso 3: Verifica (lo importante — un comando)

En el proyecto, dile a tu IA:

```
clock in
```

**✅ Éxito**: la IA actúa según Baton y emite un informe de estado con la rama, el HEAD, el estado del árbol de trabajo, la tarea actual y el resumen del handoff, seguido de una tabla de tareas como —

```
Task table: 1) ...
```

**❌ ¿No pasa nada?** Comprueba en orden:

1. ¿Qué IA usas? Claude Code → `~\.claude\skills\baton\SKILL.md`; Codex → `~\.agents\skills\baton\SKILL.md`; Cursor → `~\.cursor\skills\baton\SKILL.md` (la instalación de nivel usuario crea los tres)
2. ¿Tiene el proyecto `.git`? (si no, `git init` + primer commit)
3. ¿El comando es exactamente **clock in**, sin nada más?
4. ¿Tiene el proyecto `docs/ai_memory/`? (la instalación de nivel proyecto lo crea)

### Paso 4: Unirte a un proyecto Baton existente (máquina nueva / IA nueva)

En la máquina nueva: instala git → `git clone` de tu proyecto → dile a tu IA:

```
clock in  o  continue work
```

La memoria, el handoff y las tareas vienen con el código. Continúa directamente — no hay nada más que instalar.

### Qué hace el script de un clic (transparente)

| Modo | Hace automáticamente |
|---|---|
| Nivel usuario | Copia `SKILL.md` en las carpetas de skill globales de las tres herramientas de IA (Codex / Claude Code / Cursor) |
| Nivel proyecto | ① esqueleto `docs/ai_memory/` (con registro de revisiones + índice de archivo) ② `.baton/config.json` ③ añadido de `.gitignore` ④ tres espejos de skill ⑤ tres segmentos de entrada (`AGENTS.md` / `CLAUDE.md` / `.cursorrules`, nunca sobrescribe tus reglas) |

Idempotente: volver a ejecutarlo nunca sobrescribe tus documentos y reglas existentes; solo rellena lo que falta.

## 📁 Dónde vive la verdad

```
project/
├── docs/ai_memory/            ← memoria a largo plazo (sincronizada con Git, agnóstica de la IA)
│   ├── index.md               ← léeme primero
│   ├── current.md             ← qué está pasando ahora
│   ├── handoff_current.md     ← registro de handoff (última entrada = verdad)
│   ├── state/                 ← tasks.json, archive_index.json, project_state.json
│   ├── knowledge/             ← tech_decision.md, pit_experience.md
│   ├── ui_spec/               ← especificaciones de diseño
│   ├── daily_log/             ← registros diarios
│   └── agent_metrics/YYYY/MM/index.html  ← panel mensual
└── .baton/                    ← local de la máquina (gitignored excepto config.json): configuración, métricas, evidencias
```

## 🛡️ Seguridad y diseño

- El git peligroso (force push / reset --hard / clean arriesgado / rebase no autorizado) no existe
- Las sincronizaciones son ff-only; la divergencia se detiene y se informa; los conflictos nunca se resuelven automáticamente
- Las credenciales nunca entran en Git / memoria / métricas / registros
- El historial es de solo añadir o se marca «sustituido» — nunca se sobrescribe
- «Hecho» = evidencia mecánica (SHA remoto + registro de publicación), no una afirmación
- Ahorrar tokens es un objetivo de primer orden: primero el índice, modelos según riesgo, salidas acotadas, sin llamadas redundantes

## 📦 Repositorio y licencia

- Código abierto: https://github.com/kakadeka/Baton (solo paquete público, sincronizado mediante una tubería de saneado — sin planes privados, notas de sesión ni credenciales)
- npm: [@kakadeka/dsh-baton](https://www.npmjs.com/package/@kakadeka/dsh-baton)
- Licencia: [Apache-2.0](../LICENSE)
