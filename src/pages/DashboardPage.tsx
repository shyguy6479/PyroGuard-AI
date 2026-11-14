import React, { useMemo, useState } from 'react';
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
  Eye,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type {
  AppPage,
  IncidentRecord,
  SystemStatusState,
} from '../types/detection';
import { computeAnalytics } from '../utils/detectionLogic';
import { StatusIndicator } from '../components/StatusIndicator';
import { IncidentStatusBadge, IncidentTypeBadge } from '../components/StatusBadge';
import { IncidentDetailModal, IncidentThumbnail } from '../components/IncidentDetailModal';

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
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const analytics = useMemo(() => computeAnalytics(incidents), [incidents]);
  const recent = incidents.slice(0, 5);
  const maxDayVal = Math.max(
    1,
    ...analytics.byDay.map((d) => d.fire + d.smoke)
  );

  return (
    <div className="space-y-6">
      {/* System Status & Quick Actions Header */}
      <div
        className={`rounded-xl border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-200 ${
          systemStatus === 'fire_emergency'
            ? 'bg-red-50/70 border-red-200 dark:bg-red-950/30 dark:border-red-900'
            : systemStatus === 'smoke_warning'
              ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'
              : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {systemStatus === 'normal' ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            )}
            <span>Real-Time Monitoring Status</span>
          </div>
          <div>
            <StatusIndicator status={systemStatus} />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {systemStatus === 'normal'
              ? 'All active detection pipelines are nominal. Multi-frame verification (>= 5 frames) and strict fire/smoke class filtering armed.'
              : 'Active hazard detected across monitored stream. Review alert banner or open Live Monitor immediately.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('live')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs shadow-orange-600/20 whitespace-nowrap"
          >
            <Video className="w-4 h-4" />
            <span>Open Live Monitor</span>
          </button>
          <button
            type="button"
            onClick={onDownloadCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Detections
            </span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div
            data-testid="kpi-total-detections"
            className="mt-3 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums"
          >
            {analytics.totalDetections}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Historical database log · {analytics.avgConfidence}% avg conf
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Fire Detections
            </span>
            <span className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <div
            data-testid="kpi-fire-detections"
            className="mt-3 font-display text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums"
          >
            {analytics.fireDetections}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Historical thermal flame records
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Smoke Detections
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Wind className="w-4 h-4" />
            </span>
          </div>
          <div
            data-testid="kpi-smoke-detections"
            className="mt-3 font-display text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums"
          >
            {analytics.smokeDetections}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Historical plume warning records
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Active Alerts
            </span>
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                analytics.activeAlerts > 0
                  ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <BellRing className="w-4 h-4" />
            </span>
          </div>
          <div
            data-testid="kpi-active-alerts"
            className="mt-3 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums"
          >
            {analytics.activeAlerts}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {analytics.activeAlerts === 0 ? 'Unresolved: 0' : 'Requires review'} · {analytics.resolvedCount} resolved
          </div>
        </div>
      </div>

      {/* Detection Modules Grid */}
      <section aria-labelledby="detection-modules-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2
              id="detection-modules-heading"
              className="font-display font-bold text-base text-slate-900 dark:text-white"
            >
              Detection Modules
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select an inference pipeline to monitor live feeds or inspect uploaded media
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('live')}
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-orange-500/70 dark:hover:border-orange-500/60 rounded-xl p-5 text-left flex flex-col justify-between gap-4 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  Live Camera Detection
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Real-time webcam AI vision stream with 5-frame verification, bounding boxes, and siren control.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-orange-600 dark:text-orange-400">
              <span>Open Live Monitor</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('image')}
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-orange-500/70 dark:hover:border-orange-500/60 rounded-xl p-5 text-left flex flex-col justify-between gap-4 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  Image Upload Detection
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Drag-and-drop JPG, PNG, or WEBP snapshots for instant fire/smoke localization and confidence scoring.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-orange-600 dark:text-orange-400">
              <span>Open Image Analyzer</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('video')}
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-orange-500/70 dark:hover:border-orange-500/60 rounded-xl p-5 text-left flex flex-col justify-between gap-4 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  Video Frame-by-Frame Detection
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Scan recorded MP4/WEBM surveillance clips sequentially with timestamped hazard markers.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-orange-600 dark:text-orange-400">
              <span>Open Video Scanner</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </section>

      {/* Daily Incident Trend Bar Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Detection Activity by Day
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Historical fire and smoke alerts grouped by date (hover bars for breakdown)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
              Fire
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
              Smoke
            </span>
          </div>
        </div>

        <div className="relative mt-6 h-52 flex items-end gap-3 sm:gap-6 px-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          {analytics.byDay.length > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-2 bottom-8 flex flex-col justify-between"
            >
              <div className="border-t border-dashed border-slate-200/80 dark:border-slate-800/80" />
              <div className="border-t border-dashed border-slate-200/80 dark:border-slate-800/80" />
              <div className="border-t border-dashed border-slate-200/80 dark:border-slate-800/80" />
            </div>
          )}
          {analytics.byDay.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center">
              <Activity className="w-6 h-6 text-slate-300 dark:text-slate-600 mb-2" />
              <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                No detection activity recorded yet
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Verified Fire or Smoke detections will populate daily trends automatically.
              </p>
            </div>
          ) : (
            analytics.byDay.map((day) => {
              const fireHeight = Math.round((day.fire / maxDayVal) * 140);
              const smokeHeight = Math.round((day.smoke / maxDayVal) * 140);
              const total = day.fire + day.smoke;
              return (
                <div
                  key={day.dateLabel}
                  className="group relative flex-1 flex flex-col items-center justify-end gap-2 h-full"
                >
                  {/* Hover Tooltip */}
                  <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-2 z-10 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-mono shadow-lg whitespace-nowrap border border-slate-700">
                    <div className="font-semibold text-slate-200">{day.dateLabel} · Total {total}</div>
                    <div className="text-red-300">Fire: {day.fire}</div>
                    <div className="text-amber-300">Smoke: {day.smoke}</div>
                  </div>

                  <div className="text-[11px] font-mono font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    {total}
                  </div>
                  <div className="w-full max-w-[44px] flex flex-col justify-end rounded-t-md overflow-hidden bg-slate-100 dark:bg-slate-800 group-hover:ring-2 group-hover:ring-orange-500/40 transition-all">
                    {day.smoke > 0 && (
                      <div
                        style={{ height: `${Math.max(10, smokeHeight)}px` }}
                        className="w-full bg-amber-500 transition-all"
                      />
                    )}
                    {day.fire > 0 && (
                      <div
                        style={{ height: `${Math.max(10, fireHeight)}px` }}
                        className="w-full bg-red-600 transition-all"
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
            className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline whitespace-nowrap"
          >
            View All History
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                <th className="py-3 px-4">Preview</th>
                <th className="py-3 px-4">Incident ID</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Detection Type</th>
                <th className="py-3 px-4 text-right">Confidence</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {recent.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2.5 px-4">
                    <button
                      type="button"
                      onClick={() => setSelectedIncident(item)}
                      className="block rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-orange-500 transition-colors"
                      aria-label={`Open details for ${item.id}`}
                    >
                      <IncidentThumbnail
                        src={item.screenshotUrl}
                        alt={`Snapshot for ${item.id}`}
                        className="w-16 h-11 object-cover bg-slate-900"
                      />
                    </button>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {item.id}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4">
                    <IncidentTypeBadge type={item.detectionType} />
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                    {item.confidence}%
                  </td>
                  <td className="py-2.5 px-4">
                    <IncidentStatusBadge status={item.status} />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedIncident(item)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-400 whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Details</span>
                    </button>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center">
                    <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      No incidents recorded yet
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Run Live Camera, Image Upload, or Video Detection to log verified events.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
      />
    </div>
  );
};
