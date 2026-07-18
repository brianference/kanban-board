/** Starter board templates for new projects. */

export type TemplateId = 'blank' | 'personal' | 'side-project' | 'bugs'

export interface TemplateColumn {
  key: string
  name: string
  position: number
}

export interface TemplateTask {
  title: string
  description: string
  columnKey: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  tags: string[]
}

export interface BoardTemplate {
  id: TemplateId
  boardName: string
  kind: 'kanban' | 'bugs'
  columns: TemplateColumn[]
  tasks: TemplateTask[]
}

const KANBAN_COLUMNS: TemplateColumn[] = [
  { key: 'backlog', name: 'Backlog', position: 0 },
  { key: 'next-up', name: 'Next Up', position: 1 },
  { key: 'progress', name: 'In Progress', position: 2 },
  { key: 'blocked', name: 'Blocked', position: 3 },
  { key: 'done', name: 'Done', position: 4 },
]

const BUG_COLUMNS: TemplateColumn[] = [
  { key: 'bug-backlog', name: 'Bug Backlog', position: 0 },
  { key: 'bug-fixing', name: 'Fixing', position: 1 },
  { key: 'bug-testing', name: 'Testing', position: 2 },
  { key: 'bug-fixed', name: 'Fixed', position: 3 },
]

export const TEMPLATES: Record<TemplateId, BoardTemplate> = {
  blank: {
    id: 'blank',
    boardName: 'Main board',
    kind: 'kanban',
    columns: KANBAN_COLUMNS,
    tasks: [
      {
        title: 'Create your first task',
        description: 'This card is yours. Edit or delete it anytime.',
        columnKey: 'backlog',
        priority: 'medium',
        tags: ['welcome'],
      },
    ],
  },
  personal: {
    id: 'personal',
    boardName: 'Weekly plan',
    kind: 'kanban',
    columns: KANBAN_COLUMNS,
    tasks: [
      {
        title: 'Plan this week',
        description: 'List top 3 priorities.',
        columnKey: 'next-up',
        priority: 'high',
        tags: ['planning'],
      },
      {
        title: 'Deep work block',
        description: '90 minutes without meetings.',
        columnKey: 'progress',
        priority: 'medium',
        tags: ['focus'],
      },
      {
        title: 'Inbox zero',
        description: 'Clear email and messages.',
        columnKey: 'backlog',
        priority: 'low',
        tags: ['admin'],
      },
    ],
  },
  'side-project': {
    id: 'side-project',
    boardName: 'Build board',
    kind: 'kanban',
    columns: KANBAN_COLUMNS,
    tasks: [
      {
        title: 'Define MVP',
        description: 'What ships in v1?',
        columnKey: 'next-up',
        priority: 'critical',
        tags: ['product'],
      },
      {
        title: 'Landing page',
        description: 'Hero + CTA + pricing placeholder.',
        columnKey: 'backlog',
        priority: 'high',
        tags: ['design'],
      },
      {
        title: 'Talk to one user',
        description: 'Validate the problem.',
        columnKey: 'backlog',
        priority: 'high',
        tags: ['research'],
      },
    ],
  },
  bugs: {
    id: 'bugs',
    boardName: 'Bug triage',
    kind: 'bugs',
    columns: BUG_COLUMNS,
    tasks: [
      {
        title: 'Sample: button not clickable on mobile',
        description: 'Reproduce on iOS Safari.',
        columnKey: 'bug-backlog',
        priority: 'high',
        tags: ['mobile'],
      },
      {
        title: 'Sample: empty state missing icon',
        description: 'Visual QA item.',
        columnKey: 'bug-fixing',
        priority: 'low',
        tags: ['ui'],
      },
    ],
  },
}

/**
 * Normalize template id from client input.
 */
export function resolveTemplate(id: string | undefined): BoardTemplate {
  if (id && id in TEMPLATES) return TEMPLATES[id as TemplateId]
  return TEMPLATES.blank
}
