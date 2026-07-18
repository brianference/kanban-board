# Multi-user Kanban Platform Design

**Date:** 2026-07-18  
**Status:** Approved for implementation  
**Auth:** Email + password (magic link later)  
**Storage:** Cloudflare D1 only (no Supabase)

## Goals (items 1–10)

1. Accounts + D1 source of truth  
2. Empty / template starters (no internal seed)  
3. Projects → boards → tasks  
4. Session isolation on every query  
5. Project switcher + create project  
6. Due dates + assignee  
7. Empty/loading/toasts; no Eruda in prod  
8. Invite / share links  
9. Landing + progressive signup  
10. Mobile move-to-column  

## Stack

- Vite + React 18 + TypeScript (strict)  
- Cloudflare Pages + Pages Functions  
- D1 SQLite via `migrations/0001_init.sql`  
- Modular folders: `src/pages`, `src/components`, `src/lib`, `functions/api/*`, `functions/_lib/*`

## Security

- PBKDF2-SHA-256, 210k iterations  
- HttpOnly + Secure + SameSite=Lax session cookie  
- Same-origin check on mutations  
- Rate limits on register/login  
- Membership checks via `project_members`  
- Soft-delete tasks  
- CSP in `public/_headers`

## Out of scope (later)

- Magic link email  
- Real-time websockets  
- Billing  
- Custom column editor UI  
