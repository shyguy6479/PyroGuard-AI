import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

type DetectionClass = 'Fire' | 'Smoke';
type IncidentStatus = 'Active' | 'Acknowledged' | 'Resolved' | 'False Alarm';
type IncidentSource = 'Live Camera' | 'Image Upload' | 'Video Stream';
type IncidentDetectionType = 'Fire' | 'Smoke' | 'Fire & Smoke';

interface BoundingBox {
  id: string;
  label: DetectionClass;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface IncidentRecord {
  id: string;
  timestamp: string;
  detectionType: IncidentDetectionType;
  confidence: number;
  screenshotUrl: string;
  status: IncidentStatus;
  source: IncidentSource;
  emailSent: boolean;
  emailRecipient?: string;
  notes?: string;
}

interface AlertSettings {
  confidenceThreshold: number;
  persistenceFrames: number;
  cooldownSeconds: number;
  alarmEnabled: boolean;
  emailAlertsEnabled: boolean;
  alertEmail: string;
}

interface EmailDispatchLog {
  id: string;
  incidentId: string;
  recipient: string;
  subject: string;
  sentAt: string;
  detectionType: IncidentDetectionType;
  confidence: number;
  status: 'Dispatched' | 'Logged (SMTP Demo)';
}

interface DatabaseSchema {
  incidents: IncidentRecord[];
  settings: AlertSettings;
  emailLogs: EmailDispatchLog[];
}

const ROOT_DIR = process.cwd();
const DB_DIR = path.join(ROOT_DIR, 'database');
const DB_FILE = path.join(DB_DIR, 'fire_detection.json');
const IMAGES_DIR = path.join(ROOT_DIR, 'saved_incidents', 'detected_images');

fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

// Minimal pure-Node PNG generator for seeded historical incident thumbnails
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generateSeedSnapshotPng(mode: 'fire' | 'smoke' | 'both'): Buffer {
  const width = 240;
  const height = 160;
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      let r = 28;
      let g = 34;
      let b = 44;

      if (y > 108) {
        r = 22;
        g = 26;
        b = 34;
      }

      // Draw smoke plume in upper middle
      if (mode === 'smoke' || mode === 'both') {
        const dx = (x - 122) / 56;
        const dy = (y - 48) / 28;
        const dist = dx * dx + dy * dy;
        if (dist < 1) {
          const blend = 1 - dist;
          r = Math.round(r * (1 - blend) + 168 * blend);
          g = Math.round(g * (1 - blend) + 172 * blend);
          b = Math.round(b * (1 - blend) + 180 * blend);
        }
      }

      // Draw flame region in lower center
      if (mode === 'fire' || mode === 'both') {
        const dx = (x - 118) / 36;
        const dy = (y - 102) / 30;
        const dist = dx * dx + dy * dy;
        if (dist < 1) {
          r = 248;
          g = dist < 0.35 ? 204 : 92;
          b = dist < 0.35 ? 58 : 20;
        }
      }

      // Draw crisp bounding box border
      const boxLeft = 72;
      const boxRight = 168;
      const boxTop = mode === 'smoke' ? 18 : 66;
      const boxBottom = mode === 'smoke' ? 80 : 134;
      const onVert =
        (x === boxLeft || x === boxLeft + 1 || x === boxRight || x === boxRight - 1) &&
        y >= boxTop &&
        y <= boxBottom;
      const onHoriz =
        (y === boxTop || y === boxTop + 1 || y === boxBottom || y === boxBottom - 1) &&
        x >= boxLeft &&
        x <= boxRight;
      if (onVert || onHoriz) {
        if (mode === 'smoke') {
          r = 217;
          g = 119;
          b = 6;
        } else {
          r = 220;
          g = 38;
          b = 38;
        }
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createInitialDatabase(): DatabaseSchema {
  const now = Date.now();
  const dayMs = 86400 * 1000;

  const seeds: Array<{
    id: string;
    daysAgo: number;
    hoursOffset: number;
    type: IncidentDetectionType;
    confidence: number;
    status: IncidentStatus;
    source: IncidentSource;
    mode: 'fire' | 'smoke' | 'both';
    notes: string;
  }> = [
    {
      id: 'INC-1006',
      daysAgo: 0,
      hoursOffset: 2,
      type: 'Fire & Smoke',
      confidence: 94,
      status: 'Acknowledged',
      source: 'Live Camera',
      mode: 'both',
      notes: 'Warehouse Bay A pallet zone ignition detected across 4 consecutive frames.',
    },
    {
      id: 'INC-1005',
      daysAgo: 1,
      hoursOffset: 5,
      type: 'Smoke',
      confidence: 83,
      status: 'Resolved',
      source: 'Live Camera',
      mode: 'smoke',
      notes: 'Electrical panel ventilation duct smoke plume; power isolated and cleared.',
    },
    {
      id: 'INC-1004',
      daysAgo: 2,
      hoursOffset: 3,
      type: 'Fire',
      confidence: 91,
      status: 'Resolved',
      source: 'Video Stream',
      mode: 'fire',
      notes: 'Uploaded CCTV archive verification clip — loading dock flare.',
    },
    {
      id: 'INC-1003',
      daysAgo: 3,
      hoursOffset: 7,
      type: 'Smoke',
      confidence: 76,
      status: 'False Alarm',
      source: 'Live Camera',
      mode: 'smoke',
      notes: 'Steam vent release near boiler corridor; marked false alarm after inspection.',
    },
    {
      id: 'INC-1002',
      daysAgo: 4,
      hoursOffset: 4,
      type: 'Fire',
      confidence: 89,
      status: 'Resolved',
      source: 'Image Upload',
      mode: 'fire',
      notes: 'Controlled lab fire drill test image verified against threshold 55%.',
    },
    {
      id: 'INC-1001',
      daysAgo: 5,
      hoursOffset: 6,
      type: 'Smoke',
      confidence: 81,
      status: 'Resolved',
      source: 'Video Stream',
      mode: 'smoke',
      notes: 'Early smoke detection benchmark footage from Sector B.',
    },
  ];

  const incidents: IncidentRecord[] = seeds.map((s) => {
    const filename = `${s.id}.png`;
    const filePath = path.join(IMAGES_DIR, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, generateSeedSnapshotPng(s.mode));
    }
    const ts = new Date(now - s.daysAgo * dayMs - s.hoursOffset * 3600 * 1000).toISOString();
    return {
      id: s.id,
      timestamp: ts,
      detectionType: s.type,
      confidence: s.confidence,
      screenshotUrl: `/saved_incidents/detected_images/${filename}`,
      status: s.status,
      source: s.source,
      emailSent: s.type.includes('Fire'),
      emailRecipient: s.type.includes('Fire') ? 'safety-officer@campus-lab.edu' : undefined,
      notes: s.notes,
    };
  });

  return {
    incidents,
    settings: {
      confidenceThreshold: 75,
      persistenceFrames: 5,
      cooldownSeconds: 15,
      alarmEnabled: false,
      emailAlertsEnabled: true,
      alertEmail: 'safety-officer@campus-lab.edu',
    },
    emailLogs: [
      {
        id: 'MAIL-501',
        incidentId: 'INC-1006',
        recipient: 'safety-officer@campus-lab.edu',
        subject: '[EMERGENCY] Fire & Smoke Detected (94% confidence) - INC-1006',
        sentAt: incidents[0].timestamp,
        detectionType: 'Fire & Smoke',
        confidence: 94,
        status: 'Logged (SMTP Demo)',
      },
    ],
  };
}

function readDatabase(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    // Enforce minimum safe threshold >= 75% and >= 5 consecutive frames
    if (
      parsed.settings &&
      (parsed.settings.confidenceThreshold < 75 || parsed.settings.persistenceFrames < 5)
    ) {
      parsed.settings.confidenceThreshold = Math.max(75, parsed.settings.confidenceThreshold || 75);
      parsed.settings.persistenceFrames = Math.max(5, parsed.settings.persistenceFrames || 5);
      writeDatabase(parsed);
    }
    return parsed;
  } catch {
    const fallback = createInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function writeDatabase(db: DatabaseSchema): void {
  const tempPath = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tempPath, DB_FILE);
}

function saveBase64Screenshot(incidentId: string, dataUrl: string): string {
  const matches = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(dataUrl);
  if (!matches) {
    const filename = `${incidentId}.png`;
    fs.writeFileSync(path.join(IMAGES_DIR, filename), generateSeedSnapshotPng('fire'));
    return `/saved_incidents/detected_images/${filename}`;
  }
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const filename = `${incidentId}.${ext}`;
  const buffer = Buffer.from(matches[2], 'base64');
  fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);
  return `/saved_incidents/detected_images/${filename}`;
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use('/saved_incidents', express.static(path.join(ROOT_DIR, 'saved_incidents')));

const AI_MODEL_NAME = 'Gemini 3.1 Flash Lite Vision';
const AI_MODEL_TYPE = 'Multimodal Vision AI';
const AI_MODEL_VERSION = 'gemini-3.1-flash-lite';
const FALLBACK_AI_MODEL_NAME = 'Gemini 4 Hydrogen Vision';
const FALLBACK_AI_MODEL_VERSION = 'gemini-4-hydrogen';
const SUPPORTED_CLASSES: DetectionClass[] = ['Fire', 'Smoke'];
const MODEL_UNAVAILABLE_MESSAGE = '⚠ AI MODEL UNAVAILABLE – REAL-TIME DETECTION IS DISABLED';

const modelCooldownUntil: Record<string, number> = {
  [AI_MODEL_VERSION]: 0,
  [FALLBACK_AI_MODEL_VERSION]: 0,
};
let activeModelVersion = AI_MODEL_VERSION;
let modelEnabled = true;
let lastModelError = '';

function getModelDisplayName(modelId: string): string {
  return modelId === FALLBACK_AI_MODEL_VERSION ? FALLBACK_AI_MODEL_NAME : AI_MODEL_NAME;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getAvailableModelVersions(): string[] {
  const now = Date.now();
  const ordered =
    activeModelVersion === FALLBACK_AI_MODEL_VERSION
      ? [FALLBACK_AI_MODEL_VERSION, AI_MODEL_VERSION]
      : [AI_MODEL_VERSION, FALLBACK_AI_MODEL_VERSION];
  return ordered.filter((m) => now >= (modelCooldownUntil[m] || 0));
}

function isModelLoaded(): boolean {
  return modelEnabled && Boolean(process.env.GEMINI_API_KEY) && getAvailableModelVersions().length > 0;
}

function getModelStatusPayload() {
  const loaded = isModelLoaded();
  let errorReason = '';
  if (!modelEnabled) {
    errorReason = 'AI model has been temporarily disabled.';
  } else if (!process.env.GEMINI_API_KEY) {
    errorReason = 'Server AI model credentials are not configured.';
  } else if (!loaded) {
    errorReason = lastModelError || 'AI model rate limit cooldown active.';
  }

  return {
    modelLoaded: loaded,
    modelEnabled,
    modelName: getModelDisplayName(activeModelVersion),
    modelType: AI_MODEL_TYPE,
    modelVersion: activeModelVersion,
    supportedClasses: SUPPORTED_CLASSES,
    statusMessage: loaded ? 'AI Model: Loaded and Ready' : MODEL_UNAVAILABLE_MESSAGE,
    ...(errorReason ? { errorReason } : {}),
  };
}

// Health & AI Model status check
app.get('/api/health', (_req, res) => {
  const status = getModelStatusPayload();
  res.json({
    ok: true,
    geminiConfigured: status.modelLoaded,
    geminiKeyPresent: Boolean(process.env.GEMINI_API_KEY),
    ...status,
  });
});

// Temporarily enable/disable the AI model (e.g. fail-safe testing)
app.post('/api/model/status', (req, res) => {
  const { enabled } = req.body as { enabled?: boolean };
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'Boolean "enabled" flag is required.' });
    return;
  }
  modelEnabled = enabled;
  if (enabled) {
    lastModelError = '';
    modelCooldownUntil[AI_MODEL_VERSION] = 0;
    modelCooldownUntil[FALLBACK_AI_MODEL_VERSION] = 0;
    activeModelVersion = AI_MODEL_VERSION;
  } else {
    lastModelError = 'AI model disabled by operator.';
  }
  res.json(getModelStatusPayload());
});

