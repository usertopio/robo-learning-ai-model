export const BLOCKS: Record<string, any[]> = {
    input: [
        {
            id: 'train-data', icon: '📁', name: 'Training Data',
            subtitle: 'Dataset / YAML Config', badge: 'INPUT', color: 'blue',
            params: [
                { type: 'select', label: 'Dataset Strategy', options: ['Upload Local Folder', 'coco128.yaml', 'coco8.yaml', 'custom_dataset.yaml'] },
                { type: 'dropzone', label: 'Local Image Folder' },
            ],
            insight: { title: 'Dataset Structure', text: 'YOLO datasets use YAML configs pointing to train/val image folders with label files in YOLO format.', formula: 'label: class x y w h (normalized 0-1)' }
        },
        {
            id: 'test-image', icon: '🖼️', name: 'Test Image Input',
            subtitle: 'Single Image for Inference', badge: 'INPUT', color: 'blue',
            params: [
                { type: 'dropzone', label: 'Local Target Image' },
                { type: 'info', label: 'Preview', text: 'No image selected' },
            ],
            insight: { title: 'Image Preprocessing', text: 'Before inference, images are resized to the model\'s input size (default 640×640) and normalized to [0,1].', formula: 'pixel_norm = pixel_value / 255.0' }
        },
        {
            id: 'roboflow-data', icon: '🌐', name: 'Roboflow Dataset',
            subtitle: 'Cloud Dataset via API', badge: 'INPUT', color: 'blue',
            params: [
                { type: 'text', label: 'Roboflow API Key', placeholder: 'Enter API Key...' },
                { type: 'text', label: 'Workspace Name', placeholder: 'e.g. self-driving-cars' },
                { type: 'text', label: 'Project Name', placeholder: 'e.g. traffic-lights' },
                { type: 'slider', label: 'Dataset Version', min: 1, max: 20, value: 1, step: 1 },
            ],
            insight: { title: 'Cloud Datasets', text: 'Roboflow auto-downloads your labeled datasets directly into the training pipeline without needing to store or extract ZIP files manually.', formula: 'rf.workspace().project().version().download("yolov8")' }
        },
    ],
    model: [
        {
            id: 'yolo-model', icon: '🧠', name: 'YOLOv8',
            subtitle: 'Optimization: Detection', badge: 'MODEL', color: 'purple',
            params: [
                { type: 'select', label: 'Model Size', options: ['YOLOv8n (Nano - Fast)', 'YOLOv8s (Small)', 'YOLOv8m (Medium)', 'YOLOv8l (Large)', 'YOLOv8x (Extra Large)'] },
                { type: 'select', label: 'Pretrained Weights', options: ['yolov8n.pt', 'yolov8s.pt', 'yolov8m.pt', 'yolov8l.pt', 'yolov8x.pt', 'None (from scratch)'] },
            ],
            insight: { title: 'Neural Networks', text: 'AI models are layers of mathematical functions. Each layer transforms data using weights (W) and biases (b), then applies an activation function.', formula: 'output = f(W · x + b)' }
        },
    ],
    training: [
        {
            id: 'train-engine', icon: '⚙️', name: 'Training Engine',
            subtitle: 'Hyperparameters & Augmentation', badge: 'TRAIN', color: 'amber',
            params: [
                { type: 'slider', label: 'Image Size (imgsz)', min: 320, max: 1280, value: 640, step: 32 },
                { type: 'slider', label: 'Epochs', min: 1, max: 500, value: 100, step: 1 },
                { type: 'select', label: 'Batch Size', options: ['2', '4', '8', '16', '32', '64'] },
                { type: 'slider', label: 'Learning Rate (lr0)', min: 0.001, max: 0.1, value: 0.01, step: 0.001 },
                { type: 'divider', label: 'Data Augmentation' },
                { type: 'check', label: 'Enable Mosaic', checked: true },
                { type: 'slider', label: 'Degrees (Rotate)', min: 0, max: 45, value: 0, step: 1 },
                { type: 'slider', label: 'Translate (%)', min: 0, max: 0.9, value: 0.1, step: 0.05 },
                { type: 'slider', label: 'Scale', min: 0, max: 0.9, value: 0.5, step: 0.05 },
                { type: 'check', label: 'Flip Left-Right', checked: true },
            ],
            insight: { title: 'Gradient Descent', text: 'Training adjusts weights to minimize loss. Learning rate controls step size — too high causes divergence, too low is slow.', formula: 'W_new = W - lr × ∂Loss/∂W' }
        },
    ],
    output: [
        {
            id: 'inference', icon: '👁️', name: 'Predict / Inference',
            subtitle: 'Run Detection on Image', badge: 'PREDICT', color: 'green',
            params: [
                { type: 'slider', label: 'Confidence Threshold', min: 0.01, max: 1.0, value: 0.25, step: 0.01 },
                { type: 'slider', label: 'IoU Threshold (NMS)', min: 0.01, max: 1.0, value: 0.45, step: 0.01 },
                { type: 'slider', label: 'Image Size', min: 320, max: 1280, value: 640, step: 32 },
                { type: 'select', label: 'Source', options: ['From Test Image Block', 'Webcam (0)', 'Video File'] },
            ],
            insight: { title: 'Non-Max Suppression', text: 'NMS removes overlapping boxes by keeping only the highest-confidence prediction when IoU exceeds a threshold.', formula: 'Keep if IoU(box_i, box_j) < threshold' }
        },
        {
            id: 'det-results', icon: '📊', name: 'Detection Results',
            subtitle: 'Class · BBox · Score · Time', badge: 'OUTPUT', color: 'green',
            params: [
                { type: 'table', label: 'Detections', columns: ['Class', 'BBox', 'Score'], rows: 5 },
                { type: 'info', label: 'Inference Time', text: '— ms' },
            ],
            insight: { title: 'Bounding Box', text: 'Each detection has coordinates (x, y, w, h) normalized to image dimensions.', formula: 'bbox = (x_center, y_center, width, height)' }
        },
    ],
    viz: [
        {
            id: 'metrics', icon: '📈', name: 'Training Metrics',
            subtitle: 'mAP · Precision · Recall', badge: 'METRICS', color: 'rose',
            params: [
                { type: 'table', label: 'Evaluation', columns: ['Metric', 'Value'], rows: 4, data: [['mAP@50','—'],['mAP@50-95','—'],['Precision','—'],['Recall','—']] },
                { type: 'divider', label: 'Confusion Matrix' },
                { type: 'matrix', label: 'Predicted \\ True', headers: ['Cat','Dog','Car'], size: 3 },
            ],
            insight: { title: 'Mean Average Precision', text: 'mAP summarizes the precision-recall curve. mAP@50 uses IoU=0.5 as threshold.', formula: 'mAP = (1/N) × Σ AP_i' }
        },
        {
            id: 'loss-curves', icon: '📉', name: 'Loss Curves',
            subtitle: 'box · cls · dfl · total', badge: 'CHART', color: 'rose',
            params: [
                { type: 'table', label: 'Loss Values', columns: ['Loss Type', 'Current', 'Best'], rows: 4, data: [['box_loss','—','—'],['cls_loss','—','—'],['dfl_loss','—','—'],['total_loss','—','—']] },
                { type: 'progress', label: 'Epoch Progress', value: 0 },
            ],
            insight: { title: 'Loss Functions', text: 'YOLO uses multiple losses: box_loss (bbox accuracy), cls_loss (classification), dfl_loss.', formula: 'total_loss = box + cls + dfl' }
        },
    ],
};
