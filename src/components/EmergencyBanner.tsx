import React from 'react';
import { AlertTriangle, Flame, VolumeX, Volume2, CheckCircle2 } from 'lucide-react';
import type { SystemStatusState } from '../types/detection';

interface EmergencyBannerProps {
  status: SystemStatusState;
  confidence: number;
  sourceLabel: string;
  alarmEnabled: boolean;
  alarmSounding: boolean;
  onEnableAlarm: () => void;
  onAcknowledge: () => void;
  onSilenceAlarm: () => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({
  status,
  confidence,
  sourceLabel,
  alarmEnabled,
  alarmSounding,
  onEnableAlarm,
  onAcknowledge,
  onSilenceAlarm,
}) => {
  if (status === 'normal') return null;

  const isFire = status === 'fire_emergency';

  return (
    <div
      role="alert"
      data-testid="emergency-alert-banner"
      className={`mx-4 sm:mx-6 mt-4 rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isFire
          ? 'bg-red-600 border-red-700 text-white'
          : 'bg-amber-500 border-amber-600 text-slate-950'
      }`}
    >
      <div className="flex items-start sm:items-center gap-3.5">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            isFire ? 'bg-red-700 text-white' : 'bg-amber-600/20 text-slate-950'
          }`}
        >
          {isFire ? <Flame className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
        </div>
        <div>
          <div className="font-display font-bold text-lg leading-tight">
            {isFire ? '⚠ FIRE DETECTED!' : '⚠ SMOKE DETECTED!'}
          </div>
          <div
            className={`text-sm mt-0.5 font-mono tabular-nums ${
              isFire ? 'text-red-100' : 'text-slate-900'
            }`}
          >
            Confidence: {confidence}% · Source: {sourceLabel} ·{' '}
            {alarmEnabled ? (alarmSounding ? '🔊 Alarm Sounding' : '🔊 Alarm Ready') : '🔇 Alarm Disabled'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {!alarmEnabled && (
          <button
            type="button"
            onClick={onEnableAlarm}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              isFire
                ? 'bg-red-800 hover:bg-red-900 text-white'
                : 'bg-amber-700 text-white hover:bg-amber-800'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Enable Alarm</span>
          </button>
        )}

        <button
          type="button"
          onClick={onSilenceAlarm}
          data-testid="banner-silence-alarm"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            isFire
              ? 'bg-red-700 hover:bg-red-800 text-white'
              : 'bg-amber-600/20 hover:bg-amber-600/30 text-slate-950'
          }`}
        >
          <VolumeX className="w-4 h-4" />
          <span>Silence Alarm</span>
        </button>

        <button
          type="button"
          onClick={onAcknowledge}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            isFire
              ? 'bg-white text-red-700 hover:bg-red-50'
              : 'bg-slate-950 text-white hover:bg-slate-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Acknowledge</span>
        </button>
      </div>
    </div>
  );
};
