# FlowBoard UAT — 100 test cases

**App:** FlowBoard v4 · **Target:** https://kanban-board-public.pages.dev  
**Pass criteria:** Expected result met; no console errors; no 5xx on primary path.

Legend: **P** Priority (P0 blocker / P1 high / P2 medium / P3 low) · **Type** smoke | functional | UX | a11y | security | mobile

---

## A. Smoke & availability (1–8)

| ID | P | Type | Case | Steps | Expected |
|----|---|------|------|-------|----------|
| UAT-001 | P0 | smoke | Homepage loads | GET `/` | 200, FlowBoard branding visible |
| UAT-002 | P0 | smoke | Health API | GET `/api/health` | 200, `ok:true`, `db:up`, version present |
| UAT-003 | P0 | smoke | SPA asset bundle | Parse index for `assets/index-*.js` | Asset returns 200 |
| UAT-004 | P0 | smoke | CSS loads | Parse index for `assets/index-*.css` | Asset returns 200 |
| UAT-005 | P1 | smoke | robots.txt | GET `/robots.txt` | 200 |
| UAT-006 | P1 | smoke | favicon | GET `/favicon.svg` | 200 |
| UAT-007 | P0 | smoke | Register page | GET `/register` | Form with name/email/password |
| UAT-008 | P0 | smoke | Login page | GET `/login` | Email + password form |

## B. Auth & session (9–20)

| ID | P | Type | Case | Steps | Expected |
|----|---|------|------|-------|----------|
| UAT-009 | P0 | functional | Register valid user | POST register valid payload | 201, user + projectId, Set-Cookie fb_token |
| UAT-010 | P0 | functional | Session after register | GET `/api/auth/session` with cookie | 200, matching email |
| UAT-011 | P0 | functional | Logout | POST logout | 200; subsequent session 401 |
| UAT-012 | P0 | functional | Login valid | POST login | 200, cookie set |
| UAT-013 | P0 | functional | Login wrong password | POST login bad password | 401 |
| UAT-014 | P1 | functional | Register duplicate email | Register same email twice | 409 or error |
| UAT-015 | P1 | functional | Register short password | Password &lt; 8 | 400 |
| UAT-016 | P1 | functional | Register invalid email | `not-an-email` | 400 |
| UAT-017 | P1 | security | Session without cookie | GET session bare | 401 |
| UAT-018 | P1 | security | Cross-origin POST blocked | POST logout Origin evil.example | 403 |
| UAT-019 | P2 | UX | Register redirects to project | UI submit register | Lands on `/app/projects/:id` |
| UAT-020 | P2 | UX | Sign out clears UI session | Click Sign out | Header shows Sign in |

## C. Projects & tenancy (21–30)

| ID | P | Type | Case | Steps | Expected |
|----|---|------|------|-------|----------|
| UAT-021 | P0 | functional | List projects | GET `/api/projects` authed | ≥1 project after register |
| UAT-022 | P0 | functional | Create project | POST name + template | 201 projectId + boardId |
| UAT-023 | P0 | functional | Get project | GET project | boards, members, role owner |
| UAT-024 | P1 | functional | Delete project | DELETE as owner | 200 |
| UAT-025 | P0 | security | Other user cannot read project | User B GET user A project | 403/404 |
| UAT-026 | P0 | security | Other user cannot read board | User B GET board | 403/404 |
| UAT-027 | P0 | security | Other user cannot read task | User B GET task | 403/404 |
| UAT-028 | P1 | functional | Template personal | Create with personal template | Board has starter tasks |
| UAT-029 | P2 | UX | Dashboard shows project cards | Open `/app` | Project name + open link |
| UAT-030 | P2 | UX | Empty name rejected | POST project name `""` | 400 |

## D. Board & drag (31–42)

