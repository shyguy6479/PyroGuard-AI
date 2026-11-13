"""
AI/ML-Based Smart Fire and Smoke Detection System
Flask + OpenCV + YOLOv8 + SQLite Backend
"""

import os
import csv
import io
import time
import smtplib
import sqlite3
from email.message import EmailMessage
from datetime import datetime
import cv2
import numpy as np
from flask import (
    Flask,
    render_template,
    Response,
    request,
    redirect,
    url_for,
    jsonify,
    send_file,
)
from werkzeug.utils import secure_filename

# Optional YOLOv8 import (falls back cleanly to OpenCV HSV detection if weights are absent)
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database", "fire_detection.db")
MODEL_PATH = os.path.join(BASE_DIR, "models", "fire_detection_model", "best.pt")
INCIDENT_IMG_DIR = os.path.join(BASE_DIR, "saved_incidents", "detected_images")
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
os.makedirs(INCIDENT_IMG_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Detection & Alert Configuration
CONFIDENCE_THRESHOLD = 0.70
PERSISTENCE_FRAMES_REQUIRED = 5
ALERT_COOLDOWN_SECONDS = 15

# Global state for live monitoring
system_state = {
    "status": "normal",  # normal | smoke_warning | fire_emergency
    "last_confidence": 0.0,
    "consecutive_frames": 0,
    "last_alert_time": 0.0,
}

# Load YOLOv8 Model if available
yolo_model = None
if YOLO_AVAILABLE and os.path.exists(MODEL_PATH):
    yolo_model = YOLO(MODEL_PATH)
    print(f"Loaded YOLOv8 model from {MODEL_PATH}")
else:
    print("YOLOv8 best.pt not found — using OpenCV HSV Fire/Smoke Computer Vision fallback.")


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_code TEXT UNIQUE NOT NULL,
            timestamp TEXT NOT NULL,
            detection_type TEXT NOT NULL,
            confidence REAL NOT NULL,
            screenshot_path TEXT NOT NULL,
            source TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Active',
            email_sent INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()


init_db()


def send_email_alert(recipient, detection_type, confidence, timestamp, image_path):
    """
    Sends an email alert with incident screenshot attached via SMTP.
    Configure SMTP_USER and SMTP_PASS environment variables for live email sending.
    """
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
                    f.read(), maintype="image", subtype="jpeg", filename=os.path.basename(image_path)
                )
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(smtp_user, smtp_pass)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        print(f"Email alert error: {exc}")
        return False


