import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type { BoardPayload, ProjectMember, Task } from '../../types/models'
import { TaskCard } from './TaskCard'
import { TaskModal, emptyTaskForm, taskToForm, type TaskFormState } from './TaskModal'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

/**
 * Kanban board — reliable HTML5 DnD + cloud auto-save on every move.
 *
 * Important: avoid setState on every dragover (re-renders cancel native drag).
 */
export function BoardView({
  data,
  members,
  canWrite,
  onReload,
}: {
  data: BoardPayload
  members: ProjectMember[]
  canWrite: boolean
  onReload: () => Promise<void>
}) {
  const { push } = useToast()
  const [activeColumnKey, setActiveColumnKey] = useState(data.columns[0]?.key || '')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [formInitial, setFormInitial] = useState<TaskFormState>(
    emptyTaskForm(data.columns[0]?.id || ''),
  )

  const [tasks, setTasks] = useState<Task[]>(data.tasks)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  /** Highlight only — updated sparingly when column changes, not every pixel. */
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const overColumnRef = useRef<string | null>(null)
  const dragTaskRef = useRef<string | null>(null)
  const settleTimer = useRef<number | null>(null)
  const savedTimer = useRef<number | null>(null)

  useEffect(() => {
    setTasks(data.tasks)
  }, [data.tasks])

  useEffect(() => {
    return () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current)
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
    }
  }, [])

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const col of data.columns) map.set(col.id, [])
    for (const task of tasks) {
      const list = map.get(task.columnId) || []
      list.push(task)
      map.set(task.columnId, list)
    }
    for (const [, list] of map) list.sort((a, b) => a.position - b.position)
    return map
  }, [data.columns, tasks])

  const openCreate = useCallback(() => {
    const col =
      data.columns.find((c) => c.key === activeColumnKey) || data.columns[0]
    if (!col) return
    setEditing(null)
    setFormInitial(emptyTaskForm(col.id))
    setModalOpen(true)
  }, [activeColumnKey, data.columns])

  const openEdit = useCallback((task: Task) => {
    setEditing(task)
    setFormInitial(taskToForm(task))
    setModalOpen(true)
  }, [])

  async function saveTask(form: TaskFormState) {
    const dueAt = form.dueAt ? new Date(form.dueAt + 'T12:00:00').getTime() : null
    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    setSaveState('saving')
    try {
      if (editing) {
        await api.updateTask(editing.id, {
          title: form.title,
          description: form.description,
          priority: form.priority,
          columnId: form.columnId,
          dueAt,
          assigneeId: form.assigneeId || null,
          tags,
        })
        push('Task saved to cloud', 'success')
      } else {
        await api.createTask({
          boardId: data.board.id,
          columnId: form.columnId,
          title: form.title,
          description: form.description,
          priority: form.priority,
          dueAt,
          assigneeId: form.assigneeId || null,
          tags,
        })
        push('Task created and saved', 'success')
      }
      setSaveState('saved')
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSaveState('idle'), 2500)
      await onReload()
    } catch (err) {
      setSaveState('error')
      push(err instanceof Error ? err.message : 'Save failed', 'error')
    }
  }

  async function deleteTask() {
    if (!editing) return
    setSaveState('saving')
    try {
      await api.deleteTask(editing.id)
      push('Task deleted', 'success')
      setModalOpen(false)
      setSaveState('saved')
      await onReload()
    } catch (err) {
      setSaveState('error')
      push(err instanceof Error ? err.message : 'Delete failed', 'error')
    }
  }

  /**
   * Optimistic local move + persist to D1. This is how the board is "saved".
   */
  async function commitMove(taskId: string, columnId: string, position: number) {
    const prev = tasks
    setTasks((list) =>
      list.map((t) =>
        t.id === taskId ? { ...t, columnId, position, updatedAt: Date.now() } : t,
      ),
    )
    setSettlingId(taskId)
    if (settleTimer.current) window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => setSettlingId(null), 420)

    setSaveState('saving')
    try {
      await api.moveTask(taskId, columnId, position)
      setSaveState('saved')
      push('Board saved', 'success')
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSaveState('idle'), 2500)
      // Soft reload without blocking UI if possible
      void onReload()
    } catch (err) {
      setTasks(prev)
      setSaveState('error')
      push(err instanceof Error ? err.message : 'Move failed — not saved', 'error')
    } finally {
      dragTaskRef.current = null
      overColumnRef.current = null
      setDragTaskId(null)
      setOverColumnId(null)
    }
  }

  async function moveToColumn(columnId: string) {
    if (!editing) return
    const list = (tasksByColumn.get(columnId) || []).filter((t) => t.id !== editing.id)
    const position = list.length ? list[list.length - 1]!.position + 1 : 0
    setModalOpen(false)
    await commitMove(editing.id, columnId, position)
  }

  function onDragStart(task: Task, e: DragEvent) {
    if (!canWrite) {
      e.preventDefault()
      return
    }
    dragTaskRef.current = task.id
    overColumnRef.current = task.columnId
    setDragTaskId(task.id)
    setOverColumnId(task.columnId)

    e.dataTransfer.setData('text/plain', task.id)
    e.dataTransfer.setData('application/x-task-id', task.id)
    e.dataTransfer.effectAllowed = 'move'

    // Prefer native drag image (reliable). Optional slight offset.
    const el = e.currentTarget as HTMLElement
    try {
      e.dataTransfer.setDragImage(el, Math.min(40, el.offsetWidth / 4), 20)
    } catch {
      /* some browsers ignore setDragImage */
    }
  }

  function onDragEnd() {
    // Drop may already have cleared; if cancelled, reset chrome only
    if (dragTaskRef.current) {
      dragTaskRef.current = null
      overColumnRef.current = null
      setDragTaskId(null)
      setOverColumnId(null)
    }
  }

  function onDragOverColumn(columnId: string, e: DragEvent) {
    // Required for drop to fire
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!canWrite || !dragTaskRef.current) return

    // Only re-render when the target column actually changes (prevents drag cancel)
    if (overColumnRef.current !== columnId) {
      overColumnRef.current = columnId
      setOverColumnId(columnId)
    }
  }

  function onDragEnterColumn(columnId: string, e: DragEvent) {
    e.preventDefault()
    if (!canWrite || !dragTaskRef.current) return
    if (overColumnRef.current !== columnId) {
      overColumnRef.current = columnId
      setOverColumnId(columnId)
    }
  }

  async function onDropColumn(columnId: string, e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!canWrite) return

    const taskId =
      e.dataTransfer.getData('application/x-task-id') ||
      e.dataTransfer.getData('text/plain') ||
      dragTaskRef.current
    if (!taskId) {
      setDragTaskId(null)
      setOverColumnId(null)
      return
    }

    const columnTasks = (tasksByColumn.get(columnId) || []).filter((t) => t.id !== taskId)
    const position = columnTasks.length
      ? columnTasks[columnTasks.length - 1]!.position + 1
      : 0

    // Clear drag chrome before async work
    dragTaskRef.current = null
    overColumnRef.current = null
    setDragTaskId(null)
    setOverColumnId(null)

    await commitMove(taskId, columnId, position)
  }

  function scrollToColumn(key: string) {
    setActiveColumnKey(key)
    const el = document.querySelector(`[data-col-key="${key}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }

  const saveLabel =
    saveState === 'saving'
      ? 'Saving to cloud…'
      : saveState === 'saved'
        ? 'Saved to cloud'
        : saveState === 'error'
          ? 'Save failed'
          : 'Auto-saves to cloud'

  return (
    <div className={`board-layout ${dragTaskId ? 'board-layout--dragging' : ''}`}>
      <div className="board-toolbar">
        <div>
          <h2 style={{ margin: 0 }}>{data.board.name}</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            {tasks.length} tasks · {canWrite ? 'drag cards between columns' : 'view only'}
          </p>
        </div>
        <div className="board-toolbar-right">
          <span
            className={`save-pill save-pill--${saveState === 'idle' ? 'idle' : saveState}`}
            role="status"
            aria-live="polite"
          >
            {saveState === 'saving' ? '⏳' : saveState === 'saved' ? '✓' : saveState === 'error' ? '!' : '☁'}{' '}
            {saveLabel}
          </span>
          {canWrite ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              ＋ New task
            </button>
          ) : null}
        </div>
      </div>

      <div className="mobile-tabs" role="tablist" aria-label="Jump to column">
        {data.columns.map((col) => {
          const count = (tasksByColumn.get(col.id) || []).length
          return (
            <button
              key={col.id}
              type="button"
              role="tab"
              aria-selected={col.key === activeColumnKey}
              className={`mobile-tab ${col.key === activeColumnKey ? 'active' : ''}`}
              onClick={() => scrollToColumn(col.key)}
            >
              {col.name} {count}
            </button>
          )
        })}
      </div>

      {canWrite ? (
        <p className="drag-hint muted">
          Drag a card into another column — it saves automatically. Or open a card and use{' '}
          <strong>Move to column</strong>.
        </p>
      ) : null}

      {/* Always show all columns (horizontal scroll on small screens) so DnD can reach targets */}
      <div className="columns-scroll">
        {data.columns.map((col) => {
          const columnTasks = tasksByColumn.get(col.id) || []
          const isTarget = overColumnId === col.id && Boolean(dragTaskId)

          return (
            <section
              key={col.id}
              data-col-id={col.id}
              data-col-key={col.key}
              className={`column ${isTarget ? 'column--drop-target' : ''} ${
                dragTaskId ? 'column--dragging-active' : ''
              }`}
              onDragEnter={(e) => onDragEnterColumn(col.id, e)}
              onDragOver={(e) => onDragOverColumn(col.id, e)}
              onDrop={(e) => void onDropColumn(col.id, e)}
              aria-label={col.name}
            >
              <div className="column-header">
                <span>{col.name}</span>
                <span className="muted">{columnTasks.length}</span>
              </div>
              <div
                className="column-body"
                onDragOver={(e) => onDragOverColumn(col.id, e)}
                onDrop={(e) => void onDropColumn(col.id, e)}
              >
                {columnTasks.length === 0 ? (
                  <div className={`column-empty ${isTarget ? 'column-empty--active' : ''}`}>
                    {canWrite ? (isTarget ? 'Release to drop' : 'Drop cards here') : 'No tasks'}
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onOpen={openEdit}
                      draggable={canWrite}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      isDragging={dragTaskId === task.id}
                      isSettling={settlingId === task.id}
                    />
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>

      {canWrite ? (
        <button type="button" className="fab" aria-label="New task" onClick={openCreate}>
          ＋
        </button>
      ) : null}

      <TaskModal
        open={modalOpen}
        title={editing ? 'Edit task' : 'New task'}
        columns={data.columns}
        members={members}
        initial={formInitial}
        onClose={() => setModalOpen(false)}
        onSave={saveTask}
        onDelete={editing && canWrite ? deleteTask : undefined}
        showMoveSheet={Boolean(editing && canWrite)}
        onMoveToColumn={editing && canWrite ? moveToColumn : undefined}
      />
    </div>
  )
}
