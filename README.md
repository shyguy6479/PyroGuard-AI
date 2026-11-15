# 🔥 PyroGuard AI — Intelligent Fire & Smoke Detection System

<p align="center">
  <strong>AI-Powered Fire Detection • Real-Time Monitoring • Intelligent Alerts</strong>
</p>

<p align="center">
  <a href="https://pyro-guard-ai-psi.vercel.app/">Live Demo</a> •
  <a href="https://github.com/shyguy6479/PyroGuard-AI">GitHub Repository</a>
</p>

---

## 🚀 Overview

**PyroGuard AI** is an AI-powered fire and smoke detection and incident monitoring platform designed to improve fire safety through intelligent visual analysis.

The system leverages multimodal Vision AI to identify potential fire and smoke hazards from visual inputs, analyze detection confidence, and generate structured incident records.

Unlike conventional fire alarm systems that rely primarily on physical sensors, PyroGuard AI explores AI-driven visual monitoring to support early hazard identification and centralized incident management.

The platform provides a monitoring dashboard where users can track incidents, review detection history, configure alert settings, and export incident reports.

## ✨ Key Features

### 🔍 AI-Powered Fire & Smoke Detection
- Multimodal Vision AI using Google's Gemini API.
- Identifies fire and smoke in submitted visual inputs.
- Supports structured detection results.
- Provides confidence scores and detection bounding boxes.
- Includes fallback model handling.

### 📹 Multiple Detection Sources
- Live camera monitoring.
- Image upload and analysis.
- Video stream-based monitoring.

### 🚨 Intelligent Alert Management
- Configurable detection confidence threshold.
- Consecutive-frame persistence configuration.
- Alert cooldown settings.
- Alarm enable/disable controls.
- Email alert configuration and alert logs.

### 📊 Incident Management Dashboard
- Centralized incident monitoring.
- Incident timestamps and confidence scores.
- Fire, smoke, and combined detection categories.
- Incident status tracking:
  - Active
  - Acknowledged
  - Resolved
  - False Alarm
- Incident notes and saved detection snapshots.

### 📁 Reporting & Analytics
- Historical incident records.
- Incident image snapshots.
- CSV report export.
- Email alert activity logs.

### ⚙️ System Monitoring
- Backend health endpoint.
- AI model availability status.
- Model enable/disable controls.
- Configurable safety thresholds.

## 🧠 Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React 19, TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js |
| AI / Vision | Google Gemini API |
| AI SDK | Google GenAI SDK |
| Animations | Motion |
| Icons | Lucide React |
| Deployment | Vercel |
| Data Storage | JSON-based persistence |

## 🏗️ System Architecture

```text
          Visual Input
               |
       +-------+-------+
       |       |       |
     Camera  Image   Video
       |       |       |
       +-------+-------+
               |
               v
       PyroGuard AI Backend
          (Express.js)
               |
               v
       Gemini Vision AI
               |
               v
       Fire & Smoke Analysis
               |
        +------+------+
        |             |
     Detection    Confidence
        |             |
        +------+------+
               |
               v
       Incident Processing
               |
       +-------+--------+
       |       |        |
    Dashboard Alerts  Incident
                      Records
       |       |        |
       +-------+--------+
               |
               v
       Monitoring & Reports
```

## ⚙️ Getting Started

### Prerequisites

Make sure you have installed:

- Node.js (LTS recommended)
- npm
- Git
- Google Gemini API key

### 1. Clone the Repository

```bash
git clone https://github.com/shyguy6479/PyroGuard-AI.git
```

### 2. Navigate to the Project

```bash
cd PyroGuard-AI
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory.

```env
GEMINI_API_KEY=your_gemini_api_key
ALLOWED_ORIGINS=http://localhost:5173
```

Replace `your_gemini_api_key` with your actual Gemini API key.

Never expose your API key in frontend code or commit environment files containing secrets.

### 5. Start the Development Server

```bash
npm run dev
```

Open the local application using the URL displayed in your terminal.

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Backend and AI model health |
| GET | `/api/incidents` | Retrieve incident records |
| POST | `/api/incidents` | Create an incident |
| PATCH | `/api/incidents/:id` | Update incident status |
| DELETE | `/api/incidents/:id` | Delete an incident |
| GET | `/api/incidents/export/csv` | Export incident report |
| PUT | `/api/settings` | Update alert settings |
| POST | `/api/alerts/test-email` | Test email alert logging |
| POST | `/api/model/status` | Enable or disable AI model |

## 🌐 Live Deployment

Experience PyroGuard AI:

**https://pyro-guard-ai-psi.vercel.app/**

The application is deployed using Vercel.

## 🔐 Environment & Security

- Keep API credentials on the server.
- Configure permitted frontend origins using `ALLOWED_ORIGINS`.
- Avoid committing `.env.local` or other secret files.
- Use appropriate access controls before exposing administrative endpoints publicly.
- Configure persistent storage for production incident records.

**Deployment note:** The current backend uses filesystem-based JSON storage and temporary storage paths on Vercel. Data written to temporary serverless storage should not be considered permanently persistent. A production deployment should use a persistent database and object storage.

## 🔮 Future Enhancements

- Dedicated real-time object detection models.
- Improved continuous CCTV monitoring.
- Multi-camera monitoring and centralized control.
- SMS and WhatsApp emergency notifications.
- Cloud-based incident database.
- Geolocation-based incident tracking.
- Advanced fire-risk analytics.
- Automated emergency response integrations.

## ⚠️ Disclaimer

PyroGuard AI is an AI-assisted fire and smoke monitoring project intended for research, demonstration, and safety-support purposes. AI-generated detections may contain false positives or false negatives. It is not a replacement for certified fire alarms, smoke detectors, emergency response systems, or professional safety equipment.

## 👨‍💻 Author

**Abhiram Vikash Karamala**

AI & Machine Learning Engineering Student

- GitHub: https://github.com/shyguy6479

---

<p align="center">
  <strong>PyroGuard AI</strong>
  <br/>
  Building smarter fire safety through Artificial Intelligence.
  <br/><br/>
  ⭐ If you find this project interesting, consider giving the repository a star!
</p>
