import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  ScanSearch,
  CheckCircle2,
  ShieldCheck,
  Flame,
  Wind,
  AlertTriangle,
} from 'lucide-react';
import type {
  AIModelStatus,
  AlertSettings,
  DetectionResult,
  IncidentDetectionType,
  IncidentSource,
  SystemStatusState,
} from '../types/detection';
import {
  MIN_CONFIDENCE_RATIO,
  summarizeDetectionType,
} from '../utils/detectionLogic';
import {
  detect,
  fetchModelStatus,
  resetModelCooldowns,
  MODEL_UNAVAILABLE_MESSAGE,
} from '../services/detectionService';
import { drawDetectionsOnCanvas } from '../utils/drawDetections';
import { DEMO_SCENES, generateSampleSceneDataUrl, type DemoSceneId } from '../utils/sampleFrames';

interface ImageDetectionPageProps {
  settings: AlertSettings;
  modelStatus: AIModelStatus;
  onModelStatusChange: (status: AIModelStatus) => void;
  onStatusChange: (status: SystemStatusState, confidence: number, source: string) => void;
  onLogIncident: (payload: {
    detectionType: IncidentDetectionType;
    confidence: number;
    screenshotDataUrl: string;
    source: IncidentSource;
    notes?: string;
  }) => Promise<void>;
}

