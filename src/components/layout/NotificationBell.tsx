import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { NotificationItem } from '../../types/models'

/**
 * In-app notification bell for the top bar.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const data = await api.listNotifications()
      setItems(data.notifications)
      setUnread(data.unread)
    } catch {
      /* not signed in or migration pending */
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(id)
  }, [refresh])

  async function markAll() {
    await api.markNotificationsRead({ all: true })
    await refresh()
  }

  async function openItem(n: NotificationItem) {
    if (!n.readAt) await api.markNotificationsRead({ id: n.id })
    setOpen(false)
    await refresh()
  }

  return (
    <div className="notif-wrap">
      <button
        type="button"
        className="btn btn-icon"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        onClick={() => {
          setOpen((v) => !v)
          void refresh()
        }}
      >
        🔔
        {unread > 0 ? <span className="notif-badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-head">
            <strong>Notifications</strong>
            <button type="button" className="btn btn-sm" onClick={() => void markAll()}>
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="muted" style={{ padding: 12, margin: 0 }}>
              No notifications yet
            </p>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id} className={n.readAt ? '' : 'notif-unread'}>
                  {n.link ? (
                    <Link to={n.link} onClick={() => void openItem(n)}>
                      <strong>{n.title}</strong>
                      <span className="muted">{n.body}</span>
                    </Link>
                  ) : (
                    <button type="button" className="notif-plain" onClick={() => void openItem(n)}>
                      <strong>{n.title}</strong>
                      <span className="muted">{n.body}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
