"""
Static HTML Generator for Kanban Board
Generates deployable HTML from tasks.json
"""

import json
from datetime import datetime

class HTMLGenerator:
    def __init__(self, tasks: list, template_path='template.html'):
        """Initialize HTML generator with tasks"""
        self.tasks = tasks
        self.template_path = template_path
    
    def generate(self, output_path='index.html'):
        """Generate static HTML file"""
        # Read the original kanban HTML as template
        with open('/root/.openclaw/workspace/kanban/index.html', 'r') as f:
            template = f.read()
        
        # Convert tasks to JSON string
        tasks_json = json.dumps(self.tasks, indent=2)
        
        # Replace the cards array in the template
        # Find the line "const cards =" and replace until the closing ]
        import re
        
        # Pattern to match: const cards = [...];
        pattern = r'const cards\s*=\s*\n\s*\[[\s\S]*?\];'
        
        # Use a function to avoid regex escape issues
        def replace_cards(match):
            return f'const cards = \n  {tasks_json};'
        
        updated_html = re.sub(pattern, replace_cards, template)
        
        # Write generated HTML
        with open(output_path, 'w') as f:
            f.write(updated_html)
        
        print(f"✅ Generated {output_path} with {len(self.tasks)} tasks")
        
        return output_path
