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
  X,
} from 'lucide-react';
import type { AppPage } from '../types/detection';

interface SidebarProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  activeAlertsCount: number;
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
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Primary Navigation"
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              PyroGuard AI
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-orange-500 ${
                  isActive
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'history' && activeAlertsCount > 0 && (
                  <span
                    className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                    }`}
                  >
                    {activeAlertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <div className="font-medium text-slate-700 dark:text-slate-300">
            Smart Fire &amp; Smoke Monitor
          </div>
          <div className="mt-0.5">B.Tech Computer Vision Project</div>
        </div>
      </aside>
    </>
  );
};
