"""
create_test_dataset.py - Build a Roboflow-format ZIP for upload testing
Usage: python create_test_dataset.py
Output: test_roboflow_dataset.zip
"""
import os, shutil, zipfile
from pathlib import Path

try:
    import yaml
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyyaml"])
    import yaml

DEST = Path("test_roboflow_dataset")
CLASSES = ["person", "bicycle", "car", "motorcycle", "bus", "truck"]

def make_dummy_labels(img_dir, label_dir):
    label_dir.mkdir(parents=True, exist_ok=True)
    imgs = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png"))
    for img_path in imgs:
        label_path = label_dir / (img_path.stem + ".txt")
        with open(label_path, "w") as f:
            f.write("0 0.5 0.5 0.4 0.4\n")
            f.write("2 0.2 0.3 0.15 0.2\n")

def get_coco8_path():
    print("[*] Looking for COCO8 images...")
    try:
        from ultralytics.utils import DATASETS_DIR
        from ultralytics.data.utils import check_det_dataset
        import io, contextlib
        with contextlib.redirect_stdout(io.StringIO()):
            check_det_dataset('coco8.yaml')
        p = DATASETS_DIR / 'coco8'
        if p.exists():
            print("[OK] Found COCO8 at:", p)
            return p
    except Exception as e:
        print("[WARN] Could not load COCO8:", e)
    return None

def build():
    if DEST.exists():
        shutil.rmtree(DEST)

    coco8 = get_coco8_path()

    for split in ["train", "valid"]:
        img_dir = DEST / split / "images"
        lbl_dir = DEST / split / "labels"
        img_dir.mkdir(parents=True, exist_ok=True)

        if coco8:
            src = coco8 / "images" / ("val" if split == "valid" else split)
            if src.exists():
                for f in list(src.iterdir())[:10]:
                    shutil.copy(f, img_dir / f.name)
                print(f"[OK] {split}: copied {len(list(img_dir.iterdir()))} images")
            else:
                print(f"[WARN] No source for {split}")

        make_dummy_labels(img_dir, lbl_dir)
        print(f"     labels: {len(list(lbl_dir.iterdir()))}")

    data = {"path": ".", "train": "train/images", "val": "valid/images",
            "nc": len(CLASSES), "names": CLASSES}
    with open(DEST / "data.yaml", "w") as f:
        yaml.dump(data, f, default_flow_style=False)
    print("[OK] data.yaml written:", CLASSES)

    zip_name = "test_roboflow_dataset.zip"
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file in DEST.rglob("*"):
            if file.is_file():
                zf.write(file, file.relative_to(DEST.parent))
    shutil.rmtree(DEST)

    mb = os.path.getsize(zip_name) / 1024 / 1024
    print(f"\n[DONE] {zip_name} ({mb:.2f} MB)")
    print("[INFO] Upload this file to the 'Roboflow Export' block in the UI")

if __name__ == "__main__":
    build()
