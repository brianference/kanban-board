# Python Kanban - Quick Start Guide

## For Brian: What Changed

### Before (Old Kanban)
- ❌ Tasks stored in HTML file (fragile, data loss)
- ❌ Manual editing required
- ❌ No cloud backup
- ❌ Lost all 107 tasks showing only 3

### After (Python Kanban)
- ✅ Tasks stored in Supermemory (cloud, permanent)
- ✅ Python CLI + Telegram commands
- ✅ Time tracking (auto start/end times)
- ✅ All 107 tasks preserved
- ✅ Git version control

## Using via Telegram (Recommended)

Just message Cole (OpenClaw) in Telegram:

```
/kanban status
```

**Available commands:**

| Command | Description | Example |
|---------|-------------|---------|
| `/kanban status` | Overall board status | Shows counts, in-progress, overdue |
| `/kanban progress` | Show in-progress tasks | Lists all tasks you're working on |
| `/kanban next` | Show next-up tasks | What's queued to work on next |
| `/kanban overdue` | Show overdue tasks | Tasks past their due date |
| `/kanban add "Title"` | Quick add task | `/kanban add "Fix login bug"` |
| `/kanban move TASK-019 done` | Move task to column | `/kanban move TASK-019 progress` |
| `/kanban help` | Show help text | Lists all commands |

**Columns:**
- `backlog` - Not started, low priority
- `next-up` - Queued to work on soon
- `progress` - Currently working on
- `done` - Completed

## Using via CLI (Advanced)

SSH into server:

```bash
cd /root/.openclaw/workspace/python-kanban

# Show status
./kanban.py status

# Add task
./kanban.py add "Fix bug" --priority high --tags bug security

# Move task
./kanban.py move 1234567890 progress

# List tasks
./kanban.py list --column progress

# Generate HTML and deploy
./deploy.sh
```

## Time Tracking (Automatic)

When you move a task:
- **To "progress"** → `startTime` is recorded
- **To "done"** → `endTime` is recorded, `actualHours` calculated

Example:
```
Task started: 2026-02-10T12:00:00Z
Task finished: 2026-02-10T15:30:00Z
Actual hours: 3.5h
```

This data shows in Telegram:
```
**TASK-019:** Fix login screen
  ⏱ started 3.5h ago
```

## Deployment Flow

1. You tell Cole: "Move TASK-019 to done"
2. Cole runs: `./kanban.py move 1234567890 done`
3. Task updated in Supermemory (cloud backup)
4. Cole runs: `./deploy.sh`
   - Generates fresh HTML
   - Commits to GitHub
   - Triggers Cloudflare Pages deployment
5. Board updates at: https://kanban-board-264.pages.dev

**No manual work required!**

## What Got Migrated

All 107 tasks from the old board:
- ✅ 78 backlog tasks
- ✅ 2 next-up tasks
- ✅ 12 in-progress tasks
- ✅ 1 done task
- ✅ All metadata (priority, tags, descriptions, story numbers)

Plus **new fields added:**
- `startTime` - When moved to progress
- `endTime` - When moved to done
- `actualHours` - Calculated duration
- `estimatedHours` - Can be set manually
- `dueDate` - Can be set for deadline tracking

## Architecture Overview

```
You (Telegram) → Cole (OpenClaw) → Python Kanban
                                       ↓
                                  Supermemory.ai (cloud storage)
                                       ↓
                                  tasks.json (local cache)
                                       ↓
                                  index.html (generated)
                                       ↓
                                  Cloudflare Pages (deployed)
```

## Troubleshooting

**"Board not updating"**
- Check deployment: `cd /root/.openclaw/workspace/python-kanban && ./deploy.sh`
- Cloudflare may take 30-60 seconds to deploy

**"Task not showing in Telegram"**
- Ask Cole: "/kanban status"
- Cole will load latest from Supermemory

**"Need to add lots of tasks"**
- Ask Cole to add them (he can batch-add)
- Or SSH and use CLI: `./kanban.py add "Title" --priority high`

**"Want to edit a task"**
- Tell Cole: "Update TASK-019 title to 'New title'"
- Cole will handle the update

## Files & Locations

- **Repo:** https://github.com/brianference/python-kanban
- **Board:** https://kanban-board-264.pages.dev
- **Local:** /root/.openclaw/workspace/python-kanban
- **Secrets:** /root/.openclaw/secrets/keys.env (SUPERMEMORY_API_KEY)

## Next Steps (Optional Enhancements)

1. **Due date tracking** - Set deadlines on tasks
2. **Estimated hours** - Plan work capacity
3. **Daily summary cron** - Cole reports overdue tasks every morning
4. **Webhook integration** - Auto-deploy on every task change
5. **Search by tags** - Filter tasks by project/type
6. **Burndown charts** - Track completion velocity

Want any of these? Just ask Cole!
