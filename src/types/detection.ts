export type DetectionClass = 'Fire' | 'Smoke';

export type SystemStatusState = 'normal' | 'smoke_warning' | 'fire_emergency';

export type IncidentStatus = 'Active' | 'Acknowledged' | 'Resolved' | 'False Alarm';

export type IncidentSource = 'Live Camera' | 'Image Upload' | 'Video Stream';

export type IncidentDetectionType = 'Fire' | 'Smoke' | 'Fire & Smoke';

export interface BoundingBox {
  id: string;
  label: DetectionClass;
  /** Confidence percentage between 0 and 100 */
  confidence: number;
  /** Normalized left coordinate [0..1] */
  x: number;
  /** Normalized top coordinate [0..1] */
  y: number;
  /** Normalized width [0..1] */
  width: number;
  /** Normalized height [0..1] */
  height: number;
}

export interface DetectionResult {
  detections: BoundingBox[];
  status: SystemStatusState;
  maxConfidence: number;
  fireCount: number;
  smokeCount: number;
  inferenceMs: number;
  engine: string;
}

export interface AIModelStatus {
  modelLoaded: boolean;
  modelEnabled: boolean;
  isLoading?: boolean;
  modelName: string;
  modelType: string;
  modelVersion: string;
  supportedClasses: DetectionClass[];
  statusMessage: string;
  errorReason?: string;
}

export interface IncidentRecord {
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

export interface AlertSettings {
  confidenceThreshold: number;
  persistenceFrames: number;
  cooldownSeconds: number;
  alarmEnabled: boolean;
  emailAlertsEnabled: boolean;
  alertEmail: string;
}

export interface EmailDispatchLog {
  id: string;
  incidentId: string;
  recipient: string;
  subject: string;
  sentAt: string;
  detectionType: IncidentDetectionType;
  confidence: number;
  status: 'Dispatched' | 'Logged (SMTP Demo)';
}

export type AppPage =
  | 'dashboard'
  | 'live'
  | 'image'
  | 'video'
  | 'history'
  | 'analytics'
  | 'about';
