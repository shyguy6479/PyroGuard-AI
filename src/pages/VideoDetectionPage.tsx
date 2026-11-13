import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Play,
  Pause,
  RotateCcw,
  Film,
  Flame,
  Wind,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import type {
  AIModelStatus,
  AlertSettings,
  BoundingBox,
  IncidentDetectionType,
  IncidentSource,
  SystemStatusState,
} from '../types/detection';
import {
  advanceConsecutiveFrameState,
  MIN_CONFIDENCE_RATIO,
  MIN_CONSECUTIVE_FRAMES,
  MultiFrameAlertTracker,
  summarizeDetectionType,
} from '../utils/detectionLogic';
import { detect, fetchModelStatus, MODEL_UNAVAILABLE_MESSAGE } from '../services/detectionService';
import { drawDetectionsOnCanvas } from '../utils/drawDetections';
import { renderSimulatedSceneFrame, type DemoSceneId } from '../utils/sampleFrames';

interface VideoTimelineEvent {
  frame: number;
  timeSec: number;
  type: IncidentDetectionType;
  confidence: number;
}

interface VideoDetectionPageProps {
  settings: AlertSettings;
  modelStatus: AIModelStatus;
  onModelStatusChange: (status: AIModelStatus) => void;
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

const TOTAL_DEMO_STEPS = 7;

function getDemoScenarioForStep(step: number): DemoSceneId {
  // Step 1: Normal corridor (SYSTEM SAFE), Steps 2-6: Warehouse Fire (5 consecutive frames -> FIRE DETECTED), Step 7: Clear
  if (step >= 2 && step <= 6) return 'warehouse_fire';
  return 'clean_corridor';
}

export const VideoDetectionPage: React.FC<VideoDetectionPageProps> = ({
  settings,
  modelStatus,
  onModelStatusChange,
  onStatusChange,
  onLogIncident,
}) => {
  const [mode, setMode] = useState<'demo_clip' | 'uploaded'>('demo_clip');
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [videoName, setVideoName] = useState<string>('Sample Surveillance Clip (Normal -> Fire)');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [framesProcessed, setFramesProcessed] = useState<number>(0);
  const [fireFrames, setFireFrames] = useState<number>(0);
  const [smokeFrames, setSmokeFrames] = useState<number>(0);
  const [consecutiveFrames, setConsecutiveFrames] = useState<number>(0);
  const [verifiedStatus, setVerifiedStatus] = useState<SystemStatusState>('normal');
  const [events, setEvents] = useState<VideoTimelineEvent[]>([]);
  const [loggedForClip, setLoggedForClip] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestBoxesRef = useRef<BoundingBox[]>([]);
  const demoStepRef = useRef<number>(0);
  const loggedClipRef = useRef<boolean>(false);
  const consecutiveCountRef = useRef<number>(0);
  const activeHazardClassRef = useRef<'fire' | 'smoke' | null>(null);
  const trackerRef = useRef<MultiFrameAlertTracker>(new MultiFrameAlertTracker());

  useEffect(() => {
    let cancelled = false;
    fetchModelStatus().then((status) => {
      if (!cancelled) onModelStatusChange(status);
    });
    return () => {
      cancelled = true;
      if (videoSrc && videoSrc.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSrc]);

  const resetMetrics = () => {
    demoStepRef.current = 0;
    loggedClipRef.current = false;
    latestBoxesRef.current = [];
    consecutiveCountRef.current = 0;
    activeHazardClassRef.current = null;
    trackerRef.current.reset();
    setLoggedForClip(false);
    setProgressPct(0);
    setFramesProcessed(0);
    setFireFrames(0);
    setSmokeFrames(0);
    setConsecutiveFrames(0);
    setVerifiedStatus('normal');
    setEvents([]);
    setVideoError('');
    onStatusChange('normal', 0, 'Video Stream', false);
  };

  const handleUploadVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoSrc && videoSrc.startsWith('blob:')) {
      URL.revokeObjectURL(videoSrc);
    }
    const url = URL.createObjectURL(file);
    setMode('uploaded');
    setVideoSrc(url);
    setVideoName(file.name);
    setIsPlaying(false);
    resetMetrics();
  };

  const handleLoadDemoClip = async () => {
    setMode('demo_clip');
    setVideoName('Sample Surveillance Clip (Normal -> Fire)');
    resetMetrics();
    let currentStatus = modelStatus;
    if (currentStatus.isLoading || !currentStatus.modelLoaded) {
      currentStatus = await fetchModelStatus();
      onModelStatusChange(currentStatus);
    }
    if (!currentStatus.modelLoaded) {
      setVideoError(currentStatus.errorReason || MODEL_UNAVAILABLE_MESSAGE);
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
  };

  // Visual preview loop for uploaded <video> playback
  useEffect(() => {
    if (!isPlaying || mode !== 'uploaded') return;

    const interval = window.setInterval(() => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement('canvas');
        captureCanvasRef.current.width = canvas.width;
        captureCanvasRef.current.height = canvas.height;
      }
      const capCtx = captureCanvasRef.current.getContext('2d');

      if (video.paused || video.ended) {
        if (video.ended) {
          setIsPlaying(false);
          latestBoxesRef.current = [];
          setVerifiedStatus('normal');
          onStatusChange('normal', 0, 'Video Stream', false);
        }
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (capCtx) {
        capCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      if (video.duration > 0) {
        setProgressPct(Math.round((video.currentTime / video.duration) * 100));
      }

      if (modelStatus.modelLoaded && latestBoxesRef.current.length > 0) {
        drawDetectionsOnCanvas(ctx, canvas.width, canvas.height, latestBoxesRef.current);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [isPlaying, mode, modelStatus.modelLoaded, onStatusChange]);

  // Sequential real AI inference loop using central detect(frame)
  useEffect(() => {
    if (!isPlaying) return;
    if (!modelStatus.modelLoaded) {
      setIsPlaying(false);
      setVideoError(MODEL_UNAVAILABLE_MESSAGE);
      latestBoxesRef.current = [];
      consecutiveCountRef.current = 0;
      activeHazardClassRef.current = null;
      trackerRef.current.reset();
      setConsecutiveFrames(0);
      setVerifiedStatus('normal');
      onStatusChange('normal', 0, 'Video Stream', false);
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    const abortController = new AbortController();
    let processedCount = 0;

    const analyzeNextFrame = async () => {
      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) {
        timeoutId = window.setTimeout(analyzeNextFrame, 200);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement('canvas');
        captureCanvasRef.current.width = canvas.width;
        captureCanvasRef.current.height = canvas.height;
      }
      const capCtx = captureCanvasRef.current.getContext('2d');

      let frameNum = 0;
      let timeSec = 0;

      if (mode === 'demo_clip') {
        demoStepRef.current += 1;
        frameNum = demoStepRef.current;
        if (frameNum > TOTAL_DEMO_STEPS) {
          setIsPlaying(false);
          latestBoxesRef.current = [];
          setVerifiedStatus('normal');
          onStatusChange('normal', 0, 'Video Stream', false);
          return;
        }
        timeSec = Number((frameNum * 0.5).toFixed(1));
        setProgressPct(Math.round((frameNum / TOTAL_DEMO_STEPS) * 100));

        const scenario = getDemoScenarioForStep(frameNum);
        renderSimulatedSceneFrame(ctx, canvas.width, canvas.height, scenario, frameNum);
        if (capCtx) {
          capCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
        }
      } else {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.paused || video.ended) {
          timeoutId = window.setTimeout(analyzeNextFrame, 250);
          return;
        }
        frameNum = processedCount + 1;
        timeSec = Number(video.currentTime.toFixed(1));
      }

      const effectiveThreshold = Math.max(
        MIN_CONFIDENCE_RATIO * 100,
        settings.confidenceThreshold
      );
      const requiredFrames = Math.max(MIN_CONSECUTIVE_FRAMES, settings.persistenceFrames);

      const aiResult = await detect(captureCanvasRef.current, {
        threshold: effectiveThreshold,
        signal: abortController.signal,
      });

      if (cancelled) return;

      if (!aiResult.modelStatus.modelLoaded || aiResult.error) {
        onModelStatusChange(aiResult.modelStatus);
        setIsPlaying(false);
        setVideoError(aiResult.modelStatus.errorReason || MODEL_UNAVAILABLE_MESSAGE);
        latestBoxesRef.current = [];
        consecutiveCountRef.current = 0;
        activeHazardClassRef.current = null;
        trackerRef.current.reset();
        setConsecutiveFrames(0);
        setVerifiedStatus('normal');
        onStatusChange('normal', 0, 'Video Stream', false);
        return;
      }

      if (aiResult.modelStatus.modelVersion !== modelStatus.modelVersion) {
        onModelStatusChange(aiResult.modelStatus);
      }

      const validBoxes = aiResult.detections;
      latestBoxesRef.current = validBoxes;
      processedCount += 1;
      setFramesProcessed(processedCount);

      if (mode === 'demo_clip' && validBoxes.length > 0) {
        drawDetectionsOnCanvas(ctx, canvas.width, canvas.height, validBoxes);
      }

      if (aiResult.fireCount > 0) setFireFrames((p) => p + 1);
      if (aiResult.smokeCount > 0) setSmokeFrames((p) => p + 1);

      const frameState = advanceConsecutiveFrameState(
        consecutiveCountRef.current,
        validBoxes,
        requiredFrames,
        activeHazardClassRef.current
      );
      consecutiveCountRef.current = frameState.consecutiveCount;
      activeHazardClassRef.current = frameState.activeHazardClass;
      setConsecutiveFrames(frameState.consecutiveCount);

      const hasHazard = validBoxes.length > 0;
      const evalRes = trackerRef.current.evaluateFrame(
        hasHazard && frameState.consecutiveCount > 0,
        requiredFrames,
        settings.cooldownSeconds
      );

      setVerifiedStatus(frameState.statusToEmit);

      if (
        frameState.statusToEmit === 'fire_emergency' ||
        frameState.statusToEmit === 'smoke_warning'
      ) {
        const shouldAlarm =
          evalRes.alertTriggered && frameState.statusToEmit === 'fire_emergency';
        onStatusChange(
          frameState.statusToEmit,
          aiResult.maxConfidence,
          'Video Stream',
          shouldAlarm
        );
      } else {
        onStatusChange('normal', 0, 'Video Stream', false);
      }

      if (hasHazard) {
        const detType = summarizeDetectionType(validBoxes);
        setEvents((prev) => [
          {
            frame: frameNum,
            timeSec,
            type: detType,
            confidence: aiResult.maxConfidence,
          },
          ...prev.slice(0, 19),
        ]);

        if (frameState.verified && evalRes.alertTriggered && !loggedClipRef.current) {
          loggedClipRef.current = true;
          setLoggedForClip(true);
          const snapCanvas = document.createElement('canvas');
          snapCanvas.width = captureCanvasRef.current.width;
          snapCanvas.height = captureCanvasRef.current.height;
          const sCtx = snapCanvas.getContext('2d');
          if (sCtx) {
            sCtx.drawImage(captureCanvasRef.current, 0, 0);
            drawDetectionsOnCanvas(sCtx, snapCanvas.width, snapCanvas.height, validBoxes);
            onLogIncident({
              detectionType: detType,
              confidence: aiResult.maxConfidence,
              screenshotDataUrl: snapCanvas.toDataURL('image/png'),
              source: 'Video Stream',
              notes: `Verified in video "${videoName}" at ${timeSec}s via ${aiResult.modelStatus.modelName}.`,
            }).catch(() => {});
          }
        }
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(analyzeNextFrame, mode === 'demo_clip' ? 800 : 1200);
      }
    };

    timeoutId = window.setTimeout(analyzeNextFrame, 150);

    return () => {
      cancelled = true;
      abortController.abort();
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPlaying,
    mode,
    modelStatus.modelLoaded,
    settings.confidenceThreshold,
    settings.persistenceFrames,
    settings.cooldownSeconds,
    videoName,
  ]);

  useEffect(() => {
    if (mode === 'demo_clip' && canvasRef.current && framesProcessed === 0) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        renderSimulatedSceneFrame(ctx, 640, 480, 'clean_corridor', 0);
      }
    }
  }, [mode, framesProcessed]);

  const handlePlayToggle = () => {
    if (!modelStatus.modelLoaded && !isPlaying) {
      setVideoError(MODEL_UNAVAILABLE_MESSAGE);
      return;
    }
    setVideoError('');
    if (mode === 'uploaded' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      if (demoStepRef.current >= TOTAL_DEMO_STEPS) {
        resetMetrics();
      }
      setIsPlaying((prev) => !prev);
    }
  };

  return (
    <div className="space-y-6">
      {((!modelStatus.isLoading && !modelStatus.modelLoaded) || videoError) && (
        <div
          role="alert"
          data-testid="video-model-not-loaded-banner"
          className="p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/60 dark:border-red-800 text-sm font-semibold text-red-800 dark:text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <div>{videoError || MODEL_UNAVAILABLE_MESSAGE}</div>
              {modelStatus.errorReason && !videoError && (
                <div className="text-xs font-normal text-red-700 dark:text-red-300 mt-0.5">
                  {modelStatus.errorReason}
                </div>
              )}
            </div>
          </div>
          {!modelStatus.modelLoaded && (
            <button
              type="button"
              onClick={async () => {
                const refreshed = await fetchModelStatus();
                onModelStatusChange(refreshed);
                if (refreshed.modelLoaded) setVideoError('');
              }}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Retry Connection
            </button>
          )}
        </div>
      )}

      {/* Video Source Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Video Frame-by-Frame AI Analyzer
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Active file:{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">{videoName}</span> ·
            Model: {modelStatus.modelName} ({modelStatus.modelVersion})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            onChange={handleUploadVideo}
            className="hidden"
            aria-label="Upload video file"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Video</span>
          </button>

          <button
            type="button"
            onClick={handleLoadDemoClip}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Run Sample Fire Clip</span>
          </button>

          <button
            type="button"
            onClick={handlePlayToggle}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Process Video'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
              }
              resetMetrics();
            }}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Reset video analysis"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Processed Canvas + Timeline Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="aspect-[4/3] bg-slate-950 rounded-lg overflow-hidden">
            {mode === 'uploaded' && videoSrc && (
              <video ref={videoRef} src={videoSrc} className="hidden" muted playsInline />
            )}
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              data-testid="video-detection-canvas"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span>Scan Progress: {progressPct}%</span>
              <span>AI Frames Analyzed: {framesProcessed}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                style={{ width: `${progressPct}%` }}
                className="h-full bg-orange-600 transition-all duration-150"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              Video Verification Status
            </h3>

            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Safety Status</span>
              <span data-testid="video-safety-status" className="font-semibold">
                {!modelStatus.modelLoaded ? (
                  <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> AI MODEL UNAVAILABLE
                  </span>
                ) : verifiedStatus === 'fire_emergency' ? (
                  <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> 🔥 FIRE DETECTED
                  </span>
                ) : verifiedStatus === 'smoke_warning' ? (
                  <span className="text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5" /> 💨 SMOKE DETECTED
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> 🟢 SYSTEM SAFE
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Consecutive Frames</span>
              <span
                data-testid="video-consecutive-frames"
                className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white"
              >
                {Math.min(
                  consecutiveFrames,
                  Math.max(MIN_CONSECUTIVE_FRAMES, settings.persistenceFrames)
                )}{' '}
                / {Math.max(MIN_CONSECUTIVE_FRAMES, settings.persistenceFrames)} frames
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm pt-1">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                <div className="text-xs text-slate-500 dark:text-slate-400">Fire Frames</div>
                <div className="mt-1 font-mono text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                  {fireFrames}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                <div className="text-xs text-slate-500 dark:text-slate-400">Smoke Frames</div>
                <div className="mt-1 font-mono text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {smokeFrames}
                </div>
              </div>
            </div>

            {loggedForClip && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 pt-1">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Incident snapshot recorded in History</span>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white mb-3">
              Detected Hazard Timeline
            </h3>
            {events.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click &ldquo;Run Sample Fire Clip&rdquo; or upload a video and press Process Video to log AI-verified frame timestamps.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {events.map((ev, idx) => (
                  <div
                    key={`${ev.frame}-${idx}`}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {ev.type.includes('Fire') ? (
                        <Flame className="w-4 h-4 text-red-600 shrink-0" />
                      ) : (
                        <Wind className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {ev.type}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          t = {ev.timeSec}s · Frame #{ev.frame}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      {ev.confidence}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