// Get all incidents, settings, and email alert logs
app.get('/api/incidents', (_req, res) => {
  const db = readDatabase();
  const sorted = [...db.incidents].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  res.json({
    incidents: sorted,
    settings: db.settings,
    emailLogs: db.emailLogs,
  });
});

// Create a new incident record and save screenshot to disk
app.post('/api/incidents', (req, res) => {
  try {
    const { detectionType, confidence, screenshotDataUrl, source, notes } = req.body as {
      detectionType?: IncidentDetectionType;
      confidence?: number;
      screenshotDataUrl?: string;
      source?: IncidentSource;
      notes?: string;
    };

    if (!detectionType || typeof confidence !== 'number') {
      res.status(400).json({ error: 'detectionType and numeric confidence are required.' });
      return;
    }

    const db = readDatabase();
    const nextNum = 1001 + db.incidents.length + Math.floor(Math.random() * 5);
    const id = `INC-${nextNum}-${Date.now().toString().slice(-3)}`;
    const timestamp = new Date().toISOString();
    const screenshotUrl = screenshotDataUrl
      ? saveBase64Screenshot(id, screenshotDataUrl)
      : `/saved_incidents/detected_images/${id}.png`;

    const shouldEmail = db.settings.emailAlertsEnabled && Boolean(db.settings.alertEmail);

    const record: IncidentRecord = {
      id,
      timestamp,
      detectionType,
      confidence: Math.round(confidence),
      screenshotUrl,
      status: 'Active',
      source: source ?? 'Live Camera',
      emailSent: shouldEmail,
      emailRecipient: shouldEmail ? db.settings.alertEmail : undefined,
      notes: notes ?? `Automated ${detectionType} alert captured from ${source ?? 'Live Camera'}.`,
    };

    db.incidents.unshift(record);

    if (shouldEmail) {
      db.emailLogs.unshift({
        id: `MAIL-${Date.now().toString().slice(-5)}`,
        incidentId: id,
        recipient: db.settings.alertEmail,
        subject: `[ALERT] ${detectionType} Detected (${record.confidence}% confidence) - ${id}`,
        sentAt: timestamp,
        detectionType,
        confidence: record.confidence,
        status: 'Logged (SMTP Demo)',
      });
    }

    writeDatabase(db);
    res.status(201).json({ incident: record, emailLogs: db.emailLogs });
  } catch (err) {
    console.error('Failed to save incident:', err);
    res.status(500).json({ error: 'Failed to persist incident record.' });
  }
});

