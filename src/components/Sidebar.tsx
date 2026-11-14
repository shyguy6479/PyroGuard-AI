import React from 'react';
import {
  LayoutDashboard,
  Video,
  Image as ImageIcon,
  Film,
  History,
  BarChart3,
  BookOpen,
  Flame,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  X,
} from 'lucide-react';
import type { AIModelStatus, AppPage, SystemStatusState } from '../types/detection';

interface SidebarProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  activeAlertsCount: number;
  systemStatus: SystemStatusState;
  modelStatus: AIModelStatus;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: AppPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'live', label: 'Live Detection', icon: Video },
  { id: 'image', label: 'Image Detection', icon: ImageIcon },
  { id: 'video', label: 'Video Detection', icon: Film },
  { id: 'history', label: 'Detection History', icon: History },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'about', label: 'About Project', icon: BookOpen },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  activeAlertsCount,
  systemStatus,
  modelStatus,
  mobileOpen,
  onCloseMobile,
}) => {
  const handleSelect = (page: AppPage) => {
    onNavigate(page);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl lg:shadow-none' : '-translate-x-full'
        }`}
        aria-label="Primary Navigation"
      >
        {/* PyroGuard AI Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleSelect('dashboard')}
            className="flex items-center gap-3 text-left group rounded-lg focus-visible:outline-2 focus-visible:outline-orange-500"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-600/25 group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                PyroGuard <span className="text-orange-600 dark:text-orange-400">AI</span>
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Fire &amp; Smoke Monitor
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Monitoring
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/25'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                      isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-orange-600 dark:group-hover:text-orange-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'history' && activeAlertsCount > 0 && (
                  <span
                    className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded-md tabular-nums ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300'
                    }`}
                    title={`${activeAlertsCount} active alerts`}
                  >
                    {activeAlertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Real-Time System Status Indicator */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div
            className={`p-3 rounded-xl border text-xs transition-colors duration-200 ${
              systemStatus === 'fire_emergency'
                ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-900 dark:text-red-200'
                : systemStatus === 'smoke_warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/50 dark:border-amber-900 dark:text-amber-200'
                  : 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900/70 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {systemStatus === 'fire_emergency' ? (
                <Flame className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              ) : systemStatus === 'smoke_warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span>
                {systemStatus === 'fire_emergency'
                  ? 'Fire Alert Active'
                  : systemStatus === 'smoke_warning'
                    ? 'Smoke Warning'
                    : 'System Safe'}
              </span>
            </div>
            <div
              className="mt-1.5 flex items-center gap-1.5 text-[11px] opacity-85"
              title={`${modelStatus.modelName} (${modelStatus.modelVersion})`}
            >
              <Cpu className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {modelStatus.isLoading
                  ? 'AI Model: Checking...'
                  : modelStatus.modelLoaded
                    ? 'AI Model Ready'
                    : 'AI Model Offline'}
              </span>
            </div>
          </div>

          <div className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
            B.Tech Computer Vision Project
          </div>
        </div>
      </aside>
    </>
  );
};
