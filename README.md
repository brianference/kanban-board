# FlowBoard v3 — Full-stack project kanban

Modern full-stack kanban app.

| Layer | Technology |
|-------|------------|
| Frontend | Vite · React · TypeScript · Tailwind CSS · React Router |
| Backend | Node.js · Express |
| Database | SQLite (`better-sqlite3`) |
| Auth | JWT (httpOnly cookie) + bcrypt |

## Quick start

```bash
# Install
npm run install:all

# Terminal 1 — API
cd server
cp .env.example .env   # set JWT_SECRET
npm run dev

# Terminal 2 — UI (proxies /api → :8787)
cd client
npm run dev
```

Open http://localhost:5173

## Production

```bash
cd client && npm run build
cd ../server
NODE_ENV=production JWT_SECRET=... PORT=8787 npm start
```

Express serves `client/dist` and `/api/*`.

## Critical production notes

1. **`JWT_SECRET`** — long random string (32+ chars). Never commit real secrets.
2. **Persist volumes** — mount `server/data/` (SQLite) and `server/uploads/` (images).
3. **HTTPS** — required for secure cookies in production.
4. **`CLIENT_ORIGIN`** — set if UI is on another origin (CORS + cookies).
5. **Backups** — copy `server/data/flowboard.db` regularly.

## Pages

- `/` Home · `/about` · `/contact` · `/privacy` · `/terms`
- `/login` · `/register`
- `/app` Dashboard · `/app/projects/:id` Board · `/app/tasks/:id` Detail · `/search`

## Tests

```bash
# With server running on :8787
node scripts/sim-fullstack.mjs
```

## Release notes

See [docs/releases/v3.0.0.md](docs/releases/v3.0.0.md).
