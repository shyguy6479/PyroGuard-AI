# AI/ML Model Placement Guide

Place your trained YOLOv8 weights file inside this directory:

    models/fire_detection_model/best.pt

## How to Obtain or Train `best.pt`
1. Download a pre-trained YOLOv8 Fire & Smoke dataset from Roboflow Universe or Kaggle (classes: `Fire`, `Smoke`).
2. Train with Ultralytics CLI:
   ```bash
   yolo task=detect mode=train model=yolov8n.pt data=fire_smoke.yaml epochs=50 imgsz=640
   ```
3. Copy `runs/detect/train/weights/best.pt` to `models/fire_detection_model/best.pt`.

Note: If `best.pt` is not yet placed in this folder, `app.py` automatically uses an HSV/BGR OpenCV flame & smoke fallback detector so you can still test the application immediately!
