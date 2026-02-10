# Python Kanban Board with Supermemory Storage

A Python-based kanban board system with cloud persistence via Supermemory.ai, time tracking, and Telegram integration.

## Features

✅ **Cloud Storage**: Tasks stored in Supermemory (no more data loss!)
✅ **Time Tracking**: Auto-track start/end times, calculate actual hours
✅ **Telegram Integration**: Quick commands for task management
✅ **Static HTML Generation**: Deployable to Cloudflare Pages
✅ **Git-backed**: Version control without exposing secrets

## Architecture

```
tasks.json (local cache)
    ↓
KanbanManager (Python)
    ↓
Supermemory.ai (cloud storage)
    ↓
HTML Generator → Cloudflare Pages
```

## Installation

```bash
cd /root/.openclaw/workspace/python-kanban
pip install requests  # Only dependency
```

## Usage

### Command Line

```bash
# Show board status
./kanban.py status

# Add task
./kanban.py add "Fix login bug" --priority high --tags bug security

# Move task
./kanban.py move 1234567890 progress

# List tasks
./kanban.py list --column progress --priority critical

# Generate HTML
./kanban.py generate

# Migrate to Supermemory (one-time)
./kanban.py migrate
```

### Telegram Bot Simulation

```bash
# Status overview
./kanban.py telegram status

# Show in-progress tasks
./kanban.py telegram progress

# Add task
./kanban.py telegram add "New task title"

# Move task
./kanban.py telegram move TASK-019 done

# Show overdue
./kanban.py telegram overdue
```

### Deployment

```bash
# Generate HTML + deploy to Cloudflare Pages
./deploy.sh
```

## Task Structure

```json
{
  "id": 1770521031234,
  "title": "Task title",
  "description": "Full description...",
  "col": "progress",
  "priority": "high",
  "tags": ["feature", "v2"],
  "created": 1770520938235,
  "order": 0,
  
  // Time tracking (NEW)
  "startTime": "2026-02-10T12:00:00Z",
  "endTime": null,
  "estimatedHours": 4,
  "actualHours": null,
  "dueDate": "2026-02-15"
}
```

## Time Tracking

- **startTime**: Auto-set when task moved to "progress"
- **endTime**: Auto-set when task moved to "done"
- **actualHours**: Auto-calculated from start/end times
- **estimatedHours**: Manual entry (optional)
- **dueDate**: Manual entry for deadline tracking

## Telegram Commands (via OpenClaw)

Integration with OpenClaw message tool:

```python
# In OpenClaw, you can call:
from python_kanban import TelegramKanbanBot, KanbanManager

kanban = KanbanManager()
bot = TelegramKanbanBot(kanban, "https://kanban-board-264.pages.dev")
response = bot.handle_command("status")
# Send response via message tool
```

## Supermemory Storage

Tasks are stored in Supermemory with these tags:
- `project-kanban` - All kanban tasks
- `task` - Generic task tag
- `col-{column}` - Column-specific (col-progress, col-done, etc.)
- `priority-{level}` - Priority-specific
- `task-{id}` - Unique task identifier

Search tasks in Supermemory:
```python
from supermemory_client import SupermemoryClient
sm = SupermemoryClient()
results = sm.search("bug fix", tags=["project-kanban", "priority-high"])
```

## Git Workflow

1. Edit tasks via CLI or Telegram
2. Run `./deploy.sh`:
   - Generates HTML
   - Commits to git (tasks.json + index.html)
   - Pushes to GitHub
   - Triggers Cloudflare deployment
3. Board updates automatically

## Security

✅ API keys loaded from `/root/.openclaw/secrets/keys.env`
✅ Never committed to git
✅ .gitignore enforced
✅ Cloudflare deployment via API token (not exposed)

## Troubleshooting

**"SUPERMEMORY_API_KEY not found"**
- Add key to `/root/.openclaw/secrets/keys.env`
- Format: `SUPERMEMORY_API_KEY=your_key_here`

**"git push failed"**
- Initialize git repo: `git init && git remote add origin <url>`

**"Cloudflare deployment failed"**
- Check `CloudflarePagesDeployment` token in keys.env
- Verify account ID and project name in deploy.sh

## Migration from Old Kanban

The old kanban board (pure HTML/JS) had 107 tasks. Migration process:

1. Extract tasks: `cp /root/.openclaw/workspace/kanban/cards-updated.json tasks.json`
2. Migrate to Supermemory: `./kanban.py migrate`
3. Generate new HTML: `./kanban.py generate`
4. Deploy: `./deploy.sh`

## Live Board

🔗 https://kanban-board-264.pages.dev

Updated automatically on every deployment.
