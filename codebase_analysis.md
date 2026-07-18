# Kanban Board — Full Codebase Analysis

**Repo:** https://github.com/brianference/kanban-board  
**Analyzed:** 2026-07-18  
**GitHub visibility:** Public (`private: false`)  
**Default branch:** `master`  
**Latest commit (at analysis):** `ac51bbe` — fix: production regression - missing hamburger menu and misplaced navigation (US-116)

## Live release (this session)

| URL | Role | Status |
|-----|------|--------|
| https://kanban-board-public.pages.dev | Production alias (stable) | Verified HTTP 200, `Task Board` HTML (~243 KB) |
| https://e1caa715.kanban-board-public.pages.dev | Unique per-deploy URL | Wrangler deploy success (2026-07-18) |
| https://github.com/brianference/kanban-board | Public source | Open, no auth required to browse |

Deploy method: Cloudflare Pages **direct upload** (Type B) via `wrangler pages deploy` of static `index.html` only. Project name: `kanban-board-public`.

**Note:** An older alias `https://kanban-board.pages.dev` exists but serves a different Vite/React shell (`#root` + hashed assets), not this repo’s monolithic HTML. Historical docs also cite dead hosts (`kanban-board-264.pages.dev`, `python-kanban.pages.dev`, `hon-kanban.pages.dev`).

---

## 1. Project overview

| Dimension | Detail |
|-----------|--------|
| **Type** | Hybrid: (A) browser task board SPA, (B) Python offline CLI + Telegram/OpenClaw tooling |
| **Primary product** | Single-page kanban / “Task Board” for multi-app work tracking (Cole AI / OpenClaw workspace) |
| **Architecture** | Static HTML/CSS/JS front end + optional Python backend tools; no server required for core UX |
| **Languages** | HTML/CSS/JS (embedded), Python 3, shell (`deploy.sh`), Node (audit/screenshot scripts) |
| **Persistence (browser)** | `localStorage` under key `task board-board-data` |
| **Persistence (tooling)** | `tasks.json` source of truth; optional Supermemory.ai cloud backup |
| **Cloud sync (browser)** | Attempts `/.netlify/functions/sync-tasks` — Netlify-oriented; not wired on Cloudflare deploy |
| **Scale** | ~1.2 MB repo tree (incl. screenshots); core UI is one ~247 KB `index.html` (~5,133 lines) |

### What it is for

A personal/agent-operated board to track user stories across apps (Task Board, Tokyo/Osaka trip, Scholarship Hunt, Secret Vault, Mobileclaw, etc.). Cards carry priorities, tags, agents, and story numbers. There is a second board for **bug tracking** columns.

### What it is not

- Not a multi-tenant SaaS
- Not a real-time collaborative board (no WebSockets / CRDT)
- Not fully self-hostable as “Python API + React” — the live site is static HTML
- Not currently backed by an active Netlify function on the Cloudflare release

---

## 2. Directory structure

```
kanban-board/
├── index.html                 # Full SPA (CSS + board UI + embedded card seed + JS)
├── tasks.json                 # Task source of truth for Python pipeline (132 tasks)
├── kanban.py                  # CLI entry (status/add/move/list/generate/migrate/telegram)
├── kanban_manager.py          # CRUD, time tracking, Supermemory sync hooks
├── html_generator.py          # Regenerates index.html from tasks.json + backup template
├── supermemory_client.py      # Supermemory.ai v3 HTTP client
├── telegram_bot.py            # /kanban command formatting for Telegram/OpenClaw
├── openclaw_integration.py    # Thin bridge: parse command → TelegramKanbanBot
├── deploy.sh                  # Generate + git push + CF deploy trigger (Linux/OpenClaw paths)
├── requirements.txt           # requests>=2.31.0
├── audit-compliance.mjs       # Feature-compliance audit script
├── take-deployment-screenshots.mjs
├── README.md / USAGE.md
├── AUDIT-REPORT.md / FINAL-REPORT.md / DEPLOYMENT-SUMMARY.md
├── FIX-*.md                   # Historical bugfix plans
├── production-*.png           # Deployment proof screenshots
├── trigger.txt                # Empty deploy-trigger artifact
└── .gitignore
```

