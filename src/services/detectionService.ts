import type { AIModelStatus, BoundingBox, SystemStatusState } from '../types/detection';
import {
  deriveSystemStatus,
  filterAllowedHazardDetections,
  MIN_CONFIDENCE_RATIO,
  type RawDetectedObject,
} from '../utils/detectionLogic';

export const MODEL_UNAVAILABLE_MESSAGE =
  '⚠ AI MODEL UNAVAILABLE – REAL-TIME DETECTION IS DISABLED';

export const DEFAULT_MODEL_STATUS: AIModelStatus = {
  modelLoaded: false,
  modelEnabled: true,
  isLoading: true,
  modelName: 'Gemini 3.1 Flash Lite Vision',
  modelType: 'Multimodal Vision AI',
  modelVersion: 'gemini-3.1-flash-lite',
  supportedClasses: ['Fire', 'Smoke'],
  statusMessage: 'AI Model Status: Loading',
};

export interface CentralDetectOptions {
  threshold?: number;
  signal?: AbortSignal;
}

export interface CentralDetectResponse {
  modelStatus: AIModelStatus;
  detections: BoundingBox[];
  status: SystemStatusState;
  maxConfidence: number;
  fireCount: number;
  smokeCount: number;
  inferenceMs: number;
  engine: string;
  error?: string;
}

function normalizeModelStatus(
  raw: Partial<AIModelStatus> & { geminiConfigured?: boolean }
): AIModelStatus {
  const loaded = Boolean(raw.modelLoaded ?? raw.geminiConfigured);
  return {
    modelLoaded: loaded,
    modelEnabled: raw.modelEnabled ?? true,
    isLoading: false,
    modelName: raw.modelName ?? DEFAULT_MODEL_STATUS.modelName,
    modelType: raw.modelType ?? DEFAULT_MODEL_STATUS.modelType,
    modelVersion: raw.modelVersion ?? DEFAULT_MODEL_STATUS.modelVersion,
    supportedClasses: raw.supportedClasses ?? ['Fire', 'Smoke'],
    statusMessage:
      raw.statusMessage ??
      (loaded ? 'AI Model: Loaded and Ready' : MODEL_UNAVAILABLE_MESSAGE),
    errorReason: raw.errorReason,
  };
}

async function safeParseJsonResponse<T>(resp: Response): Promise<{ data: T | null; nonJsonError?: string }> {
  const rawText = await resp.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { data: null, nonJsonError: `Empty response (HTTP ${resp.status}) from AI backend.` };
  }
  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  if (trimmed.startsWith('<') || contentType.includes('text/html')) {
    return {
      data: null,
      nonJsonError: `AI backend endpoint returned HTML instead of JSON (HTTP ${resp.status}). Ensure the Express server is running and reload if the session expired.`,
    };
  }
  try {
    return { data: JSON.parse(trimmed) as T };
  } catch {
    return {
      data: null,
      nonJsonError: `Invalid JSON response (HTTP ${resp.status}) from AI inference backend.`,
    };
  }
}

/**
 * Queries the backend AI model health & readiness state.
 */
export async function fetchModelStatus(): Promise<AIModelStatus> {
  try {
    const resp = await fetch('/api/health');
    const parsed = await safeParseJsonResponse<Partial<AIModelStatus> & { geminiConfigured?: boolean }>(resp);
    if (!resp.ok || !parsed.data) {
      return {
        ...DEFAULT_MODEL_STATUS,
        isLoading: false,
        modelLoaded: false,
        statusMessage: MODEL_UNAVAILABLE_MESSAGE,
        errorReason: parsed.nonJsonError ?? 'AI model health endpoint returned an error.',
      };
    }
    return normalizeModelStatus(parsed.data);
  } catch {
    return {
      ...DEFAULT_MODEL_STATUS,
      isLoading: false,
      modelLoaded: false,
      statusMessage: MODEL_UNAVAILABLE_MESSAGE,
      errorReason: 'Unable to connect to AI inference backend.',
    };
  }
}

/**
 * Enables or temporarily disables the backend AI model for fail-safe verification.
 */
