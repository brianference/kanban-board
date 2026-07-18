"""
Telegram Bot Integration for Kanban Board
Handles /kanban commands for quick task management
"""

from kanban_manager import KanbanManager
from datetime import datetime, timezone

class TelegramKanbanBot:
    def __init__(self, kanban: KanbanManager, board_url: str):
        """Initialize Telegram bot with kanban manager"""
        self.kanban = kanban
        self.board_url = board_url
    
    def handle_command(self, command: str, args: list = None) -> str:
        """
        Handle /kanban commands
        
        Commands:
            /kanban status - Overall board status
            /kanban progress - Show in-progress tasks
            /kanban add "Title" - Add task to backlog
            /kanban move <id> <column> - Move task
            /kanban overdue - Show overdue tasks
        """
        args = args or []
        
        if not command or command == 'status':
            return self.status()
        elif command == 'progress':
            return self.show_progress()
        elif command == 'add' and args:
            return self.add_task(' '.join(args))
        elif command == 'move' and len(args) >= 2:
            return self.move_task(args[0], args[1])
        elif command == 'overdue':
            return self.show_overdue()
        elif command == 'next':
            return self.show_next_up()
        elif command == 'help':
            return self.help_text()
        else:
            return "❓ Unknown command. Use /kanban help for usage."
    
    def status(self) -> str:
        """Get overall board status"""
        status = self.kanban.get_status()
        now = datetime.now(timezone.utc).strftime("%b %d, %I:%M %p")
        
        # Count by column
        counts = status['by_column']
        
        # Build status message
        msg = f"📊 **Kanban Status** - {now}\n\n"
        
        # In Progress
        msg += f"**In Progress** ({counts.get('progress', 0)}):\n"
        for task in status['in_progress'][:5]:  # Show first 5
            hours = self._get_hours_in_progress(task)
            msg += f"• {self._format_task_id(task)}: {task['title'][:50]}"
            if hours:
                msg += f" ({hours})"
            msg += "\n"
        
        if counts.get('progress', 0) > 5:
            msg += f"  _...and {counts['progress'] - 5} more_\n"
        
        msg += "\n"
        
        # Next Up
        msg += f"**Next Up** ({counts.get('next-up', 0)}):\n"
        next_tasks = self.kanban.get_tasks_by_column('next-up')
        for task in next_tasks[:3]:
            msg += f"• {self._format_task_id(task)}: {task['title'][:50]}\n"
        
        if counts.get('next-up', 0) > 3:
            msg += f"  _...and {counts['next-up'] - 3} more_\n"
        
        msg += "\n"
        
        # Summary
        msg += f"**Backlog:** {counts.get('backlog', 0)} tasks\n"
        msg += f"**Done:** {counts.get('done', 0)} tasks\n\n"
        
        # Alerts
        if status['overdue']:
            msg += f"🔴 **Overdue:** {len(status['overdue'])} tasks\n"
        
        if status['due_today']:
            msg += f"⚠️ **Due today:** {len(status['due_today'])} task(s)\n"
        
        msg += f"\n🔗 View board: {self.board_url}"
        
        return msg
    
    def show_progress(self) -> str:
        """Show all in-progress tasks"""
        tasks = self.kanban.get_tasks_by_column('progress')
        
        if not tasks:
            return "✅ No tasks in progress"
        
        msg = f"🚀 **In Progress** ({len(tasks)} tasks):\n\n"
        
        for task in tasks:
            hours = self._get_hours_in_progress(task)
            msg += f"**{self._format_task_id(task)}:** {task['title']}\n"
            if hours:
                msg += f"  ⏱ {hours}\n"
            if task.get('priority') == 'critical':
                msg += "  🔴 Critical\n"
            msg += "\n"
        
        return msg
    
    def show_next_up(self) -> str:
        """Show next-up tasks"""
        tasks = self.kanban.get_tasks_by_column('next-up')
        
        if not tasks:
            return "📭 No tasks in Next Up"
        
        msg = f"📋 **Next Up** ({len(tasks)} tasks):\n\n"
        
        for task in tasks:
            msg += f"**{self._format_task_id(task)}:** {task['title']}\n"
            if task.get('priority') in ['critical', 'high']:
                msg += f"  Priority: {task['priority']}\n"
            msg += "\n"
        
        return msg
    
    def show_overdue(self) -> str:
        """Show overdue tasks"""
        status = self.kanban.get_status()
        overdue = status['overdue']
        
        if not overdue:
            return "✅ No overdue tasks!"
        
        msg = f"🔴 **Overdue Tasks** ({len(overdue)}):\n\n"
        
        for task in overdue:
            msg += f"**{self._format_task_id(task)}:** {task['title']}\n"
            due = datetime.fromisoformat(task['dueDate'].replace('Z', '+00:00'))
            days_overdue = (datetime.now(timezone.utc) - due).days
            msg += f"  Due: {due.strftime('%b %d')} ({days_overdue} days ago)\n"
            msg += f"  Column: {task.get('col', 'unknown')}\n\n"
        
        return msg
    
    def add_task(self, title: str) -> str:
        """Quick add task to backlog"""
        if not title or len(title) < 3:
            return "❌ Task title too short. Provide a meaningful title."
        
        task = self.kanban.add_task(
            title=title,
            column='backlog',
            priority='med'
        )
        
        return f"✅ Added task **{self._format_task_id(task)}**: {title}"
    
    def move_task(self, task_id_str: str, column: str) -> str:
        """Move task to different column"""
        # Extract numeric ID from TASK-XXX format
        if task_id_str.upper().startswith('TASK-'):
            task_id_str = task_id_str[5:]
        
        try:
            task_id = int(task_id_str)
        except ValueError:
            return f"❌ Invalid task ID: {task_id_str}"
        
        # Validate column
        valid_columns = ['backlog', 'next-up', 'progress', 'done']
        if column not in valid_columns:
            return f"❌ Invalid column. Use one of: {', '.join(valid_columns)}"
        
        task = self.kanban.move_task(task_id, column)
        if not task:
            return f"❌ Task {task_id} not found"
        
        return f"✅ Moved **{task['title'][:40]}** to **{column}**"
    
    def help_text(self) -> str:
        """Show help text"""
        return """
📚 **Kanban Bot Commands**

**/kanban status** - Overview of board
**/kanban progress** - Show in-progress tasks
**/kanban next** - Show next-up tasks
**/kanban overdue** - Show overdue tasks
**/kanban add "Title"** - Add task to backlog
**/kanban move TASK-019 progress** - Move task to column

**Columns:** backlog, next-up, progress, done

**Example:**
```
/kanban add "Fix login bug"
/kanban move 1234 progress
```
        """.strip()
    
    def _format_task_id(self, task: dict) -> str:
        """Format task ID for display (TASK-XXX)"""
        # Use last 3 digits of ID
        short_id = str(task['id'])[-3:]
        return f"TASK-{short_id}"
    
    def _get_hours_in_progress(self, task: dict) -> str:
        """Get hours since task started"""
        if not task.get('startTime'):
            return None
        
        start = datetime.fromisoformat(task['startTime'].replace('Z', '+00:00'))
        hours = (datetime.now(timezone.utc) - start).total_seconds() / 3600
        
        if hours < 1:
            return "started <1h ago"
        elif hours < 24:
            return f"started {round(hours)}h ago"
        else:
            days = round(hours / 24)
            return f"started {days}d ago"
