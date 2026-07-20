# FlowBoard — test run report

**Generated:** 2026-07-19T20:59:45.175Z
**Target:** https://kanban-board-public.pages.dev

## Totals

| Metric | Value |
|--------|-------|
| Passed | 91 |
| Failed | 11 |
| Skipped | 1 |
| Total | 103 |

## Suites

- **comprehensive-api**: 63 pass / 0 fail / 0 skip (5952ms)
- **playwright-visual-ux-mobile**: 27 pass / 0 fail / 0 skip (49826ms)
- **100-user-sim**: 1 pass / 11 fail / 0 skip (111613ms)
- **e2e-prod-reference**: 0 pass / 0 fail / 1 skip (0ms)

## Bugs recorded

| ID | Suite | Case | Detail |
|----|-------|------|--------|
| UAT-098 | 100-user-sim | register+journey success 45/100 | assertion failed |
| UAT-099 | 100-user-sim | create task success among users | assertion failed |
| user-24 | 100-user-sim | user journey failed | register 429 |
| user-25 | 100-user-sim | user journey failed | register 429 |
| user-26 | 100-user-sim | user journey failed | register 429 |
| user-27 | 100-user-sim | user journey failed | register 429 |
| user-28 | 100-user-sim | user journey failed | register 429 |
| user-29 | 100-user-sim | user journey failed | register 429 |
| user-30 | 100-user-sim | user journey failed | register 429 |
| user-31 | 100-user-sim | user journey failed | register 429 |
| STRESS-001 | 100-user-sim | spike 30 concurrent journeys 11/30 | assertion failed |

## Learnings

- **comprehensive-api:** Auth forms are client-rendered; static fetch only proves SPA shell, not form DOM
- **comprehensive-api:** Origin check on mutating auth routes returns 403 for foreign Origin
- **playwright-visual-ux-mobile:** Primary controls min height 38.390625px — below 44px WCAG 2.5.5 AAA, OK for AA if spacing allows
- **100-user-sim:** register: n=45 p50=687ms p95=830ms max=916ms
- **100-user-sim:** session: n=45 p50=24ms p95=32ms max=71ms
- **100-user-sim:** board: n=45 p50=224ms p95=274ms max=322ms
- **100-user-sim:** createTask: n=45 p50=177ms p95=210ms max=220ms
- **100-user-sim:** comment: n=45 p50=127ms p95=175ms max=367ms
- **100-user-sim:** search: n=45 p50=76ms p95=95ms max=125ms
- **100-user-sim:** move: n=45 p50=145ms p95=194ms max=381ms
- **100-user-sim:** Full journey: success=45/100 (45.0%) wall=106800ms p50=1661ms p95=1886ms concurrency=3
- **100-user-sim:** Failure sample errors: register 429
- **100-user-sim:** Stress spike: 11/30 concurrent full journeys succeeded
- **e2e-prod-reference:** Full e2e-prod.mjs remains available via npm run test:e2e

## UAT catalog

See [UAT-100-test-cases.md](./UAT-100-test-cases.md) for the full 100-case matrix.
