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
    <header className="h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white truncate">
          {PAGE_TITLES[activePage]}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* System Safety Status Indicator */}
        <div
          data-testid="system-status-indicator"
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap ${
            systemStatus === 'fire_emergency'
              ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/60 dark:border-red-900 dark:text-red-300'
              : systemStatus === 'smoke_warning'
                ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/60 dark:border-amber-900 dark:text-amber-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-900 dark:text-emerald-300'
          }`}
        >
          {systemStatus === 'fire_emergency' ? (
            <>
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Fire Detected – Emergency Alert</span>
              <span className="md:hidden">Fire Alert</span>
            </>
          ) : systemStatus === 'smoke_warning' ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Smoke Detected – Warning</span>
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

        {/* Alarm Audio Status & Enable / Test / Silence Controls */}
        {alarmSounding ? (
          <button
            type="button"
            onClick={onSilenceAlarm}
            data-testid="topbar-silence-alarm"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
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
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
              title="Click to disable alarm audio"
            >
              <span className="hidden sm:inline">🔊 Alarm Enabled</span>
              <span className="sm:hidden">🔊 Enabled</span>
            </button>
            <button
              type="button"
              onClick={onTestAlarm}
              data-testid="test-alarm-button"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              title="Test emergency siren playback"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Test Siren</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEnableAlarm}
            data-testid="enable-alarm-button"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-200 text-xs font-semibold hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors whitespace-nowrap"
            title="Click once to unlock browser audio for fire alarms"
          >
            <span>🔇 Alarm Disabled · Enable Alarm</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? (
            <>
              <Sun className="w-4 h-4" />
              <span className="hidden lg:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4" />
              <span className="hidden lg:inline">Dark</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
