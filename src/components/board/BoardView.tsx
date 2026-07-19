import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type {
  BoardFilters,
  BoardPayload,
  ProjectMember,
  SavedView,
  SwimlaneMode,
  Task,
} from '../../types/models'
import { defaultFilters } from '../../types/models'
import { TaskCard } from './TaskCard'
import { TaskModal, emptyTaskForm, taskToForm, type TaskFormState } from './TaskModal'
import { BoardFiltersBar } from './BoardFiltersBar'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import { collectTags, filterTasks } from '../../lib/filters'
import { useAuth } from '../../hooks/useAuth'

/**
 * Kanban board with DnD, filters, swimlanes, WIP, and cloud auto-save.
 */
export function BoardView({
  data,
  members,
  canWrite,
  projectId,
  onReload,
}: {
  data: BoardPayload
  members: ProjectMember[]
  canWrite: boolean
  projectId: string
  onReload: () => Promise<void>
}) {
  const { push } = useToast()
  const { user } = useAuth()
  const [activeColumnKey, setActiveColumnKey] = useState(data.columns[0]?.key || '')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [formInitial, setFormInitial] = useState<TaskFormState>(
    emptyTaskForm(data.columns[0]?.id || ''),
  )

  const [tasks, setTasks] = useState<Task[]>(data.tasks)
  const [columns, setColumns] = useState(data.columns)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [filters, setFilters] = useState<BoardFilters>(defaultFilters)
  const [swimlane, setSwimlane] = useState<SwimlaneMode>('none')
  const [views, setViews] = useState<SavedView[]>([])

  const overColumnRef = useRef<string | null>(null)
  const dragTaskRef = useRef<string | null>(null)
  const settleTimer = useRef<number | null>(null)
  const savedTimer = useRef<number | null>(null)

  useEffect(() => {
    setTasks(data.tasks)
    setColumns(data.columns)
  }, [data.tasks, data.columns])

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.listViews(projectId)
        setViews(res.views)
      } catch {
        /* ignore */
      }
    })()
  }, [projectId])

  useEffect(() => {
    return () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current)
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
    }
  }, [])

  // Deep-link ?task=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tid = params.get('task')
    if (!tid) return
    const task = data.tasks.find((t) => t.id === tid)
    if (task) {
      setEditing(task)
      setFormInitial(taskToForm(task))
      setModalOpen(true)
    }
  }, [data.tasks])

  const filteredTasks = useMemo(
    () => filterTasks(tasks, filters, user?.id),
    [tasks, filters, user?.id],
  )

  const tags = useMemo(() => collectTags(tasks), [tasks])

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const col of columns) map.set(col.id, [])
    for (const task of filteredTasks) {
      const list = map.get(task.columnId) || []
      list.push(task)
      map.set(task.columnId, list)
    }
    for (const [, list] of map) list.sort((a, b) => a.position - b.position)
    return map
  }, [columns, filteredTasks])

  function swimlaneKey(task: Task): string {
    if (swimlane === 'assignee') {
      return task.assigneeName || task.assigneeEmail || 'Unassigned'
    }
    if (swimlane === 'priority') return task.priority
    if (swimlane === 'tag') return task.tags[0] || 'No tag'
    return ''
  }

  function groupBySwimlane(list: Task[]): { key: string; tasks: Task[] }[] {
    if (swimlane === 'none') return [{ key: '', tasks: list }]
    const map = new Map<string, Task[]>()
    for (const t of list) {
      const k = swimlaneKey(t)
      const arr = map.get(k) || []
      arr.push(t)
      map.set(k, arr)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, tasks]) => ({ key, tasks }))
  }

  const openCreate = useCallback(() => {
    const col = columns.find((c) => c.key === activeColumnKey) || columns[0]
    if (!col) return
    setEditing(null)
    setFormInitial(emptyTaskForm(col.id))
    setModalOpen(true)
  }, [activeColumnKey, columns])

  const openEdit = useCallback((task: Task) => {
    setEditing(task)
    setFormInitial(taskToForm(task))
    setModalOpen(true)
  }, [])

  async function saveTask(form: TaskFormState) {
    const dueAt = form.dueAt ? new Date(form.dueAt + 'T12:00:00').getTime() : null
    const tagsList = form.tags
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
          tags: tagsList,
          recurringRule: form.recurringRule,
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
          tags: tagsList,
          recurringRule: form.recurringRule,
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
      throw err
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
    const el = e.currentTarget as HTMLElement
    try {
      e.dataTransfer.setDragImage(el, Math.min(40, el.offsetWidth / 4), 20)
    } catch {
      /* */
    }
  }

  function onDragEnd() {
    if (dragTaskRef.current) {
      dragTaskRef.current = null
      overColumnRef.current = null
      setDragTaskId(null)
      setOverColumnId(null)
    }
  }

  function onDragOverColumn(columnId: string, e: DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!canWrite || !dragTaskRef.current) return
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
    dragTaskRef.current = null
    overColumnRef.current = null
    setDragTaskId(null)
    setOverColumnId(null)
    await commitMove(taskId, columnId, position)
  }

  async function setWip(columnId: string) {
    const col = columns.find((c) => c.id === columnId)
    if (!col || !canWrite) return
    const raw = window.prompt(
      `WIP limit for “${col.name}” (blank = none)`,
      col.wipLimit != null ? String(col.wipLimit) : '',
    )
    if (raw === null) return
    const wipLimit = raw.trim() === '' ? null : Number(raw)
    if (wipLimit !== null && (!Number.isFinite(wipLimit) || wipLimit < 0)) {
      push('Invalid WIP limit', 'error')
      return
    }
    try {
      const res = await api.updateColumn(columnId, { wipLimit })
      setColumns((cols) =>
        cols.map((c) => (c.id === columnId ? { ...c, wipLimit: res.wipLimit } : c)),
      )
      push('Column updated', 'success')
    } catch (err) {
      push(err instanceof Error ? err.message : 'WIP update failed', 'error')
    }
  }

  async function onSaveView() {
    const name = window.prompt('Name this filter view')
    if (!name?.trim()) return
    try {
      const res = await api.saveView(projectId, name.trim(), filters)
      setViews((v) => [res.view, ...v])
      push('View saved', 'success')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not save view', 'error')
    }
  }

  async function onDeleteView(id: string) {
    await api.deleteView(id)
    setViews((v) => v.filter((x) => x.id !== id))
  }

  function scrollToColumn(key: string) {
    setActiveColumnKey(key)
    document
      .querySelector(`[data-col-key="${key}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
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

      <BoardFiltersBar
        filters={filters}
        onChange={setFilters}
        members={members}
        tags={tags}
        swimlane={swimlane}
        onSwimlane={setSwimlane}
        views={views}
        onSaveView={() => void onSaveView()}
        onApplyView={(v) => setFilters({ ...defaultFilters(), ...v.filters })}
        onDeleteView={(id) => void onDeleteView(id)}
        filteredCount={filteredTasks.length}
        totalCount={tasks.length}
      />

      <div className="mobile-tabs" role="tablist" aria-label="Jump to column">
        {columns.map((col) => {
          const count = (tasksByColumn.get(col.id) || []).length
          const wip = col.wipLimit
          const over = wip != null && count > wip
          return (
            <button
              key={col.id}
              type="button"
              role="tab"
              aria-selected={col.key === activeColumnKey}
              className={`mobile-tab ${col.key === activeColumnKey ? 'active' : ''} ${over ? 'wip-over' : ''}`}
              onClick={() => scrollToColumn(col.key)}
            >
              {col.name} {count}
              {wip != null ? `/${wip}` : ''}
            </button>
          )
        })}
      </div>

      {canWrite ? (
        <p className="drag-hint muted">
          Drag cards between columns (auto-saves). Filters and swimlanes reshape the board. Set WIP
          with the ⚙ on each column.
        </p>
      ) : null}

      <div className="columns-scroll">
        {columns.map((col) => {
          const columnTasks = tasksByColumn.get(col.id) || []
          const isTarget = overColumnId === col.id && Boolean(dragTaskId)
          const wip = col.wipLimit
          const count = columnTasks.length
          const wipOver = wip != null && count > wip
          const wipFull = wip != null && count >= wip
          const lanes = groupBySwimlane(columnTasks)

          return (
            <section
              key={col.id}
              data-col-id={col.id}
              data-col-key={col.key}
              className={`column ${isTarget ? 'column--drop-target' : ''} ${
                dragTaskId ? 'column--dragging-active' : ''
              } ${wipOver ? 'column--wip-over' : ''}`}
              onDragEnter={(e) => onDragEnterColumn(col.id, e)}
              onDragOver={(e) => onDragOverColumn(col.id, e)}
              onDrop={(e) => void onDropColumn(col.id, e)}
              aria-label={col.name}
            >
              <div className="column-header">
                <span>
                  {col.name}
                  {wip != null ? (
                    <span className={`wip-badge ${wipFull ? 'wip-badge--full' : ''}`}>
                      {' '}
                      {count}/{wip}
                    </span>
                  ) : (
                    <span className="muted"> {count}</span>
                  )}
                </span>
                {canWrite ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    title="Set WIP limit"
                    onClick={() => void setWip(col.id)}
                  >
                    ⚙
                  </button>
                ) : (
                  <span className="muted">{count}</span>
                )}
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
                  lanes.map((lane) => (
                    <div key={lane.key || 'all'} className="swimlane">
                      {lane.key ? <div className="swimlane-label">{lane.key}</div> : null}
                      {lane.tasks.map((task) => (
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
                      ))}
                    </div>
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
        columns={columns}
        members={members}
        initial={formInitial}
        taskId={editing?.id ?? null}
        canWrite={canWrite}
        initialAttachments={editing?.attachments ?? []}
        onClose={() => setModalOpen(false)}
        onSave={saveTask}
        onDelete={editing && canWrite ? deleteTask : undefined}
        showMoveSheet={Boolean(editing && canWrite)}
        onMoveToColumn={editing && canWrite ? moveToColumn : undefined}
        onAttachmentsChange={() => void onReload()}
      />
    </div>
  )
}
