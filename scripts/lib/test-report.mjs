/**
 * Shared result collector for FlowBoard test suites.
 */
import fs from 'fs'
import path from 'path'

export function createReporter(suiteName) {
  const results = []
  const bugs = []
  const learnings = []
  const t0 = Date.now()

  function pass(id, name, detail = '') {
    results.push({ id, name, status: 'pass', detail, ms: 0 })
    console.log(`  ✓ [${id}] ${name}${detail ? ` — ${detail}` : ''}`)
  }

  function fail(id, name, detail = '', bug = true) {
    results.push({ id, name, status: 'fail', detail, ms: 0 })
    console.error(`  ✗ [${id}] ${name}: ${detail}`)
    if (bug) {
      bugs.push({ id, name, detail, suite: suiteName, severity: 'found' })
    }
  }

  function skip(id, name, detail = '') {
    results.push({ id, name, status: 'skip', detail, ms: 0 })
    console.log(`  ○ [${id}] ${name} (skip: ${detail})`)
  }

  function learn(msg) {
    learnings.push({ suite: suiteName, msg, at: new Date().toISOString() })
    console.log(`  ℹ learning: ${msg}`)
  }

  function assert(cond, id, name, detail = '') {
    if (cond) pass(id, name)
    else fail(id, name, detail || 'assertion failed')
  }

  function summary() {
    const passed = results.filter((r) => r.status === 'pass').length
    const failed = results.filter((r) => r.status === 'fail').length
    const skipped = results.filter((r) => r.status === 'skip').length
    return {
      suite: suiteName,
      passed,
      failed,
      skipped,
      total: results.length,
      durationMs: Date.now() - t0,
      results,
      bugs,
      learnings,
    }
  }

  return { pass, fail, skip, learn, assert, summary, results, bugs, learnings }
}

export function writeReport(summaries, outDir = 'docs/testing') {
  fs.mkdirSync(outDir, { recursive: true })
  const allBugs = summaries.flatMap((s) => s.bugs || [])
  const allLearn = summaries.flatMap((s) => s.learnings || [])
  const passed = summaries.reduce((a, s) => a + s.passed, 0)
  const failed = summaries.reduce((a, s) => a + s.failed, 0)
  const skipped = summaries.reduce((a, s) => a + s.skipped, 0)
  const total = summaries.reduce((a, s) => a + s.total, 0)

  const jsonPath = path.join(outDir, 'last-run-results.json')
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        base: process.env.API_BASE || 'https://kanban-board-public.pages.dev',
        totals: { passed, failed, skipped, total },
        suites: summaries,
      },
      null,
      2,
    ),
  )

  const md = []
  md.push('# FlowBoard — test run report')
  md.push('')
  md.push(`**Generated:** ${new Date().toISOString()}`)
  md.push(`**Target:** ${process.env.API_BASE || 'https://kanban-board-public.pages.dev'}`)
  md.push('')
  md.push('## Totals')
  md.push('')
  md.push(`| Metric | Value |`)
  md.push(`|--------|-------|`)
  md.push(`| Passed | ${passed} |`)
  md.push(`| Failed | ${failed} |`)
  md.push(`| Skipped | ${skipped} |`)
  md.push(`| Total | ${total} |`)
  md.push('')
  md.push('## Suites')
  md.push('')
  for (const s of summaries) {
    md.push(
      `- **${s.suite}**: ${s.passed} pass / ${s.failed} fail / ${s.skipped} skip (${s.durationMs}ms)`,
    )
  }
  md.push('')
  md.push('## Bugs recorded')
  md.push('')
  if (!allBugs.length) {
    md.push('_No automated failures this run._')
  } else {
    md.push('| ID | Suite | Case | Detail |')
    md.push('|----|-------|------|--------|')
    for (const b of allBugs) {
      md.push(
        `| ${b.id} | ${b.suite} | ${b.name.replace(/\|/g, '/')} | ${String(b.detail).replace(/\|/g, '/').slice(0, 200)} |`,
      )
    }
  }
  md.push('')
  md.push('## Learnings')
  md.push('')
  if (!allLearn.length) md.push('_None recorded._')
  else for (const l of allLearn) md.push(`- **${l.suite}:** ${l.msg}`)
  md.push('')
  md.push('## UAT catalog')
  md.push('')
  md.push('See [UAT-100-test-cases.md](./UAT-100-test-cases.md) for the full 100-case matrix.')
  md.push('')

  const mdPath = path.join(outDir, 'BUGS-AND-LEARNINGS.md')
  fs.writeFileSync(mdPath, md.join('\n'))
  return { jsonPath, mdPath, passed, failed, total }
}
