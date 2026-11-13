import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  MonitorPlay,
  Square,
  Play,
  BookmarkCheck,
  Flame,
  Wind,
  ShieldCheck,
  Volume2,
  VolumeX,
  AlertTriangle,
  Cpu,
  Power,
} from 'lucide-react';
import type {
  AIModelStatus,
  AlertSettings,
  BoundingBox,
  DetectionResult,
  IncidentDetectionType,
  IncidentSource,
  SystemStatusState,
} from '../types/detection';
import {
  advanceConsecutiveFrameState,
  deriveSystemStatus,
  filterAllowedHazardDetections,
  MIN_CONFIDENCE_RATIO,
  MIN_CONSECUTIVE_FRAMES,
  MultiFrameAlertTracker,
  summarizeDetectionType,
  type ConsecutiveFrameState,
  type RawDetectedObject,
} from '../utils/detectionLogic';
import {
  detect,
  fetchModelStatus,
  MODEL_UNAVAILABLE_MESSAGE,
  setModelEnabled,
} from '../services/detectionService';
import { drawDetectionsOnCanvas } from '../utils/drawDetections';
import { renderSimulatedSceneFrame, type DemoSceneId } from '../utils/sampleFrames';

export {
  advanceConsecutiveFrameState,
  filterAllowedHazardDetections,
  type ConsecutiveFrameState,
  type RawDetectedObject,
};

interface LiveDetectionPageProps {
  settings: AlertSettings;
  modelStatus: AIModelStatus;
  onModelStatusChange: (status: AIModelStatus) => void;
  alarmEnabled: boolean;
  alarmSounding: boolean;
  onEnableAlarm: () => void;
  onTestAlarm: () => void;
  onSilenceAlarm: () => void;
  onUpdateSettings: (partial: Partial<AlertSettings>) => void;
  onStatusChange: (
    status: SystemStatusState,
    confidence: number,
    source: string,
    triggerAlarm?: boolean
  ) => void;
  onLogIncident: (payload: {
    detectionType: IncidentDetectionType;
    confidence: number;
    screenshotDataUrl: string;
    source: IncidentSource;
    notes?: string;
  }) => Promise<void>;
}