| ID | P | Type | Case | Steps | Expected |
|----|---|------|------|-------|----------|
| UAT-031 | P0 | functional | Get board payload | GET board | columns ≥3, tasks array |
| UAT-032 | P0 | functional | Columns include backlog/done | Inspect column keys/names | Standard kanban lanes present |
| UAT-033 | P0 | functional | Create task | POST task | 201 taskId |
| UAT-034 | P0 | functional | Move task | POST move to other column | 200; columnId updates |
| UAT-035 | P0 | functional | Patch task title | PATCH title | 200; GET reflects change |
| UAT-036 | P1 | functional | Patch priority | PATCH critical | priority critical |
| UAT-037 | P1 | functional | Soft delete task | DELETE task | 200; GET 404 |
| UAT-038 | P1 | functional | Board filter by priority | UI filter high | Only high tasks shown |
| UAT-039 | P1 | functional | Board text filter | Type title substring | Matching cards only |
| UAT-040 | P2 | UX | Drag grip visible | Inspect card | Grip affordance present |
| UAT-041 | P2 | UX | Empty column drop zone | Empty column | “Drop cards here” |
| UAT-042 | P1 | mobile | Mobile column tabs | Viewport 390px | Tabs switch single column |

## E. Task detail (43–52)

| ID | P | Type | Case | Steps | Expected |
|----|---|------|------|-------|----------|
| UAT-043 | P0 | functional | Open task detail | GET task | title, description, role |
| UAT-044 | P0 | functional | Save description | PATCH description | Persists on reload |
| UAT-045 | P1 | functional | Set due date | PATCH dueAt | Due shown |
| UAT-046 | P1 | functional | Add checklist item | POST checklist | Item appears |
| UAT-047 | P1 | functional | Toggle checklist | PATCH done true | Checked |
| UAT-048 | P1 | functional | Delete checklist | DELETE item | Removed |
| UAT-049 | P2 | UX | Breadcrumb to project | Click project crumb | Returns board |
| UAT-050 | P2 | UX | Priority select options | Open select | critical/high/medium/low |
| UAT-051 | P1 | functional | Viewer cannot write | Viewer PATCH | 403/404 |
| UAT-052 | P2 | a11y | Labels on form fields | Inspect title/desc inputs | Associated labels |

## F. Attachments (53–62)

| ID | P | Type | Case | Steps | Expected |
|----|---|------|------|-------|----------|
| UAT-053 | P0 | functional | Upload PNG | multipart PNG | 201; GET image magic 89 50 4E 47 |
| UAT-054 | P0 | functional | Upload JPEG | multipart JPEG | 201; magic FF D8 |
| UAT-055 | P1 | functional | Empty MIME + .png | type "" name x.png | Accepted or clear error |
| UAT-056 | P1 | functional | Reject non-image | text/plain | 400 |
| UAT-057 | P1 | functional | Reject oversized raw | &gt;900KB without client compress | 400 |
| UAT-058 | P0 | security | Attachment requires auth | GET image no cookie | 401/404 |
| UAT-059 | P1 | functional | Delete attachment | DELETE | 200; GET gone |
| UAT-060 | P1 | UX | Client compress large image | Upload ~2MB screenshot | Success toast optimized KB |
| UAT-061 | P2 | functional | Max 8 task images | Upload 9th | 400 |
| UAT-062 | P1 | visual | AuthImage shows thumbnail | After upload | Not broken icon |

## G. Comments, mentions, tags (63–74)

| ID | P | Type | Case | Steps | Expected |
|----|---|------|------|-------|----------|
| UAT-063 | P0 | functional | Post text comment | POST body | 201; listed on task |
| UAT-064 | P0 | functional | Comment with image | multipart body+file | Attachment URL serves image |
| UAT-065 | P1 | functional | Comment image-only | body empty + file | Comment created |
| UAT-066 | P1 | functional | @email mention | Body `@user@ex.com` | 201; mention parsed |
| UAT-067 | P1 | functional | @name mention | Body `@DisplayName` | Resolves if member |
| UAT-068 | P1 | UX | Mention autocomplete | Type `@` in composer | Member list appears |
| UAT-069 | P1 | UX | Tag chip insert | Click Tag chip | Inserts @handle |
| UAT-070 | P1 | visual | Mention highlight | View comment | @token styled |
| UAT-071 | P1 | visual | #tag highlight | Body `#focus` | Tag chip style |
| UAT-072 | P1 | functional | Max 4 comment images | 5 files | 400 or client cap |
| UAT-073 | P2 | functional | Empty comment rejected | body "" no files | 400 |
| UAT-074 | P2 | security | Comment on foreign task | User B posts | 403/404 |