### Role of each major area

| Area | Purpose | Connects to |
|------|---------|-------------|
| `index.html` | User-facing board | Browser only; seeds from embedded JSON into localStorage |
| `tasks.json` | Offline/agent source of truth | Python manager, HTML generator, git history |
| Python modules | Agent/CLI control plane | Local disk + Supermemory API |
| Docs + screenshots | Compliance/ops history | Human process, not runtime |
| `deploy.sh` | Old OpenClaw host automation | Hardcoded `/root/.openclaw/...` paths |

---

## 3. File-by-file breakdown

### Core application (browser)

| File | Role |
|------|------|
| **index.html** | Monolith: design tokens, layout, lock screen, main board (5 columns), bug board (4 columns), modal CRUD, filters, theme, drag-and-drop, mobile tabs, hamburger nav, Eruda on mobile, embedded card array, sync stubs |

**Notable JS surface (36 functions):**  
`initBoard`, `render`, `createCardEl`, `openModal`, `saveCard`, `deleteCard`, `esc`, `toggleTheme`, `toggleNav`, `switchTab`, `onDragStart`/`onDragEnd`/`setupDropZones`/`getDragAfterElement`, `syncPull`/`syncPush`/`syncPushPlain`/`forceSyncFromCloud`, `load`/`save`, `loadBugs`, `hashCards`, plus restaurant/map leftovers (`createRestaurantMarker` — likely dead or residual code).

**Constants:**
- `STORAGE_KEY = 'task board-board-data'`
- `VERSION_KEY = 'kanban_data_version'`, `CURRENT_VERSION = '2'`
- `SYNC_URL = '/.netlify/functions/sync-tasks'`

**External dependency (only one):**  
`https://cdn.jsdelivr.net/npm/eruda` — mobile debug console when width &lt; 768 or `?debug=true`.

### Core application (Python)

| File | Classes / entry | Responsibility |
|------|-----------------|----------------|
| `kanban.py` | `main()` | Argparse CLI; board URL constant (stale host) |
| `kanban_manager.py` | `KanbanManager` | Load/save `tasks.json`, add/update/move/delete, start/end time tracking, Supermemory store |
| `html_generator.py` | `HTMLGenerator` | Regex-replace embedded `const cards = [...]` in a backup template; **hardcoded path** to `/root/.openclaw/workspace/python-kanban/index.html.backup` |
| `supermemory_client.py` | `SupermemoryClient` | Bearer auth to `https://api.supermemory.ai/v3` |
| `telegram_bot.py` | `TelegramKanbanBot` | status / progress / next / overdue / add / move / help |
| `openclaw_integration.py` | `handle_kanban_command` | Strip `/kanban` prefix and dispatch |

### Configuration & ops

| File | Notes |
|------|-------|
| `requirements.txt` | Only `requests` |
| `deploy.sh` | Sources secrets from OpenClaw `keys.env`; pushes git; POSTs CF Pages deployment API |
| `.gitignore` | `.env`, `keys.env`, venv, backups, logs |

### Data

| File | Notes |
|------|-------|
| `tasks.json` | 132 tasks; columns: backlog 78, progress 16, done 22, next-up 2, **null col 14**; priorities mixed (`med` vs `medium`) |

### Documentation / evidence

Multiple markdown reports describe a March 2026 push to ~96% “standard features” compliance, mobile touch fixes, Eruda, hamburger verification, and SEO meta. Screenshot PNGs capture desktop/mobile production states.

### Testing

- No unit/integration test suite in-repo for Python or the SPA
- `audit-compliance.mjs` is a compliance checklist runner, not a test framework
- FINAL-REPORT defers Playwright suite (US-073) as future work

---

## 4. API / integration surface

### Browser

| Endpoint / mechanism | Method | Purpose | Status on CF public deploy |
|----------------------|--------|---------|----------------------------|
| `localStorage` | — | Primary store | Works |
| `/.netlify/functions/sync-tasks` | GET/POST | Multi-device sync | **Not deployed** — fetch will fail; app falls back to local |
| Eruda CDN | GET | Debug UI | Works if CDN reachable |

