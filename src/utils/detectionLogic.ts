import type {
  BoundingBox,
  DetectionClass,
  IncidentDetectionType,
  IncidentRecord,
  SystemStatusState,
} from '../types/detection';

// Strict allowlist: accept ONLY objects explicitly identified as 'fire' (class ID 0) or 'smoke' (class ID 1)
export const ALLOWED_CLASS_IDS = new Set<number>([0, 1]);
export const CLASS_ID_BY_LABEL: Record<string, number> = {
  fire: 0,
  smoke: 1,
};
export const ALLOWED_CLASS_LABELS = new Set<string>(['fire', 'smoke']);
export const MIN_CONFIDENCE_RATIO = 0.75;
export const MIN_CONSECUTIVE_FRAMES = 5;

export interface RawDetectedObject extends Omit<Partial<BoundingBox>, 'label'> {
  classId?: number;
  class_id?: number;
  label?: string;
  confidence?: number;
}

export interface ConsecutiveFrameState {
  consecutiveCount: number;
  verified: boolean;
  statusToEmit: SystemStatusState;
  activeHazardClass: 'fire' | 'smoke' | null;
}

/**
 * Derives the overall system safety status from active bounding boxes.
 */
export function deriveSystemStatus(detections: BoundingBox[]): SystemStatusState {
  if (detections.some((d) => d.label === 'Fire')) {
    return 'fire_emergency';
  }
  if (detections.some((d) => d.label === 'Smoke')) {
    return 'smoke_warning';
  }
  return 'normal';
}

/**
 * Summarizes detected bounding boxes into a single IncidentDetectionType string.
 */
export function summarizeDetectionType(detections: BoundingBox[]): IncidentDetectionType {
  const hasFire = detections.some((d) => d.label === 'Fire');
  const hasSmoke = detections.some((d) => d.label === 'Smoke');
  if (hasFire && hasSmoke) return 'Fire & Smoke';
  if (hasFire) return 'Fire';
  return 'Smoke';
}

/**
 * Strict detection allowlist filter for real AI model predictions:
 * - Only accepts detections whose class label explicitly matches 'fire' or 'smoke'
 * - Checks class IDs against the strict allowlist (0 = fire, 1 = smoke)
 * - Enforces >= 0.75 (75%) minimum confidence and finite positive bounding box dimensions
 * - Never fabricates bounding boxes; discards all invalid/non-hazard objects before UI/state
 */
export function filterAllowedHazardDetections(
  detections: readonly RawDetectedObject[] | null | undefined,
  minConfidenceRatio = MIN_CONFIDENCE_RATIO
): BoundingBox[] {
  if (!Array.isArray(detections) || detections.length === 0) {
    return [];
  }

  const minScore = Math.max(
    MIN_CONFIDENCE_RATIO,
    minConfidenceRatio > 1 ? minConfidenceRatio / 100 : minConfidenceRatio
  );

  return detections
    .filter((det): det is RawDetectedObject => {
      if (!det || typeof det !== 'object') {
        return false;
      }

      const normalizedLabel =
        typeof det.label === 'string' ? det.label.trim().toLowerCase() : '';
      if (
        (normalizedLabel !== 'fire' && normalizedLabel !== 'smoke') ||
        !ALLOWED_CLASS_LABELS.has(normalizedLabel)
      ) {
        return false;
      }

      const explicitClassId =
        typeof det.classId === 'number' ? det.classId : det.class_id;
      const resolvedClassId = explicitClassId ?? CLASS_ID_BY_LABEL[normalizedLabel];
      if (typeof resolvedClassId !== 'number' || !ALLOWED_CLASS_IDS.has(resolvedClassId)) {
        return false;
      }

      const rawConf = typeof det.confidence === 'number' ? det.confidence : NaN;
      if (!Number.isFinite(rawConf)) {
        return false;
      }
      const normalizedScore = rawConf > 1 ? rawConf / 100 : rawConf;
      if (normalizedScore < minScore || normalizedScore < MIN_CONFIDENCE_RATIO) {
        return false;
      }

      const x = typeof det.x === 'number' ? det.x : NaN;
      const y = typeof det.y === 'number' ? det.y : NaN;
      const w = typeof det.width === 'number' ? det.width : NaN;
      const h = typeof det.height === 'number' ? det.height : NaN;
      return (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(w) &&
        Number.isFinite(h) &&
        x >= 0 &&
        y >= 0 &&
        w > 0 &&
        h > 0
      );
    })
    .map((det, idx) => {
      const normalizedLabel = (det.label ?? '').trim().toLowerCase();
      const rawConf = det.confidence as number;
      const confidencePercent = Math.min(
        100,
        Math.round(rawConf <= 1 ? rawConf * 100 : rawConf)
      );
      const label: DetectionClass = normalizedLabel === 'fire' ? 'Fire' : 'Smoke';
      return {
        id: det.id ?? `${normalizedLabel}-${idx + 1}`,
        label,
        confidence: confidencePercent,
        x: Math.max(0, Math.min(1, det.x as number)),
        y: Math.max(0, Math.min(1, det.y as number)),
        width: Math.max(0, Math.min(1, det.width as number)),
        height: Math.max(0, Math.min(1, det.height as number)),
      };
    });
}

