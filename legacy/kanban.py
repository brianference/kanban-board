#!/usr/bin/env python3
"""
Kanban Board CLI
Main entry point for kanban management
"""

import sys
import argparse
from kanban_manager import KanbanManager
from telegram_bot import TelegramKanbanBot
from html_generator import HTMLGenerator

BOARD_URL = "https://kanban-board-264.pages.dev"

def main():
    parser = argparse.ArgumentParser(description='Kanban Board Manager')
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Status command
    subparsers.add_parser('status', help='Show board status')
    
    # Add command
    add_parser = subparsers.add_parser('add', help='Add new task')
    add_parser.add_argument('title', help='Task title')
    add_parser.add_argument('--description', '-d', default='', help='Task description')
    add_parser.add_argument('--column', '-c', default='backlog', 
                            choices=['backlog', 'next-up', 'progress', 'done'])
    add_parser.add_argument('--priority', '-p', default='med',
                            choices=['critical', 'high', 'med', 'low'])
    add_parser.add_argument('--tags', '-t', nargs='*', help='Tags')
    
    # Move command
    move_parser = subparsers.add_parser('move', help='Move task to different column')
    move_parser.add_argument('task_id', type=int, help='Task ID')
    move_parser.add_argument('column', choices=['backlog', 'next-up', 'progress', 'done'])
    
    # List command
    list_parser = subparsers.add_parser('list', help='List tasks')
    list_parser.add_argument('--column', '-c', help='Filter by column')
    list_parser.add_argument('--priority', '-p', help='Filter by priority')
    
    # Generate HTML
    subparsers.add_parser('generate', help='Generate static HTML')
    
    # Migrate to Supermemory
    subparsers.add_parser('migrate', help='Migrate all tasks to Supermemory')
    
    # Telegram bot simulation
    telegram_parser = subparsers.add_parser('telegram', help='Simulate Telegram command')
    telegram_parser.add_argument('args', nargs='*', help='Telegram command args')
    
    args = parser.parse_args()
    
    # Initialize kanban manager
    kanban = KanbanManager()
    
    if args.command == 'status':
        show_status(kanban)
    
    elif args.command == 'add':
        task = kanban.add_task(
            title=args.title,
            description=args.description,
            column=args.column,
            priority=args.priority,
            tags=args.tags
        )
        print(f"✅ Added task {task['id']}: {task['title']}")
    
    elif args.command == 'move':
        task = kanban.move_task(args.task_id, args.column)
        if task:
            print(f"✅ Moved task {task['id']} to {args.column}")
        else:
            print(f"❌ Task {args.task_id} not found")
    
    elif args.command == 'list':
        list_tasks(kanban, column=args.column, priority=args.priority)
    
    elif args.command == 'generate':
        generator = HTMLGenerator(kanban.tasks)
        output = generator.generate()
        print(f"📄 Generated: {output}")
    
    elif args.command == 'migrate':
        kanban.migrate_to_supermemory()
    
    elif args.command == 'telegram':
        bot = TelegramKanbanBot(kanban, BOARD_URL)
        if args.args:
            cmd = args.args[0]
            cmd_args = args.args[1:] if len(args.args) > 1 else []
            response = bot.handle_command(cmd, cmd_args)
        else:
            response = bot.handle_command('status')
        print(response)
    
    else:
        parser.print_help()

def show_status(kanban):
    """Display board status"""
    status = kanban.get_status()
    
    print(f"\n📊 Kanban Board Status")
    print(f"{'='*50}")
    print(f"Total tasks: {status['total']}")
    print(f"\nBy column:")
    for col, count in status['by_column'].items():
        print(f"  {col:12} {count:3} tasks")
    
    if status['in_progress']:
        print(f"\n🚀 In Progress:")
        for task in status['in_progress'][:5]:
            print(f"  • {task['title'][:60]}")
    
    if status['overdue']:
        print(f"\n🔴 Overdue ({len(status['overdue'])}):")
        for task in status['overdue'][:3]:
            print(f"  • {task['title'][:60]}")
    
    print()

def list_tasks(kanban, column=None, priority=None):
    """List tasks with optional filters"""
    tasks = kanban.tasks
    
    if column:
        tasks = [t for t in tasks if t.get('col') == column]
    
    if priority:
        tasks = [t for t in tasks if t.get('priority') == priority]
    
    print(f"\n📋 Tasks ({len(tasks)}):")
    print(f"{'='*80}")
    
    for task in tasks:
        print(f"\n{task['id']} | {task.get('col', 'unknown'):10} | {task.get('priority', 'med'):8}")
        print(f"  {task['title']}")
        if task.get('description'):
            desc = task['description'][:100]
            print(f"  {desc}...")

if __name__ == '__main__':
    main()
