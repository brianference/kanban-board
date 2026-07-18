import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react'
import type { BoardPayload, ProjectMember, Task } from '../../types/models'
import { DropPlaceholder, TaskCard } from './TaskCard'
import { TaskModal, emptyTaskForm, taskToForm, type TaskFormState } from './TaskModal'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

/**
 * Kanban board with animated drag-and-drop between columns.
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

  /** Optimistic task list for instant drag feedback. */
  const [tasks, setTasks] = useState<Task[]>(data.tasks)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const dragImageRef = useRef<HTMLElement | null>(null)
  const settleTimer = useRef<number | null>(null)

  useEffect(() => {
    setTasks(data.tasks)
  }, [data.tasks])

  useEffect(() => {
    return () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current)
      if (dragImageRef.current) {
        dragImageRef.current.remove()
        dragImageRef.current = null
      }
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
      push('Task updated', 'success')
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
      push('Task created', 'success')
    }
    await onReload()
  }

  async function deleteTask() {
    if (!editing) return
    await api.deleteTask(editing.id)
    push('Task deleted', 'success')
    setModalOpen(false)
    await onReload()
  }

  async function moveToColumn(columnId: string) {
    if (!editing) return
    const list = tasksByColumn.get(columnId) || []
    const position = list.length ? list[list.length - 1]!.position + 1 : 0
    await commitMove(editing.id, columnId, position)
    setModalOpen(false)
  }

  /**
   * Optimistically reorder then persist.
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

    setMoving(true)
    try {
      await api.moveTask(taskId, columnId, position)
      await onReload()
    } catch (err) {
      setTasks(prev)
      push(err instanceof Error ? err.message : 'Move failed', 'error')
    } finally {
      setMoving(false)
      setDragTaskId(null)
      setOverColumnId(null)
      setOverIndex(null)
    }
  }

  function clearDragChrome() {
    setDragTaskId(null)
    setOverColumnId(null)
    setOverIndex(null)
    if (dragImageRef.current) {
      dragImageRef.current.remove()
      dragImageRef.current = null
    }
  }

  function onDragStart(task: Task, e: DragEvent) {
    if (!canWrite || moving) return
    setDragTaskId(task.id)
    e.dataTransfer.setData('text/plain', task.id)
    e.dataTransfer.effectAllowed = 'move'

    // Lifted ghost preview
    const source = e.currentTarget as HTMLElement
    const ghost = source.cloneNode(true) as HTMLElement
    ghost.classList.add('task-card--ghost')
    ghost.style.position = 'absolute'
    ghost.style.top = '-1000px'
    ghost.style.left = '-1000px'
    ghost.style.width = `${source.offsetWidth}px`
    ghost.style.pointerEvents = 'none'
    document.body.appendChild(ghost)
    dragImageRef.current = ghost
    e.dataTransfer.setDragImage(ghost, source.offsetWidth / 2, 24)
  }

  function onDragEnd() {
    if (!moving) clearDragChrome()
  }

  function onDragOverColumn(columnId: string, e: DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!canWrite || !dragTaskId) return
    setOverColumnId(columnId)

    const body = e.currentTarget.querySelector('.column-body') as HTMLElement | null
    if (!body) {
      setOverIndex(null)
      return
    }

    const cards = [...body.querySelectorAll<HTMLElement>('.task-card:not(.task-card--dragging)')]
    const y = e.clientY
    let index = cards.length
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i]!.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      if (y < mid) {
        index = i
        break
      }
    }
    setOverIndex(index)
  }

  function onDragLeaveColumn(e: DragEvent) {
    // Only clear when leaving the column entirely
    const related = e.relatedTarget as Node | null
    if (related && e.currentTarget.contains(related)) return
    setOverColumnId((id) => (id === (e.currentTarget as HTMLElement).dataset.colId ? null : id))
  }

  async function onDropColumn(columnId: string, e: DragEvent) {
    e.preventDefault()
    if (!canWrite) return
    const taskId = e.dataTransfer.getData('text/plain') || dragTaskId
    if (!taskId) {
      clearDragChrome()
      return
    }

    const columnTasks = (tasksByColumn.get(columnId) || []).filter((t) => t.id !== taskId)
    const insertAt = overColumnId === columnId && overIndex != null ? overIndex : columnTasks.length

    let position: number
    if (columnTasks.length === 0) {
      position = 0
    } else if (insertAt <= 0) {
      position = columnTasks[0]!.position - 1
    } else if (insertAt >= columnTasks.length) {
      position = columnTasks[columnTasks.length - 1]!.position + 1
    } else {
      const before = columnTasks[insertAt - 1]!.position
      const after = columnTasks[insertAt]!.position
      position = (before + after) / 2
    }

    await commitMove(taskId, columnId, position)
  }

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 768,
  )
  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const activeCol =
    data.columns.find((c) => c.key === activeColumnKey) || data.columns[0]

  function renderColumnTasks(columnId: string, columnTasks: Task[]) {
    const showPlaceholder = dragTaskId && overColumnId === columnId
    const insertAt = showPlaceholder ? (overIndex ?? columnTasks.length) : -1
    const nodes: ReactNode[] = []

    columnTasks.forEach((task, i) => {
      if (showPlaceholder && insertAt === i) {
        nodes.push(<DropPlaceholder key={`ph-${columnId}-${i}`} active />)
      }
      nodes.push(
        <TaskCard
          key={task.id}
          task={task}
          onOpen={openEdit}
          draggable={canWrite && !moving}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          isDragging={dragTaskId === task.id}
          isSettling={settlingId === task.id}
        />,
      )
    })

    if (showPlaceholder && insertAt >= columnTasks.length) {
      nodes.push(<DropPlaceholder key={`ph-${columnId}-end`} active />)
    }

    if (columnTasks.length === 0 && !showPlaceholder) {
      return (
        <div className="column-empty">
          {canWrite ? 'Drop a card here or add a task' : 'No tasks'}
        </div>
      )
    }

    if (columnTasks.length === 0 && showPlaceholder) {
      return <DropPlaceholder active />
    }

    return nodes
  }

  return (
    <div className={`board-layout ${dragTaskId ? 'board-layout--dragging' : ''}`}>
      <div className="board-toolbar">
        <div>
          <h2 style={{ margin: 0 }}>{data.board.name}</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            {tasks.length} tasks · {canWrite ? 'edit access' : 'view only'}
            {moving ? ' · saving…' : ''}
          </p>
        </div>
        {canWrite ? (
          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={moving}>
            ＋ New task
          </button>
        ) : null}
      </div>

      <div className="mobile-tabs" role="tablist" aria-label="Columns">
        {data.columns.map((col) => {
          const count = (tasksByColumn.get(col.id) || []).length
          return (
            <button
              key={col.id}
              type="button"
              role="tab"
              aria-selected={col.key === activeColumnKey}
              className={`mobile-tab ${col.key === activeColumnKey ? 'active' : ''}`}
              onClick={() => setActiveColumnKey(col.key)}
            >
              {col.name} {count}
            </button>
          )
        })}
      </div>

      <div className={`columns-scroll ${isMobile ? 'mobile-single' : ''}`}>
        {(isMobile ? (activeCol ? [activeCol] : []) : data.columns).map((col) => {
          // When hovering another column, hide the card from its source for a cleaner flight.
          const visibleTasks =
            dragTaskId && overColumnId && overColumnId !== col.id
              ? (tasksByColumn.get(col.id) || []).filter((t) => t.id !== dragTaskId)
              : tasksByColumn.get(col.id) || []

          const isTarget = overColumnId === col.id && Boolean(dragTaskId)

          return (
            <section
              key={col.id}
              data-col-id={col.id}
              className={`column ${isTarget ? 'column--drop-target' : ''} ${
                dragTaskId ? 'column--dragging-active' : ''
              }`}
              onDragOver={(e) => onDragOverColumn(col.id, e)}
              onDragLeave={onDragLeaveColumn}
              onDrop={(e) => void onDropColumn(col.id, e)}
              aria-label={col.name}
            >
              <div className="column-header">
                <span>{col.name}</span>
                <span className="muted">{(tasksByColumn.get(col.id) || []).length}</span>
              </div>
              <div className="column-body">{renderColumnTasks(col.id, visibleTasks)}</div>
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