export const ImageDetectionPage: React.FC<ImageDetectionPageProps> = ({
  settings,
  modelStatus,
  onModelStatusChange,
  onStatusChange,
  onLogIncident,
}) => {
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [annotatedUrl, setAnnotatedUrl] = useState<string>('');
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<DetectionResult | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const loadSampleImage = (sceneId: DemoSceneId, title: string) => {
    const dataUrl = generateSampleSceneDataUrl(sceneId, 640, 480);
    setOriginalUrl(dataUrl);
    setAnnotatedUrl('');
    setAnalysisResult(null);
    setSavedSuccess(false);
    setErrorMsg('');
    setSelectedLabel(title);
  };

  const processImageFile = (file: File | undefined) => {
    if (!file) return;
    if (!/\.(jpe?g|png|webp)$/i.test(file.name) && !file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid JPG, JPEG, PNG, or WEBP image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOriginalUrl(reader.result);
        setAnnotatedUrl('');
        setAnalysisResult(null);
        setSavedSuccess(false);
        setErrorMsg('');
        setSelectedLabel(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processImageFile(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processImageFile(e.dataTransfer.files?.[0]);
  };

  const handleAnalyze = async () => {
    if (!originalUrl) {
      setErrorMsg('Please upload an image or pick a sample test scene first.');
      return;
    }

    let currentStatus = modelStatus;
    if (currentStatus.isLoading || !currentStatus.modelLoaded) {
      currentStatus = await fetchModelStatus();
      onModelStatusChange(currentStatus);
    }

    if (!currentStatus.modelLoaded) {
      setErrorMsg(currentStatus.errorReason || MODEL_UNAVAILABLE_MESSAGE);
      setAnnotatedUrl('');
      setAnalysisResult(null);
      onStatusChange('normal', 0, 'Image Upload');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg('');
    setSavedSuccess(false);

    try {
      const img = new Image();
      img.src = originalUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to decode selected image.'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable.');

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const effectiveThreshold = Math.max(
        MIN_CONFIDENCE_RATIO * 100,
        settings.confidenceThreshold
      );

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 45000);

      let aiResult;
      try {
        // Run central AI detection service detect(frame) on normalized canvas frame
        aiResult = await detect(canvas, {
          threshold: effectiveThreshold,
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (!aiResult.modelStatus.modelLoaded || aiResult.error) {
        onModelStatusChange(aiResult.modelStatus);
        setAnnotatedUrl('');
        setAnalysisResult(null);
        setErrorMsg(aiResult.modelStatus.errorReason || MODEL_UNAVAILABLE_MESSAGE);
        onStatusChange('normal', 0, 'Image Upload');
        return;
      }

      onModelStatusChange(aiResult.modelStatus);

      const finalDetections = aiResult.detections;
      if (finalDetections.length > 0) {
        drawDetectionsOnCanvas(ctx, canvas.width, canvas.height, finalDetections);
      }

      const annotatedDataUrl = canvas.toDataURL('image/png');
      const fullResult: DetectionResult = {
        detections: finalDetections,
        status: aiResult.status,
        maxConfidence: aiResult.maxConfidence,
        fireCount: aiResult.fireCount,
        smokeCount: aiResult.smokeCount,
        inferenceMs: aiResult.inferenceMs,
        engine: aiResult.engine,
      };

      setAnnotatedUrl(annotatedDataUrl);
      setAnalysisResult(fullResult);
      onStatusChange(aiResult.status, aiResult.maxConfidence, 'Image Upload');

      if (finalDetections.length > 0) {
        const detType = summarizeDetectionType(finalDetections);
        await onLogIncident({
          detectionType: detType,
          confidence: aiResult.maxConfidence,
          screenshotDataUrl: annotatedDataUrl,
          source: 'Image Upload',
          notes: `Image analysis (${selectedLabel || 'Uploaded image'}) via ${aiResult.engine}.`,
        });
        setSavedSuccess(true);
      }
    } catch {
      setAnnotatedUrl('');
      setAnalysisResult(null);
      onStatusChange('normal', 0, 'Image Upload');
      setErrorMsg(MODEL_UNAVAILABLE_MESSAGE);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Fail-Safe Warning if Model is Unavailable */}
      {!modelStatus.isLoading && !modelStatus.modelLoaded && (
        <div
          role="alert"
          data-testid="image-model-not-loaded-banner"
          className="p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/60 dark:border-red-800 text-sm font-semibold text-red-800 dark:text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <div>{MODEL_UNAVAILABLE_MESSAGE}</div>
              {modelStatus.errorReason && (
                <div className="text-xs font-normal text-red-700 dark:text-red-300 mt-0.5">
                  {modelStatus.errorReason}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              const refreshed = await resetModelCooldowns();
              onModelStatusChange(refreshed);
              if (refreshed.modelLoaded) setErrorMsg('');
            }}
            className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Upload & Sample Selection Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Upload Image or Select Sample Scene
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Model: {modelStatus.modelName} ({modelStatus.modelVersion}) ·{' '}
              {modelStatus.isLoading
                ? 'Loading...'
                : modelStatus.modelLoaded
                  ? 'Loaded and Ready'
                  : 'Not Loaded'}{' '}
              · Min confidence: {Math.max(75, settings.confidenceThreshold)}%
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleFileUpload}
              className="hidden"
              aria-label="Upload JPG, PNG, or WEBP image"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Image</span>
            </button>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!originalUrl || isAnalyzing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs whitespace-nowrap"
            >
              <ScanSearch className="w-4 h-4" />
              <span>{isAnalyzing ? 'Analyzing Frame...' : 'Analyze Frame'}</span>
            </button>
          </div>
        </div>

        {/* Drag-and-Drop Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
            isDragging
              ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/30'
              : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-950/40 hover:border-orange-400/70'
          }`}
        >
          <Upload className="w-6 h-6 text-orange-600 dark:text-orange-400 mx-auto mb-2" />
          <div className="text-xs font-semibold text-slate-900 dark:text-white">
            Drag and drop an image frame here, or{' '}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-orange-600 dark:text-orange-400 hover:underline font-semibold"
            >
              browse files
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Supported formats: JPG, JPEG, PNG, WEBP · Strict Fire &amp; Smoke localization
          </p>
        </div>

        {/* Analysis Progress Indicator */}
        {isAnalyzing && (
          <div className="space-y-1.5" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-xs font-medium text-orange-700 dark:text-orange-300">
              <span>Running AI vision model inference...</span>
              <span className="font-mono">Processing</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full w-2/3 bg-orange-600 rounded-full animate-pulse" />
            </div>
          </div>
        )}

        {/* Built-in Demo Samples */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Quick Test Sample Scenes
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DEMO_SCENES.map((scene) => (
              <button
                key={scene.id}
                type="button"
                onClick={() => loadSampleImage(scene.id, scene.title)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedLabel === scene.title
                    ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-950/30 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {scene.title}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {scene.subtitle}
                </div>
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="text-xs font-semibold text-red-600 dark:text-red-400">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Original vs Annotated Output */}
      {originalUrl ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                Original Image
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                {selectedLabel}
              </span>
            </div>
            <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">
              <img
                src={originalUrl}
                alt="Original input frame"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                AI Detection Result
              </h3>
              {analysisResult && (
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {analysisResult.engine} · {analysisResult.inferenceMs} ms
                </span>
              )}
            </div>
            <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">
              {annotatedUrl ? (
                <img
                  src={annotatedUrl}
                  alt="Annotated fire and smoke detection result"
                  data-testid="annotated-result-image"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-slate-400 px-6 text-center">
                  {isAnalyzing
                    ? 'Analyzing frame for fire and smoke regions...'
                    : 'Click “Analyze Frame” to run real AI Fire and Smoke detection.'}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center">
          <ScanSearch className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            Ready for Image Analysis
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Drop an image above or select one of the three sample scenes, then click Analyze Frame to view annotated bounding boxes.
          </p>
        </div>
      )}

      {/* Detection Breakdown */}
      {analysisResult && (
        <div
          data-testid="image-detection-summary"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {analysisResult.status === 'fire_emergency' ? (
                <Flame className="w-5 h-5 text-red-600" />
              ) : analysisResult.status === 'smoke_warning' ? (
                <Wind className="w-5 h-5 text-amber-600" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              )}
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                {analysisResult.status === 'fire_emergency'
                  ? `🔥 FIRE DETECTED (${analysisResult.detections.length} ${analysisResult.detections.length === 1 ? 'region' : 'regions'})`
                  : analysisResult.status === 'smoke_warning'
                    ? `💨 SMOKE DETECTED (${analysisResult.detections.length} ${analysisResult.detections.length === 1 ? 'region' : 'regions'})`
                    : '🟢 SYSTEM SAFE – No Fire or Smoke Detected'}
              </h3>
            </div>

            {savedSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved to Incident History</span>
              </span>
            )}
          </div>

          {analysisResult.detections.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {analysisResult.detections.map((box) => (
                <div
                  key={box.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div
                      className={`text-sm font-semibold ${
                        box.label === 'Fire'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {box.label}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Box [{Math.round(box.x * 100)}%, {Math.round(box.y * 100)}%] ·{' '}
                      {Math.round(box.width * 100)}%×{Math.round(box.height * 100)}%
                    </div>
                  </div>
                  <div className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                    {box.confidence}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
