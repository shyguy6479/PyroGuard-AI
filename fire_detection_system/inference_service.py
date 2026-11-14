"""
Lightweight Fire & Smoke AI Inference Service
- Serverless-ready (zero top-level PyTorch/Ultralytics/OpenCV imports)
- Uses external AI inference endpoints (custom EXTERNAL_AI_ENDPOINT or Gemini Vision REST API)
- Optional lazy-loaded local YOLOv8 (models/fire_detection_model/best.pt) for local VS Code execution only
- Strict allowlist ('fire' | 'smoke'), >= 0.75 confidence, and fail-safe error handling
"""

from __future__ import annotations

import base64
import importlib
import importlib.util
import io
import json
import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import requests
from PIL import Image, ImageDraw

ALLOWED_CLASSES = {"fire", "smoke"}
MIN_CONFIDENCE_THRESHOLD = 0.75

PRIMARY_GEMINI_MODEL = "gemini-3.1-flash-lite"
FALLBACK_GEMINI_MODEL = "gemini-4-hydrogen"

MODEL_UNAVAILABLE_MESSAGE = (
    "⚠ AI MODEL NOT LOADED – Live fire and smoke detection is unavailable."
)

_yolo_lock = threading.Lock()
_lazy_yolo_model: Any = None
_lazy_yolo_attempted = False
_model_cooldown_until: Dict[str, float] = {
    PRIMARY_GEMINI_MODEL: 0.0,
    FALLBACK_GEMINI_MODEL: 0.0,
}


class ModelUnavailableError(RuntimeError):
    """Raised when no real AI model or external inference endpoint is available."""


def is_vercel_runtime() -> bool:
    return bool(os.environ.get("VERCEL"))


def normalize_and_filter_detections(
    raw_detections: Optional[List[Dict[str, Any]]],
    conf_threshold: float = MIN_CONFIDENCE_THRESHOLD,
    image_width: int = 1,
    image_height: int = 1,
) -> List[Dict[str, Any]]:
    """
    Strictly validates AI detections:
    1. Label normalized to lowercase must be exactly 'fire' or 'smoke'.
    2. Confidence must be >= max(0.75, conf_threshold).
    3. Bounding box coordinates must have positive width and height.
    """
    if not raw_detections:
        return []

    effective_min = max(MIN_CONFIDENCE_THRESHOLD, float(conf_threshold))
    valid: List[Dict[str, Any]] = []

    for det in raw_detections:
        if not isinstance(det, dict):
            continue
        raw_label = det.get("label") or det.get("class") or ""
        norm_label = str(raw_label).strip().lower()
        if norm_label not in ALLOWED_CLASSES:
            continue

        raw_conf = det.get("confidence")
        if raw_conf is None:
            continue
        try:
            conf_float = float(raw_conf)
        except (TypeError, ValueError):
            continue
        conf_ratio = conf_float / 100.0 if conf_float > 1.0 else conf_float
        if conf_ratio < effective_min:
            continue

        bbox = det.get("bbox")
        if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
            x1, y1, x2, y2 = [int(round(float(v))) for v in bbox]
        elif all(k in det for k in ("ymin", "xmin", "ymax", "xmax")):
            # Normalized 0..1000 Gemini coordinates
            x1 = int(round(max(0.0, min(1.0, float(det["xmin"]) / 1000.0)) * image_width))
            y1 = int(round(max(0.0, min(1.0, float(det["ymin"]) / 1000.0)) * image_height))
            x2 = int(round(max(0.0, min(1.0, float(det["xmax"]) / 1000.0)) * image_width))
            y2 = int(round(max(0.0, min(1.0, float(det["ymax"]) / 1000.0)) * image_height))
        else:
            continue

        if x2 <= x1 or y2 <= y1:
            continue

        safe_w = max(1, int(image_width))
        safe_h = max(1, int(image_height))
        norm_x = max(0.0, min(1.0, x1 / float(safe_w)))
        norm_y = max(0.0, min(1.0, y1 / float(safe_h)))
        norm_w = max(0.0, min(1.0, (x2 - x1) / float(safe_w)))
        norm_h = max(0.0, min(1.0, (y2 - y1) / float(safe_h)))
        if norm_w <= 0.0 or norm_h <= 0.0:
            continue

        valid.append(
            {
                "id": f"ai-{norm_label}-{len(valid) + 1}",
                "label": "Fire" if norm_label == "fire" else "Smoke",
                "confidence": min(100.0, round(conf_ratio * 100.0, 1)),
                "bbox": [x1, y1, x2, y2],
                "x": round(norm_x, 4),
                "y": round(norm_y, 4),
                "width": round(norm_w, 4),
                "height": round(norm_h, 4),
            }
        )

    return valid


