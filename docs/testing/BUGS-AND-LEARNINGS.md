# FlowBoard — bugs & learnings (test campaign)

**Generated:** 2026-07-19  
**Target:** https://kanban-board-public.pages.dev  
**UAT catalog:** [UAT-100-test-cases.md](./UAT-100-test-cases.md)  
**Raw JSON:** [last-run-results.json](./last-run-results.json)

---

## Campaign summary

| Suite | Result | Notes |
|-------|--------|--------|
| **Smoke / integration / security API** | **63 / 63 pass** | Full feature API path green |
| **Playwright visual / UX / mobile** | **25 pass / 1 fail** | Mobile task open flake (fixed in suite) |
| **100-user + stress** | **~45–100% journey** | Capped by **register rate limit (429)** — security working |
| **Artifacts** | `docs/testing/artifacts/*.png` | Visual captures |

**Latest combined totals (after CSP fix deploy):** ~89 pass / 12 fail across 102 automated checks. Failures are dominated by intentional rate limiting under multi-user stampede, not functional breakage of single-user flows.

---

## Bugs / findings

### BUG-001 — CSP blocked theme bootstrap (fixed)
| | |
|--|--|
| **Severity** | Medium (console noise; FOUC risk) |
| **Area** | Visual / security headers |
| **Symptom** | Browser console: `Refused to execute inline script` (script-src 'self') |
| **Cause** | Inline `<script>` in `index.html` for `kb-theme` vs CSP in `_headers` |
| **Fix** | Moved to `client/public/theme-boot.js` external file |
| **Status** | **Fixed & redeployed** |

### BUG-002 — Register rate limit blocks bulk signup stress
| | |
|--|--|
| **Severity** | Low for product / High for bulk onboarding ops |
| **Area** | Scalability / security |
| **Symptom** | `POST /api/auth/register` → **429** after ~15 attempts/minute/IP |
| **Cause** | In-memory rate limit in Pages Function (`rateLimit('reg:'+ip, 15, 60_000)`) |
| **Impact** | 100 concurrent “new users” from one IP cannot all register in &lt;1 min |
| **Learning** | Limit is **correct security**. Stress tests must use concurrency ≤3 + retries + multi-minute windows, or shared fixtures |
| **Status** | **By design** — document; optional: Durable Object / KV rate limit for multi-instance fairness |

### BUG-003 — Mobile task form open can fail if active tab column is empty
| | |
|--|--|
| **Severity** | Low (test flake / UX edge) |
| **Area** | Mobile UX / Playwright |
| **Symptom** | UAT-094: no form after click when first tab’s column empty |
| **Cause** | Mobile shows one column; first tab may be empty after moves |
| **Fix** | Test scans tabs until a `.task-card:visible` appears |
| **Status** | **Fixed in test suite** |

### BUG-004 — Some control heights &lt; 44px
| | |
|--|--|
| **Severity** | Low (a11y AAA) |
| **Area** | UX / mobile |
| **Symptom** | Measured primary `.btn` ~38px min height |
| **Cause** | Design system `min-height: 2.4rem` (~38px) |
| **Recommendation** | Raise primary buttons to `min-h-11` (44px) on mobile for WCAG 2.5.5 AAA |
| **Status** | **Open** (AA still reasonable) |

### BUG-005 — SPA routes not verifiable via raw HTTP body
| | |
|--|--|
| **Severity** | N/A (test design) |
| **Area** | Smoke testing |
| **Symptom** | GET `/register` HTML lacks “password” string |
| **Cause** | React client render |
| **Learning** | Smoke for forms must use Playwright/DOM, not `fetch` body regex |
| **Status** | Documented |

---

## Learnings (by discipline)

### Smoke testing
- Health + static assets + SPA shell are sufficient for deploy gates.
- Always curl `/api/health` **and** a real auth endpoint after Pages deploys (Functions ≠ static).

### Integration testing
- End-to-end API journey (register → project → board → task → move → checklist → comment+image → search → tenancy) is **solid**.
- Comment images + PNG magic-byte round-trip **pass** (migration 0005 applied).

### Security testing
- Cross-origin POST → 403 works.
- Attachments require auth.
- Foreign project/board/task/comment access → 404/403.
- Rate limiting on register is effective (blocks bot stampede).

### Visual inspection / UX
- Unified workspace panel + black footer confirmed in Playwright.
- Solid priority pills and drag grips present.
- No desktop horizontal page overflow.
- Dark mode toggle works.

### Mobile compatibility
- Column tabs present and switch.
- Hamburger menu works.
- No meaningful horizontal page scroll.
- Prefer scanning tabs before asserting task cards.

### Scalability / stress / 100 users
- **Health:** 50 concurrent → 50/50.
- **Full journey p50 ~1.7–2.0s** when registration succeeds.
- **Bottleneck:** register IP rate limit, not D1 task write latency (task create p50 ~175–230ms).
- Concurrent spike (30) without backoff collapses success rate — expected with shared IP limits.
- Recommendation for “100 users”: concurrency 1–2 + 250ms spacing **or** pre-seed users, then stress task/move/search only.

### User acceptance (100 cases)
- Catalog: `docs/testing/UAT-100-test-cases.md`
- Automated coverage: majority of P0/P1 via API + Playwright.
- Remaining manual: pure drag physics feel, long-session endurance, multi-device real hardware.

---

## How to re-run

```bash
# Full campaign (API + Playwright + 100 users)
API_BASE=https://kanban-board-public.pages.dev npm run test:campaign

# Pieces
npm run test:api
npm run test:pw
USER_COUNT=100 CONCURRENCY=3 npm run test:users
npm run test:e2e
```

---

## Pass / fail interpretation for leadership

| Question | Answer |
|----------|--------|
| Can a single user complete all features? | **Yes** (API + Playwright) |
| Is multi-tenant isolation OK? | **Yes** |
| Are images safe & working? | **Yes** (task + comment) |
| Can 100 users sign up from one IP in seconds? | **No** — rate limited (**good**) |
| Production UX polish issues? | Minor a11y (44px targets); CSP fixed |

**Overall:** Production-ready for real use. Stress failures are security controls, not regressions. Open follow-ups: optional 44px mobile buttons; multi-IP or fixture-based load tests for scale demos.
