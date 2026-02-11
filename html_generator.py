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
        # Read the current working index.html as template (not the old kanban folder)
        with open('/root/.openclaw/workspace/python-kanban/index.html.backup', 'r') as f:
            template = f.read()
        
        # Convert tasks to JSON string
        tasks_json = json.dumps(self.tasks, indent=2)
        
        # Replace the cards array in the template
        # Find the line "const cards =" and replace until the closing ]
        import re
        
        # Pattern to match: const cards = [...]; (within the initialization IIFE)
        pattern = r'(// Import cards \(only if no existing data\)\s*\n\s*const cards\s*=\s*)\n\s*\[[\s\S]*?\];'
        
        # Build the replacement with cards array AND localStorage save logic
        save_logic = '''
  
  // Save cards to localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  localStorage.setItem('kanban_initialized', 'true');
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
  console.log(`✅ Imported ${cards.length} cards from embedded data`);
})();'''
        
        # Use a callback function to avoid regex escape issues
        def replace_with_cards(match):
            return match.group(1) + '\n  ' + tasks_json + ';' + save_logic
        
        updated_html = re.sub(pattern, replace_with_cards, template, count=1)
        
        # Write generated HTML
        with open(output_path, 'w') as f:
            f.write(updated_html)
        
        print(f"✅ Generated {output_path} with {len(self.tasks)} tasks")
        
        return output_path