def _get_lazy_local_yolo(model_path: str) -> Any:
    """
    Lazily imports ultralytics and loads local best.pt weights ONLY when:
    - Not running in a Vercel serverless container
    - Weight file actually exists on disk
    - ultralytics is installed in the local environment
    """
    global _lazy_yolo_model, _lazy_yolo_attempted
    if is_vercel_runtime():
        return None
    if not os.path.exists(model_path):
        return None

    with _yolo_lock:
        if _lazy_yolo_model is not None:
            return _lazy_yolo_model
        if _lazy_yolo_attempted:
            return None
        _lazy_yolo_attempted = True
        try:
            ultralytics_mod = importlib.import_module("ultralytics")
            yolo_cls = getattr(ultralytics_mod, "YOLO", None)
            if yolo_cls is None:
                return None
            _lazy_yolo_model = yolo_cls(model_path)
            return _lazy_yolo_model
        except Exception:
            return None


def get_model_status(model_path: str, enabled: bool = True) -> Dict[str, Any]:
    """Reports active inference mode without eagerly loading heavy weights."""
    if not enabled:
        return {
            "model_loaded": False,
            "modelLoaded": False,
            "modelEnabled": False,
            "mode": "disabled",
            "model_name": "Disabled by Operator",
            "modelName": "Disabled by Operator",
            "modelType": "Multimodal / YOLOv8 Vision AI",
            "modelVersion": "disabled",
            "supportedClasses": ["Fire", "Smoke"],
            "statusMessage": MODEL_UNAVAILABLE_MESSAGE,
            "errorReason": "AI model disabled by operator.",
            "message": MODEL_UNAVAILABLE_MESSAGE,
        }
    if os.environ.get("EXTERNAL_AI_ENDPOINT"):
        return {
            "model_loaded": True,
            "modelLoaded": True,
            "modelEnabled": True,
            "mode": "external_endpoint",
            "model_name": "External Fire/Smoke AI API",
            "modelName": "External Fire/Smoke AI API",
            "modelType": "External Inference Service",
            "modelVersion": "external-api",
            "supportedClasses": ["Fire", "Smoke"],
            "statusMessage": "AI Model: Loaded and Ready",
        }
    if os.environ.get("GEMINI_API_KEY"):
        return {
            "model_loaded": True,
            "modelLoaded": True,
            "modelEnabled": True,
            "mode": "external_gemini_vision",
            "model_name": f"Gemini Vision ({PRIMARY_GEMINI_MODEL})",
            "modelName": f"Gemini Vision ({PRIMARY_GEMINI_MODEL})",
            "modelType": "Multimodal Vision AI",
            "modelVersion": PRIMARY_GEMINI_MODEL,
            "supportedClasses": ["Fire", "Smoke"],
            "statusMessage": "AI Model: Loaded and Ready",
        }
    if not is_vercel_runtime() and os.path.exists(model_path):
        try:
            if importlib.util.find_spec("ultralytics") is not None:
                return {
                    "model_loaded": True,
                    "modelLoaded": True,
                    "modelEnabled": True,
                    "mode": "local_yolo_lazy",
                    "model_name": "YOLOv8 Local Weights (Lazy-Loaded)",
                    "modelName": "YOLOv8 Fire & Smoke Model (YOLOv8)",
                    "modelType": "Object Detection CNN",
                    "modelVersion": "yolov8-best.pt",
                    "supportedClasses": ["Fire", "Smoke"],
                    "statusMessage": "AI Model: Loaded and Ready",
                }
        except Exception:
            pass
    return {
        "model_loaded": False,
        "modelLoaded": False,
        "modelEnabled": True,
        "mode": "unavailable",
        "model_name": "Unavailable",
        "modelName": "Unavailable",
        "modelType": "Multimodal / YOLOv8 Vision AI",
        "modelVersion": "unavailable",
        "supportedClasses": ["Fire", "Smoke"],
        "statusMessage": MODEL_UNAVAILABLE_MESSAGE,
        "errorReason": "No external AI endpoint, Gemini key, or local best.pt weights configured.",
        "message": MODEL_UNAVAILABLE_MESSAGE,
    }


