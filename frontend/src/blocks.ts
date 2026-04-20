/* 
  AI Building Blocks Definitions
  Contains all the metadata for different categories of nodes in the workspace.
*/

export interface BlockParam {
    type: 'slider' | 'select' | 'check' | 'text' | 'table' | 'info' | 'divider' | 'dropzone';
    label: string;
    desc?: string; // Detailed educational description
    min?: number;
    max?: number;
    value?: any;
    step?: number;
    options?: string[];
    checked?: boolean;
    text?: string;
    columns?: string[];
    rows?: number;
    placeholder?: string;
}

export interface BlockDef {
    id: string;
    icon: string;
    name: string;
    subtitle: string;
    badge: string;
    color: string;
    description: string;
    params: BlockParam[];
    insight?: {
        title: string;
        text: string;
        formula?: string;
    };
}

export const BLOCKS: Record<string, BlockDef[]> = {
    input: [
        {
            id: 'robot-stream', icon: '📷', name: 'Robot Camera',
            subtitle: 'Direct MJPEG/RTSP' , badge: 'INPUT', color: 'blue',
            description: 'ดึงข้อมูลภาพสดจากหุ่นยนต์ผ่านโปรโตคอล MJPEG หรือ RTSP โดยตรง เพื่อนำมาประมวลผลในขั้นตอนถัดไป',
            params: [
                { type: 'text', label: 'Stream URL', desc: 'ที่อยู่ IP หรือ Endpoint ของกล้องหุ่นยนต์ (เช่น http://192.168.1.50:5000/video_feed)', value: 'http://localhost:5000/video_feed' },
                { type: 'slider', label: 'Frame Rate', desc: 'จำนวนภาพต่อวินาที (FPS) ยิ่งมากภาพยิ่งลื่นแต่กินเน็ตมากขึ้น', min: 1, max: 60, value: 30, step: 1 },
                { type: 'select', label: 'Resolution', desc: 'ความละเอียดของภาพ (ยิ่งสูง AI ยิ่งเห็นชัดแต่โหลดเครื่อง)', options: ['640x480 (Standard)', '1280x720 (HD)', '1920x1080 (FHD)'] },
            ],
            insight: { 
                title: 'Data Compression Ratio', 
                text: 'การส่งข้อมูลวิดีโอต้องพึ่งพาสูตรการบีบอัดภาพเพื่อลดโหลดของ Network โดยรักษา Peak Signal-to-Noise Ratio (PSNR) ให้สูงเพียงพอที่ AI จะยังคงมองเห็นวัตถุได้ชัดเจน', 
                formula: 'CR = Uncompressed_Size / Compressed_Size' 
            }
        },
        {
            id: 'webcam-input', icon: '📹', name: 'Webcam Stream',
            subtitle: 'Local Browser Camera', badge: 'INPUT', color: 'blue',
            description: 'ใช้กล้องเว็บแคมจากคอมพิวเตอร์ของผู้ใช้โดยตรงสำหรับการทดสอบและพัฒนาโมเดลเบื้องต้น',
            params: [
                { type: 'select', label: 'Camera Device', desc: 'เลือกกล้องที่เชื่อมต่อกับคอมพิวเตอร์ของคุณ', options: ['Integrated Camera', 'USB Video Device', 'Virtual Camera'] },
                { type: 'check', label: 'Mirror Display', desc: 'แสดงภาพแบบกลับด้าน (เหมือนกระจก) เพื่อความคุ้นเคยของผู้ใช้', checked: true },
            ],
            insight: { 
                title: 'Latency Tracking', 
                text: 'ความล่าช้า (Latency) เกิดจากเวลาที่แสงเข้าเลนส์จนถึงเวลาที่ประมวลผลเสร็จ การลด Resolution ช่วยลด Latency ในการประมวลผลได้มหาศาล', 
                formula: 'T_total = T_capture + T_transfer + T_inference' 
            }
        },
        {
            id: 'test-image', icon: '🖼️', name: 'Test Images Folder',
            subtitle: 'Images Only Dataset', badge: 'INPUT', color: 'blue',
            description: 'เลือก folder ที่มีแต่ทีหนึ่ง รูปภาพ (JPG, PNG, BMP) เพื่อทดสอบการตรวจจับภาพ ไม่มี annotation/labels',
            params: [
                { type: 'dropzone', label: 'Test Images Folder', desc: 'เลือกหรือลาก folder ที่มีแต่ภาพทดสอบ (.jpg, .png, .bmp)' },
                { type: 'info', label: '📁 Folder Content', text: 'เป็น folder ที่เมีแต่ images เท่านั้น ไม่ต้องมี labels หรือ annotation' },
                { type: 'check', label: 'Recursive Search', desc: 'ค้นหาภาพจากโฟลเดอร์ย่อยทั้งหมดด้วย', checked: true },
                { type: 'divider', label: 'Image Processing' },
                { type: 'check', label: 'Normalize (0-1)', desc: 'ปรับค่า pixel ให้เป็น 0-1 range แทน 0-255 (สำคัญสำหรับ inference)', checked: true },
                { type: 'select', label: 'Auto Resize to', desc: 'ปรับขนาดภาพให้เหมือนที่โมเดลรับเข้า', options: ['320x320 (Fast)', '640x640 (Balanced)', '1280x1280 (High Detail)', 'No Resize'] },
            ],
            insight: { 
                title: 'Preprocessing Pipeline', 
                text: 'Normalize + Auto Resize ทำให้ inference ถูกต้อง เนื่องจากโมเดล YOLOv11 ได้รับการฝึกด้วย pixel 0-1 และขนาด 640x640', 
                formula: 'X_norm = X / 255; resized = resize(X_norm, (640, 640))' 
            }
        },
        {
            id: 'roboflow-dataset', icon: '📚', name: 'Roboflow Export',
            subtitle: 'Dataset from Roboflow', badge: 'INPUT', color: 'blue',
            description: 'อัปโหลด Dataset ที่ดาวน์โหลดจาก Roboflow มี folder `images` (ภาพ) และ `labels` (annotation) ขางใน YOLO format',
            params: [
                { type: 'dropzone', label: 'Roboflow Dataset Folder', desc: 'เลือกหรือลาก folder ที่อง contains `images/` และ `labels/` subfolder (exported from Roboflow)' },
                { type: 'info', label: '📁 Required Structure', text: 'dataset-folder/ ¿ images/ ¿ labels/ ¿ data.yaml (optional)' },
                { type: 'check', label: 'Auto Validate', desc: 'ตรวจสอบโครงสร้าง folder เมื่ออัปโหลด', checked: true },
            ],
            insight: { 
                title: 'Roboflow Export Format', 
                text: 'Roboflow สอง export dataset เป็น YOLO format ที่มี images folder, labels folder, และ data.yaml ไฟล์ ซึ่งพร้อมใช้งานกับ YOLOv11 training', 
                formula: 'Dataset(images) + Annotations(labels) = Training Ready' 
            }
        },
    ],
    model: [
        {
            id: 'ai-detector', icon: '🤖', name: 'AI Object Detector',
            subtitle: 'YOLO Object Detection', badge: 'MODEL', color: 'purple',
            description: 'ตรวจจับวัตถุและระบุตำแหน่ง (Bounding Box) รองรับ YOLOv11 ครอบคลุมตั้งแต่การเลือกโมเดลจนถึงการตั้งค่าการประมวลผลขั้นสูง',
            params: [
                { type: 'divider', label: 'Model Configuration' },
                { type: 'select', label: 'Weights Source', desc: 'เลือกใช้โมเดลมาตรฐาน (COCO) หรือโมเดลที่คุณเทรนเองสำเร็จแล้ว', options: ['Pre-trained (COCO)', 'My Custom Model (best.pt)'] },
                { type: 'select', label: 'Processing Device', desc: 'เลือก Hardware ที่ใช้ประมวลผล (GPU จะเร็วกว่า CPU 10-50 เท่า)', options: ['CPU (Universal)', 'GPU (NVIDIA CUDA)', 'Auto-Select'] },
                { type: 'select', label: 'Model Variant', desc: 'ขนาดของโมเดล (Nano เล็กเร็ว / Extra Large ใหญ่แม่นยำที่สุด)', options: [
                    'YOLOv11n (Nano - Ultra Fast)', 
                    'YOLOv11s (Small - Balanced)', 
                    'YOLOv11m (Medium - High Accuracy)', 
                    'YOLOv11l (Large - Professional)', 
                    'YOLOv11x (Extra Large - Master)'
                ] },
                { type: 'divider', label: 'Inference Settings' },
                { type: 'slider', label: 'Image Size', desc: 'ความละเอียดของภาพที่ส่งเข้า AI (ควรสัมพันธ์กับขนาดที่ใช้ฝึก)', min: 320, max: 1280, value: 640, step: 32 },
                { type: 'slider', label: 'Conf Threshold', desc: 'เกณฑ์ความมั่นใจขั้นต่ำ (ถ้าต่ำกว่านี้ AI จะไม่แสดงผล)', min: 0.1, max: 0.9, value: 0.25, step: 0.05 },
                { type: 'slider', label: 'IoU Threshold', desc: 'เกณฑ์การตัดสินใจกรณีกล่องซ้อนกัน (NMS)', min: 0.1, max: 0.9, value: 0.45, step: 0.05 },
                { type: 'divider', label: 'Display Options' },
                { type: 'check', label: 'Draw Bounding Box', desc: 'วาดกรอบสี่เหลี่ยมรอบวัตถุ', checked: true },
                { type: 'check', label: 'Show Labels & Scores', desc: 'แสดงชื่อคลาสและคะแนนความมั่นใจ', checked: true },
            ],
            insight: { 
                title: 'Object Detection Pipeline', 
                text: 'การทำ Object Detection คือการทำ Localization (หาตำแหน่ง) และ Classification (ระบุประเภท) ไปพร้อมๆ กันในขั้นตอนเดียว (Single-Shot)', 
                formula: 'Output = [x, y, w, h, confidence, class_id]' 
            }
        },
        {
            id: 'image-classifier', icon: '🖼️', name: 'Image Classifier',
            subtitle: 'YOLO Classification', badge: 'CLASSIFY', color: 'purple',
            description: 'จำแนกประเภทของภาพทั้งภาพว่าคืออะไร เหมาะสำหรับงานที่ไม่ต้องการระบุตำแหน่งวัตถุแต่ต้องการความเร็วสูงสุด',
            params: [
                { type: 'select', label: 'Model Version', desc: 'เลือกเวอร์ชันของ YOLO สำหรับงานจำแนกประเภท', options: ['YOLOv11-cls (Latest)', 'YOLOv8-cls (Legacy)'] },
                { type: 'slider', label: 'Top-K Results', desc: 'แสดงผลลัพธ์ที่มีคะแนนสูงสุด K อันดับแรก', min: 1, max: 5, value: 1, step: 1 },
                { type: 'check', label: 'Softmax Activation', desc: 'ปรับคะแนนผลลัพธ์ให้รวมกันได้ 1 (Probability)', checked: true },
            ],
            insight: { 
                title: 'Image Classification', 
                text: 'โมเดลจะดึงลักษณะเด่น (Global Features) ทั่วทั้งภาพมาคำนวณหาความน่าจะเป็นของแต่ละคลาส', 
                formula: 'P(class|image) = exp(z_i) / Σ exp(z_j)' 
            }
        },
        {
            id: 'instance-segmentor', icon: '🎭', name: 'Instance Segmentor',
            subtitle: 'Pixel-level Detection', badge: 'SEGMENT', color: 'purple',
            description: 'ตรวจจับวัตถุและตัดแยกตามรูปทรงจริง (Pixel-perfect) เหมาะสำหรับงานวัดพื้นที่หรือตรวจจับวัตถุที่มีรูปร่างซับซ้อน',
            params: [
                { type: 'slider', label: 'Mask Alpha', desc: 'ความโปร่งใสของสีที่ระบายทับวัตถุ', min: 0.1, max: 1.0, value: 0.5, step: 0.1 },
                { type: 'check', label: 'Show Contours', desc: 'วาดเส้นขอบรอบวัตถุให้ชัดเจน', checked: true },
                { type: 'slider', label: 'Retina Masks', desc: 'ใช้ความละเอียดหน้ากากสูง (คมชัดขึ้นแต่โหลดเครื่อง)', min: 0, max: 1, value: 1, step: 1 },
            ],
            insight: { 
                title: 'Instance Segmentation', 
                text: 'เป็นการรวมกันของ Detection และ Mask Generation เพื่อระบุตัวตนของวัตถุในระดับพิกเซล', 
                formula: 'Mask = Sigmoid(Prototype_Masks * Coefficients)' 
            }
        },
    ],
    training: [
        {
            id: 'train-engine', icon: '⚙️', name: 'Training Engine',
            subtitle: 'Hyperparameters & Optimization', badge: 'TRAIN', color: 'amber',
            description: 'ศูนย์กลางการควบคุมการเรียนรู้ของ AI กำหนดพฤติกรรมการปรับค่าน้ำหนักและการดึงทรัพยากร Hardware มาใช้สูงสุด',
            params: [
                { type: 'select', label: 'Operation Mode', desc: 'เลือกโหมดหลักของระบบ', options: ['Inference (Testing)', 'Training (Learning)'] },
                { type: 'select', label: 'Training Strategy', desc: 'Transfer Learning (ฝึกต่อจากฐานความรู้เดิม) หรือ Scratch (เริ่มใหม่หมด)', options: ['Transfer Learning (Fast)', 'Train from Scratch (Slow)'] },
                { type: 'divider', label: 'Hardware Acceleration' },
                { type: 'check', label: 'AMP (Mixed Precision)', desc: 'ใช้ความละเอียดตัวเลขแบบผสมเพื่อให้เทรนเร็วขึ้น 2 เท่าและประหยัด VRAM', checked: true },
                { type: 'slider', label: 'Dataloader Workers', desc: 'จำนวน CPU Threads ที่ใช้โหลดภาพเข้าระบบ (ยิ่งมากยิ่งเร็วแต่กิน CPU)', min: 0, max: 16, value: 4, step: 2 },
                { type: 'divider', label: 'Core Hyperparameters' },
                { type: 'slider', label: 'Initial LR (lr0)', desc: 'ความเร็วในการเรียนรู้เริ่มต้น (Learning Rate)', min: 0.0001, max: 0.1, value: 0.01, step: 0.0001 },
                { type: 'slider', label: 'Epochs', desc: 'จำนวนรอบการฝึกทั้งหมด', min: 1, max: 2000, value: 100, step: 10 },
                { type: 'select', label: 'Batch Size', desc: 'จำนวนภาพที่ส่งเข้าคำนวณพร้อมกัน (ต้องสัมพันธ์กับแรมการ์ดจอ)', options: ['8', '16', '32', '64', '128'] },
                { type: 'divider', label: 'Optimizer & Scheduler' },
                { type: 'select', label: 'Optimizer Type', desc: 'อัลกอริทึมการคำนวณหาทิศทางค่าน้ำหนัก', options: ['AdamW (Modern)', 'Adam', 'SGD', 'RMSProp', 'Adagrad'] },
                { type: 'select', label: 'LR Scheduler', desc: 'รูปแบบการลดความเร็วการเรียนรู้เมื่อเทรนไปนานๆ', options: ['Cosine (Smooth)', 'Linear (Step)', 'Constant'] },
                { type: 'divider', label: 'Validation Control' },
                { type: 'slider', label: 'Val. Frequency', desc: 'ตรวจสอบความแม่นยำทุกๆ กี่รอบ (Epoch)', min: 1, max: 50, value: 1, step: 1 },
                { type: 'check', label: 'Save Checkpoints', desc: 'บันทึกโมเดลไว้ทุกรอบที่ความแม่นยำดีขึ้น', checked: true },
            ],
            insight: { 
                title: 'Stochastic Gradient Descent', 
                text: 'Optimizer และ Learning Rate คือหัวใจในการพาโมเดลลงจาก "ภูเขาแห่งความผิดพลาด" ไปสู่ "หุบเขาแห่งความแม่นยำ" ที่ลึกที่สุด', 
                formula: 'W_new = W_old - LR * Gradient' 
            }
        },
    ],
    output: [
        {
            id: 'live-monitor', icon: '🖥️', name: 'Live Monitor',
            subtitle: 'Real-time Feed Display', badge: 'OUTPUT', color: 'blue',
            description: 'หน้าจอสำหรับแสดงผลลัพธ์การประมวลผลย้อนกลับมาที่ Dashboard เพื่อให้ผู้ใช้งานมองเห็นสิ่งที่ AI เห็น',
            params: [
                { type: 'check', label: 'Active Preview', desc: 'เปิดหน้าต่าง Preview ทางด้านขวาของหน้าจอเพื่อดูภาพสด', checked: true },
                { type: 'select', label: 'Overlay Style', desc: 'เลือกรูปแบบการตกแต่งกรอบ Bounding Box ที่จะแสดงผล', options: ['Neon Glow', 'Minimalist', 'Classic Specs'] },
            ],
            insight: { 
                title: 'Post-Process Rendering', 
                text: 'การวาด Bounding Box ลงบนภาพสดต้องอาศัย GPU หรือ Canvas ในเบราว์เซอร์ เพื่อให้เรามองเห็นได้ทันทีโดยไม่เกิด Frame Drop', 
                formula: 'FPS_view = 1 / (T_infer + T_render)' 
            }
        },
        {
            id: 'robot-action', icon: '🤖', name: 'Robot Data Sender',
            subtitle: 'Web → Robot Feedback', badge: 'ROBOT', color: 'emerald',
            description: 'ส่งผลลัพธ์จากการประมวลผล AI (เช่น ชื่อวัตถุที่เจอ) กลับไปยังหุ่นยนต์แบบ Real-time เพื่อสั่งงานฮาร์ดแวร์',
            params: [
                { type: 'text', label: 'Target Robot ID', desc: 'รหัสหุ่นยนต์ตัวที่ต้องการส่งข้อมูลไป (ต้องตรงกับที่หุ่นยนต์ลงทะเบียนไว้)', value: 'ROBOT_01' },
                { type: 'select', label: 'Data Type', desc: 'รูปแบบข้อมูลที่จะส่งกลับไป', options: ['Simple Label (String)', 'JSON Object (Full Data)', 'Raw Coordinates (X,Y)'] },
                { type: 'check', label: 'Enable Auto-Send', desc: 'ส่งข้อมูลทันทีที่ AI ตรวจพบวัตถุตามเงื่อนไข', checked: true },
            ],
            insight: { 
                title: 'Bi-directional Communication', 
                text: 'การสื่อสารแบบ 2 ทางทำให้หุ่นยนต์สามารถ "ตัดสินใจ" ได้โดยใช้พลังประมวลผลจากเซิร์ฟเวอร์ (Cloud Intelligence)', 
                formula: 'Action = Robot(Receive(AI_Result))' 
            }
        },
        {
            id: 'det-results', icon: '📊', name: 'Detection Results',
            subtitle: 'Class · BBox · Score · Time', badge: 'OUTPUT', color: 'green',
            description: 'แสดงผลลัพธ์จากการทำ Inference ในรูปแบบของตารางข้อมูลเชิงปริมาณ',
            params: [
                { type: 'table', label: 'Detections', desc: 'ตารางแสดงพิกัดและระดับความมั่นใจของวัตถุทุกชิ้นในภาพ', columns: ['Class', 'Confidence', 'X1', 'Y1', 'X2', 'Y2'], rows: 5 },
                { type: 'info', label: 'Pre-processing Time', desc: 'เวลาที่ใช้ในการปรับแต่งรูปภาพก่อนส่งให้ AI', text: '— ms' },
            ],
            insight: { 
                title: 'Spatial Coordinates Encoding', 
                text: 'การเก็บข้อมูลพิกัดในรูป [Xmin, Ymin, Xmax, Ymax] ช่วยให้คำนวณพื้นที่วัตถุได้ทันที', 
                formula: 'Area = (Xmax - Xmin) * (Ymax - Ymin)' 
            }
        },
    ],
    viz: [
        {
            id: 'loss-chart', icon: '📈', name: 'Loss Analysis',
            subtitle: 'Training Progress', badge: 'VIZ', color: 'rose',
            description: 'กราฟแสดงประวัติความผิดพลาด (Loss) ระหว่างการฝึก ยิ่งค่าลดต่ำลงโมเดลยิ่งเก่งขึ้น',
            params: [
                { type: 'select', label: 'Chart Type', desc: 'รูปแบบการแสดงผลของกราฟความคืบหน้า', options: ['Line Chart', 'Area Chart', 'Scatter Plot'] },
                { type: 'check', label: 'Smooth Curves', desc: 'ปรับเส้นกราฟให้นิ่งขึ้นเพื่อให้มองเห็นแนวโน้ม (Trend) ได้ง่าย', checked: true },
            ],
            insight: { 
                title: 'Gradient Descent Curve', 
                text: 'เป้าหมายคือการหาจุด Global Minimum ของพื้นผิวความผิดพลาด เพื่อให้น้ำหนักของโมเดลแม่นยำที่สุด', 
                formula: 'θ = θ - η∇J(θ)' 
            }
        },
        {
            id: 'confusion-matrix', icon: '🧮', name: 'Confusion Matrix',
            subtitle: 'Model Reliability', badge: 'VIZ', color: 'rose',
            description: 'ตารางเปรียบเทียบระหว่างสิ่งที่ AI ทาย กับความจริง (Truth) เพื่อดูว่า AI มักสับสนวัตถุประเภทไหน',
            params: [
                { type: 'check', label: 'Normalize Values', desc: 'แสดงค่าเป็นเปอร์เซ็นต์ (0-1) แทนจำนวนนับปกติ', checked: true },
                { type: 'select', label: 'Color Schema', desc: 'โทนสีที่ใช้แสดงความหนาแน่นของข้อมูล (Heatmap)', options: ['Viridis (Standard)', 'Magma', 'Plasma'] },
            ],
            insight: { 
                title: 'F1-Score Balance', 
                text: 'F1-Score คือค่าเฉลี่ยที่สมดุลระหว่าง Precision (ทายแม่น) และ Recall (ทายครบ)', 
                formula: 'F1 = 2 * (Prec * Rec) / (Prec + Rec)' 
            }
        },
    ]
};
