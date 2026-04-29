import sys
from pathlib import Path

# Ensure the root directory is in the path
sys.path.append(str(Path(__file__).parent))

from src.ai_bridge.engine import AIEngine

if __name__ == "__main__":
    engine = AIEngine('http://localhost:3000')
    engine.start()