def _call_custom_external_endpoint(
    image_bytes: bytes, mime_type: str, conf_threshold: float, width: int, height: int
) -> List[Dict[str, Any]]:
    endpoint = os.environ["EXTERNAL_AI_ENDPOINT"].strip()
    headers = {"Content-Type": "application/json"}
    api_key = os.environ.get("EXTERNAL_AI_API_KEY", "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    b64 = base64.b64encode(image_bytes).decode("ascii")
    resp = requests.post(
        endpoint,
        headers=headers,
        json={"imageBase64": b64, "mimeType": mime_type, "threshold": conf_threshold * 100},
        timeout=25,
    )
    if resp.status_code >= 400:
        raise ModelUnavailableError(
            f"External inference endpoint returned HTTP {resp.status_code}."
        )
    payload = resp.json()
    raw = payload.get("detections", []) if isinstance(payload, dict) else []
    return normalize_and_filter_detections(raw, conf_threshold, width, height)


def _call_gemini_vision_rest(
    image_bytes: bytes, mime_type: str, conf_threshold: float, width: int, height: int
) -> List[Dict[str, Any]]:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ModelUnavailableError(MODEL_UNAVAILABLE_MESSAGE)

    b64 = base64.b64encode(image_bytes).decode("ascii")
    prompt = (
        "You are a strict industrial fire and smoke object detection model. "
        "Inspect the image ONLY for actual burning fire flames or actual smoke plumes. "
        "NEVER classify people, faces, skin tones, red clothing, switchboards, walls, "
        "furniture, or ceiling lights as fire or smoke. "
        'Allowed labels are strictly "fire" or "smoke". '
        "Return JSON matching schema with confidence in 0.0..1.0 and 0..1000 [ymin, xmin, ymax, xmax]. "
        'If safe, return {"detections": []}.'
    )

    body = {
        "contents": [
            {
                "parts": [
                    {"inline_data": {"mime_type": mime_type, "data": b64}},
                    {"text": prompt},
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "detections": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "label": {"type": "STRING"},
                                "confidence": {"type": "NUMBER"},
                                "ymin": {"type": "NUMBER"},
                                "xmin": {"type": "NUMBER"},
                                "ymax": {"type": "NUMBER"},
                                "xmax": {"type": "NUMBER"},
                            },
                            "required": ["label", "confidence", "ymin", "xmin", "ymax", "xmax"],
                        },
                    }
                },
                "required": ["detections"],
            },
        },
    }

    now = time.time()
    candidates = [
        m
        for m in (PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL)
        if now >= _model_cooldown_until.get(m, 0.0)
    ]
    if not candidates:
        candidates = [PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]

    last_err = ""
    for model_id in candidates:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model_id}:generateContent?key={api_key}"
        )
        try:
            resp = requests.post(url, json=body, timeout=25)
            if resp.status_code == 429:
                _model_cooldown_until[model_id] = time.time() + 20.0
                last_err = f"{model_id} rate-limited (429)"
                continue
            if resp.status_code >= 400:
                last_err = f"{model_id} returned HTTP {resp.status_code}"
                continue

            data = resp.json()
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "{}")
            )
            parsed = json.loads(text)
            raw = parsed.get("detections", []) if isinstance(parsed, dict) else []
            return normalize_and_filter_detections(raw, conf_threshold, width, height)
        except Exception as exc:
            last_err = str(exc)

    raise ModelUnavailableError(f"{MODEL_UNAVAILABLE_MESSAGE} ({last_err})")


def annotate_image_bytes(
    image_bytes: bytes, detections: List[Dict[str, Any]]
) -> bytes:
    """Draws bounding boxes onto image bytes using lightweight Pillow (zero OpenCV)."""
    with Image.open(io.BytesIO(image_bytes)) as img:
        rgb = img.convert("RGB")
        draw = ImageDraw.Draw(rgb)
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            is_fire = det["label"].lower() == "fire"
            color = (220, 38, 38) if is_fire else (217, 119, 6)
            draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
            tag = f"{det['label'].upper()} {det['confidence']}%"
            tag_top = max(0, y1 - 22)
            draw.rectangle([x1, tag_top, x1 + max(110, len(tag) * 7 + 12), y1], fill=color)
            draw.text((x1 + 6, tag_top + 4), tag, fill=(255, 255, 255))

        out = io.BytesIO()
        rgb.save(out, format="JPEG", quality=88)
        return out.getvalue()


def detect_image_bytes(
    image_bytes: bytes,
    model_path: str,
    conf_threshold: float = MIN_CONFIDENCE_THRESHOLD,
    mime_type: str = "image/jpeg",
) -> Tuple[bytes, List[Dict[str, Any]]]:
    """
    Runs real AI fire/smoke detection on raw image bytes:
    1. Prefers EXTERNAL_AI_ENDPOINT if configured.
    2. Otherwise uses Gemini Vision REST API when GEMINI_API_KEY is set.
    3. Locally (non-Vercel) falls back to lazy-loaded YOLOv8 best.pt if installed.
    Never generates synthetic or color-threshold detections.
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        width, height = img.size

    if os.environ.get("EXTERNAL_AI_ENDPOINT"):
        detections = _call_custom_external_endpoint(
            image_bytes, mime_type, conf_threshold, width, height
        )
    elif os.environ.get("GEMINI_API_KEY"):
        detections = _call_gemini_vision_rest(
            image_bytes, mime_type, conf_threshold, width, height
        )
    else:
        yolo_model = _get_lazy_local_yolo(model_path)
        if yolo_model is None:
            raise ModelUnavailableError(MODEL_UNAVAILABLE_MESSAGE)
        with Image.open(io.BytesIO(image_bytes)) as img:
            results = yolo_model(img.convert("RGB"), conf=max(MIN_CONFIDENCE_THRESHOLD, conf_threshold), verbose=False)
        raw: List[Dict[str, Any]] = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                label = yolo_model.names.get(cls_id, "")
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                raw.append({"label": label, "confidence": conf, "bbox": [x1, y1, x2, y2]})
        detections = normalize_and_filter_detections(raw, conf_threshold, width, height)

    annotated_bytes = annotate_image_bytes(image_bytes, detections)
    return annotated_bytes, detections
