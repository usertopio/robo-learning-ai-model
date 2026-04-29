import dearpygui.dearpygui as dpg
import os

# Global state
selected_train_folder = ""
selected_test_image = ""

def main():
    dpg.create_context()

    # --- Theme ---
    with dpg.theme() as global_theme:
        with dpg.theme_component(dpg.mvAll):
            dpg.add_theme_color(dpg.mvNodeCol_TitleBar, (41, 128, 185), category=dpg.mvThemeCat_Nodes)
            dpg.add_theme_color(dpg.mvNodeCol_TitleBarHovered, (52, 152, 219), category=dpg.mvThemeCat_Nodes)
            dpg.add_theme_color(dpg.mvNodeCol_TitleBarSelected, (52, 152, 219), category=dpg.mvThemeCat_Nodes)
            dpg.add_theme_color(dpg.mvNodeCol_NodeBackground, (30, 30, 30, 200), category=dpg.mvThemeCat_Nodes)
    dpg.bind_theme(global_theme)

    # --- Texture registry for image preview ---
    with dpg.texture_registry(show=False):
        dpg.add_raw_texture(width=1, height=1, default_value=[0, 0, 0, 0], format=dpg.mvFormat_Float_rgba, tag="test_preview_texture")

    # =============================================
    # Callbacks
    # =============================================

    # Callback: Training folder selected
    def on_train_folder_selected(sender, app_data):
        global selected_train_folder
        folder_path = app_data['file_path_name']
        selected_train_folder = folder_path
        dpg.set_value("train_folder_label", f"📂 {os.path.basename(folder_path)}")
        
        # Count images in the folder
        exts = ('.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff')
        count = 0
        if os.path.isdir(folder_path):
            for f in os.listdir(folder_path):
                if f.lower().endswith(exts):
                    count += 1
        dpg.set_value("train_count_label", f"Found {count} images")

    # Callback: Test image selected
    def on_test_image_selected(sender, app_data):
        global selected_test_image
        file_path = app_data['file_path_name']
        selected_test_image = file_path
        basename = os.path.basename(file_path)
        dpg.set_value("test_img_label", f"📄 {basename}")

        # Load and display image preview
        try:
            width, height, channels, data = dpg.load_image(file_path)
            if data is not None:
                if dpg.does_item_exist("test_preview_texture"):
                    dpg.delete_item("test_preview_texture")
                with dpg.texture_registry():
                    dpg.add_raw_texture(width=width, height=height, default_value=data, format=dpg.mvFormat_Float_rgba, tag="test_preview_texture")
                
                scale = min(280 / width, 180 / height, 1.0)
                display_w = int(width * scale)
                display_h = int(height * scale)
                dpg.configure_item("test_img_preview", texture_tag="test_preview_texture", width=display_w, height=display_h)
                dpg.configure_item("test_img_preview", show=True)
                dpg.set_value("test_img_info", f"Size: {width}x{height}px")
        except Exception as e:
            dpg.set_value("test_img_info", f"Error: {str(e)[:40]}")

    # Callback: Training YAML selected
    def on_yaml_selected(sender, app_data):
        file_path = app_data['file_path_name']
        basename = os.path.basename(file_path)
        dpg.set_value("yaml_path_label", f"📄 {basename}")

    # =============================================
    # File Dialogs
    # =============================================

    # Dialog: Select training data folder
    with dpg.file_dialog(
        directory_selector=True, show=False,
        callback=on_train_folder_selected, tag="train_folder_dialog",
        width=700, height=400
    ):
        pass

    # Dialog: Select test image
    with dpg.file_dialog(
        directory_selector=False, show=False,
        callback=on_test_image_selected, tag="test_image_dialog",
        width=700, height=400
    ):
        dpg.add_file_extension(".png", color=(0, 255, 0, 255))
        dpg.add_file_extension(".jpg", color=(0, 255, 0, 255))
        dpg.add_file_extension(".jpeg", color=(0, 255, 0, 255))
        dpg.add_file_extension(".bmp", color=(0, 255, 0, 255))
        dpg.add_file_extension(".*")

    # Dialog: Select dataset YAML config
    with dpg.file_dialog(
        directory_selector=False, show=False,
        callback=on_yaml_selected, tag="yaml_dialog",
        width=700, height=400
    ):
        dpg.add_file_extension(".yaml", color=(255, 255, 0, 255))
        dpg.add_file_extension(".yml", color=(255, 255, 0, 255))
        dpg.add_file_extension(".*")

    # =============================================
    # Main Window
    # =============================================
    with dpg.window(label="Robo Learn AI - YOLO Teaching UI", width=1200, height=800, no_collapse=True, no_close=True):
        
        dpg.add_text("YOLO Node Editor: Drag between pins to connect blocks. Adjust parameters inside each block.")
        dpg.add_text("Workflow: Input Data → Model → Train → Test with Image", color=[150, 200, 255])
        dpg.add_separator()

        with dpg.node_editor() as node_editor:

            # ==========================================
            # 1. Training Data Input (Folder / YAML)
            # ==========================================
            with dpg.node(label="📁 Training Data Input", pos=[30, 30]):
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Static):
                    dpg.add_text("Training Dataset Config:", color=[255, 200, 0])
                    
                    dpg.add_text("Dataset YAML:")
                    dpg.add_combo(items=["coco128.yaml", "coco8.yaml", "VOC.yaml", "Custom..."], 
                                  default_value="coco128.yaml", width=180, tag="dataset_yaml_combo")
                    dpg.add_button(label="📂 Browse YAML...", width=180, 
                                   callback=lambda: dpg.show_item("yaml_dialog"))
                    dpg.add_text("No custom YAML selected", tag="yaml_path_label", color=[180, 180, 180])
                    
                    dpg.add_separator()
                    dpg.add_text("Or select image folder directly:")
                    dpg.add_button(label="📂 Browse Training Folder...", width=180, 
                                   callback=lambda: dpg.show_item("train_folder_dialog"))
                    dpg.add_text("No folder selected", tag="train_folder_label", color=[180, 180, 180])
                    dpg.add_text("", tag="train_count_label", color=[100, 200, 255])
                
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Output):
                    dpg.add_text("Dataset →", color=[100, 255, 100])

            # ==========================================
            # 2. Model Selection Block
            # ==========================================
            with dpg.node(label="🧠 YOLO Model", pos=[30, 350]):
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Static):
                    dpg.add_text("Model Size:", color=[255, 200, 0])
                    dpg.add_combo(items=[
                        "YOLOv8n (Nano - Fast)", 
                        "YOLOv8s (Small)", 
                        "YOLOv8m (Medium)", 
                        "YOLOv8l (Large)", 
                        "YOLOv8x (Extra Large - Accurate)"
                    ], default_value="YOLOv8n (Nano - Fast)", width=200)
                    
                    dpg.add_text("Pretrained Weights:")
                    dpg.add_combo(items=["yolov8n.pt", "yolov8s.pt", "yolov8m.pt", "yolov8l.pt", "yolov8x.pt", "None (from scratch)"],
                                  default_value="yolov8n.pt", width=200)
                
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Output):
                    dpg.add_text("Model →", color=[100, 255, 100])

            # ==========================================
            # 3. Training Config Block
            # ==========================================
            with dpg.node(label="⚙️ Training Engine", pos=[350, 30]):
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Input):
                    dpg.add_text("← Dataset")
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Input):
                    dpg.add_text("← Model")
                
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Static):
                    dpg.add_separator()
                    dpg.add_text("Hyperparameters:", color=[255, 200, 0])
                    
                    dpg.add_text("Image Size (imgsz):")
                    dpg.add_slider_int(min_value=320, max_value=1280, default_value=640, width=200)
                    
                    dpg.add_text("Epochs:")
                    dpg.add_slider_int(min_value=1, max_value=500, default_value=100, width=200)
                    
                    dpg.add_text("Batch Size:")
                    dpg.add_combo(items=["2", "4", "8", "16", "32", "64"], default_value="16", width=200)

                    dpg.add_text("Learning Rate (lr0):")
                    dpg.add_input_float(default_value=0.01, step=0.001, width=200)

                    dpg.add_separator()
                    dpg.add_text("Data Augmentation:", color=[255, 200, 0])
                    dpg.add_checkbox(label="Enable Mosaic", default_value=True)
                    dpg.add_slider_float(label="Degrees (Rotate)", min_value=0.0, max_value=45.0, default_value=0.0, width=140)
                    dpg.add_slider_float(label="Translate (%)", min_value=0.0, max_value=0.9, default_value=0.1, width=140)
                    dpg.add_slider_float(label="Scale", min_value=0.0, max_value=0.9, default_value=0.5, width=140)
                    dpg.add_checkbox(label="Flip Left-Right", default_value=True)
                
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Static):
                    dpg.add_spacer(height=5)
                    dpg.add_button(label="🚀 START TRAINING", width=200, height=35)
                
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Output):
                    dpg.add_text("Trained Weights (.pt) →", color=[100, 255, 100])

            # ==========================================
            # 4. Test Image Input Block (NEW!)
            # ==========================================
            with dpg.node(label="🖼️ Test Image Input", pos=[700, 30]):
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Static):
                    dpg.add_text("Select image to test:", color=[255, 200, 0])
                    dpg.add_button(label="📂 Browse Test Image...", width=200, 
                                   callback=lambda: dpg.show_item("test_image_dialog"))
                    dpg.add_text("No image selected", tag="test_img_label", color=[180, 180, 180])
                    dpg.add_text("", tag="test_img_info", color=[100, 200, 255])
                    
                    dpg.add_separator()
                    dpg.add_text("Preview:", color=[255, 200, 0])
                    dpg.add_image("test_preview_texture", width=280, height=180, tag="test_img_preview", show=False)
                
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Output):
                    dpg.add_text("Test Image →", color=[100, 255, 100])

            # ==========================================
            # 5. Inference / Predict Block
            # ==========================================
            with dpg.node(label="👁️ Predict / Inference", pos=[700, 380]):
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Input):
                    dpg.add_text("← Trained Weights")
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Input):
                    dpg.add_text("← Test Image")
                
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Static):
                    dpg.add_separator()
                    dpg.add_text("Prediction Settings:", color=[255, 200, 0])
                    
                    dpg.add_text("Confidence Threshold:")
                    dpg.add_slider_float(min_value=0.01, max_value=1.00, default_value=0.25, width=200)
                    
                    dpg.add_text("IoU Threshold (NMS):")
                    dpg.add_slider_float(min_value=0.01, max_value=1.00, default_value=0.45, width=200)
                    
                    dpg.add_text("Image Size:")
                    dpg.add_slider_int(min_value=320, max_value=1280, default_value=640, width=200)
                    
                    dpg.add_separator()
                    dpg.add_text("Source Override:")
                    dpg.add_combo(items=["From Test Image Block", "Webcam (0)", "Video File"], 
                                  default_value="From Test Image Block", width=200)
                    
                    dpg.add_spacer(height=5)
                    dpg.add_button(label="👁️ RUN INFERENCE", width=200, height=35,
                                   callback=lambda: simulate_inference())
                
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Output):
                    dpg.add_text("Detection Results →", color=[100, 255, 100])
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Output):
                    dpg.add_text("Training Metrics →", color=[100, 255, 100])

            # ==========================================
            # 6. Detection Results Output
            #    (Class Label, Bounding Box, Probability Score, Inference Time)
            # ==========================================
            with dpg.node(label="📊 Detection Results", pos=[1050, 30]):
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Input):
                    dpg.add_text("← Detection Results")
                
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Static):
                    dpg.add_separator()
                    dpg.add_text("Detections:", color=[255, 200, 0])
                    
                    # Table header
                    with dpg.table(tag="det_table", header_row=True, borders_innerH=True, 
                                   borders_outerH=True, borders_innerV=True, borders_outerV=True,
                                   width=380):
                        dpg.add_table_column(label="Class Label", width_fixed=True, init_width_or_weight=90)
                        dpg.add_table_column(label="BBox (x,y,w,h)", width_fixed=True, init_width_or_weight=130)
                        dpg.add_table_column(label="Score", width_fixed=True, init_width_or_weight=50)

                        # Placeholder rows (will be updated by simulate_inference)
                        for i in range(5):
                            with dpg.table_row():
                                dpg.add_text("—", tag=f"det_class_{i}", color=[180, 180, 180])
                                dpg.add_text("—", tag=f"det_bbox_{i}", color=[180, 180, 180])
                                dpg.add_text("—", tag=f"det_score_{i}", color=[180, 180, 180])

                    dpg.add_separator()
                    dpg.add_text("⏱ Inference Time:", color=[255, 200, 0])
                    dpg.add_text("— ms", tag="inference_time_label", color=[0, 255, 200])
                    dpg.add_text("Total Detections: —", tag="total_det_label", color=[150, 200, 255])

            # ==========================================
            # 7. Training Metrics Output
            #    (mAP, Precision, Recall)
            # ==========================================
            with dpg.node(label="📈 Training Metrics (mAP)", pos=[1050, 350]):
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Input):
                    dpg.add_text("← Training Metrics")
                
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Static):
                    dpg.add_separator()
                    dpg.add_text("Evaluation Metrics:", color=[255, 200, 0])

                    with dpg.table(tag="metrics_table", header_row=True, borders_innerH=True,
                                   borders_outerH=True, borders_innerV=True, borders_outerV=True,
                                   width=300):
                        dpg.add_table_column(label="Metric", width_fixed=True, init_width_or_weight=130)
                        dpg.add_table_column(label="Value", width_fixed=True, init_width_or_weight=80)

                        metrics = [
                            ("mAP@50", "—"),
                            ("mAP@50-95", "—"),
                            ("Precision (P)", "—"),
                            ("Recall (R)", "—"),
                        ]
                        for idx, (name, val) in enumerate(metrics):
                            with dpg.table_row():
                                dpg.add_text(name, color=[200, 200, 255])
                                dpg.add_text(val, tag=f"metric_val_{idx}", color=[0, 255, 150])

                    dpg.add_separator()
                    dpg.add_text("Confusion Matrix (sample):", color=[255, 200, 0])
                    # Simple text-based confusion matrix grid  
                    with dpg.table(tag="conf_matrix", header_row=True, borders_innerH=True,
                                   borders_outerH=True, borders_innerV=True, borders_outerV=True,
                                   width=300):
                        dpg.add_table_column(label="Pred\\True", width_fixed=True, init_width_or_weight=70)
                        dpg.add_table_column(label="Cat", width_fixed=True, init_width_or_weight=50)
                        dpg.add_table_column(label="Dog", width_fixed=True, init_width_or_weight=50)
                        dpg.add_table_column(label="Car", width_fixed=True, init_width_or_weight=50)

                        cm_labels = ["Cat", "Dog", "Car"]
                        for r, label in enumerate(cm_labels):
                            with dpg.table_row():
                                dpg.add_text(label, color=[200, 200, 255])
                                for c in range(3):
                                    dpg.add_text("—", tag=f"cm_{r}_{c}", color=[180, 180, 180])

            # ==========================================
            # 8. Loss Curves Output
            # ==========================================
            with dpg.node(label="📉 Loss Curves", pos=[1450, 30]):
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Input):
                    dpg.add_text("← Training Data")
                
                with dpg.node_attribute(attribute_type=dpg.mvNode_Attr_Static):
                    dpg.add_separator()
                    dpg.add_text("Loss Values (per epoch):", color=[255, 200, 0])

                    with dpg.table(tag="loss_table", header_row=True, borders_innerH=True,
                                   borders_outerH=True, borders_innerV=True, borders_outerV=True,
                                   width=320):
                        dpg.add_table_column(label="Loss Type", width_fixed=True, init_width_or_weight=100)
                        dpg.add_table_column(label="Current", width_fixed=True, init_width_or_weight=70)
                        dpg.add_table_column(label="Best", width_fixed=True, init_width_or_weight=70)

                        loss_names = ["box_loss", "cls_loss", "dfl_loss", "total_loss"]
                        for idx, name in enumerate(loss_names):
                            with dpg.table_row():
                                dpg.add_text(name, color=[200, 200, 255])
                                dpg.add_text("—", tag=f"loss_cur_{idx}", color=[255, 150, 100])
                                dpg.add_text("—", tag=f"loss_best_{idx}", color=[100, 255, 150])

                    dpg.add_separator()
                    dpg.add_text("Training Progress:", color=[255, 200, 0])
                    dpg.add_text("Epoch: —/—", tag="epoch_progress_label", color=[150, 200, 255])
                    dpg.add_progress_bar(default_value=0.0, width=250, tag="epoch_progress_bar")
                    
                    dpg.add_spacer(height=5)
                    dpg.add_button(label="🔄 Load Demo Data", width=200, height=30,
                                   callback=lambda: simulate_training_metrics())

    # =============================================
    # Simulation Callbacks (Demo / Mock Data)
    # =============================================
    def simulate_inference():
        """Populate mock detection data when RUN INFERENCE is pressed."""
        import random
        classes = ["person", "car", "dog", "cat", "bicycle", "bus", "chair", "bottle"]
        num_det = random.randint(2, 5)
        for i in range(5):
            if i < num_det:
                cls = random.choice(classes)
                x = random.randint(10, 400)
                y = random.randint(10, 300)
                w = random.randint(30, 150)
                h = random.randint(30, 150)
                score = round(random.uniform(0.30, 0.99), 2)
                dpg.set_value(f"det_class_{i}", cls)
                dpg.configure_item(f"det_class_{i}", color=[255, 255, 255])
                dpg.set_value(f"det_bbox_{i}", f"({x},{y},{w},{h})")
                dpg.configure_item(f"det_bbox_{i}", color=[200, 200, 255])
                dpg.set_value(f"det_score_{i}", f"{score}")
                # Color score: green if high, orange if medium
                if score >= 0.7:
                    dpg.configure_item(f"det_score_{i}", color=[0, 255, 100])
                else:
                    dpg.configure_item(f"det_score_{i}", color=[255, 180, 50])
            else:
                dpg.set_value(f"det_class_{i}", "—")
                dpg.configure_item(f"det_class_{i}", color=[80, 80, 80])
                dpg.set_value(f"det_bbox_{i}", "—")
                dpg.configure_item(f"det_bbox_{i}", color=[80, 80, 80])
                dpg.set_value(f"det_score_{i}", "—")
                dpg.configure_item(f"det_score_{i}", color=[80, 80, 80])

        inf_time = round(random.uniform(5.0, 45.0), 1)
        dpg.set_value("inference_time_label", f"{inf_time} ms")
        dpg.set_value("total_det_label", f"Total Detections: {num_det}")

    def simulate_training_metrics():
        """Populate mock training metrics when Load Demo Data is pressed."""
        import random
        # mAP scores
        mock_metrics = [
            round(random.uniform(0.50, 0.95), 3),   # mAP@50
            round(random.uniform(0.30, 0.70), 3),   # mAP@50-95
            round(random.uniform(0.60, 0.95), 3),   # Precision
            round(random.uniform(0.55, 0.90), 3),   # Recall
        ]
        for idx, val in enumerate(mock_metrics):
            dpg.set_value(f"metric_val_{idx}", f"{val}")

        # Confusion matrix mock data
        for r in range(3):
            for c in range(3):
                if r == c:
                    val = random.randint(40, 95)
                    dpg.set_value(f"cm_{r}_{c}", str(val))
                    dpg.configure_item(f"cm_{r}_{c}", color=[0, 255, 100])
                else:
                    val = random.randint(0, 15)
                    dpg.set_value(f"cm_{r}_{c}", str(val))
                    dpg.configure_item(f"cm_{r}_{c}", color=[255, 100, 100])

        # Loss curves mock data
        loss_curs = [round(random.uniform(0.02, 0.15), 4) for _ in range(4)]
        loss_bests = [round(v * random.uniform(0.5, 0.9), 4) for v in loss_curs]
        for idx in range(4):
            dpg.set_value(f"loss_cur_{idx}", f"{loss_curs[idx]}")
            dpg.set_value(f"loss_best_{idx}", f"{loss_bests[idx]}")

        # Progress
        epoch_done = random.randint(50, 100)
        epoch_total = 100
        dpg.set_value("epoch_progress_label", f"Epoch: {epoch_done}/{epoch_total}")
        dpg.set_value("epoch_progress_bar", epoch_done / epoch_total)

    # Start
    dpg.create_viewport(title='Robo Learn AI - YOLO Node Editor', width=1600, height=900)
    dpg.setup_dearpygui()
    dpg.show_viewport()
    dpg.start_dearpygui()
    dpg.destroy_context()

if __name__ == "__main__":
    main()
