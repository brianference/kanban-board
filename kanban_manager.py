"""
Kanban Task Manager with Supermemory Storage
Handles CRUD operations, time tracking, and persistence
"""

import json
import os
from datetime import datetime, timezone
from typing import List, Dict, Optional
from supermemory_client import SupermemoryClient

class KanbanManager:
    def __init__(self, local_file='tasks.json'):
        """Initialize kanban manager with Supermemory backend"""
        self.local_file = local_file
        self.sm = SupermemoryClient()
        self.tasks = []
        self.load_tasks()
    
    def load_tasks(self):
        """Load tasks from local JSON file"""
        if os.path.exists(self.local_file):
            with open(self.local_file, 'r') as f:
                self.tasks = json.load(f)
                print(f"✅ Loaded {len(self.tasks)} tasks from {self.local_file}")
        else:
            self.tasks = []
            print(f"⚠️  No local tasks file found at {self.local_file}")
    
    def save_tasks(self):
        """Save tasks to local JSON file"""
        with open(self.local_file, 'w') as f:
            json.dump(self.tasks, f, indent=2)
        print(f"💾 Saved {len(self.tasks)} tasks to {self.local_file}")
    
    def get_task_by_id(self, task_id: int) -> Optional[Dict]:
        """Find task by ID"""
        for task in self.tasks:
            if task.get('id') == task_id:
                return task
        return None
    
    def get_tasks_by_column(self, column: str) -> List[Dict]:
        """Get all tasks in a specific column"""
        return [t for t in self.tasks if t.get('col') == column]
    
    def add_task(self, title: str, description: str = "", column: str = "backlog", 
                 priority: str = "med", tags: List[str] = None) -> Dict:
        """
        Add a new task
        
        Args:
            title: Task title
            description: Task description
            column: Column to place task (backlog, next-up, progress, done)
            priority: critical, high, med, low
            tags: List of tags
        
        Returns:
            Created task
        """
        # Generate unique ID (timestamp-based)
        task_id = int(datetime.now().timestamp() * 1000)
        
        # Create task object
        task = {
            'id': task_id,
            'title': title,
            'description': description,
            'col': column,
            'priority': priority,
            'tags': tags or [],
            'created': task_id,
            'order': len([t for t in self.tasks if t.get('col') == column]),
            
            # Time tracking fields
            'startTime': None,  # Set when moved to 'progress'
            'endTime': None,    # Set when moved to 'done'
            'estimatedHours': None,
            'actualHours': None,
            'dueDate': None
        }
        
        # Add to local list
        self.tasks.append(task)
        self.save_tasks()
        
        # Store in Supermemory
        self.sync_task_to_supermemory(task)
        
        return task
    
    def update_task(self, task_id: int, **updates) -> Optional[Dict]:
        """
        Update a task
        
        Args:
            task_id: Task ID
            **updates: Fields to update (title, description, col, priority, etc.)
        
        Returns:
            Updated task or None if not found
        """
        task = self.get_task_by_id(task_id)
        if not task:
            return None
        
        old_col = task.get('col')
        
        # Apply updates
        for key, value in updates.items():
            task[key] = value
        
        # Time tracking: set startTime when moved to 'progress'
        new_col = task.get('col')
        if old_col != 'progress' and new_col == 'progress':
            task['startTime'] = datetime.now(timezone.utc).isoformat()
        
        # Time tracking: set endTime and calculate actualHours when moved to 'done'
        if old_col != 'done' and new_col == 'done':
            task['endTime'] = datetime.now(timezone.utc).isoformat()
            if task.get('startTime'):
                start = datetime.fromisoformat(task['startTime'].replace('Z', '+00:00'))
                end = datetime.fromisoformat(task['endTime'].replace('Z', '+00:00'))
                hours = (end - start).total_seconds() / 3600
                task['actualHours'] = round(hours, 2)
        
        self.save_tasks()
        self.sync_task_to_supermemory(task)
        
        return task
    
    def move_task(self, task_id: int, new_column: str) -> Optional[Dict]:
        """Move task to a different column"""
        return self.update_task(task_id, col=new_column)
    
    def delete_task(self, task_id: int) -> bool:
        """Delete a task"""
        task = self.get_task_by_id(task_id)
        if not task:
            return False
        
        self.tasks = [t for t in self.tasks if t.get('id') != task_id]
        self.save_tasks()
        
        return True
    
    def get_status(self) -> Dict:
        """Get kanban board status summary"""
        columns = {
            'backlog': self.get_tasks_by_column('backlog'),
            'next-up': self.get_tasks_by_column('next-up'),
            'progress': self.get_tasks_by_column('progress'),
            'done': self.get_tasks_by_column('done')
        }
        
        # Find overdue tasks
        now = datetime.now(timezone.utc)
        overdue = []
        due_today = []
        
        for task in self.tasks:
            if task.get('dueDate'):
                due = datetime.fromisoformat(task['dueDate'].replace('Z', '+00:00'))
                if due < now and task.get('col') != 'done':
                    overdue.append(task)
                elif due.date() == now.date():
                    due_today.append(task)
        
        return {
            'total': len(self.tasks),
            'by_column': {col: len(tasks) for col, tasks in columns.items()},
            'in_progress': columns['progress'],
            'overdue': overdue,
            'due_today': due_today,
            'timestamp': now.isoformat()
        }
    
    def sync_task_to_supermemory(self, task: Dict):
        """Store task in Supermemory for cloud backup"""
        try:
            # Create searchable content
            content = f"""
Task: {task['title']}
ID: {task['id']}
Column: {task.get('col', 'backlog')}
Priority: {task.get('priority', 'med')}
Description: {task.get('description', '')}
Status: {self._get_task_status(task)}
            """.strip()
            
            # Generate tags
            tags = [
                'project-kanban',
                'task',
                f"col-{task.get('col', 'backlog')}",
                f"priority-{task.get('priority', 'med')}",
                f"task-{task['id']}"
            ]
            
            # Add custom tags from task
            if task.get('tags'):
                tags.extend(task['tags'])
            
            # Store in Supermemory
            self.sm.store(content=content, tags=tags)
            
        except Exception as e:
            print(f"⚠️  Failed to sync task {task['id']} to Supermemory: {e}")
    
    def _get_task_status(self, task: Dict) -> str:
        """Get human-readable task status"""
        col = task.get('col')
        if col == 'done':
            if task.get('actualHours'):
                return f"Completed in {task['actualHours']}h"
            return "Completed"
        elif col == 'progress':
            if task.get('startTime'):
                start = datetime.fromisoformat(task['startTime'].replace('Z', '+00:00'))
                hours = (datetime.now(timezone.utc) - start).total_seconds() / 3600
                return f"In progress ({round(hours, 1)}h)"
            return "In progress"
        elif col == 'next-up':
            return "Next up"
        else:
            return "Backlog"
    
    def migrate_to_supermemory(self):
        """Bulk migrate all existing tasks to Supermemory"""
        print(f"🔄 Migrating {len(self.tasks)} tasks to Supermemory...")
        
        for i, task in enumerate(self.tasks, 1):
            try:
                self.sync_task_to_supermemory(task)
                print(f"  [{i}/{len(self.tasks)}] Synced task {task['id']}")
            except Exception as e:
                print(f"  ❌ Failed to sync task {task['id']}: {e}")
        
        print("✅ Migration complete!")
