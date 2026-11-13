import React, { useMemo } from 'react';
import {
  Flame,
  Wind,
  Activity,
  BellRing,
  Video,
  Image as ImageIcon,
  Film,
  ArrowRight,
  Download,
} from 'lucide-react';
import type {
  AppPage,
  IncidentRecord,
  SystemStatusState,
} from '../types/detection';
import { computeAnalytics } from '../utils/detectionLogic';
import { StatusIndicator } from '../components/StatusIndicator';

interface DashboardPageProps {
  incidents: IncidentRecord[];
  systemStatus: SystemStatusState;
  onNavigate: (page: AppPage) => void;
  onDownloadCsv: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  incidents,
  systemStatus,
  onNavigate,
  onDownloadCsv,
}) => {
  const analytics = useMemo(() => computeAnalytics(incidents), [incidents]);
  const recent = incidents.slice(0, 5);
  const maxDayVal = Math.max(
    1,
    ...analytics.byDay.map((d) => d.fire + d.smoke)
  );

  return (
    <div className="space-y-6">
      {/* System Status & Quick Actions Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Real-Time Monitoring Status
          </div>
          <div className="mt-1">
            <StatusIndicator status={systemStatus} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Multi-frame false-alarm filtering and automated screenshot logging active.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('live')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Video className="w-4 h-4" />
            <span>Open Live Monitor</span>
          </button>
          <button
            type="button"
            onClick={onDownloadCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Detections</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div
            data-testid="kpi-total-detections"
            className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums"
          >
            {analytics.totalDetections}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Avg confidence {analytics.avgConfidence}%
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Fire Detections</span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div
            data-testid="kpi-fire-detections"
            className="mt-2 font-display text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums"
          >
            {analytics.fireDetections}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            High-priority thermal flame events
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Smoke Detections</span>
            <Wind className="w-4 h-4 text-amber-500" />
          </div>
          <div
            data-testid="kpi-smoke-detections"
            className="mt-2 font-display text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums"
          >
            {analytics.smokeDetections}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Early warning plume alerts
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Active Alerts</span>
            <BellRing className="w-4 h-4 text-orange-500" />
          </div>
          <div
            data-testid="kpi-active-alerts"
            className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums"
          >
            {analytics.activeAlerts}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {analytics.resolvedCount} resolved incidents
          </div>
        </div>
      </div>

      {/* Middle Row: Detection Modes & Daily Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Quick Detection Modes */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Detection Modules
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose an input stream to run real-time fire and smoke inference.
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="w-full p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-orange-500/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-orange-600 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    Live Camera Detection
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Webcam or simulated CCTV stream with instant alarm
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('image')}
              className="w-full p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-orange-500/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-orange-600 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    Image Upload Detection
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Upload JPG/PNG frames or test sample warehouse fires
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('video')}
              className="w-full p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-orange-500/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Film className="w-5 h-5 text-orange-600 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    Video Frame-by-Frame Scan
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Inspect recorded footage with timeline hazard markers
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </div>
        </div>

        {/* Daily Incident Trend Bar Chart */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Detection Activity by Day
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Fire and smoke alerts recorded across recent monitoring days
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block" />
                Fire
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                Smoke
              </span>
            </div>
          </div>

          <div className="mt-6 h-48 flex items-end gap-3 sm:gap-5 px-2">
            {analytics.byDay.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No detection activity recorded yet.
              </div>
            ) : (
              analytics.byDay.map((day) => {
                const fireHeight = Math.round((day.fire / maxDayVal) * 140);
                const smokeHeight = Math.round((day.smoke / maxDayVal) * 140);
                return (
                  <div
                    key={day.dateLabel}
                    className="flex-1 flex flex-col items-center justify-end gap-2 h-full"
                  >
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {day.fire + day.smoke}
                    </div>
                    <div className="w-full max-w-[42px] flex flex-col justify-end rounded-t-md overflow-hidden bg-slate-100 dark:bg-slate-800">
                      {day.smoke > 0 && (
                        <div
                          style={{ height: `${Math.max(8, smokeHeight)}px` }}
                          className="w-full bg-amber-500 transition-all"
                          title={`Smoke: ${day.smoke}`}
                        />
                      )}
                      {day.fire > 0 && (
                        <div
                          style={{ height: `${Math.max(8, fireHeight)}px` }}
                          className="w-full bg-red-600 transition-all"
                          title={`Fire: ${day.fire}`}
                        />
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {day.dateLabel}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Recent Incidents
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest verified fire and smoke detections saved to database
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline whitespace-nowrap"
          >
            View All History
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                <th className="py-3 px-4">Snapshot</th>
                <th className="py-3 px-4">Incident ID</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Confidence</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {recent.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2.5 px-4">
                    <img
                      src={item.screenshotUrl}
                      alt={`Snapshot for ${item.id}`}
                      referrerPolicy="no-referrer"
                      className="w-16 h-11 object-cover rounded border border-slate-200 dark:border-slate-700 bg-slate-900"
                    />
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs font-medium text-slate-900 dark:text-white">
                    {item.id}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 font-medium">
                    <span
                      className={
                        item.detectionType.includes('Fire')
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {item.detectionType}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                    {item.confidence}%
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                    {item.source}
                  </td>
                  <td className="py-2.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-200">
                    {item.status}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No incidents recorded yet. Run Live, Image, or Video detection to log events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