// Update incident status
app.patch('/api/incidents/:id', (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body as { status?: IncidentStatus; notes?: string };
  const db = readDatabase();
  const idx = db.incidents.findIndex((i) => i.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Incident not found.' });
    return;
  }

  if (status) db.incidents[idx].status = status;
  if (typeof notes === 'string') db.incidents[idx].notes = notes;
  writeDatabase(db);
  res.json({ incident: db.incidents[idx] });
});

// Delete incident
app.delete('/api/incidents/:id', (req, res) => {
  const { id } = req.params;
  const db = readDatabase();
  const before = db.incidents.length;
  db.incidents = db.incidents.filter((i) => i.id !== id);
  if (db.incidents.length === before) {
    res.status(404).json({ error: 'Incident not found.' });
    return;
  }
  writeDatabase(db);
  res.json({ deleted: true, id });
});

// Export CSV report
app.get('/api/incidents/export/csv', (_req, res) => {
  const db = readDatabase();
  const headers = [
    'Incident ID',
    'Timestamp',
    'Detection Type',
    'Confidence (%)',
    'Source',
    'Status',
    'Email Alert Sent',
    'Notes',
  ];
  const rows = db.incidents.map((item) =>
    [
      item.id,
      item.timestamp,
      item.detectionType,
      item.confidence,
      item.source,
      item.status,
      item.emailSent ? 'Yes' : 'No',
      item.notes ?? '',
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="fire_detection_report.csv"');
  res.send(csv);
});

// Update alert settings
app.put('/api/settings', (req, res) => {
  const db = readDatabase();
  const updates = req.body as Partial<AlertSettings>;
  db.settings = {
    ...db.settings,
    ...updates,
  };
  writeDatabase(db);
  res.json({ settings: db.settings });
});

// Simulate / test Email Alert dispatch
app.post('/api/alerts/test-email', (req, res) => {
  const { recipient } = req.body as { recipient?: string };
  const db = readDatabase();
  const targetEmail = (recipient ?? db.settings.alertEmail ?? '').trim();
  if (!targetEmail || !targetEmail.includes('@')) {
    res.status(400).json({ error: 'Please provide a valid recipient email address.' });
    return;
  }

  const logEntry: EmailDispatchLog = {
    id: `MAIL-${Date.now().toString().slice(-5)}`,
    incidentId: db.incidents[0]?.id ?? 'TEST-PING',
    recipient: targetEmail,
    subject: '[TEST] PyroGuard AI Fire Safety Email Alert Verification',
    sentAt: new Date().toISOString(),
    detectionType: 'Fire',
    confidence: 95,
    status: 'Logged (SMTP Demo)',
  };

  db.emailLogs.unshift(logEntry);
  writeDatabase(db);
  res.json({ logEntry, emailLogs: db.emailLogs });
});

async function runVisionInferenceWithModel(
  ai: GoogleGenAI,
  modelId: string,
  cleanBase64: string,
  mimeType: string
) {
  return ai.models.generateContent({
    model: modelId,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        },
        {
          text:
            'You are a strict industrial fire and smoke object detection model. ' +
            'Inspect the image ONLY for actual burning fire flames or actual smoke plumes. ' +
            'NEVER classify people, faces, skin tones, hands, red or orange clothing/shirts, ' +
            'wall switchboards, electrical outlets, pictures, posters, painted walls, wooden furniture, ' +
            'ceiling lamps, LED indicators, sunlight, or warm reflections as fire or smoke. ' +
            'Only emit a detection when real fire or real smoke is unmistakably visible. ' +
            'Allowed labels are strictly "fire" or "smoke". ' +
            'Return confidence as a decimal in 0.0..1.0 and tight bounding box coordinates in 0..1000 [ymin, xmin, ymax, xmax]. ' +
            'If the scene contains only normal indoor/outdoor objects without real fire or smoke, return {"detections": []}.',
        },
      ],
    },
    config: {
      ...(modelId === FALLBACK_AI_MODEL_VERSION
        ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
        : {}),
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                ymin: { type: Type.NUMBER },
                xmin: { type: Type.NUMBER },
                ymax: { type: Type.NUMBER },
                xmax: { type: Type.NUMBER },
              },
              required: ['label', 'confidence', 'ymin', 'xmin', 'ymax', 'xmax'],
            },
          },
        },
        required: ['detections'],
      },
    },
  });
}