There is **no first-party REST API** in this repo for the board itself.

### Python → Supermemory

| Operation | Notes |
|-----------|--------|
| Store/update task memories | POST with tags (`project-kanban`, `col-*`, `priority-*`, `task-{id}`) |
| Search/get | Client methods exist; README states v3 is effectively write-heavy for this workflow |

### Telegram (via OpenClaw)

Commands: `status`, `progress`, `next`, `overdue`, `add`, `move`, `help`. Not a standalone Telegram webhook server in-repo — meant to be invoked by OpenClaw’s message tool.

---

## 5. Architecture deep dive

```
┌─────────────────────────────────────────────────────────────────┐
│                         OPERATORS                                │
│  Browser user │ Telegram (Cole/OpenClaw) │ CLI (kanban.py)        │
└───────┬───────────────┬───────────────────────┬─────────────────┘
        │               │                       │
        ▼               ▼                       ▼
┌───────────────┐ ┌─────────────────┐ ┌──────────────────────────┐
│  index.html   │ │ telegram_bot +  │ │ KanbanManager            │
│  SPA (local)  │ │ openclaw bridge │ │ tasks.json               │
│  localStorage │ └────────┬────────┘ └────────────┬─────────────┘
└───────┬───────┘          │                       │
        │                  └───────────┬───────────┘
        │ optional Netlify             │ optional
        ▼                              ▼
┌───────────────────┐        ┌─────────────────────┐
│ sync-tasks (dead  │        │ Supermemory.ai v3   │
│ on CF release)    │        │ (backup, needs key) │
└───────────────────┘        └─────────────────────┘
        │
        ▼
┌───────────────────┐
│ Cloudflare Pages  │  ← static index.html only (this release)
│ kanban-board-     │
│ public.pages.dev  │
└───────────────────┘
```

### Request lifecycle (browser)

1. Page loads; Eruda may init on small screens.
2. IIFE checks `localStorage` version / init flag.
3. If empty or first run, embeds large `const cards = [...]` into storage.
4. `load()` may try `syncPull()`; on failure uses local data.
5. `initBoard()` / `render()` paint columns; drag-and-drop and modals mutate array → `save()` → localStorage (+ optional `syncPush`).

### Request lifecycle (Python)

1. `KanbanManager` loads `tasks.json`.
2. Mutations save disk file and call Supermemory if client constructs successfully.
3. `HTMLGenerator.generate()` (when used on OpenClaw host) rewrites `index.html` from template + tasks.
4. `deploy.sh` commits and triggers CF (paths are OpenClaw-server-specific).

### Design patterns

- **Monolithic SPA** in one HTML file (no bundler for the board itself)
- **Repository pattern-ish** in `KanbanManager` over JSON file
- **Embedded seed data** for cold-start offline use
- **Dual column systems**: product board + bug board in one document
- **Client-side encryption UI** (lock screen / passphrase) present; Web Crypto usage is partial (`encryptData` referenced with `cryptoKey`, no full `crypto.subtle` implementation found in current HTML — lock UI may be incomplete or gated)

### Data model (task / card)

```json
{
  "id": 1770521031234,
  "title": "…",
  "description": "…",
  "col": "backlog|next-up|progress|blocked|done|null",
  "priority": "critical|high|med|medium|low",
  "tag": "…",
  "tags": ["…"],
  "agent": "…",
  "created": 1770520938235,
  "order": 0,
  "storyNumber": "US-116",
  "startTime": null,
  "endTime": null,
  "estimatedHours": null,
  "actualHours": null,
  "dueDate": null
}
```

**Schema drift:** `med` vs `medium`, optional `tag` vs `tags`, 14 tasks with `col: null`, dual sources (`tasks.json` vs embedded array in HTML) can diverge.

---

## 6. Environment and setup

### Browser-only (public release)

1. Open https://kanban-board-public.pages.dev  
2. No env vars, no install  
3. Data stays in that browser’s localStorage  

### Python tooling (local)

