# AI/ML Model Placement Guide

## Serverless / Vercel Mode (Default)
Do **not** commit `best.pt`, `torch`, or `ultralytics` into `requirements.txt` for Vercel deployments — `.vercelignore` excludes `*.pt` / `*.onnx` weights so the serverless bundle stays well below Vercel's 500 MB limit. Set `GEMINI_API_KEY` or `EXTERNAL_AI_ENDPOINT` in your environment variables for remote AI inference.

## Local VS Code YOLOv8 Mode (Optional)
For offline local execution in VS Code:
1. Install local ML dependencies:
   ```bash
   pip install -r requirements-local.txt
   ```
2. Place your trained YOLOv8 weights at:
   `models/fire_detection_model/best.pt`
3. `inference_service.py` will lazily import `ultralytics` and load `best.pt` on first local inference request (never eagerly at startup or in Vercel serverless environments).
4. If neither an external AI endpoint nor local `best.pt` weights are available, the app fails safely with an explicit `AI MODEL NOT LOADED` warning rather than using color-threshold guesses.
