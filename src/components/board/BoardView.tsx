import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import type { BoardPayload, ProjectMember, Task } from '../../types/models'
import { TaskCard } from './TaskCard'
import { TaskModal, emptyTaskForm, taskToForm, type TaskFormState } from './TaskModal'
import { api } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

/**
 * Kanban board with desktop drag-and-drop and mobile move sheet.
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
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const col of data.columns) map.set(col.id, [])
    for (const task of data.tasks) {
      const list = map.get(task.columnId) || []
      list.push(task)
      map.set(task.columnId, list)
    }
    for (const [, list] of map) list.sort((a, b) => a.position - b.position)
    return map
  }, [data])

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
    await api.moveTask(editing.id, columnId, position)
    push('Task moved', 'success')
    setModalOpen(false)
    await onReload()
  }

  function onDragStart(task: Task, e: DragEvent) {
    if (!canWrite) return
    setDragTaskId(task.id)
    e.dataTransfer.setData('text/plain', task.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  async function onDropColumn(columnId: string, e: DragEvent) {
    e.preventDefault()
    if (!canWrite) return
    const taskId = e.dataTransfer.getData('text/plain') || dragTaskId
    if (!taskId) return
    const list = tasksByColumn.get(columnId) || []
    const position = list.length ? list[list.length - 1]!.position + 1 : 0
    try {
      await api.moveTask(taskId, columnId, position)
      await onReload()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Move failed', 'error')
    } finally {
      setDragTaskId(null)
    }
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

  return (
    <div className="board-layout">
      <div className="board-toolbar">
        <div>
          <h2 style={{ margin: 0 }}>{data.board.name}</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            {data.tasks.length} tasks · {canWrite ? 'edit access' : 'view only'}
          </p>
        </div>
        {canWrite ? (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
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
          const tasks = tasksByColumn.get(col.id) || []
          return (
            <section
              key={col.id}
              className="column"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void onDropColumn(col.id, e)}
              aria-label={col.name}
            >
              <div className="column-header">
                <span>{col.name}</span>
                <span className="muted">{tasks.length}</span>
              </div>
              <div className="column-body">
                {tasks.length === 0 ? (
                  <div className="column-empty">
                    {canWrite ? 'Drop a card here or add a task' : 'No tasks'}
                  </div>
                ) : (
                  tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onOpen={openEdit}
                      draggable={canWrite}
                      onDragStart={onDragStart}
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
