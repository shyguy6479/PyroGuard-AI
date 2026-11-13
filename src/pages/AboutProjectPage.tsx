import React from 'react';
import { Layers, Cpu, ShieldAlert, Database, Terminal, FolderTree } from 'lucide-react';

export const AboutProjectPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Project Overview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
        <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
          AI/ML-Based Smart Fire and Smoke Detection System
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          An intelligent computer-vision safety monitoring system built for B.Tech engineering demonstration. It detects open flames and early smoke plumes across live webcam feeds, uploaded images, and recorded videos, filters transient noise using multi-frame persistence, triggers an audible &amp; visual emergency alarm with cooldown protection, and logs every incident with a screenshot into a persistent database.
        </p>
      </div>

      {/* Simple Viva Workflow Explanation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-orange-600" />
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            How the AI/ML Pipeline Works (Viva Explanation Guide)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-mono text-xs font-semibold text-orange-600">Step 1 · Capture</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Frame Acquisition
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Webcam, image upload, or video stream is sampled into RGB image frames at fixed intervals.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-mono text-xs font-semibold text-orange-600">Step 2 · Inference</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Real AI Vision Model
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Gemini 3.1 Flash Lite Vision (with Gemini 4 Hydrogen fallback) predicts bounding boxes [ymin, xmin, ymax, xmax], class labels (Fire or Smoke), and real confidence scores.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-mono text-xs font-semibold text-orange-600">Step 3 · Filter</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Strict Allowlist &amp; Threshold
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Only &lsquo;fire&rsquo; and &lsquo;smoke&rsquo; predictions &ge; 75% confidence pass; alerts trigger only after 5 consecutive verified frames.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="font-mono text-xs font-semibold text-orange-600">Step 4 · Respond</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Fail-Safe Alert &amp; Logging
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Fails safely if model is unavailable; otherwise plays siren with cooldown protection, saves screenshot, and logs incident.
            </p>
          </div>
        </div>
      </div>

      {/* Viva Questions & Project Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-600" />
            <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Key Concepts for Project Viva
            </h3>
          </div>
          <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <li>
              <strong className="text-slate-900 dark:text-white">Why Genuine AI Vision Over Color Thresholds?</strong>{' '}
              Pixel-color rules confuse red shirts, wall switchboards, skin tones, and warm lights with fire. A trained multimodal AI model understands scene context and only localizes genuine flames and smoke.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-white">What is Confidence Threshold (&ge; 75%)?</strong>{' '}
              A strict probability cutoff requiring &ge; 0.75 model confidence before a prediction is accepted, rejecting ambiguous background textures.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-white">How does 5-Frame Verification help?</strong>{' '}
              Alerts and incident logging trigger only after 5 consecutive valid frames confirm Fire or Smoke, immediately resetting to 0 if a frame clears.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-white">Why Fail-Safe Model Status?</strong>{' '}
              If the AI model is disabled or unreachable, the UI explicitly displays &ldquo;AI MODEL NOT LOADED&rdquo; rather than generating synthetic or fallback alerts.
            </li>
          </ul>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-orange-600" />
            <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Included Python + Flask + YOLOv8 Folder
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Alongside this live web application, the workspace includes the complete Python/Flask/SQLite reference directory at <code className="font-mono text-orange-600">/fire_detection_system/</code> for local VS Code submission:
          </p>
          <pre className="p-3.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
{`fire_detection_system/
├── app.py                  # Flask + OpenCV + YOLOv8 server
├── requirements.txt        # Python dependencies
├── README.md               # VS Code setup guide
├── models/fire_detection_model/
│   └── MODEL_README.md     # Place best.pt weights here
├── database/
│   └── init_db.py          # SQLite schema initializer
├── templates/              # HTML pages (dashboard, live, history...)
└── static/                 # CSS & JavaScript polling`}
          </pre>
        </div>
      </div>

      {/* Local VS Code Execution */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-orange-600" />
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Running the Python Flask Version Locally in VS Code
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-1">
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-orange-600" /> 1. Virtual Environment
            </div>
            <code className="block font-mono text-[11px] text-slate-700 dark:text-slate-200">
              cd fire_detection_system &amp;&amp; python -m venv venv &amp;&amp; pip install -r requirements.txt
            </code>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-1">
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-orange-600" /> 2. Place YOLOv8 Weights
            </div>
            <code className="block font-mono text-[11px] text-slate-700 dark:text-slate-200">
              models/fire_detection_model/best.pt (OpenCV HSV fallback runs automatically if omitted)
            </code>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-1">
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-orange-600" /> 3. Launch Flask App
            </div>
            <code className="block font-mono text-[11px] text-slate-700 dark:text-slate-200">
              python database/init_db.py &amp;&amp; python app.py
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
