# AI/ML-Based Smart Fire and Smoke Detection System (Python / Flask Version)

## Serverless / Vercel Architecture (Under 500 MB)
- `requirements.txt` contains **only** lightweight web/HTTP dependencies (`Flask`, `Werkzeug`, `Pillow`, `requests` — under 25 MB total).
- Heavy local ML weights (`best.pt`, `ultralytics`, `torch`, `opencv-python`) are excluded via `.vercelignore` and `requirements-local.txt`.
- At runtime, `inference_service.py` routes frames to:
  1. `EXTERNAL_AI_ENDPOINT` (optional custom YOLO/ONNX REST API), or
  2. Gemini Vision REST API (`GEMINI_API_KEY`), or
  3. **Lazy-loaded** local `models/fire_detection_model/best.pt` weights when running locally outside Vercel.

## Setup Instructions in VS Code
1. Open the `fire_detection_system` folder in VS Code.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   - **Lightweight API mode (external Gemini / REST inference):**
     ```bash
     pip install -r requirements.txt
     ```
   - **Local YOLOv8 + OpenCV webcam mode (optional):**
     ```bash
     pip install -r requirements-local.txt
     ```
4. Initialize the SQLite database:
   ```bash
   python database/init_db.py
   ```
5. Set `GEMINI_API_KEY` (or `EXTERNAL_AI_ENDPOINT`), or optionally place local `best.pt` weights at `models/fire_detection_model/best.pt`.
6. Start the Flask server:
   ```bash
   python app.py
   ```
7. Open `http://127.0.0.1:5000` in your browser.
