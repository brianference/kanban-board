import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { BoardPayload, ProjectMember, ProjectSummary } from '../types/models'
import { TopBar } from '../components/layout/TopBar'
import { BottomNav } from '../components/layout/BottomNav'
import { BoardView } from '../components/board/BoardView'
import { LoadingBlock } from '../components/ui/LoadingBlock'
import { useToast } from '../hooks/useToast'

/**
 * Project detail: switcher, board, invite.
 */
export function ProjectBoardPage() {
  const { projectId = '' } = useParams()
  const { push } = useToast()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [board, setBoard] = useState<BoardPayload | null>(null)
  const [role, setRole] = useState<string>('viewer')
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setError(null)
    try {
      const [list, detail] = await Promise.all([api.listProjects(), api.getProject(projectId)])
      setProjects(list.projects)
      setMembers(detail.members)
      setRole(detail.role)
      const firstBoard = detail.boards[0]
      if (!firstBoard) {
        setBoard(null)
        setError('Project has no board')
        return
      }
      const boardData = await api.getBoard(firstBoard.id)
      setBoard(boardData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  async function createInvite(e: FormEvent) {
    e.preventDefault()
    try {
      const res = await api.createInvite({
        projectId,
        email: inviteEmail,
        role: 'member',
      })
      const url = `${window.location.origin}${res.sharePath}`
      setShareLink(url)
      push('Invite created — share the link', 'success')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Invite failed', 'error')
    }
  }

  const canWrite = role === 'owner' || role === 'member'

  return (
    <div className="app-shell">
      <TopBar title="Board" />
      <div style={{ padding: '10px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="muted" htmlFor="switcher" style={{ fontSize: '0.85rem' }}>
          Project
        </label>
        <select
          id="switcher"
          className="project-switcher"
          value={projectId}
          onChange={(e) => {
            window.location.href = `/app/projects/${e.target.value}`
          }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Link className="btn btn-ghost" to="/app/new">
          ＋
        </Link>
        {canWrite ? (
          <button type="button" className="btn" onClick={() => setShowInvite((v) => !v)}>
            Invite
          </button>
        ) : null}
      </div>

      {showInvite ? (
        <form
          className="card-panel stack"
          style={{ margin: '0 12px 12px', maxWidth: 480 }}
          onSubmit={(e) => void createInvite(e)}
        >
          <strong>Invite collaborator</strong>
          <div className="field">
            <label htmlFor="invite-email">Their email (must match their account)</label>
            <input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Create share link
          </button>
          {shareLink ? (
            <p className="muted" style={{ wordBreak: 'break-all' }}>
              Share: {shareLink}
            </p>
          ) : null}
        </form>
      ) : null}

      {error ? (
        <p className="error-text" style={{ padding: 16 }}>
          {error}
        </p>
      ) : null}
      {!board && !error ? (
        <div className="page">
          <LoadingBlock rows={4} />
        </div>
      ) : null}
      {board ? (
        <BoardView
          data={board}
          members={members}
          canWrite={canWrite}
          projectId={projectId}
          onReload={load}
        />
      ) : null}
      <BottomNav projectId={projectId} />
    </div>
  )
}