def detect_fire_and_smoke(frame, conf_threshold=CONFIDENCE_THRESHOLD):
    """
    Runs YOLOv8 inference when weights exist, or OpenCV HSV contour analysis as fallback.
    Returns (annotated_frame, detections_list).
    """
    annotated = frame.copy()
    detections = []

    if yolo_model is not None:
        results = yolo_model(frame, conf=conf_threshold, verbose=False)
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                label = yolo_model.names.get(cls_id, "Fire")
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                detections.append({
                    "label": label,
                    "confidence": round(conf * 100, 1),
                    "bbox": [x1, y1, x2, y2],
                })
    else:
        # OpenCV HSV Fire + Smoke fallback
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        fire_mask = cv2.inRange(hsv, np.array([0, 110, 175]), np.array([28, 255, 255]))
        smoke_mask = cv2.inRange(hsv, np.array([0, 0, 115]), np.array([180, 42, 220]))

        for label, mask, min_area in [("Fire", fire_mask, 900), ("Smoke", smoke_mask, 2400)]:
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area >= min_area:
                    x, y, w, h = cv2.boundingRect(cnt)
                    conf = min(98.0, round(62.0 + (area / (frame.shape[0] * frame.shape[1])) * 120.0, 1))
                    if conf >= conf_threshold * 100:
                        detections.append({
                            "label": label,
                            "confidence": conf,
                            "bbox": [x, y, x + w, y + h],
                        })

    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        color = (38, 38, 220) if det["label"].lower() == "fire" else (6, 119, 217)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)
        tag = f"{det['label'].upper()} {det['confidence']}%"
        cv2.rectangle(annotated, (x1, max(0, y1 - 26)), (x1 + 170, y1), color, -1)
        cv2.putText(annotated, tag, (x1 + 6, max(16, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

    return annotated, detections


def record_incident(frame, detections, source="Live Camera"):
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
    cv2.imwrite(save_path, frame)

    rel_path = f"saved_incidents/detected_images/{filename}"
    email_sent = 1 if send_email_alert("safety-officer@example.com", det_type, max_conf, timestamp, save_path) else 0

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
    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        return
    try:
        while True:
            success, frame = camera.read()
            if not success:
                break
            annotated, detections = detect_fire_and_smoke(frame)

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
                    record_incident(annotated, detections, "Live Camera")
            else:
                system_state["consecutive_frames"] = 0
                system_state["status"] = "normal"

            ret, buffer = cv2.imencode(".jpg", annotated)
            if not ret:
                continue
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
            )
    finally:
        camera.release()


@app.route("/")
def dashboard():
    conn = get_db_connection()
    incidents = conn.execute("SELECT * FROM incidents ORDER BY id DESC LIMIT 6").fetchall()
    total = conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
    fires = conn.execute("SELECT COUNT(*) FROM incidents WHERE detection_type LIKE '%Fire%'").fetchone()[0]
    smokes = conn.execute("SELECT COUNT(*) FROM incidents WHERE detection_type LIKE '%Smoke%'").fetchone()[0]
    conn.close()
    return render_template("dashboard.html", incidents=incidents, total=total, fires=fires, smokes=smokes, state=system_state)


@app.route("/live")
def live_detection():
    return render_template("live_detection.html", state=system_state)


@app.route("/video_feed")
def video_feed():
    return Response(generate_camera_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/api/status")
def api_status():
    return jsonify(system_state)


@app.route("/image", methods=["GET", "POST"])
def image_detection():
    result = None
    if request.method == "POST":
        file = request.files.get("image")
        if file and file.filename:
            filename = secure_filename(file.filename)
            orig_path = os.path.join(UPLOAD_DIR, filename)
            file.save(orig_path)

            img = cv2.imread(orig_path)
            if img is not None:
                annotated, detections = detect_fire_and_smoke(img)
                out_name = f"det_{filename}"
                out_path = os.path.join(UPLOAD_DIR, out_name)
                cv2.imwrite(out_path, annotated)
                if detections:
                    record_incident(annotated, detections, "Image Upload")
                result = {
                    "original": f"static/uploads/{filename}",
                    "annotated": f"static/uploads/{out_name}",
                    "detections": detections,
                }
    return render_template("image_detection.html", result=result)


@app.route("/video", methods=["GET", "POST"])
def video_detection():
    summary = None
    if request.method == "POST":
        file = request.files.get("video")
        if file and file.filename:
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
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                total_frames += 1
                annotated, detections = detect_fire_and_smoke(frame)
                if any(d["label"].lower() == "fire" for d in detections):
                    fire_frames += 1
                if any(d["label"].lower() == "smoke" for d in detections):
                    smoke_frames += 1
                writer.write(annotated)
            cap.release()
            writer.release()
            summary = {
                "video_url": f"static/uploads/{out_name}",
                "total_frames": total_frames,
                "fire_frames": fire_frames,
                "smoke_frames": smoke_frames,
            }
    return render_template("video_detection.html", summary=summary)


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
    writer.writerow(["Incident Code", "Timestamp", "Type", "Confidence (%)", "Source", "Status", "Email Sent"])
    for r in rows:
        writer.writerow([r["incident_code"], r["timestamp"], r["detection_type"], r["confidence"], r["source"], r["status"], "Yes" if r["email_sent"] else "No"])

    mem = io.BytesIO(output.getvalue().encode("utf-8"))
    return send_file(mem, mimetype="text/csv", as_attachment=True, download_name="fire_detection_report.csv")


@app.route("/analytics")
def analytics():
    conn = get_db_connection()
    total = conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
    fires = conn.execute("SELECT COUNT(*) FROM incidents WHERE detection_type LIKE '%Fire%'").fetchone()[0]
    smokes = conn.execute("SELECT COUNT(*) FROM incidents WHERE detection_type LIKE '%Smoke%'").fetchone()[0]
    conn.close()
    return render_template("analytics.html", total=total, fires=fires, smokes=smokes)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