/**
 * State transition for consecutive-frame detection verification:
 * - Increments counter on valid 'fire' or 'smoke' detections
 * - Immediately resets to 0 when a frame contains no valid detection
 * - Only emits 'fire_emergency' or 'smoke_warning' once counter reaches >= 5 consecutive frames
 */
export function advanceConsecutiveFrameState(
  currentCount: number,
  validDetections: readonly BoundingBox[],
  requiredFrames = MIN_CONSECUTIVE_FRAMES,
  previousHazardClass: 'fire' | 'smoke' | null = null
): ConsecutiveFrameState {
  const minFrames = Math.max(MIN_CONSECUTIVE_FRAMES, requiredFrames);
  if (!Array.isArray(validDetections) || validDetections.length === 0) {
    return {
      consecutiveCount: 0,
      verified: false,
      statusToEmit: 'normal',
      activeHazardClass: null,
    };
  }

  const derivedStatus = deriveSystemStatus([...validDetections]);
  const currentHazardClass: 'fire' | 'smoke' | null =
    derivedStatus === 'fire_emergency'
      ? 'fire'
      : derivedStatus === 'smoke_warning'
        ? 'smoke'
        : null;

  if (!currentHazardClass) {
    return {
      consecutiveCount: 0,
      verified: false,
      statusToEmit: 'normal',
      activeHazardClass: null,
    };
  }

  const isSameClass =
    previousHazardClass === null || previousHazardClass === currentHazardClass;
  const nextCount = isSameClass ? currentCount + 1 : 1;
  const verified = nextCount >= minFrames;
  const statusToEmit = verified ? derivedStatus : 'normal';

  return {
    consecutiveCount: nextCount,
    verified,
    statusToEmit,
    activeHazardClass: currentHazardClass,
  };
}

/**
 * Multi-Frame False Alarm Reduction & Cooldown State Machine.
 * Requires consecutive verified frames (default 5) before triggering alert,
 * resets immediately when hazard disappears, and enforces cooldown between triggers.
 */
export interface AlertEvaluation {
  consecutiveDetections: number;
  alertTriggered: boolean;
  verifiedActive: boolean;
  cooldownRemainingMs: number;
  suppressedByCooldown: boolean;
}

export class MultiFrameAlertTracker {
  private consecutiveFrames = 0;
  private lastAlertTimestampMs = -Infinity;

  public reset(): void {
    this.consecutiveFrames = 0;
    this.lastAlertTimestampMs = -Infinity;
  }

