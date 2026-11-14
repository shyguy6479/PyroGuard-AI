"""
AI/ML-Based Smart Fire and Smoke Detection System
Lightweight Flask Backend (Serverless-Compatible + Optional Lazy Local YOLOv8)
"""

import base64
import csv
import importlib
import io
import json
import os
import smtplib
import sqlite3
import time
from datetime import datetime
from email.message import EmailMessage

from flask import (
    Flask,
    Response,
    jsonify,
    render_template,
    request,
    send_file,
    send_from_directory,
)
from werkzeug.utils import secure_filename

from inference_service import (
    MIN_CONFIDENCE_THRESHOLD,
    MODEL_UNAVAILABLE_MESSAGE,
    ModelUnavailableError,
    detect_image_bytes,
    get_model_status,
    is_vercel_runtime,
)

app = Flask(__name__)

ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()
]


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if not ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = "*"
    elif origin and origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    return response


@app.route("/api/<path:_subpath>", methods=["OPTIONS"])
def api_preflight(_subpath):
    return ("", 204)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WRITE_BASE = "/tmp/pyroguard_flask" if is_vercel_runtime() else BASE_DIR
DB_PATH = os.path.join(WRITE_BASE, "database", "fire_detection.db")
MODEL_PATH = os.path.join(BASE_DIR, "models", "fire_detection_model", "best.pt")
INCIDENT_IMG_DIR = os.path.join(WRITE_BASE, "saved_incidents", "detected_images")
UPLOAD_DIR = os.path.join(WRITE_BASE, "static", "uploads")
SETTINGS_PATH = os.path.join(WRITE_BASE, "database", "settings.json")

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
os.makedirs(INCIDENT_IMG_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Detection & Alert Configuration
CONFIDENCE_THRESHOLD = MIN_CONFIDENCE_THRESHOLD  # 0.75 strict minimum
PERSISTENCE_FRAMES_REQUIRED = 5
ALERT_COOLDOWN_SECONDS = 15

# Global state for live monitoring
system_state = {
    "status": "normal",  # normal | smoke_warning | fire_emergency
    "last_confidence": 0.0,
    "consecutive_frames": 0,
    "last_alert_time": 0.0,
    "model_enabled": True,
}


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_code TEXT UNIQUE NOT NULL,
            timestamp TEXT NOT NULL,
            detection_type TEXT NOT NULL,
            confidence REAL NOT NULL,
            screenshot_path TEXT NOT NULL,
            source TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Active',
            email_sent INTEGER NOT NULL DEFAULT 0,
            notes TEXT DEFAULT ''
        )
        """
    )
    try:
        conn.execute("ALTER TABLE incidents ADD COLUMN notes TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()


init_db()


def read_settings():
    defaults = {
        "confidenceThreshold": 75,
        "persistenceFrames": 5,
        "cooldownSeconds": 15,
        "alarmEnabled": False,
        "emailAlertsEnabled": True,
        "alertEmail": "safety-officer@campus-lab.edu",
    }
    if os.path.exists(SETTINGS_PATH):
        try:
            with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                defaults.update(data)
        except Exception:
            pass
    defaults["confidenceThreshold"] = max(75, int(defaults.get("confidenceThreshold", 75)))
    defaults["persistenceFrames"] = max(5, int(defaults.get("persistenceFrames", 5)))
    return defaults


def write_settings(updated):
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(updated, f, indent=2)


def send_email_alert(recipient, detection_type, confidence, timestamp, image_path):
    """Sends an email alert when SMTP_USER and SMTP_PASS environment variables are configured."""
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    if not smtp_user or not smtp_pass:
        print(f"[EMAIL DEMO] Alert prepared for {recipient}: {detection_type} ({confidence}%)")
        return False

    try:
        msg = EmailMessage()
        msg["Subject"] = f"EMERGENCY ALERT: {detection_type} Detected ({confidence}%)"
        msg["From"] = smtp_user
        msg["To"] = recipient
        msg.set_content(
            f"Smart Fire & Smoke Detection Alert\n\n"
            f"Type: {detection_type}\n"
            f"Confidence: {confidence}%\n"
            f"Time: {timestamp}\n"
        )
        if os.path.exists(image_path):
            with open(image_path, "rb") as f:
                msg.add_attachment(
                    f.read(),
                    maintype="image",
                    subtype="jpeg",
                    filename=os.path.basename(image_path),
                )
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(smtp_user, smtp_pass)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        print(f"Email alert error: {exc}")
        return False


def record_incident(annotated_bytes, detections, source="Live Camera"):
    if not detections:
        return None
    has_fire = any(d["label"].lower() == "fire" for d in detections)
    has_smoke = any(d["label"].lower() == "smoke" for d in detections)
    det_type = "Fire & Smoke" if (has_fire and has_smoke) else ("Fire" if has_fire else "Smoke")
    max_conf = max(d["confidence"] for d in detections)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    code = f"INC-{int(time.time())}"
    filename = f"{code}.jpg"
    save_path = os.path.join(INCIDENT_IMG_DIR, filename)
    with open(save_path, "wb") as f:
        f.write(annotated_bytes)

    rel_path = f"saved_incidents/detected_images/{filename}"
    email_sent = (
        1
        if send_email_alert(
            "safety-officer@example.com", det_type, max_conf, timestamp, save_path
        )
        else 0
    )

    conn = get_db_connection()
    conn.execute(
        """
        INSERT INTO incidents (incident_code, timestamp, detection_type, confidence, screenshot_path, source, status, email_sent)
        VALUES (?, ?, ?, ?, ?, ?, 'Active', ?)
        """,
        (code, timestamp, det_type, max_conf, rel_path, source, email_sent),
    )
    conn.commit()
    conn.close()
    return code


def generate_camera_frames():
    """Local-only webcam streaming loop (lazily imports cv2 only when invoked)."""
    try:
        cv2 = importlib.import_module("cv2")
    except ImportError:
        return

    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        return
    try:
        while True:
            success, frame = camera.read()
            if not success:
                break
            ok, encoded = cv2.imencode(".jpg", frame)
            if not ok:
                continue
            try:
                annotated_bytes, detections = detect_image_bytes(
                    encoded.tobytes(), MODEL_PATH, CONFIDENCE_THRESHOLD, "image/jpeg"
                )
            except ModelUnavailableError:
                system_state["consecutive_frames"] = 0
                system_state["status"] = "normal"
                annotated_bytes = encoded.tobytes()
                detections = []

            if detections:
                system_state["consecutive_frames"] += 1
                system_state["last_confidence"] = max(d["confidence"] for d in detections)
                has_fire = any(d["label"].lower() == "fire" for d in detections)
                system_state["status"] = "fire_emergency" if has_fire else "smoke_warning"

                now = time.time()
                if (
                    system_state["consecutive_frames"] >= PERSISTENCE_FRAMES_REQUIRED
                    and now - system_state["last_alert_time"] >= ALERT_COOLDOWN_SECONDS
                ):
                    system_state["last_alert_time"] = now
                    record_incident(annotated_bytes, detections, "Live Camera")
            else:
                system_state["consecutive_frames"] = 0
                system_state["status"] = "normal"

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + annotated_bytes + b"\r\n"
            )
    finally:
        camera.release()


@app.route("/")
def dashboard():
    conn = get_db_connection()
    incidents = conn.execute("SELECT * FROM incidents ORDER BY id DESC LIMIT 6").fetchall()
    total = conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
    fires = conn.execute(
        "SELECT COUNT(*) FROM incidents WHERE detection_type LIKE '%Fire%'"
    ).fetchone()[0]
    smokes = conn.execute(
        "SELECT COUNT(*) FROM incidents WHERE detection_type LIKE '%Smoke%'"
    ).fetchone()[0]
    conn.close()
    return render_template(
        "dashboard.html",
        incidents=incidents,
        total=total,
        fires=fires,
        smokes=smokes,
        state=system_state,
        model_status=get_model_status(MODEL_PATH),
    )


@app.route("/live")
def live_detection():
    return render_template(
        "live_detection.html",
        state=system_state,
        model_status=get_model_status(MODEL_PATH),
    )


@app.route("/video_feed")
def video_feed():
    return Response(
        generate_camera_frames(), mimetype="multipart/x-mixed-replace; boundary=frame"
    )


@app.route("/saved_incidents/detected_images/<path:filename>")
def serve_incident_image(filename):
    return send_from_directory(INCIDENT_IMG_DIR, filename)


@app.route("/api/status")
def api_status():
    return jsonify({**system_state, "model": get_model_status(MODEL_PATH, system_state["model_enabled"])})


@app.route("/api/health")
def api_health():
    status = get_model_status(MODEL_PATH, system_state["model_enabled"])
    return jsonify({"ok": True, "geminiConfigured": status["modelLoaded"], **status})


@app.route("/api/model/status", methods=["POST"])
def api_model_status():
    payload = request.get_json(silent=True) or {}
    enabled = payload.get("enabled")
    if not isinstance(enabled, bool):
        return jsonify({"error": 'Boolean "enabled" flag is required.'}), 400
    system_state["model_enabled"] = enabled
    return jsonify(get_model_status(MODEL_PATH, enabled))


@app.route("/api/incidents", methods=["GET", "POST"])
def api_incidents():
    if request.method == "GET":
        conn = get_db_connection()
        rows = conn.execute("SELECT * FROM incidents ORDER BY id DESC").fetchall()
        conn.close()
        incidents = [
            {
                "id": r["incident_code"],
                "timestamp": r["timestamp"],
                "detectionType": r["detection_type"],
                "confidence": round(float(r["confidence"])),
                "screenshotUrl": "/" + r["screenshot_path"].lstrip("/"),
                "status": r["status"],
                "source": r["source"],
                "emailSent": bool(r["email_sent"]),
                "notes": r["notes"] if "notes" in r.keys() else "",
            }
            for r in rows
        ]
        return jsonify({"incidents": incidents, "settings": read_settings(), "emailLogs": []})

    payload = request.get_json(silent=True) or {}
    det_type = payload.get("detectionType")
    confidence = payload.get("confidence")
    if not det_type or not isinstance(confidence, (int, float)):
        return jsonify({"error": "detectionType and numeric confidence are required."}), 400

    code = f"INC-{int(time.time())}-{int((time.time() % 1) * 1000):03d}"
    timestamp = datetime.utcnow().isoformat() + "Z"
    source = payload.get("source") or "Live Camera"
    notes = payload.get("notes") or ""
    screenshot_b64 = payload.get("screenshotDataUrl", "")
    filename = f"{code}.jpg"
    save_path = os.path.join(INCIDENT_IMG_DIR, filename)
    if isinstance(screenshot_b64, str) and "," in screenshot_b64:
        try:
            with open(save_path, "wb") as f:
                f.write(base64.b64decode(screenshot_b64.split(",", 1)[1]))
        except Exception:
            pass
    rel_path = f"saved_incidents/detected_images/{filename}"

    conn = get_db_connection()
    conn.execute(
        """
        INSERT INTO incidents (incident_code, timestamp, detection_type, confidence, screenshot_path, source, status, email_sent, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'Active', 0, ?)
        """,
        (code, timestamp, det_type, float(confidence), rel_path, source, notes),
    )
    conn.commit()
    conn.close()
    return (
        jsonify(
            {
                "incident": {
                    "id": code,
                    "timestamp": timestamp,
                    "detectionType": det_type,
                    "confidence": round(float(confidence)),
                    "screenshotUrl": f"/{rel_path}",
                    "status": "Active",
                    "source": source,
                    "emailSent": False,
                    "notes": notes,
                },
                "emailLogs": [],
            }
        ),
        201,
    )


@app.route("/api/incidents/<incident_code>", methods=["PATCH", "DELETE"])
def api_incident_detail(incident_code):
    conn = get_db_connection()
    if request.method == "DELETE":
        cur = conn.execute("DELETE FROM incidents WHERE incident_code = ?", (incident_code,))
        conn.commit()
        conn.close()
        if cur.rowcount == 0:
            return jsonify({"error": "Incident not found."}), 404
        return jsonify({"deleted": True, "id": incident_code})

    payload = request.get_json(silent=True) or {}
    new_status = payload.get("status")
    if not new_status:
        conn.close()
        return jsonify({"error": "Status is required."}), 400
    conn.execute("UPDATE incidents SET status = ? WHERE incident_code = ?", (new_status, incident_code))
    conn.commit()
    row = conn.execute("SELECT * FROM incidents WHERE incident_code = ?", (incident_code,)).fetchone()
    conn.close()
    if row is None:
        return jsonify({"error": "Incident not found."}), 404
    return jsonify(
        {
            "incident": {
                "id": row["incident_code"],
                "timestamp": row["timestamp"],
                "detectionType": row["detection_type"],
                "confidence": round(float(row["confidence"])),
                "screenshotUrl": "/" + row["screenshot_path"].lstrip("/"),
                "status": row["status"],
                "source": row["source"],
                "emailSent": bool(row["email_sent"]),
                "notes": row["notes"] if "notes" in row.keys() else "",
            }
        }
    )


@app.route("/api/settings", methods=["PUT"])
def api_settings():
    current = read_settings()
    payload = request.get_json(silent=True) or {}
    current.update(payload)
    current["confidenceThreshold"] = max(75, int(current.get("confidenceThreshold", 75)))
    current["persistenceFrames"] = max(5, int(current.get("persistenceFrames", 5)))
    write_settings(current)
    return jsonify({"settings": current})


@app.route("/api/alerts/test-email", methods=["POST"])
def api_test_email():
    payload = request.get_json(silent=True) or {}
    recipient = payload.get("recipient") or read_settings().get("alertEmail", "safety-officer@campus-lab.edu")
    return jsonify(
        {
            "emailLogs": [
                {
                    "id": f"MAIL-{int(time.time())}",
                    "incidentId": "TEST-ALERT",
                    "recipient": recipient,
                    "subject": "[TEST] PyroGuard AI Alert Dispatch",
                    "sentAt": datetime.utcnow().isoformat() + "Z",
                    "detectionType": "Fire",
                    "confidence": 100,
                    "status": "Logged (SMTP Demo)",
                }
            ]
        }
    )


@app.route("/api/detect", methods=["POST"])
def api_detect():
    """Serverless / WSGI JSON inference endpoint delegating to YOLOv8, external API, or Gemini Vision."""
    status = get_model_status(MODEL_PATH, system_state["model_enabled"])
    if not system_state["model_enabled"]:
        return jsonify({**status, "modelLoaded": False, "error": MODEL_UNAVAILABLE_MESSAGE, "detections": []}), 503

    file = request.files.get("image")
    image_bytes = None
    mime_type = "image/jpeg"
    threshold_ratio = CONFIDENCE_THRESHOLD

    if file and file.filename:
        image_bytes = file.read()
        mime_type = file.mimetype or "image/jpeg"
    elif request.is_json:
        payload = request.get_json(silent=True) or {}
        b64_raw = payload.get("imageBase64", "")
        mime_type = payload.get("mimeType", "image/jpeg")
        req_thresh = payload.get("threshold")
        if isinstance(req_thresh, (int, float)):
            ratio = float(req_thresh) / 100.0 if float(req_thresh) > 1.0 else float(req_thresh)
            threshold_ratio = max(CONFIDENCE_THRESHOLD, ratio)
        if b64_raw:
            b64_clean = b64_raw.split(",", 1)[-1]
            image_bytes = base64.b64decode(b64_clean)

    if not image_bytes:
        return jsonify({"error": "Image file or imageBase64 payload is required."}), 400

    start_ms = time.time()
    try:
        _, detections = detect_image_bytes(
            image_bytes, MODEL_PATH, threshold_ratio, mime_type
        )
        return jsonify(
            {
                **status,
                "model_loaded": True,
                "modelLoaded": True,
                "detections": detections,
                "inferenceMs": int((time.time() - start_ms) * 1000),
                "engine": status.get("modelName", "PyroGuard AI"),
            }
        )
    except ModelUnavailableError as exc:
        return (
            jsonify(
                {
                    **status,
                    "model_loaded": False,
                    "modelLoaded": False,
                    "error": str(exc) or MODEL_UNAVAILABLE_MESSAGE,
                    "detections": [],
                }
            ),
            503,
        )


@app.route("/image", methods=["GET", "POST"])
def image_detection():
    result = None
    error_message = None
    if request.method == "POST":
        file = request.files.get("image")
        if file and file.filename:
            filename = secure_filename(file.filename)
            raw_bytes = file.read()
            orig_path = os.path.join(UPLOAD_DIR, filename)
            with open(orig_path, "wb") as f:
                f.write(raw_bytes)

            try:
                annotated_bytes, detections = detect_image_bytes(
                    raw_bytes,
                    MODEL_PATH,
                    CONFIDENCE_THRESHOLD,
                    file.mimetype or "image/jpeg",
                )
                out_name = f"det_{filename}.jpg"
                out_path = os.path.join(UPLOAD_DIR, out_name)
                with open(out_path, "wb") as f:
                    f.write(annotated_bytes)
                if detections:
                    record_incident(annotated_bytes, detections, "Image Upload")
                result = {
                    "original": f"static/uploads/{filename}",
                    "annotated": f"static/uploads/{out_name}",
                    "detections": detections,
                }
            except ModelUnavailableError as exc:
                error_message = str(exc) or MODEL_UNAVAILABLE_MESSAGE

    return render_template(
        "image_detection.html",
        result=result,
        error_message=error_message,
        model_status=get_model_status(MODEL_PATH),
    )


@app.route("/video", methods=["GET", "POST"])
def video_detection():
    summary = None
    error_message = None
    if request.method == "POST":
        file = request.files.get("video")
        if file and file.filename:
            try:
                cv2 = importlib.import_module("cv2")
            except ImportError:
                return (
                    render_template(
                        "video_detection.html",
                        summary=None,
                        error_message="Video transcoding via OpenCV is available in local mode (requirements-local.txt), not in the lightweight serverless bundle.",
                        model_status=get_model_status(MODEL_PATH),
                    ),
                    400,
                )

            filename = secure_filename(file.filename)
            in_path = os.path.join(UPLOAD_DIR, filename)
            out_name = f"processed_{filename}.mp4"
            out_path = os.path.join(UPLOAD_DIR, out_name)
            file.save(in_path)

            cap = cv2.VideoCapture(in_path)
            fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            writer = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

            fire_frames, smoke_frames, total_frames = 0, 0, 0
            try:
                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        break
                    total_frames += 1
                    ok, encoded = cv2.imencode(".jpg", frame)
                    if not ok:
                        continue
                    annotated_bytes, detections = detect_image_bytes(
                        encoded.tobytes(), MODEL_PATH, CONFIDENCE_THRESHOLD, "image/jpeg"
                    )
                    if any(d["label"].lower() == "fire" for d in detections):
                        fire_frames += 1
                    if any(d["label"].lower() == "smoke" for d in detections):
                        smoke_frames += 1
                    np_mod = importlib.import_module("numpy")
                    arr = np_mod.frombuffer(annotated_bytes, np_mod.uint8)
                    dec = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if dec is not None:
                        writer.write(dec)
            except ModelUnavailableError as exc:
                error_message = str(exc) or MODEL_UNAVAILABLE_MESSAGE
            finally:
                cap.release()
                writer.release()

            if not error_message:
                summary = {
                    "video_url": f"static/uploads/{out_name}",
                    "total_frames": total_frames,
                    "fire_frames": fire_frames,
                    "smoke_frames": smoke_frames,
                }

    return render_template(
        "video_detection.html",
        summary=summary,
        error_message=error_message,
        model_status=get_model_status(MODEL_PATH),
    )


@app.route("/history")
def history():
    q = request.args.get("q", "").strip()
    det_filter = request.args.get("type", "All")
    conn = get_db_connection()
    query = "SELECT * FROM incidents WHERE 1=1"
    params = []
    if q:
        query += " AND (incident_code LIKE ? OR source LIKE ? OR status LIKE ?)"
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    if det_filter != "All":
        query += " AND detection_type LIKE ?"
        params.append(f"%{det_filter}%")
    query += " ORDER BY id DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return render_template("history.html", incidents=rows, q=q, det_filter=det_filter)


@app.route("/export_csv")
def export_csv():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM incidents ORDER BY id DESC").fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Incident Code",
            "Timestamp",
            "Type",
            "Confidence (%)",
            "Source",
            "Status",
            "Email Sent",
        ]
    )
    for r in rows:
        writer.writerow(
            [
                r["incident_code"],
                r["timestamp"],
                r["detection_type"],
                r["confidence"],
                r["source"],
                r["status"],
                "Yes" if r["email_sent"] else "No",
            ]
        )

    mem = io.BytesIO(output.getvalue().encode("utf-8"))
    return send_file(
        mem,
        mimetype="text/csv",
        as_attachment=True,
        download_name="fire_detection_report.csv",
    )


@app.route("/analytics")
def analytics():
    conn = get_db_connection()
    total = conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
    fires = conn.execute(
        "SELECT COUNT(*) FROM incidents WHERE detection_type LIKE '%Fire%'"
    ).fetchone()[0]
    smokes = conn.execute(
        "SELECT COUNT(*) FROM incidents WHERE detection_type LIKE '%Smoke%'"
    ).fetchone()[0]
    conn.close()
    return render_template("analytics.html", total=total, fires=fires, smokes=smokes)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
