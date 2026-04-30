import sys
import os
from pathlib import Path

# Ensure the root directory is in the path
sys.path.append(str(Path(__file__).parent))

from src.ai_bridge.engine import AIEngine

if __name__ == "__main__":
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:3000')
    engine = AIEngine(backend_url)
    engine.start()