## H. Search & contact (75–82)

| ID | P | Type | Case | Steps | Expected |
|----|---|------|------|-------|----------|
| UAT-075 | P0 | functional | Search by keyword | GET search?q= | Results include task |
| UAT-076 | P1 | functional | Search priority filter | priority=high | Only high |
| UAT-077 | P1 | UX | Header search dropdown | Type in header | Hits + view all |
| UAT-078 | P1 | UX | Header search unauth | Logged out | Prompt sign in |
| UAT-079 | P1 | functional | Contact form | POST contact | 201 |
| UAT-080 | P2 | functional | Contact validation | Empty message | 400 |
| UAT-081 | P2 | UX | Legal pages | /privacy /terms | Readable prose |
| UAT-082 | P2 | UX | About / Contact pages | Navigate | Content + no console errors |

## I. Visual / UX / a11y (83–92)

| ID | P | Type | Case | Steps | Expected |
|----|---|------|------|-------|----------|
| UAT-083 | P1 | visual | Header/body/footer aligned | Desktop 1440 | Shared max-width, no clash |
| UAT-084 | P1 | visual | Black footer | Inspect footer | Dark #071018 style |
| UAT-085 | P1 | visual | Board workspace card | Board page | Single bordered panel |
| UAT-086 | P1 | visual | Priority solid pills | Cards | HIGH/MED/LOW filled |
| UAT-087 | P1 | visual | Focus visible | Tab through header | Focus ring on controls |
| UAT-088 | P1 | a11y | Touch targets ≥44px | Mobile buttons | Min height reasonable |
| UAT-089 | P1 | a11y | Contrast body text | Light mode | Readable on bg |
| UAT-090 | P2 | UX | Loading states | Slow network | No blank crash |
| UAT-091 | P2 | UX | Error toast on fail | Force bad login | User-visible error |
| UAT-092 | P1 | visual | Dark mode toggle | Click moon | Surfaces invert |

## J. Mobile compatibility (93–96)

| ID | P | Type | Case | Steps | Expected |
|----|---|------|------|-------|----------|
| UAT-093 | P0 | mobile | Board usable 390×844 | iPhone viewport | Tabs + one column |
| UAT-094 | P1 | mobile | Task detail forms | Mobile | Inputs full width, no overflow |
| UAT-095 | P1 | mobile | Header hamburger | &lt;md | Menu opens |
| UAT-096 | P2 | mobile | No horizontal page scroll | Board | document scrollWidth ≈ clientWidth |

## K. Performance & multi-user (97–100)

| ID | P | Type | Case | Steps | Expected |
|----|---|------|------|-------|----------|
| UAT-097 | P1 | scale | Health under parallel load | 50 concurrent GET health | ≥95% 200 |
| UAT-098 | P1 | stress | 100 register+session | Sequential/batched | Success rate ≥90% |
| UAT-099 | P1 | stress | 100 users create task | Per-user task create | Success ≥90% |
| UAT-100 | P0 | smoke | Full journey | register→board→task→comment→search→logout | All steps pass |

---

**Automation mapping**

| Suite | Script | Covers |
|-------|--------|--------|
| Smoke + integration + security | `scripts/test-comprehensive.mjs` | API UAT bulk |
| Playwright visual/UX/mobile | `scripts/test-playwright-suite.mjs` | UI UAT |
| 100-user sim | `scripts/test-100-users.mjs` | UAT-097–099 |
| Full e2e | `scripts/e2e-prod.mjs` | Core path |