// Server-side Real AI Vision Detection endpoint using Gemini Multimodal Vision AI
app.post('/api/detect', async (req, res) => {
  const { imageBase64, mimeType, threshold } = req.body as {
    imageBase64?: string;
    mimeType?: string;
    threshold?: number;
  };

  if (!imageBase64) {
    res.status(400).json({ error: 'imageBase64 payload is required.' });
    return;
  }

  if (!isModelLoaded()) {
    const status = getModelStatusPayload();
    res.status(503).json({
      ...status,
      error: MODEL_UNAVAILABLE_MESSAGE,
      detections: [],
    });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    const status = getModelStatusPayload();
    res.status(503).json({
      ...status,
      modelLoaded: false,
      error: MODEL_UNAVAILABLE_MESSAGE,
      detections: [],
    });
    return;
  }

  const startMs = Date.now();
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const confThreshold = Math.max(75, typeof threshold === 'number' ? threshold : 75);
  const candidateModels = getAvailableModelVersions();

  let responseText = '';
  let usedModel = candidateModels[0] || AI_MODEL_VERSION;
  let lastErrMsg = '';
  let sawQuotaError = false;

  for (const modelId of candidateModels) {
    try {
      const response = await runVisionInferenceWithModel(
        ai,
        modelId,
        cleanBase64,
        mimeType || 'image/jpeg'
      );
      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('AI model returned an empty inference payload.');
      }
      responseText = rawText;
      usedModel = modelId;
      activeModelVersion = modelId;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastErrMsg = msg;
      const isQuotaError =
        msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
      if (isQuotaError) {
        sawQuotaError = true;
        const retryMatch = /retryDelay["']?\s*:\s*["']?(\d+)s/i.exec(msg);
        const retrySeconds = retryMatch ? Math.min(Number(retryMatch[1]), 60) : 20;
        const effectiveWaitSec = Math.max(15, retrySeconds);
        modelCooldownUntil[modelId] = Date.now() + effectiveWaitSec * 1000;
        console.warn(`[AI Model Fail-Safe] ${modelId} rate-limited:`, msg.slice(0, 260));
        continue;
      }
      console.warn(`[AI Model Fail-Safe] ${modelId} error:`, msg.slice(0, 260));
    }
  }

  if (!responseText) {
    lastModelError = sawQuotaError
      ? `AI model quota/rate limit reached (${lastErrMsg.slice(0, 140)}).`
      : `AI model inference unavailable: ${lastErrMsg.slice(0, 140)}`;
    const status = getModelStatusPayload();
    res.status(503).json({
      ...status,
      modelLoaded: false,
      statusMessage: MODEL_UNAVAILABLE_MESSAGE,
      errorReason: lastModelError,
      error: MODEL_UNAVAILABLE_MESSAGE,
      quotaExhausted: sawQuotaError,
      detections: [],
    });
    return;
  }

  try {
    const parsed = JSON.parse(responseText) as {
      detections?: Array<{
        label: string;
        confidence: number;
        ymin: number;
        xmin: number;
        ymax: number;
        xmax: number;
      }>;
    };

    const boxes: BoundingBox[] = (parsed.detections ?? [])
      .filter((d) => {
        if (!d || typeof d !== 'object') return false;
        const normLabel = typeof d.label === 'string' ? d.label.trim().toLowerCase() : '';
        if (normLabel !== 'fire' && normLabel !== 'smoke') return false;
        if (
          !Number.isFinite(d.confidence) ||
          !Number.isFinite(d.xmin) ||
          !Number.isFinite(d.ymin) ||
          !Number.isFinite(d.xmax) ||
          !Number.isFinite(d.ymax)
        ) {
          return false;
        }
        const confPercent = d.confidence <= 1 ? d.confidence * 100 : d.confidence;
        if (confPercent < confThreshold || confPercent < 75) return false;
        return d.xmax > d.xmin && d.ymax > d.ymin;
      })
      .map((d, idx) => {
        const normLabel = d.label.trim().toLowerCase();
        const confPercent = d.confidence <= 1 ? d.confidence * 100 : d.confidence;
        const x = Math.max(0, Math.min(1, d.xmin / 1000));
        const y = Math.max(0, Math.min(1, d.ymin / 1000));
        const right = Math.max(0, Math.min(1, d.xmax / 1000));
        const bottom = Math.max(0, Math.min(1, d.ymax / 1000));
        return {
          id: `ai-${normLabel}-${idx + 1}`,
          label: (normLabel === 'fire' ? 'Fire' : 'Smoke') as DetectionClass,
          confidence: Math.min(100, Math.round(confPercent)),
          x: Number(x.toFixed(4)),
          y: Number(y.toFixed(4)),
          width: Number(Math.max(0, right - x).toFixed(4)),
          height: Number(Math.max(0, bottom - y).toFixed(4)),
        };
      })
      .filter((b) => b.width > 0 && b.height > 0);

    lastModelError = '';
    const status = getModelStatusPayload();
    res.json({
      ...status,
      detections: boxes,
      inferenceMs: Date.now() - startMs,
      engine: `${status.modelName} (${usedModel})`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    lastModelError = `AI model response parsing failed: ${msg.slice(0, 120)}`;
    res.status(503).json({
      modelLoaded: false,
      modelEnabled,
      modelName: getModelDisplayName(usedModel),
      modelType: AI_MODEL_TYPE,
      modelVersion: usedModel,
      supportedClasses: SUPPORTED_CLASSES,
      statusMessage: MODEL_UNAVAILABLE_MESSAGE,
      errorReason: lastModelError,
      error: MODEL_UNAVAILABLE_MESSAGE,
      detections: [],
    });
  }
});

// Ensure unmatched /api/* routes and Express body/middleware errors always return JSON, never HTML
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.use(
  (
    err: Error & { status?: number; type?: string },
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (req.path.startsWith('/api')) {
      const status = typeof err.status === 'number' ? err.status : 500;
      res.status(status).json({
        modelLoaded: false,
        modelEnabled,
        modelName: AI_MODEL_NAME,
        modelType: AI_MODEL_TYPE,
        modelVersion: AI_MODEL_VERSION,
        supportedClasses: SUPPORTED_CLASSES,
        statusMessage: MODEL_UNAVAILABLE_MESSAGE,
        errorReason: err.message || 'Server failed to process API request.',
        error: MODEL_UNAVAILABLE_MESSAGE,
        detections: [],
      });
      return;
    }
    next(err);
  }
);

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PyroGuard AI server listening on http://localhost:${PORT}`);
  });
}

startServer();
