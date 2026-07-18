/**
 * Logic tests for drag/move commit rules (no browser).
 * Simulates column append position and id resolution used by BoardView.
 */
import assert from 'node:assert/strict'

function nextPosition(columnTasks, taskId) {
  const list = columnTasks.filter((t) => t.id !== taskId)
  return list.length ? list[list.length - 1].position + 1 : 0
}

function resolveTaskId(dataTransfer, fallback) {
  return (
    dataTransfer['application/x-task-id'] ||
    dataTransfer['text/plain'] ||
    fallback ||
    null
  )
}

// Position math
assert.equal(nextPosition([], 'a'), 0)
assert.equal(nextPosition([{ id: 'b', position: 0 }], 'a'), 1)
assert.equal(nextPosition([{ id: 'a', position: 0 }, { id: 'b', position: 1 }], 'a'), 2)

// Id resolution prefers custom mime
assert.equal(
  resolveTaskId({ 'application/x-task-id': 't1', 'text/plain': 't2' }, 't3'),
  't1',
)
assert.equal(resolveTaskId({ 'text/plain': 't2' }, 't3'), 't2')
assert.equal(resolveTaskId({}, 't3'), 't3')
assert.equal(resolveTaskId({}, null), null)

// Optimistic move map
function optimisticMove(tasks, taskId, columnId, position) {
  return tasks.map((t) => (t.id === taskId ? { ...t, columnId, position } : t))
}
const after = optimisticMove(
  [
    { id: '1', columnId: 'c1', position: 0 },
    { id: '2', columnId: 'c1', position: 1 },
  ],
  '1',
  'c2',
  0,
)
assert.equal(after.find((t) => t.id === '1').columnId, 'c2')
assert.equal(after.find((t) => t.id === '2').columnId, 'c1')

console.log('Drag logic tests: 7 assertions passed')
