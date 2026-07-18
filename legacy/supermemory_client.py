"""
Supermemory.ai Client for Python
Cloud-based semantic memory storage for AI agents
"""

import requests
import json
import os
from datetime import datetime
from typing import List, Dict, Optional

class SupermemoryClient:
    def __init__(self, api_key: Optional[str] = None):
        """Initialize Supermemory client with API key from env or keys.env"""
        self.base_url = "https://api.supermemory.ai/v3"
        self.api_key = api_key or self._load_api_key()
        
        if not self.api_key:
            raise ValueError("SUPERMEMORY_API_KEY not found. Set environment variable or add to /root/.openclaw/secrets/keys.env")
    
    def _load_api_key(self) -> Optional[str]:
        """Load API key from environment or keys.env file"""
        # Try environment first
        key = os.getenv('SUPERMEMORY_API_KEY')
        if key:
            return key
        
        # Try keys.env file
        keys_file = '/root/.openclaw/secrets/keys.env'
        if os.path.exists(keys_file):
            with open(keys_file, 'r') as f:
                for line in f:
                    if line.startswith('SUPERMEMORY_API_KEY='):
                        return line.split('=', 1)[1].strip()
        
        return None
    
    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """Make authenticated API request"""
        url = f"{self.base_url}{endpoint}"
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.request(method, url, headers=headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Supermemory API error: {e}")
    
    def store(self, content: str, tags: List[str] = None, space: str = 'default') -> Dict:
        """
        Store a new memory
        
        Args:
            content: Memory text content
            tags: List of tags for categorization
            space: Space/namespace (default: 'default')
        
        Returns:
            Created memory with ID
        """
        if not content or not content.strip():
            raise ValueError("Memory content cannot be empty")
        
        payload = {
            'content': content.strip()
        }
        
        # Add metadata if provided
        metadata = {}
        if tags:
            metadata['tags'] = tags
        if space and space != 'default':
            metadata['space'] = space
        
        if metadata:
            payload['metadata'] = metadata
        
        return self._request('POST', '/documents', payload)
    
    def search(self, query: str, limit: int = 10, space: str = 'default', tags: List[str] = None) -> List[Dict]:
        """
        Search memories by semantic similarity
        
        Args:
            query: Search query
            limit: Max results (default: 10)
            space: Search in specific space
            tags: Filter by tags
        
        Returns:
            List of matching memories with scores
        """
        params = f"?q={requests.utils.quote(query)}&limit={limit}"
        
        if space and space != 'default':
            params += f"&space={space}"
        
        if tags:
            params += f"&tags={','.join(tags)}"
        
        try:
            result = self._request('GET', f'/documents/search{params}')
            return result.get('results', result.get('documents', []))
        except Exception as e:
            # Fallback: try POST method
            result = self._request('POST', '/documents/search', {
                'query': query,
                'limit': limit,
                'space': space,
                'tags': tags
            })
            return result.get('results', result.get('documents', []))
    
    def get_all(self, space: str = 'default', tag: str = None, limit: int = 100) -> List[Dict]:
        """
        Get all memories with optional filters
        
        Args:
            space: Filter by space
            tag: Filter by single tag
            limit: Max results
        
        Returns:
            List of memories
        """
        params = f"?limit={limit}"
        
        if space and space != 'default':
            params += f"&space={space}"
        
        if tag:
            params += f"&tag={tag}"
        
        result = self._request('GET', f'/documents{params}')
        return result.get('documents', result.get('memories', []))
    
    def get(self, memory_id: str) -> Dict:
        """Get a specific memory by ID"""
        return self._request('GET', f'/documents/{memory_id}')
    
    def update(self, memory_id: str, content: str = None, tags: List[str] = None) -> Dict:
        """
        Update an existing memory
        
        Args:
            memory_id: Memory ID
            content: New content (optional)
            tags: New tags (optional)
        
        Returns:
            Updated memory
        """
        updates = {}
        if content:
            updates['content'] = content
        if tags:
            updates['metadata'] = {'tags': tags}
        
        return self._request('PATCH', f'/documents/{memory_id}', updates)
    
    def delete(self, memory_id: str) -> Dict:
        """Delete a memory"""
        return self._request('DELETE', f'/documents/{memory_id}')
    
    def test_connection(self) -> Dict:
        """Test connection to Supermemory API"""
        try:
            test_doc = self.store(
                content=f"Supermemory connection test - {datetime.now().isoformat()}",
                tags=['test', 'connection']
            )
            
            return {
                'success': True,
                'message': 'Connection successful',
                'api_key': self.api_key[:10] + '***',
                'test_document_id': test_doc.get('id')
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
