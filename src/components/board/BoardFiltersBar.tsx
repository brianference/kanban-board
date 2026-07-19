import type { BoardFilters, DueFilter, ProjectMember, SavedView, SwimlaneMode } from '../../types/models'
import { defaultFilters } from '../../types/models'

/**
 * Filter + swimlane + saved views toolbar for the board.
 */
export function BoardFiltersBar({
  filters,
  onChange,
  members,
  tags,
  swimlane,
  onSwimlane,
  views,
  onSaveView,
  onApplyView,
  onDeleteView,
  filteredCount,
  totalCount,
}: {
  filters: BoardFilters
  onChange: (f: BoardFilters) => void
  members: ProjectMember[]
  tags: string[]
  swimlane: SwimlaneMode
  onSwimlane: (m: SwimlaneMode) => void
  views: SavedView[]
  onSaveView: () => void
  onApplyView: (v: SavedView) => void
  onDeleteView: (id: string) => void
  filteredCount: number
  totalCount: number
}) {
  function set<K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="filters-panel">
      <div className="filters-row">
        <input
          type="search"
          className="filter-input"
          placeholder="Search title, description, tags…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          aria-label="Search tasks"
        />
        <select
          className="filter-select"
          value={filters.assigneeId}
          onChange={(e) => set('assigneeId', e.target.value)}
          aria-label="Filter by assignee"
        >
          <option value="">All assignees</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name || m.email}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.priority}
          onChange={(e) => set('priority', e.target.value)}
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          className="filter-select"
          value={filters.tag}
          onChange={(e) => set('tag', e.target.value)}
          aria-label="Filter by tag"
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.due}
          onChange={(e) => set('due', e.target.value as DueFilter)}
          aria-label="Filter by due date"
        >
          <option value="all">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due this week</option>
          <option value="has-due">Has due date</option>
          <option value="none">No due date</option>
        </select>
        <select
          className="filter-select"
          value={swimlane}
          onChange={(e) => onSwimlane(e.target.value as SwimlaneMode)}
          aria-label="Swimlanes"
        >
          <option value="none">No swimlanes</option>
          <option value="assignee">Swimlanes: assignee</option>
          <option value="priority">Swimlanes: priority</option>
          <option value="tag">Swimlanes: first tag</option>
        </select>
      </div>
      <div className="filters-row filters-row--checks">
        <label className="filter-check">
          <input
            type="checkbox"
            checked={filters.unassignedOnly}
            onChange={(e) => set('unassignedOnly', e.target.checked)}
          />
          Unassigned
        </label>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={filters.hasAttachments}
            onChange={(e) => set('hasAttachments', e.target.checked)}
          />
          Has images
        </label>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={filters.hasOpenChecklist}
            onChange={(e) => set('hasOpenChecklist', e.target.checked)}
          />
          Open checklist
        </label>
        <span className="muted filter-count">
          Showing {filteredCount} / {totalCount}
        </span>
        <button type="button" className="btn btn-sm" onClick={() => onChange(defaultFilters())}>
          Clear filters
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={onSaveView}>
          Save view
        </button>
      </div>
      {views.length > 0 ? (
        <div className="saved-views">
          <span className="muted">Saved views:</span>
          {views.map((v) => (
            <span key={v.id} className="saved-view-chip">
              <button type="button" className="btn btn-sm" onClick={() => onApplyView(v)}>
                {v.name}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-label={`Delete view ${v.name}`}
                onClick={() => onDeleteView(v.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