export async function setModelEnabled(enabled: boolean): Promise<AIModelStatus> {
  try {
    const resp = await fetch('/api/model/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const parsed = await safeParseJsonResponse<Partial<AIModelStatus>>(resp);
    if (!resp.ok || !parsed.data) {
      return {
        ...DEFAULT_MODEL_STATUS,
        isLoading: false,
        modelLoaded: false,
        statusMessage: MODEL_UNAVAILABLE_MESSAGE,
        errorReason: parsed.nonJsonError ?? 'Failed to update AI model state.',
      };
    }
    return normalizeModelStatus(parsed.data);
  } catch {
    return {
      ...DEFAULT_MODEL_STATUS,
      isLoading: false,
      modelLoaded: false,
      statusMessage: MODEL_UNAVAILABLE_MESSAGE,
      errorReason: 'Unable to communicate with AI model backend.',
    };
  }
}

/**
 * Converts a raw image frame (base64 data URL, HTMLCanvasElement, or HTMLVideoElement)
 * into a clean preprocessed JPEG payload for real AI model inference.
 */
function preprocessFrameToDataUrl(
  frame: string | HTMLCanvasElement | HTMLVideoElement
): { dataUrl: string; mimeType: string } {
  if (typeof frame === 'string') {
    const mimeMatch = /^data:(image\/[a-zA-Z0-9+.-]+);base64,/.exec(frame);
    return {
      dataUrl: frame,
      mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg',
    };
  }

  const targetWidth = 640;
  const targetHeight = 480;
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire 2D canvas context for frame preprocessing.');
  }

  ctx.drawImage(frame, 0, 0, targetWidth, targetHeight);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.82),
    mimeType: 'image/jpeg',
  };
}

/**
 * Central AI Detection Service: detect(frame)
 * Shared by Live Webcam Detection, Image Detection, and Video Detection.
 * 1. Preprocesses frame.
 * 2. Sends frame to real AI model endpoint (/api/detect).
 * 3. Strictly validates class ('fire' | 'smoke') & confidence (>= 0.75).
 * 4. Returns valid detections or [] when safe, and fails safely when unavailable.
 */
export async function detect(
  frame: string | HTMLCanvasElement | HTMLVideoElement,
  options: CentralDetectOptions = {}
): Promise<CentralDetectResponse> {
  const effectiveThreshold = Math.max(
    MIN_CONFIDENCE_RATIO * 100,
    options.threshold ?? MIN_CONFIDENCE_RATIO * 100
  );

  try {
    const { dataUrl, mimeType } = preprocessFrameToDataUrl(frame);
    const resp = await fetch('/api/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: options.signal,
      body: JSON.stringify({
        imageBase64: dataUrl,
        mimeType,
        threshold: effectiveThreshold,
      }),
    });

    const parsed = await safeParseJsonResponse<
      Partial<AIModelStatus> & {
        detections?: RawDetectedObject[];
        inferenceMs?: number;
        engine?: string;
        error?: string;
      }
    >(resp);

    if (!parsed.data) {
      return {
        modelStatus: {
          ...DEFAULT_MODEL_STATUS,
          isLoading: false,
          modelLoaded: false,
          statusMessage: MODEL_UNAVAILABLE_MESSAGE,
          errorReason: parsed.nonJsonError ?? 'AI model inference unavailable.',
        },
        detections: [],
        status: 'normal',
        maxConfidence: 0,
        fireCount: 0,
        smokeCount: 0,
        inferenceMs: 0,
        engine: 'AI Model Unavailable',
        error: MODEL_UNAVAILABLE_MESSAGE,
      };
    }

    const payload = parsed.data;
    const statusObj = normalizeModelStatus(payload);
    if (!resp.ok || !statusObj.modelLoaded) {
      return {
        modelStatus: {
          ...statusObj,
          modelLoaded: false,
          statusMessage: MODEL_UNAVAILABLE_MESSAGE,
          errorReason: payload.errorReason ?? payload.error ?? 'AI model inference unavailable.',
        },
        detections: [],
        status: 'normal',
        maxConfidence: 0,
        fireCount: 0,
        smokeCount: 0,
        inferenceMs: 0,
        engine: 'AI Model Unavailable',
        error: MODEL_UNAVAILABLE_MESSAGE,
      };
    }

    const validDetections = filterAllowedHazardDetections(
      payload.detections,
      effectiveThreshold / 100
    );
    const derivedStatus = deriveSystemStatus(validDetections);
    const maxConfidence =
      validDetections.length > 0
        ? Math.max(...validDetections.map((d) => d.confidence))
        : 0;

    return {
      modelStatus: statusObj,
      detections: validDetections,
      status: derivedStatus,
      maxConfidence,
      fireCount: validDetections.filter((d) => d.label === 'Fire').length,
      smokeCount: validDetections.filter((d) => d.label === 'Smoke').length,
      inferenceMs: payload.inferenceMs ?? 0,
      engine: payload.engine ?? `${statusObj.modelName} (${statusObj.modelVersion})`,
    };
  } catch (err) {
    return {
      modelStatus: {
        ...DEFAULT_MODEL_STATUS,
        isLoading: false,
        modelLoaded: false,
        statusMessage: MODEL_UNAVAILABLE_MESSAGE,
        errorReason:
          err instanceof Error ? err.message : 'Unable to reach AI inference service.',
      },
      detections: [],
      status: 'normal',
      maxConfidence: 0,
      fireCount: 0,
      smokeCount: 0,
      inferenceMs: 0,
      engine: 'AI Model Unavailable',
      error: MODEL_UNAVAILABLE_MESSAGE,
    };
  }
}
