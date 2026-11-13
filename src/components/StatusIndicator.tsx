import React from 'react';
import { ShieldCheck, AlertTriangle, Flame } from 'lucide-react';
import type { SystemStatusState } from '../types/detection';

interface StatusIndicatorProps {
  status: SystemStatusState;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  if (status === 'fire_emergency') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 dark:text-red-400">
        <Flame className="w-4 h-4 shrink-0" />
        <span>Fire Detected – Emergency Alert</span>
      </span>
    );
  }
  if (status === 'smoke_warning') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Smoke Detected – Warning</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
      <ShieldCheck className="w-4 h-4 shrink-0" />
      <span>SYSTEM SAFE – No Fire or Smoke Detected</span>
    </span>
  );
};
