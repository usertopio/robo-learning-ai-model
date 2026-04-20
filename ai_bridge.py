import cv2
import base64
import socketio
import time
import sys
import os
import numpy as np
from ultralytics import YOLO

# Utility for unbuffered logging
def log(msg):
    print(f"[AI] {msg}", flush=True)

class AIEngine:
    def __init__(self, server_url):
        self.sio = socketio.Client()
        self.server_url = server_url
        self.models = {}
        self.is_running = False
        self.current_flow = {"nodes": [], "edges": []}
        self.latest_frame = None
        
        self.config = {
            'confidence': 0.25,
            'iou': 0.45,
            'imgsz': 640,
            'model_variant': 'yolo11n.pt',
            'mode': 'inference'
        }

        self.setup_handlers()

    def setup_handlers(self):
        @self.sio.event
        def connect():
            log("Connected to Backend Server")
            self.sio.emit('join_robot_room', 'WEBCAM_PROCESSED')

        @self.sio.on('ai_flow_sync')
        def on_flow_sync(data):
            self.current_flow = data
            log(f"Flow topology updated: {len(data.get('nodes', []))} nodes")

        @self.sio.on('ai_system_sync')
        def on_system_sync(data):
            self.is_running = data.get('running', False)
            log(f"System status: {'RUNNING' if self.is_running else 'STOPPED'}")

        @self.sio.on('ai_params_sync')
        def on_params_sync(data):
            label, value = data.get('label'), data.get('value')
            if label == 'Confidence Threshold': self.config['confidence'] = float(value)
            elif label == 'IOU Threshold': self.config['iou'] = float(value)
            elif label == 'Model Variant': self.config['model_variant'] = value

        @self.sio.on('ai_webcam_frame')
        def on_webcam_frame(data):
            try:
                img_bytes = base64.b64decode(data.split(',')[1])
                nparr = np.frombuffer(img_bytes, np.uint8)
                self.latest_frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            except Exception as e:
                log(f"Frame decode error: {e}")

    def get_model(self):
        variant = self.config['model_variant'].split(' ')[0].lower()
        if not variant.endswith('.pt'): variant += '.pt'
        
        if variant not in self.models:
            log(f"Loading weights: {variant}")
            self.models[variant] = YOLO(variant)
        return self.models[variant]

    def check_active_pipeline(self):
        """Validates if current flow has Input -> Model -> Monitor"""
        nodes = self.current_flow.get('nodes', [])
        ids = [n.get('data', {}).get('def', {}).get('id') for n in nodes]
        
        has_input = any(x in ['webcam-input', 'robot-stream'] for x in ids)
        has_model = any(x in ['yolo-model', 'inference'] for x in ids)
        has_monitor = any(x == 'live-monitor' for x in ids)
        
        return has_input and has_model and has_monitor

    def run_inference(self):
        if not self.is_running or self.latest_frame is None:
            return

        if not self.check_active_pipeline():
            return

        try:
            model = self.get_model()
            results = model.predict(
                source=self.latest_frame,
                conf=self.config['confidence'],
                iou=self.config['iou'],
                imgsz=self.config['imgsz'],
                verbose=False
            )

            # Draw and Encode
            annotated_frame = results[0].plot()
            _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            encoded_img = base64.b64encode(buffer).decode('utf-8')
            
            self.sio.emit('video_frame_from_robot', {
                'robotId': 'WEBCAM_PROCESSED',
                'image': f"data:image/jpeg;base64,{encoded_img}"
            })
            
            # Logic Engine (Simple Example)
            self.process_logic(results)

        except Exception as e:
            log(f"Inference error: {e}")

    def process_logic(self, results):
        # Implementation for Robot Commands based on detections
        pass

    def start(self):
        try:
            self.sio.connect(self.server_url)
            log(f"AI Bridge active on {self.server_url}")
            
            while True:
                if self.is_running:
                    self.run_inference()
                else:
                    time.sleep(0.5)
        except KeyboardInterrupt:
            log("Shutting down...")
        except Exception as e:
            log(f"Fatal error: {e}")
            time.sleep(5)
            self.start() # Simple auto-restart

if __name__ == "__main__":
    engine = AIEngine('http://localhost:3000')
    engine.start()
