# FlowBoard v4 — Project kanban on Cloudflare Pages

Multi-user kanban with accounts, D1 cloud storage, search, images, and a unified product UI.

| Layer | Technology |
|-------|------------|
| Frontend | Vite · React · TypeScript · Tailwind (layout) · design tokens |
| Backend | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite) |
| Auth | JWT (`fb_token` httpOnly cookie) + PBKDF2 |

**Production:** https://kanban-board-public.pages.dev  
**Release notes:** [docs/releases/v4.0.0.md](docs/releases/v4.0.0.md)

## Quick start (local)

```bash
npm install --prefix client
npm run build
# .dev.vars → JWT_SECRET=your-long-secret
npx wrangler pages dev client/dist --d1=DB --compatibility-date=2026-07-01
```

## Deploy (Type B — push does not deploy)

```bash
npm run db:migrate
npx wrangler pages secret put JWT_SECRET --project-name kanban-board-public
npm run deploy
```

## Tests

```bash
npm run test:e2e
# API_BASE=https://kanban-board-public.pages.dev node scripts/e2e-prod.mjs
```

## Backup

Pre-v4 source zip: `Downloads/flowboard-backups/flowboard-backup-pre-v4.0.0.zip`  
Git: `backup/pre-v4.0.0`, release tag `v4.0.0`
