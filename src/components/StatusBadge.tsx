import React from 'react';
import {
  Flame,
  Wind,
  AlertTriangle,
  CheckCircle2,
  BellRing,
  Eye,
  Slash,
} from 'lucide-react';
import type { IncidentDetectionType, IncidentStatus } from '../types/detection';

export const IncidentTypeBadge: React.FC<{ type: IncidentDetectionType }> = ({ type }) => {
  const hasFire = type.includes('Fire');
  const hasSmoke = type.includes('Smoke');

  if (hasFire && hasSmoke) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900 whitespace-nowrap">
        <Flame className="w-3 h-3 shrink-0" />
        <span>Fire &amp; Smoke</span>
      </span>
    );
  }

  if (hasFire) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900 whitespace-nowrap">
        <Flame className="w-3 h-3 shrink-0" />
        <span>Fire</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900 whitespace-nowrap">
      <Wind className="w-3 h-3 shrink-0" />
      <span>Smoke</span>
    </span>
  );
};

export const IncidentStatusBadge: React.FC<{ status: IncidentStatus }> = ({ status }) => {
  switch (status) {
    case 'Active':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900 whitespace-nowrap">
          <BellRing className="w-3 h-3 shrink-0" />
          <span>Active</span>
        </span>
      );
    case 'Acknowledged':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900 whitespace-nowrap">
          <Eye className="w-3 h-3 shrink-0" />
          <span>Acknowledged</span>
        </span>
      );
    case 'Resolved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>Resolved</span>
        </span>
      );
    case 'False Alarm':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 whitespace-nowrap">
          <Slash className="w-3 h-3 shrink-0" />
          <span>False Alarm</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 whitespace-nowrap">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>{status}</span>
        </span>
      );
  }
};