  public evaluateFrame(
    hasDetection: boolean,
    requiredConsecutiveFrames = MIN_CONSECUTIVE_FRAMES,
    cooldownSeconds = 15,
    nowMs: number = Date.now()
  ): AlertEvaluation {
    const cooldownMs = Math.max(0, cooldownSeconds) * 1000;
    const elapsedSinceLast = nowMs - this.lastAlertTimestampMs;
    const inCooldown =
      this.lastAlertTimestampMs !== -Infinity && elapsedSinceLast < cooldownMs;

    if (!hasDetection) {
      this.consecutiveFrames = 0;
      return {
        consecutiveDetections: 0,
        alertTriggered: false,
        verifiedActive: false,
        cooldownRemainingMs: inCooldown ? Math.max(0, cooldownMs - elapsedSinceLast) : 0,
        suppressedByCooldown: false,
      };
    }

    this.consecutiveFrames += 1;
    const thresholdMet = this.consecutiveFrames >= Math.max(MIN_CONSECUTIVE_FRAMES, requiredConsecutiveFrames);

    if (thresholdMet && !inCooldown) {
      this.lastAlertTimestampMs = nowMs;
      return {
        consecutiveDetections: this.consecutiveFrames,
        alertTriggered: true,
        verifiedActive: true,
        cooldownRemainingMs: cooldownMs,
        suppressedByCooldown: false,
      };
    }

    return {
      consecutiveDetections: this.consecutiveFrames,
      alertTriggered: false,
      verifiedActive: thresholdMet,
      cooldownRemainingMs: inCooldown ? Math.max(0, cooldownMs - elapsedSinceLast) : 0,
      suppressedByCooldown: thresholdMet && inCooldown,
    };
  }
}

/**
 * Filters incident history records by search term, detection type, and status.
 */
export function filterIncidents(
  incidents: IncidentRecord[],
  searchQuery: string,
  typeFilter: string,
  statusFilter: string
): IncidentRecord[] {
  const q = searchQuery.trim().toLowerCase();
  return incidents.filter((item) => {
    const matchesSearch =
      q.length === 0 ||
      item.id.toLowerCase().includes(q) ||
      item.detectionType.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q) ||
      (item.notes ?? '').toLowerCase().includes(q);

    const matchesType =
      typeFilter === 'All' ||
      (typeFilter === 'Fire' && item.detectionType.includes('Fire')) ||
      (typeFilter === 'Smoke' && item.detectionType.includes('Smoke'));

    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });
}

export interface AnalyticsSummary {
  totalDetections: number;
  fireDetections: number;
  smokeDetections: number;
  activeAlerts: number;
  resolvedCount: number;
  avgConfidence: number;
  byDay: Array<{ dateLabel: string; fire: number; smoke: number }>;
  bySource: Array<{ source: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

/**
 * Computes dashboard & analytics aggregations from incident records.
 */
export function computeAnalytics(incidents: IncidentRecord[]): AnalyticsSummary {
  const fireDetections = incidents.filter((i) => i.detectionType.includes('Fire')).length;
  const smokeDetections = incidents.filter((i) => i.detectionType.includes('Smoke')).length;
  const activeAlerts = incidents.filter((i) => i.status === 'Active').length;
  const resolvedCount = incidents.filter((i) => i.status === 'Resolved').length;
  const avgConfidence =
    incidents.length > 0
      ? Math.round(
          incidents.reduce((sum, item) => sum + item.confidence, 0) / incidents.length
        )
      : 0;

  const dayMap = new Map<string, { fire: number; smoke: number }>();
  const sourceMap = new Map<string, number>();
  const statusMap = new Map<string, number>();

  for (const item of incidents) {
    const dayKey = item.timestamp.slice(0, 10);
    const existingDay = dayMap.get(dayKey) ?? { fire: 0, smoke: 0 };
    if (item.detectionType.includes('Fire')) existingDay.fire += 1;
    if (item.detectionType.includes('Smoke')) existingDay.smoke += 1;
    dayMap.set(dayKey, existingDay);

    sourceMap.set(item.source, (sourceMap.get(item.source) ?? 0) + 1);
    statusMap.set(item.status, (statusMap.get(item.status) ?? 0) + 1);
  }

  const byDay = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([dateLabel, counts]) => ({
      dateLabel: dateLabel.slice(5),
      fire: counts.fire,
      smoke: counts.smoke,
    }));

  const bySource = Array.from(sourceMap.entries()).map(([source, count]) => ({
    source,
    count,
  }));

  const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  return {
    totalDetections: incidents.length,
    fireDetections,
    smokeDetections,
    activeAlerts,
    resolvedCount,
    avgConfidence,
    byDay,
    bySource,
    byStatus,
  };
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats incident history rows as an RFC-4180 CSV string for report download.
 */
export function formatIncidentsCsv(incidents: IncidentRecord[]): string {
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
  const rows = incidents.map((item) =>
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

  return [headers.join(','), ...rows].join('\n');
}
