/** Default board templates for new projects. */

export const TEMPLATES = {
  blank: {
    boardName: 'Main board',
    columns: [
      { key: 'backlog', name: 'Backlog', position: 0 },
      { key: 'next-up', name: 'Next Up', position: 1 },
      { key: 'progress', name: 'In Progress', position: 2 },
      { key: 'blocked', name: 'Blocked', position: 3 },
      { key: 'done', name: 'Done', position: 4 },
    ],
    tasks: [
      {
        title: 'Create your first task',
        description: 'This card is yours. Edit or delete anytime.',
        columnKey: 'backlog',
        priority: 'medium',
        tags: ['welcome'],
      },
    ],
  },
  personal: {
    boardName: 'Weekly plan',
    columns: [
      { key: 'backlog', name: 'Backlog', position: 0 },
      { key: 'next-up', name: 'Next Up', position: 1 },
      { key: 'progress', name: 'In Progress', position: 2 },
      { key: 'blocked', name: 'Blocked', position: 3 },
      { key: 'done', name: 'Done', position: 4 },
    ],
    tasks: [
      {
        title: 'Plan this week',
        description: 'List your top 3 priorities.',
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
    boardName: 'Build board',
    columns: [
      { key: 'backlog', name: 'Backlog', position: 0 },
      { key: 'next-up', name: 'Next Up', position: 1 },
      { key: 'progress', name: 'In Progress', position: 2 },
      { key: 'blocked', name: 'Blocked', position: 3 },
      { key: 'done', name: 'Done', position: 4 },
    ],
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
        description: 'Hero, CTA, and clear value prop.',
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
}

export function resolveTemplate(id) {
  return TEMPLATES[id] || TEMPLATES.blank
}
