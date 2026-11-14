import React, { useEffect, useState } from 'react';
import { X, Mail, Clock, Camera, ImageOff } from 'lucide-react';
import type { IncidentRecord } from '../types/detection';
import { IncidentStatusBadge, IncidentTypeBadge } from './StatusBadge';

export const IncidentThumbnail: React.FC<{
  src?: string;
  alt: string;
  className?: string;
  iconClassName?: string;
}> = ({ src, alt, className = 'w-20 h-13 object-cover bg-slate-900', iconClassName = 'w-4 h-4' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`${className} flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

interface IncidentDetailModalProps {
  incident: IncidentRecord | null;
  onClose: () => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  onClose,
}) => {
  useEffect(() => {
    if (!incident) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [incident, onClose]);

  if (!incident) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Incident ${incident.id} Details`}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full overflow-hidden shadow-xl page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white font-mono">
                {incident.id}
              </h3>
              <IncidentTypeBadge type={incident.detectionType} />
              <IncidentStatusBadge status={incident.status} />
            </div>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(incident.timestamp).toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" />
                {incident.source}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            aria-label="Close incident details"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="aspect-[4/3] bg-slate-950 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
            <IncidentThumbnail
              src={incident.screenshotUrl}
              alt={`Captured evidence frame for ${incident.id}`}
              className="w-full h-full object-contain"
              iconClassName="w-8 h-8"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-slate-500 dark:text-slate-400">Model Confidence</div>
              <div className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white">
                {incident.confidence}%
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-slate-500 dark:text-slate-400">Detection Source</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                {incident.source}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="text-slate-500 dark:text-slate-400">Email Notification</div>
              <div className="mt-1 font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-orange-600" />
                <span>{incident.emailSent ? 'Alert Logged' : 'Not Dispatched'}</span>
              </div>
            </div>
          </div>

          {incident.notes && (
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <span className="font-semibold text-slate-900 dark:text-white">Operator / AI Notes: </span>
              {incident.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
