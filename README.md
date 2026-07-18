# Kanban Board (multi-user platform)

Cloud-backed project tracker: **accounts, projects, boards, tasks** on **Cloudflare D1**.

- Live: https://kanban-board-public.pages.dev  
- Source: https://github.com/brianference/kanban-board  
- Mobile mockups: `/mockups/mobile-variations.html`

## Stack

- React + TypeScript + Vite (modular UI, not a monolith)
- Cloudflare Pages Functions API
- D1 (SQLite) with versioned migrations
- Email + password auth (PBKDF2), httpOnly sessions

## Local dev

```bash
npm install
npm run build
npx wrangler d1 migrations apply kanban-board-db --local
npx wrangler pages dev dist --d1=DB=kanban-board-db
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run build` | Typecheck + production bundle |
| `npm run test:unit` | Unit tests |
| `npm run test:security` | Security / tenancy tests |
| `npm run test:api` | API contract tests |
| `npm run test:integration` | Multi-step flows |
| `npm run test:sim` | 20 journey simulations |
| `npm run test:pass1` | Full automated pass |

## Architecture

```
src/                 UI routes & components
functions/api/       HTTP handlers
functions/_lib/      auth, crypto, tenancy, templates
migrations/          D1 schema
mockups/             3 mobile-first design variations
legacy/              Previous single-file board (archive)
```

## Auth

1. `POST /api/auth/register` `{ email, password, name }`  
2. `POST /api/auth/login` `{ email, password }`  
3. Cookie `kb_session` (HttpOnly)  
4. `GET /api/auth/session`

No email provider required for v1.
