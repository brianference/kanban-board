/**
 * Lightweight sim — delegates to the full e2e suite.
 * Prefer: npm run test:e2e
 */
process.env.API_BASE =
  process.env.API_BASE || 'https://kanban-board-public.pages.dev'
await import('./e2e-prod.mjs')
