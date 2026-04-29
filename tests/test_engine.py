import pytest
from src.ai_bridge.engine import AIEngine

def test_engine_initialization():
    """Test that the engine initializes with the correct default states."""
    engine = AIEngine('http://127.0.0.1:3000')
    assert engine.server_url == 'http://127.0.0.1:3000'
    assert engine.is_running is False
    assert len(engine.models) == 0

def test_extract_detections(mocker):
    """Test the internal data parsing logic for YOLO results."""
    engine = AIEngine('http://127.0.0.1:3000')
    
    # Example: Mock the YOLO result object
    class MockBox:
        xyxy = [[10, 20, 30, 40]]
        conf = [0.95]
        cls = [0]
    
    class MockResult:
        boxes = [MockBox()]
        names = {0: "person"}
        
    class MockModel:
        names = {0: "person"}
        
    detections, names = engine.extract_detections([MockResult()], MockModel())
    
    assert len(detections) == 1
    assert detections[0][0] == 'person'
    assert detections[0][1] == 0.95
