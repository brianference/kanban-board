#!/usr/bin/env python3
"""
OpenClaw Integration for Python Kanban
Call this from OpenClaw message tool to handle Telegram commands
"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from kanban_manager import KanbanManager
from telegram_bot import TelegramKanbanBot

BOARD_URL = "https://kanban-board-264.pages.dev"

def handle_kanban_command(command_text: str) -> str:
    """
    Handle /kanban command from Telegram via OpenClaw
    
    Args:
        command_text: Full command text (e.g., "/kanban status" or "status")
    
    Returns:
        Response text to send back to Telegram
    """
    # Strip /kanban prefix if present
    if command_text.startswith('/kanban'):
        command_text = command_text[7:].strip()
    
    # Parse command and args
    parts = command_text.split()
    command = parts[0] if parts else 'status'
    args = parts[1:] if len(parts) > 1 else []
    
    # Initialize manager and bot
    kanban = KanbanManager()
    bot = TelegramKanbanBot(kanban, BOARD_URL)
    
    # Handle command
    response = bot.handle_command(command, args)
    
    return response

if __name__ == '__main__':
    # Test usage
    if len(sys.argv) > 1:
        command = ' '.join(sys.argv[1:])
        print(handle_kanban_command(command))
    else:
        print("Usage: ./openclaw_integration.py [command]")
        print("Example: ./openclaw_integration.py status")
        print("Example: ./openclaw_integration.py add 'New task title'")
