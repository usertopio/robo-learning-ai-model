import cv2
import base64
import socketio
import time
import os
import numpy as np
import threading
from pathlib import Path
from ultralytics import YOLO


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
        self.training_active = False
        self._frame_lock = threading.Lock()
        self._models_lock = threading.Lock()

        self.config = {
            'confidence': 0.25,
            'iou': 0.45,
            'imgsz': 640,
            'model_variant': 'yolo11n.pt',
            'mode': 'inference',
            'show_boxes': True,
            'show_labels': True,
            'target_classes': []
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
            if not label: return
            
            l = label.lower()
            if 'conf' in l: self.config['confidence'] = float(value)
            elif 'iou' in l: self.config['iou'] = float(value)
            elif 'image size' in l:
                try: self.config['imgsz'] = int(value)
                except (ValueError, TypeError): pass
            elif 'model variant' in l or 'model version' in l:
                val = str(value).split(' ')[0].lower()
                # yolov11 → yolo11, yolov8 stays as yolov8
                if val.startswith('yolov11'):
                    val = val.replace('yolov11', 'yolo11')
                # inject 'n' size if missing (e.g. yolo11-cls → yolo11n-cls)
                if 'cls' in val and not any(s in val for s in ['n-', 's-', 'm-', 'l-', 'x-']):
                    val = val.replace('yolo11', 'yolo11n').replace('yolov8', 'yolov8n')
                if 'seg' in val and not any(s in val for s in ['n-', 's-', 'm-', 'l-', 'x-']):
                    val = val.replace('yolo11', 'yolo11n').replace('yolov8', 'yolov8n')
                self.config['model_variant'] = val
            elif 'weights source' in l: self.config['weights_source'] = value
            elif 'bounding box' in l or 'show masks' in l:
                self.config['show_boxes'] = (str(value).lower() == 'true') if not isinstance(value, bool) else value
            elif 'labels' in l:
                self.config['show_labels'] = (str(value).lower() == 'true') if not isinstance(value, bool) else value

        @self.sio.on('ai_webcam_frame')
        def on_webcam_frame(data):
            try:
                frame_str = data.get('image') if isinstance(data, dict) else data
                if not frame_str or ',' not in frame_str:
                    return
                img_bytes = base64.b64decode(frame_str.split(',')[1])
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                with self._frame_lock:
                    self.latest_frame = frame
            except Exception as e:
                log(f"Frame decode error: {e}")

        @self.sio.on('run_image_inference')
        def on_run_image_inference(data):
            folder_path = data.get('folderPath', '')
            folder_name = data.get('folder', 'default')
            log(f"[📁] Image inference requested: {folder_path}")
            t = threading.Thread(
                target=self.run_image_folder_inference,
                args=(folder_path, folder_name),
                daemon=True
            )
            t.start()

        @self.sio.on('start_training')
        def on_start_training(data):
            if self.training_active:
                log("Training already running, skipping.")
                return
            hyperparams = data.get('hyperparams', {})
            # Receive yaml_path from backend (resolved from dataset DB)
            hyperparams['yaml_path'] = data.get('yaml_path', 'coco8.yaml')
            hyperparams['dataset_name'] = data.get('dataset_name', 'coco8 (demo)')
            log(f"[🎓] Training requested: dataset={hyperparams['dataset_name']}")
            t = threading.Thread(target=self.run_training, args=(hyperparams,), daemon=True)
            t.start()

        @self.sio.on('update_search_classes')
        @self.sio.on('ai_search_sync')
        def on_update_search_classes(data):
            if isinstance(data, str):
                classes = [c.strip().lower() for c in data.split(',') if c.strip()]
                self.config['target_classes'] = classes
                log(f"Target classes updated: {classes}")

    # -------------------------------------------------------
    def get_model(self):
        source = self.config.get('weights_source', 'Pre-trained (COCO)')

        if 'My Custom Model' in source:
            custom_path = Path('runs/train/exp/weights/best.pt')
            if not custom_path.exists():
                train_root = Path('runs/train')
                if train_root.exists():
                    runs = sorted([d for d in train_root.iterdir() if d.is_dir()],
                                  key=lambda x: x.stat().st_mtime, reverse=True)
                    if runs:
                        custom_path = runs[0] / 'weights' / 'best.pt'

            if custom_path.exists():
                path_str = str(custom_path)
                with self._models_lock:
                    if path_str not in self.models:
                        log(f"Loading CUSTOM weights: {path_str}")
                        self.models[path_str] = YOLO(path_str)
                    return self.models[path_str]
            else:
                log("Custom weights (best.pt) not found, falling back to pre-trained.")

        variant = self.config['model_variant'].split(' ')[0].lower()
        if not variant.endswith('.pt'):
            variant += '.pt'
        with self._models_lock:
            if variant not in self.models:
                log(f"Loading weights: {variant}")
                self.models[variant] = YOLO(variant)
            return self.models[variant]

    def check_active_pipeline(self):
        nodes = self.current_flow.get('nodes', [])
        ids = [n.get('data', {}).get('def', {}).get('id') for n in nodes]
        has_input = any(x in ['webcam-input', 'robot-stream', 'test-image'] for x in ids)
        has_model = any(x in ['yolo-model', 'inference', 'ai-detector', 'image-classifier'] for x in ids)
        return has_input and has_model

    def encode_frame(self, frame, quality=70):
        _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return base64.b64encode(buf).decode('utf-8')

    def extract_detections(self, results, model):
        detections = []
        names = model.names
        r = results[0]

        # 1. Handle Detection / Segmentation (Boxes)
        if r.boxes is not None and len(r.boxes) > 0:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                label = names.get(cls_id, str(cls_id))
                conf = round(float(box.conf[0]), 3)
                x1, y1, x2, y2 = [round(float(v), 1) for v in box.xyxy[0]]
                # Format: [Label, Confidence, X1, Y1, X2, Y2]
                detections.append([label, conf, x1, y1, x2, y2])
        
        # 2. Handle Classification (Probs)
        elif r.probs is not None:
            # Get top 5 classes
            top5_idx = r.probs.top5
            top5_conf = r.probs.top5conf
            for i in range(len(top5_idx)):
                cls_id = int(top5_idx[i])
                label = names.get(cls_id, str(cls_id))
                conf = round(float(top5_conf[i]), 3)
                # Format for classification: [Label, Confidence, "-", "-", "-", "-"]
                detections.append([label, conf, "-", "-", "-", "-"])

        return detections, names

    # -------------------------------------------------------
    def run_inference(self):
        """Webcam / Robot stream inference loop."""
        if not self.is_running:
            return
        with self._frame_lock:
            frame = self.latest_frame
        if frame is None:
            return
        if not self.check_active_pipeline():
            return
        try:
            model = self.get_model()
            results = model.predict(
                source=frame,
                conf=self.config['confidence'],
                iou=self.config['iou'],
                imgsz=self.config['imgsz'],
                verbose=False
            )
            
            # Strict filtering: if target_classes is set AND we have boxes
            if self.config['target_classes'] and results[0].boxes is not None:
                # Find indices of boxes that match our target classes
                indices = []
                for i, box in enumerate(results[0].boxes):
                    cls_id = int(box.cls[0])
                    label = model.names.get(cls_id, "").lower()
                    if label in self.config['target_classes']:
                        indices.append(i)
                
                # Apply filtering to the results object
                results[0].boxes = results[0].boxes[indices]

            annotated = results[0].plot(
                boxes=self.config['show_boxes'],
                labels=self.config['show_labels'],
                probs=self.config['show_labels'],
                conf=self.config['show_labels']
            )
            encoded = self.encode_frame(annotated)
            self.sio.emit('video_frame_from_robot', {
                'robotId': 'WEBCAM_PROCESSED',
                'image': f"data:image/jpeg;base64,{encoded}"
            })
            detections, names = self.extract_detections(results, model)
            self.sio.emit('det_results', {'detections': detections})
            self.process_logic(results, names)
        except Exception as e:
            log(f"Inference error: {e}")

    # -------------------------------------------------------
    def run_image_folder_inference(self, folder_path, folder_name):
        """Process every image in a folder and stream results to frontend."""
        log(f"[📁] Starting folder inference: {folder_path}")

        if not os.path.exists(folder_path):
            self.sio.emit('image_inference_done', {'error': f'Folder not found: {folder_path}'})
            return

        valid_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
        image_files = [f for f in sorted(os.listdir(folder_path))
                       if os.path.splitext(f)[1].lower() in valid_exts]

        if not image_files:
            self.sio.emit('image_inference_done', {'error': 'No images found'})
            return

        log(f"[📁] Processing {len(image_files)} images")
        self.sio.emit('image_inference_start', {'total': len(image_files), 'folder': folder_name})

        model = self.get_model()
        total_dets = 0

        for i, fname in enumerate(image_files):
            frame = cv2.imread(os.path.join(folder_path, fname))
            if frame is None:
                continue
            try:
                results = model.predict(
                    source=frame,
                    conf=self.config['confidence'],
                    iou=self.config['iou'],
                    imgsz=self.config['imgsz'],
                    verbose=False
                )
                # Send annotated frame to Live Monitor
                annotated = results[0].plot(
                    boxes=self.config['show_boxes'],
                    labels=self.config['show_labels'],
                    probs=self.config['show_labels'],
                    conf=self.config['show_labels']
                )
                encoded = self.encode_frame(annotated, quality=75)
                self.sio.emit('video_frame_from_robot', {
                    'robotId': 'WEBCAM_PROCESSED',
                    'image': f"data:image/jpeg;base64,{encoded}"
                })
                # Detections table
                detections, _ = self.extract_detections(results, model)
                total_dets += len(detections)
                self.sio.emit('det_results', {'detections': detections})
                # Progress event
                self.sio.emit('image_inference_progress', {
                    'current': i + 1,
                    'total': len(image_files),
                    'filename': fname,
                    'detections': len(detections)
                })
                time.sleep(0.08)
            except Exception as e:
                log(f"[📁] Error on {fname}: {e}")

        log(f"[📁] Done. {total_dets} total detections across {len(image_files)} images")
        self.sio.emit('image_inference_done', {
            'total_images': len(image_files),
            'total_detections': total_dets,
            'folder': folder_name
        })

    # -------------------------------------------------------
    def run_training(self, hyperparams):
        """Run YOLO training with real-time loss/epoch emission."""
        self.training_active = True
        log("[🎓] Training started")
        self.sio.emit('training_progress', {
            'status': 'started', 'epoch': 0, 'loss': 0, 'val_loss': 0, 'map50': 0
        })
        try:
            variant = self.config['model_variant'].split(' ')[0].lower()
            if not variant.endswith('.pt'):
                variant += '.pt'
            model = YOLO(variant)

            epochs     = int(hyperparams.get('epochs', 10))
            batch      = int(str(hyperparams.get('batch_size', '16')).split(' ')[0])
            lr0        = float(hyperparams.get('lr0', 0.01))
            optimizer  = str(hyperparams.get('optimizer_type', 'AdamW')).split(' ')[0]
            yaml_path  = hyperparams.get('yaml_path', 'coco8.yaml')
            weight_decay = float(hyperparams.get('weight_decay', 0.0005))

            # imgsz: use user-specified value if available, fallback based on dataset
            raw_imgsz = hyperparams.get('imgsz', None)
            if raw_imgsz and str(raw_imgsz).isdigit():
                imgsz = int(raw_imgsz)
            else:
                imgsz = 320 if yaml_path == 'coco8.yaml' else 640

            # LR Scheduler mapping
            scheduler_raw = hyperparams.get('lr_scheduler', 'Cosine')
            lrf_map = {'Cosine': 0.01, 'Linear': 0.1, 'Constant': 1.0}
            lrf = lrf_map.get(str(scheduler_raw).split(' ')[0], 0.01)

            log(f"[🎓] yaml={yaml_path} | epochs={epochs} | batch={batch} | imgsz={imgsz} | lr={lr0} | lrf={lrf} | opt={optimizer} | wd={weight_decay}")

            sio_ref = self.sio

            def on_epoch_end(trainer):
                ep = trainer.epoch + 1
                try:
                    loss = round(float(trainer.loss.item()), 4)
                except Exception:
                    loss = round(float(trainer.loss), 4)
                val_loss = round(float(trainer.metrics.get('val/box_loss', 0)), 4)
                map50    = round(float(trainer.metrics.get('metrics/mAP50(B)', 0)), 4)
                log(f"[🎓] Epoch {ep}/{epochs} loss={loss} val={val_loss} mAP50={map50}")
                sio_ref.emit('training_progress', {
                    'status': 'training',
                    'epoch': ep,
                    'total_epochs': epochs,
                    'loss': loss,
                    'val_loss': val_loss,
                    'map50': map50
                })

            model.add_callback('on_fit_epoch_end', on_epoch_end)

            model.train(
                data=yaml_path,
                epochs=epochs,
                batch=batch,
                lr0=lr0,
                lrf=lrf,
                optimizer=optimizer,
                weight_decay=weight_decay,
                imgsz=imgsz,
                verbose=False,
                project='runs/train',
                name='exp'
            )

            # --- Collect training artifacts ---
            run_dir = Path('runs/train/exp')
            # Find most recent run if 'exp' doesn't exist (YOLO auto-increments)
            train_root = Path('runs/train')
            if train_root.exists():
                runs = sorted(train_root.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True)
                if runs:
                    run_dir = runs[0]

            artifacts = {}

            # 1. Confusion Matrix PNG (normalized)
            for cm_name in ['confusion_matrix_normalized.png', 'confusion_matrix.png']:
                cm_path = run_dir / cm_name
                if cm_path.exists():
                    with open(cm_path, 'rb') as f:
                        artifacts['confusion_matrix'] = base64.b64encode(f.read()).decode('utf-8')
                    log(f"[🎓] Found: {cm_name}")
                    break

            # 2. Results curves (results.png — loss + mAP over epochs)
            res_png = run_dir / 'results.png'
            if res_png.exists():
                with open(res_png, 'rb') as f:
                    artifacts['results_chart'] = base64.b64encode(f.read()).decode('utf-8')

            # 3. PR Curve
            pr_png = run_dir / 'PR_curve.png'
            if pr_png.exists():
                with open(pr_png, 'rb') as f:
                    artifacts['pr_curve'] = base64.b64encode(f.read()).decode('utf-8')

            # 4. Parse results.csv for final metrics
            results_csv = run_dir / 'results.csv'
            final_metrics = {}
            if results_csv.exists():
                try:
                    import csv
                    with open(results_csv, newline='') as csvfile:
                        reader = csv.DictReader(csvfile)
                        rows = list(reader)
                        if rows:
                            last = rows[-1]
                            final_metrics = {k.strip(): round(float(v), 4) for k, v in last.items()
                                             if v.strip() and k.strip()}
                except Exception as ce:
                    log(f"[🎓] CSV parse error: {ce}")

            log(f"[🎓] Artifacts: {list(artifacts.keys())} | Metrics: {len(final_metrics)} fields")

            self.sio.emit('training_progress', {
                'status': 'complete',
                'epoch': epochs,
                'total_epochs': epochs,
                'loss': 0,
                'val_loss': 0,
                'map50': 0
            })

            # Emit artifacts separately (can be large)
            self.sio.emit('training_artifacts', {
                'run_dir': str(run_dir),
                'artifacts': artifacts,
                'metrics': final_metrics
            })
            log("[🎓] Training complete! Artifacts emitted.")

        except Exception as e:
            log(f"[🎓] Training error: {e}")
            self.sio.emit('training_progress', {'status': 'error', 'message': str(e)})
        finally:
            self.training_active = False


    # -------------------------------------------------------
    def process_logic(self, results, names=None):
        """Send robot commands from detected objects."""
        nodes = self.current_flow.get('nodes', [])
        robot_node = next((n for n in nodes if n.get('data', {}).get('def', {}).get('id') == 'robot-action'), None)
        if not robot_node:
            return
        params = robot_node.get('data', {}).get('def', {}).get('params', [])
        robot_id = next((p.get('value', 'ROBOT_01') for p in params if p.get('label') == 'Target Robot ID'), 'ROBOT_01')
        auto_send = next((p.get('checked', True) for p in params if p.get('label') == 'Enable Auto-Send'), True)
        if not auto_send or results[0].boxes is None or names is None:
            return
        detected = list(set([names.get(int(b.cls[0]), '') for b in results[0].boxes]))
        if detected:
            payload = {'robotId': robot_id, 'detections': detected, 'command': f"DETECTED:{','.join(detected)}"}
            self.sio.emit('robot_command', payload)
            log(f"[🤖] → {robot_id}: {payload['command']}")

    # -------------------------------------------------------
    def start(self):
        retry_delay = 5
        max_delay = 60
        while True:
            try:
                log(f"Connecting to {self.server_url}...")
                self.sio.connect(self.server_url)
                log(f"AI Bridge active on {self.server_url}")
                retry_delay = 5
                while True:
                    if self.is_running:
                        self.run_inference()
                    else:
                        time.sleep(0.5)
            except KeyboardInterrupt:
                log("Shutting down...")
                break
            except Exception as e:
                log(f"Connection error: {e}. Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, max_delay)
                try:
                    self.sio.disconnect()
                except Exception:
                    pass

if __name__ == "__main__":
    import os as _os
    engine = AIEngine(_os.getenv('BACKEND_URL', 'http://localhost:3000'))
    engine.start()
