import React from 'react';
import {
  Menu,
  Moon,
  Sun,
  VolumeX,
  Volume2,
  ShieldCheck,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import type { AppPage, SystemStatusState } from '../types/detection';

interface TopBarProps {
  activePage: AppPage;
  systemStatus: SystemStatusState;
  darkMode: boolean;
  onToggleTheme: () => void;
  alarmEnabled: boolean;
  alarmSounding: boolean;
  onEnableAlarm: () => void;
  onDisableAlarm: () => void;
  onTestAlarm: () => void;
  onSilenceAlarm: () => void;
  onOpenMobileMenu: () => void;
}

const PAGE_TITLES: Record<AppPage, string> = {
  dashboard: 'Safety Overview',
  live: 'Live Camera Detection',
  image: 'Image Fire & Smoke Detection',
  video: 'Video Frame Analysis',
  history: 'Incident Detection History',
  analytics: 'Detection Analytics & Alerts',
  about: 'Project Architecture & Viva Guide',
};

export const TopBar: React.FC<TopBarProps> = ({
  activePage,
  systemStatus,
  darkMode,
  onToggleTheme,
  alarmEnabled,
  alarmSounding,
  onEnableAlarm,
  onDisableAlarm,
  onTestAlarm,
  onSilenceAlarm,
  onOpenMobileMenu,
}) => {
  return (
    <header className="h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Open navigation menu"
          title="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate tracking-tight">
            {PAGE_TITLES[activePage]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Real-Time System Status Badge */}
        <div
          data-testid="system-status-indicator"
          role="status"
          aria-live="polite"
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-colors duration-200 ${
            systemStatus === 'fire_emergency'
              ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950/60 dark:border-red-800 dark:text-red-300 shadow-xs shadow-red-600/10'
              : systemStatus === 'smoke_warning'
                ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/80 dark:text-emerald-300'
          }`}
        >
          {systemStatus === 'fire_emergency' ? (
            <>
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">FIRE DETECTED – EMERGENCY ALERT</span>
              <span className="md:hidden">Fire Alert</span>
            </>
          ) : systemStatus === 'smoke_warning' ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">SMOKE DETECTED – WARNING</span>
              <span className="md:hidden">Smoke</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">SYSTEM SAFE – No Fire or Smoke Detected</span>
              <span className="md:hidden">SAFE</span>
            </>
          )}
        </div>

        {/* Alarm Status Controls */}
        {alarmSounding ? (
          <button
            type="button"
            onClick={onSilenceAlarm}
            data-testid="topbar-silence-alarm"
            title="Silence emergency siren"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold whitespace-nowrap shadow-xs"
          >
            <VolumeX className="w-3.5 h-3.5 shrink-0" />
            <span>Silence Alarm</span>
          </button>
        ) : alarmEnabled ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDisableAlarm}
              data-testid="alarm-status-button"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-950/70 whitespace-nowrap"
              title="Alarm armed — click to disarm audio"
            >
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Alarm Armed</span>
              <span className="sm:hidden">Armed</span>
            </button>
            <button
              type="button"
              onClick={onTestAlarm}
              data-testid="test-alarm-button"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              title="Test emergency siren audio"
            >
              <span>Test Siren</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEnableAlarm}
            data-testid="enable-alarm-button"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-200 text-xs font-semibold hover:bg-orange-100 dark:hover:bg-orange-950/70 whitespace-nowrap"
            title="Click once to unlock browser audio for fire alarms"
          >
            <VolumeX className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Enable Alarm</span>
            <span className="sm:hidden">Alarm Off</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-600" />
              <span className="hidden lg:inline">Dark</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