```bash
pip install -r requirements.txt   # requests
# Optional:
export SUPERMEMORY_API_KEY=...
python kanban.py status
python kanban.py add "Title" --priority high
python kanban.py move <id> progress
python kanban.py generate   # needs OpenClaw template path unless patched
```

### Secrets (not in git)

- `SUPERMEMORY_API_KEY` (env or `/root/.openclaw/secrets/keys.env`)
- Cloudflare deploy tokens (historical: `CloudflarePagesDeployment`, account `dd01b432…`)
- GitHub PAT for push (ops only)

### Production deployment strategy (current)

1. Build/export static `index.html` (already in repo).  
2. `wrangler pages deploy <dir> --project-name kanban-board-public --branch main`.  
3. Verify production alias content (title + size), not only wrangler success.  
4. Optionally push source to GitHub (separate step; does not auto-deploy this project).

### Historical deployment strategy (docs)

Generate from Python → commit → GitHub → Cloudflare project `kanban-board` / `hon-kanban` / `python-kanban` — several of those hosts are gone or serve different apps.

---

## 7. Technology stack

| Layer | Choice |
|-------|--------|
| Runtime (UI) | Browser (vanilla JS) |
| Runtime (tools) | Python 3 + Node (mjs utilities) |
| CSS | Custom properties, light/dark themes, glass/gradient design system |
| Storage | localStorage; JSON file; Supermemory |
| Hosting | Cloudflare Pages (static) |
| CDN | jsDelivr (Eruda only) |
| CI | None observed in this clone (no `.github/workflows`) |
| Bundler | None for the SPA |
| Tests | None automated |
| Deps (Python) | `requests` only |

---

## 8. Visual architecture (file hierarchy + data flow)

```
                    ┌──────────────────────────┐
                    │  github.com/brianference │
                    │       /kanban-board      │
                    │   (public, master)       │
                    └────────────┬─────────────┘
                                 │ clone / push
                                 ▼
              ┌──────────────────────────────────────┐
              │  Workspace clone                     │
              │  index.html  tasks.json  *.py  docs  │
              └───────┬──────────────────┬───────────┘
                      │ static upload    │ CLI
                      ▼                  ▼
         ┌────────────────────┐   ┌─────────────────┐
         │ CF Pages           │   │ KanbanManager   │
         │ kanban-board-      │   │ + Supermemory   │
         │ public.pages.dev   │   └─────────────────┘
         └─────────┬──────────┘
                   │ GET /
                   ▼
         ┌────────────────────┐
         │ Browser            │
         │ localStorage cards │
         │ drag-drop UX       │
         └────────────────────┘
```

**Board columns (main):** Backlog → Next Up → In Progress → Blocked → Done  

**Bug columns:** bug-backlog → bug-fixing → bug-testing → bug-fixed  

---

## 9. Key insights and recommendations

### Strengths

1. **Zero-install UX** — one HTML file works offline after first load (modulo Eruda CDN).  
2. **Agent-friendly control plane** — Python CLI + Telegram phrasing fits OpenClaw workflows.  
3. **Rich task corpus** — 132 real stories with agents/story numbers (not placeholder data).  
4. **Mobile attention** — hamburger, mobile tabs, touch threshold fix, Eruda for debug.  
5. **XSS awareness** — `esc()` helper for card text (confirm all innerHTML paths still use it).  
6. **Public repo + public host** — easy to share the board UI without auth ceremony.

### Risks and gaps

| Issue | Severity | Detail |
|-------|----------|--------|
| **Dual sources of truth** | High | Embedded cards in HTML vs `tasks.json` can drift; generator path is host-specific |
| **Dead Netlify sync on CF** | Medium | `SYNC_URL` points at Netlify; multi-device sync is illusory on this deploy |
| **No automated tests** | Medium | Regressions (US-116/117/121 history) likely to recur |
| **Stale URLs in code/docs** | Medium | `kanban-board-264.pages.dev`, OpenClaw absolute paths, multiple CF project names |
| **Schema inconsistency** | Medium | `med`/`medium`, null columns, tag vs tags |
| **Encryption incomplete** | Medium | Lock UI + passphrase present; `encryptData` without clear `crypto.subtle` pipeline in file |
| **Supply chain (Eruda)** | Low–Med | Only external script; no SRI; loads on mobile always |
| **Accessibility** | Low–Med | Very few `aria-*` / `role=` attributes vs claims of full a11y compliance |
| **html_generator hardcoding** | High for regen | Absolute Linux path; broken outside original OpenClaw server |
| **Dead code smell** | Low | `createRestaurantMarker` suggests copy-paste from another app |