export const LiveDetectionPage: React.FC<LiveDetectionPageProps> = ({
  settings,
  modelStatus,
  onModelStatusChange,
  alarmEnabled,
  alarmSounding,
  onEnableAlarm,
  onTestAlarm,
  onSilenceAlarm,
  onUpdateSettings,
  onStatusChange,
  onLogIncident,
}) => {
  // Strictly separated modes:
  // 1. 'webcam' (LIVE AI DETECTION — real webcam + real AI model, never simulated)
  // 2. 'simulation' (DEMO / SIMULATION MODE — clearly labeled demo scenarios)
  const [feedMode, setFeedMode] = useState<'webcam' | 'simulation'>('webcam');
  const [simScenario, setSimScenario] = useState<DemoSceneId>('clean_corridor');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [webcamActive, setWebcamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [togglingModel, setTogglingModel] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<DetectionResult>({
    detections: [],
    status: 'normal',
    maxConfidence: 0,
    fireCount: 0,
    smokeCount: 0,
    inferenceMs: 0,
    engine: `${modelStatus.modelName} (${modelStatus.modelVersion})`,
  });
  const [consecutiveFrames, setConsecutiveFrames] = useState(0);
  const [isVerifiedHazard, setIsVerifiedHazard] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [autoSaveBanner, setAutoSaveBanner] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<MultiFrameAlertTracker>(new MultiFrameAlertTracker());
  const consecutiveFrameCounterRef = useRef<number>(0);
  const activeHazardClassRef = useRef<'fire' | 'smoke' | null>(null);
  const latestAiDetectionsRef = useRef<BoundingBox[]>([]);
  const tickRef = useRef<number>(0);

  const resetDetectionState = (sourceLabel = 'Live Camera') => {
    trackerRef.current.reset();
    consecutiveFrameCounterRef.current = 0;
    activeHazardClassRef.current = null;
    latestAiDetectionsRef.current = [];
    setConsecutiveFrames(0);
    setIsVerifiedHazard(false);
    setCooldownSec(0);
    setLastResult({
      detections: [],
      status: 'normal',
      maxConfidence: 0,
      fireCount: 0,
      smokeCount: 0,
      inferenceMs: 0,
      engine: modelStatus.modelLoaded
        ? `${modelStatus.modelName} (${modelStatus.modelVersion})`
        : 'AI Model Unavailable',
    });
    onStatusChange('normal', 0, sourceLabel, false);
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWebcamActive(false);
  };

  const handleSwitchMode = (nextMode: 'webcam' | 'simulation') => {
    setAutoSaveBanner('');
    resetDetectionState(nextMode === 'webcam' ? 'Live Camera' : 'Demo Simulation');
    setFeedMode(nextMode);
  };

  const handleToggleModelAvailability = async () => {
    setTogglingModel(true);
    const updated = await setModelEnabled(!modelStatus.modelEnabled);
    onModelStatusChange(updated);
    if (!updated.modelLoaded) {
      resetDetectionState('AI Model Unavailable');
    }
    setTogglingModel(false);
  };

  // Load AI model readiness on page mount
  useEffect(() => {
    let cancelled = false;
    fetchModelStatus().then((status) => {
      if (!cancelled) {
        onModelStatusChange(status);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize real webcam ONLY in LIVE AI DETECTION ('webcam') mode
  useEffect(() => {
    if (feedMode !== 'webcam' || !isRunning) {
      stopWebcam();
      return;
    }

    let cancelled = false;
    setCameraError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Webcam API is unavailable in this browser. Switch to Demo / Simulation Mode to test sample footage.'
      );
      setWebcamActive(false);
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setWebcamActive(true);
      })
      .catch(() => {
        if (!cancelled) {
          setWebcamActive(false);
          setCameraError(
            'Camera access is unavailable or denied. Allow webcam permission for Live AI Detection, or switch to Demo / Simulation Mode.'
          );
        }
      });

    return () => {
      cancelled = true;
      stopWebcam();
    };
  }, [feedMode, isRunning]);

  // Smooth preview loop — draws webcam/simulation canvas and ONLY valid model bounding boxes
  useEffect(() => {
    const drawFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement('canvas');
        captureCanvasRef.current.width = width;
        captureCanvasRef.current.height = height;
      }
      const captureCtx = captureCanvasRef.current.getContext('2d');

      if (!isRunning) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Detection Stream Paused', width / 2, height / 2);
        ctx.textAlign = 'start';
        return;
      }

      if (feedMode === 'webcam') {
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            cameraError ? 'Live Webcam Inactive' : 'Waiting for Live Webcam Stream...',
            width / 2,
            height / 2
          );
          ctx.textAlign = 'start';
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        if (captureCtx) {
          captureCtx.drawImage(video, 0, 0, width, height);
        }
      } else {
        tickRef.current += 1;
        renderSimulatedSceneFrame(ctx, width, height, simScenario, tickRef.current);
        if (captureCtx) {
          captureCtx.drawImage(canvas, 0, 0, width, height);
        }
      }

      // Draw bounding boxes ONLY when valid model predictions exist
      if (modelStatus.modelLoaded && latestAiDetectionsRef.current.length > 0) {
        drawDetectionsOnCanvas(ctx, width, height, latestAiDetectionsRef.current);
      }
    };

    drawFrame();
    const previewTimer = window.setInterval(drawFrame, 100);
    return () => window.clearInterval(previewTimer);
  }, [isRunning, feedMode, simScenario, cameraError, modelStatus.modelLoaded]);

  // Automatic recovery check if AI model was temporarily unavailable due to rate-limit cooldown
  useEffect(() => {
    if (!modelStatus.modelEnabled || modelStatus.modelLoaded) return;
    const pollId = window.setInterval(async () => {
      const latest = await fetchModelStatus();
      if (latest.modelLoaded) {
        onModelStatusChange(latest);
      }
    }, 8000);
    return () => window.clearInterval(pollId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelStatus.modelEnabled, modelStatus.modelLoaded]);

  // Central AI detection loop: Frame -> Preprocess -> Central detect(frame) -> Validate -> 5-Frame Verification
  useEffect(() => {
    if (!isRunning || !modelStatus.modelLoaded) {
      resetDetectionState(
        modelStatus.modelLoaded ? 'Stream Paused' : 'AI Model Unavailable'
      );
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    const abortController = new AbortController();

    const runNextInference = async () => {
      if (cancelled) return;

      const sourceLabel = feedMode === 'webcam' ? 'Live Camera' : 'Demo Simulation';

      if (feedMode === 'webcam') {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !captureCanvasRef.current) {
          timeoutId = window.setTimeout(runNextInference, 300);
          return;
        }
      } else if (!captureCanvasRef.current) {
        timeoutId = window.setTimeout(runNextInference, 300);
        return;
      }

      const effectiveConfidencePercent = Math.max(
        MIN_CONFIDENCE_RATIO * 100,
        settings.confidenceThreshold
      );
      const requiredConsecutiveFrames = Math.max(
        MIN_CONSECUTIVE_FRAMES,
        settings.persistenceFrames
      );

      // Call the central AI detection service detect(frame)
      const aiResult = await detect(captureCanvasRef.current, {
        threshold: effectiveConfidencePercent,
        signal: abortController.signal,
      });

      if (cancelled) return;

      if (!aiResult.modelStatus.modelLoaded || aiResult.error) {
        onModelStatusChange(aiResult.modelStatus);
        resetDetectionState('AI Model Unavailable');
        return;
      }

      if (aiResult.modelStatus.modelVersion !== modelStatus.modelVersion) {
        onModelStatusChange(aiResult.modelStatus);
      }

      const validDetections = aiResult.detections;
      // Never reuse stale bounding boxes when no new valid prediction exists
      latestAiDetectionsRef.current = validDetections;

      // Multi-frame verification requires 5 consecutive frames of the SAME hazard class ('fire' or 'smoke')
      const frameState = advanceConsecutiveFrameState(
        consecutiveFrameCounterRef.current,
        validDetections,
        requiredConsecutiveFrames,
        activeHazardClassRef.current
      );
      consecutiveFrameCounterRef.current = frameState.consecutiveCount;
      activeHazardClassRef.current = frameState.activeHazardClass;
      setConsecutiveFrames(frameState.consecutiveCount);

      const hasHazard = validDetections.length > 0;
      const evalRes = trackerRef.current.evaluateFrame(
        hasHazard && frameState.consecutiveCount > 0,
        requiredConsecutiveFrames,
        settings.cooldownSeconds
      );
      const verifiedOverFrames = frameState.verified;

      setIsVerifiedHazard(verifiedOverFrames && evalRes.verifiedActive);
      setCooldownSec(Math.ceil(evalRes.cooldownRemainingMs / 1000));

      const status = deriveSystemStatus(validDetections);
      const maxConf = aiResult.maxConfidence;

      if (
        frameState.statusToEmit === 'fire_emergency' ||
        frameState.statusToEmit === 'smoke_warning'
      ) {
        const shouldAlarm =
          evalRes.alertTriggered && frameState.statusToEmit === 'fire_emergency';
        onStatusChange(frameState.statusToEmit, maxConf, sourceLabel, shouldAlarm);
      } else {
        onStatusChange('normal', 0, sourceLabel, false);
      }

      if (verifiedOverFrames && evalRes.alertTriggered && feedMode === 'webcam') {
        const snapshotCanvas = document.createElement('canvas');
        snapshotCanvas.width = captureCanvasRef.current.width;
        snapshotCanvas.height = captureCanvasRef.current.height;
        const sCtx = snapshotCanvas.getContext('2d');
        if (sCtx) {
          sCtx.drawImage(captureCanvasRef.current, 0, 0);
          drawDetectionsOnCanvas(
            sCtx,
            snapshotCanvas.width,
            snapshotCanvas.height,
            validDetections
          );
          const detType = summarizeDetectionType(validDetections);
          const dataUrl = snapshotCanvas.toDataURL('image/png');
          setAutoSaveBanner(
            `Verified incident logged: ${detType} (${maxConf}% across ${consecutiveFrameCounterRef.current} frames)`
          );
          onLogIncident({
            detectionType: detType,
            confidence: maxConf,
            screenshotDataUrl: dataUrl,
            source: 'Live Camera',
            notes: `${sourceLabel}: verified by ${aiResult.modelStatus.modelName} (${aiResult.modelStatus.modelVersion}) across ${consecutiveFrameCounterRef.current} consecutive frames.`,
          }).catch(() => {});
        }
      }

      setLastResult({
        detections: validDetections,
        status,
        maxConfidence: maxConf,
        fireCount: aiResult.fireCount,
        smokeCount: aiResult.smokeCount,
        inferenceMs: aiResult.inferenceMs,
        engine: aiResult.engine,
      });

      if (!cancelled) {
        timeoutId = window.setTimeout(runNextInference, 2500);
      }
    };

    timeoutId = window.setTimeout(runNextInference, 250);

    return () => {
      cancelled = true;
      abortController.abort();
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isRunning,
    feedMode,
    simScenario,
    modelStatus.modelLoaded,
    settings.confidenceThreshold,
    settings.persistenceFrames,
    settings.cooldownSeconds,
  ]);

  const handleManualSnapshot = async () => {
    if (!modelStatus.modelLoaded) {
      setAutoSaveBanner(MODEL_UNAVAILABLE_MESSAGE);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const verifiedDetections = filterAllowedHazardDetections(
      lastResult.detections,
      Math.max(MIN_CONFIDENCE_RATIO, settings.confidenceThreshold / 100)
    );
    if (verifiedDetections.length === 0) {
      setAutoSaveBanner('No active Fire or Smoke detected by AI model in current frame.');
      return;
    }
    const detType = summarizeDetectionType(verifiedDetections);
    await onLogIncident({
      detectionType: detType,
      confidence: Math.max(...verifiedDetections.map((d) => d.confidence)),
      screenshotDataUrl: canvas.toDataURL('image/png'),
      source: 'Live Camera',
      notes: `Manual operator snapshot captured (${modelStatus.modelName}).`,
    });
    setAutoSaveBanner('Verified incident snapshot saved to history.');
  };

  return (
    <div className="space-y-6">
      {/* Mode Separation & Stream Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg p-1 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => handleSwitchMode('webcam')}
                data-testid="mode-live-webcam"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  feedMode === 'webcam'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>LIVE AI DETECTION</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('simulation')}
                data-testid="mode-demo-simulation"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  feedMode === 'simulation'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <MonitorPlay className="w-3.5 h-3.5" />
                <span>DEMO / SIMULATION MODE</span>
              </button>
            </div>

            {feedMode === 'simulation' && (
              <div className="flex flex-wrap items-center gap-1.5 ml-0 sm:ml-2">
                <button
                  type="button"
                  onClick={() => {
                    resetDetectionState('Demo Simulation');
                    setSimScenario('clean_corridor');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                    simScenario === 'clean_corridor'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Safe Corridor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetDetectionState('Demo Simulation');
                    setSimScenario('warehouse_fire');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                    simScenario === 'warehouse_fire'
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Simulate Fire
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetDetectionState('Demo Simulation');
                    setSimScenario('server_smoke');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                    simScenario === 'server_smoke'
                      ? 'bg-amber-600 border-amber-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Simulate Smoke
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!alarmEnabled ? (
              <button
                type="button"
                onClick={onEnableAlarm}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Enable Alarm</span>
              </button>
            ) : alarmSounding ? (
              <button
                type="button"
                onClick={onSilenceAlarm}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Silence Alarm</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onTestAlarm}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Test Siren</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsRunning((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                isRunning
                  ? 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {isRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isRunning ? 'Pause Stream' : 'Resume Stream'}</span>
            </button>

            <button
              type="button"
              onClick={handleManualSnapshot}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Capture Snapshot</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {feedMode === 'webcam'
              ? `Active Mode: LIVE AI DETECTION (${webcamActive ? 'Webcam streaming' : 'Waiting for webcam'}) · Model: ${modelStatus.modelName} (${modelStatus.modelVersion})`
              : `DEMO MODE – SIMULATED DETECTION · Sample demonstration feed (${modelStatus.modelName})`}
          </span>
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {alarmEnabled ? '🔊 Alarm Enabled' : '🔇 Alarm Disabled'}
          </span>
        </div>
      </div>

      {/* Explicit Demo Mode Banner */}
      {feedMode === 'simulation' && (
        <div
          data-testid="demo-mode-banner"
          className="px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/50 dark:border-indigo-800 text-xs font-semibold text-indigo-800 dark:text-indigo-200 flex items-center justify-between gap-3"
        >
          <span>DEMO MODE – SIMULATED DETECTION (Separated from LIVE AI DETECTION webcam stream)</span>
          <button
            type="button"
            onClick={() => handleSwitchMode('webcam')}
            className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold whitespace-nowrap"
          >
            Return to Live Webcam
          </button>
        </div>
      )}

      {/* Explicit Fail-Safe Banner when AI Model is Unavailable */}
      {!modelStatus.isLoading && !modelStatus.modelLoaded && (
        <div
          role="alert"
          data-testid="model-not-loaded-banner"
          className="p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/60 dark:border-red-800 text-sm font-semibold text-red-800 dark:text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <div>{MODEL_UNAVAILABLE_MESSAGE}</div>
              {modelStatus.errorReason && (
                <div className="text-xs font-normal text-red-700 dark:text-red-300 mt-0.5">
                  {modelStatus.errorReason}
                </div>
              )}
            </div>
          </div>
          {!modelStatus.modelEnabled ? (
            <button
              type="button"
              onClick={handleToggleModelAvailability}
              disabled={togglingModel}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Re-enable AI Model
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                const refreshed = await fetchModelStatus();
                onModelStatusChange(refreshed);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Retry Connection
            </button>
          )}
        </div>
      )}

      {feedMode === 'webcam' && cameraError && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{cameraError}</span>
          <button
            type="button"
            onClick={() => handleSwitchMode('simulation')}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            Open Demo / Simulation Mode
          </button>
        </div>
      )}

      {autoSaveBanner && (
        <div className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200">
          {autoSaveBanner}
        </div>
      )}

      {/* Main Live Video & Telemetry Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div
          id="live-video-processing-engine"
          className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
        >
          <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-contain opacity-0 pointer-events-none"
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              data-testid="live-detection-canvas"
              className="relative z-10 w-full h-full object-contain"
            />
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          {/* Visible AI Model Status Card */}
          <div
            data-testid="ai-model-status-card"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-orange-600 shrink-0" />
                <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  AI Model Status
                </h2>
              </div>
              <button
                type="button"
                data-testid="toggle-ai-model-btn"
                onClick={handleToggleModelAvailability}
                disabled={togglingModel}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border whitespace-nowrap ${
                  modelStatus.modelEnabled
                    ? 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
                title="Temporarily disable or restore the AI model to test fail-safe behavior"
              >
                <Power className="w-3 h-3" />
                <span>{modelStatus.modelEnabled ? 'Disable Model' : 'Enable Model'}</span>
              </button>
            </div>

            <div
              data-testid="ai-model-status-badge"
              className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                modelStatus.isLoading
                  ? 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                  : modelStatus.modelLoaded
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                    : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-300'
              }`}
            >
              {modelStatus.isLoading
                ? 'AI Model Status: Loading'
                : modelStatus.modelLoaded
                  ? '🟢 AI Model: Loaded and Ready'
                  : '🔴 AI Model: Not Loaded'}
            </div>

            <div className="space-y-2 text-xs pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Model Name</span>
                <span className="font-semibold text-slate-900 dark:text-white text-right">
                  {modelStatus.modelName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Model Type</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 text-right">
                  {modelStatus.modelType}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Model Version</span>
                <span className="font-mono text-slate-700 dark:text-slate-200">
                  {modelStatus.modelVersion}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Supported Classes</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  Fire and Smoke
                </span>
              </div>
            </div>
          </div>

          {/* Live Telemetry Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Verified Inference Status
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Safety Status</span>
                <span className="font-semibold flex items-center gap-1.5">
                  {!modelStatus.modelLoaded ? (
                    <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> AI MODEL UNAVAILABLE
                    </span>
                  ) : isVerifiedHazard && lastResult.status === 'fire_emergency' ? (
                    <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1">
                      <Flame className="w-4 h-4" /> FIRE DETECTED
                    </span>
                  ) : isVerifiedHazard && lastResult.status === 'smoke_warning' ? (
                    <span className="text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                      <Wind className="w-4 h-4" /> SMOKE DETECTED
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" /> 🟢 SYSTEM SAFE
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Peak Confidence</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                  {modelStatus.modelLoaded ? `${lastResult.maxConfidence}%` : '--'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">
                  Multi-Frame Verification
                </span>
                <span
                  data-testid="persistence-counter"
                  className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white"
                >
                  {Math.min(
                    consecutiveFrames,
                    Math.max(MIN_CONSECUTIVE_FRAMES, settings.persistenceFrames)
                  )}{' '}
                  / {Math.max(MIN_CONSECUTIVE_FRAMES, settings.persistenceFrames)} frames
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Alert Cooldown</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                  {cooldownSec > 0 ? `${cooldownSec}s` : 'Ready'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 dark:text-slate-400">Inference Latency</span>
                <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                  {modelStatus.modelLoaded ? `${lastResult.inferenceMs} ms` : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>

          {/* Detection Tuning Controls */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              False-Alarm &amp; Threshold Controls
            </h3>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="conf-slider" className="text-slate-600 dark:text-slate-300">
                  Confidence Threshold (Min 75%)
                </label>
                <span className="font-mono font-semibold tabular-nums">
                  {Math.max(75, settings.confidenceThreshold)}%
                </span>
              </div>
              <input
                id="conf-slider"
                type="range"
                min={75}
                max={95}
                value={Math.max(75, settings.confidenceThreshold)}
                onChange={(e) =>
                  onUpdateSettings({ confidenceThreshold: Number(e.target.value) })
                }
                className="w-full accent-orange-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="persist-slider" className="text-slate-600 dark:text-slate-300">
                  Consecutive Frames Required
                </label>
                <span className="font-mono font-semibold tabular-nums">
                  {Math.max(5, settings.persistenceFrames)} frames
                </span>
              </div>
              <input
                id="persist-slider"
                type="range"
                min={5}
                max={10}
                value={Math.max(5, settings.persistenceFrames)}
                onChange={(e) =>
                  onUpdateSettings({ persistenceFrames: Number(e.target.value) })
                }
                className="w-full accent-orange-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="cooldown-slider" className="text-slate-600 dark:text-slate-300">
                  Alert Cooldown Period
                </label>
                <span className="font-mono font-semibold tabular-nums">
                  {settings.cooldownSeconds}s
                </span>
              </div>
              <input
                id="cooldown-slider"
                type="range"
                min={5}
                max={60}
                step={5}
                value={settings.cooldownSeconds}
                onChange={(e) =>
                  onUpdateSettings({ cooldownSeconds: Number(e.target.value) })
                }
                className="w-full accent-orange-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