### Security considerations

- **Client-only auth** — passphrase model is at best obfuscation unless encryption path is complete and verified.  
- **No server auth** — anyone with the public URL can use the UI; data is local to their browser.  
- **Public task content** — `tasks.json` and embedded cards may contain internal project plans; confirm nothing sensitive is committed (paths like `/root/.openclaw/workspace/...` appear in card descriptions).  
- **CORS `*` on historical Netlify sync** — if re-enabled, add auth and origin checks.  
- **Secrets hygiene** — `.gitignore` covers env files; keep API keys out of commits.

### Performance

- Single ~240 KB HTML is fine for this use case; large embedded JSON increases parse time.  
- No code-splitting; entire board JS runs on every load.  
- Consider lazy-loading Eruda only on `?debug=true` (not auto on all mobile).

### Maintainability suggestions

1. Split `index.html` into CSS / JS / data modules (or Vite) without losing offline seed.  
2. Single source of truth: generate HTML from `tasks.json` in CI on every push.  
3. Replace Netlify sync with Cloudflare Pages Function + D1/KV (or drop sync and document local-only).  
4. Normalize priority/column enums with a JSON schema.  
5. Add smoke tests: load page, count columns, open modal, drag card (Playwright).  
6. Fix `html_generator.py` paths to be relative.  
7. Update all BOARD_URL constants to `https://kanban-board-public.pages.dev`.  
8. Add `_headers` CSP on Pages (allow jsDelivr only if Eruda stays).

### Code quality snapshot

| Area | Assessment |
|------|------------|
| SPA structure | Functional monolith; hard to review/diff |
| Python structure | Clear modules; good for agents |
| Docs | Abundant but partly obsolete URLs/status |
| Ops scripts | Coupled to one Linux host layout |
| Deps | Minimal — good |
| Public release readiness | UI ready; tooling needs path/key fixes |

---

## 10. Related local trees (not this repo)

| Path | Relation |
|------|----------|
| `C:\Users\brian\workspace\kanban` | Older Netlify-oriented HTML + `netlify/functions/sync.mjs` + security audit |
| `C:\Users\brian\workspace\projects\kanban-backend` | Small Node `update-task.js` + JSON |

These are siblings/history, not what is on `origin/master` of `kanban-board`.

---

## 11. Verification performed (2026-07-18)

1. Cloned `https://github.com/brianference/kanban-board.git` — public, 26 tracked files.  
2. Static analysis of `index.html`, Python modules, `tasks.json` (132 tasks).  
3. Created Cloudflare Pages project `kanban-board-public`.  
4. Deployed `index.html` via wrangler; unique deploy: `https://e1caa715.kanban-board-public.pages.dev`.  
5. Confirmed production alias returns Task Board document (~243 KB, title `Task Board`, contains embedded cards).  
6. Confirmed GitHub `visibility=public`.

---

## 12. Quick reference

| Item | Value |
|------|--------|
| Source | https://github.com/brianference/kanban-board |
| Public board | https://kanban-board-public.pages.dev |
| Unique deploy | https://e1caa715.kanban-board-public.pages.dev |
| Primary artifact | `index.html` (~5.1k lines) |
| Task count | 132 in `tasks.json` |
| Columns (main) | backlog, next-up, progress, blocked, done |
| Python entry | `python kanban.py …` |
| Deploy (static) | `wrangler pages deploy . --project-name kanban-board-public --branch main` |

---

*Generated as a full-repo analysis for public release. Prefer this document over older FINAL-REPORT/DEPLOYMENT-SUMMARY for current URLs.*
