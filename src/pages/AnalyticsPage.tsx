import React, { useMemo, useState } from 'react';
import { Mail, Send, CheckCircle2, Calendar, BarChart3, Flame, Wind } from 'lucide-react';
import type {
  AlertSettings,
  EmailDispatchLog,
  IncidentRecord,
} from '../types/detection';
import {
  computeAnalytics,
  filterIncidentsByDateRange,
  type DateRangeFilter,
} from '../utils/detectionLogic';

interface AnalyticsPageProps {
  incidents: IncidentRecord[];
  settings: AlertSettings;
  emailLogs: EmailDispatchLog[];
  onUpdateSettings: (partial: Partial<AlertSettings>) => Promise<void>;
  onSendTestEmail: (recipient: string) => Promise<void>;
}

const DATE_RANGES: Array<{ id: DateRangeFilter; label: string }> = [
  { id: '7d', label: 'Last 7 Days' },
  { id: '14d', label: 'Last 14 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'all', label: 'All Time' },
];

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  incidents,
  settings,
  emailLogs,
  onUpdateSettings,
  onSendTestEmail,
}) => {
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const filteredIncidents = useMemo(
    () => filterIncidentsByDateRange(incidents, dateRange),
    [incidents, dateRange]
  );
  const analytics = useMemo(
    () => computeAnalytics(filteredIncidents),
    [filteredIncidents]
  );

  const [emailInput, setEmailInput] = useState(settings.alertEmail);
  const [testNotice, setTestNotice] = useState('');

  const firePct =
    analytics.totalDetections > 0
      ? Math.round((analytics.fireDetections / analytics.totalDetections) * 100)
      : 0;
  const smokePct = analytics.totalDetections > 0 ? 100 - firePct : 0;
  const maxDayTotal = Math.max(1, ...analytics.byDay.map((d) => d.fire + d.smoke));

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestNotice('');
    await onUpdateSettings({ alertEmail: emailInput });
    await onSendTestEmail(emailInput);
    setTestNotice(`Alert verification email prepared & logged for ${emailInput}.`);
  };

  return (
    <div className="space-y-6">
      {/* Historical Analytics Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              Historical Incident Analytics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Computed from {filteredIncidents.length} verified database {filteredIncidents.length === 1 ? 'record' : 'records'}
            </p>
          </div>
        </div>

        <div
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800"
          role="group"
          aria-label="Filter analytics by date range"
        >
          {DATE_RANGES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDateRange(opt.id)}
              aria-pressed={dateRange === opt.id}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                dateRange === opt.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Analytical Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Historical Incidents
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {analytics.totalDetections}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            In selected time window
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Fire Share</span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {firePct}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {analytics.fireDetections} fire events
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Smoke Share</span>
            <Wind className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {smokePct}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {analytics.smokeDetections} smoke events
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Mean Model Confidence
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {analytics.avgConfidence}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {analytics.resolvedCount} resolved in window
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stacked Daily Trend */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Daily Fire &amp; Smoke Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Historical daily incident counts (hover bar for Fire vs Smoke breakdown)
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

          <div className="relative mt-6 h-56 flex items-end gap-4 px-2 border-b border-slate-100 dark:border-slate-800 pb-2">
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
                <BarChart3 className="w-7 h-7 text-slate-300 dark:text-slate-600 mb-2" />
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  No historical incidents in this date range
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Try selecting a wider timeframe or run new detection sessions.
                </p>
              </div>
            ) : (
              analytics.byDay.map((day) => {
                const fh = Math.round((day.fire / maxDayTotal) * 150);
                const sh = Math.round((day.smoke / maxDayTotal) * 150);
                const total = day.fire + day.smoke;
                return (
                  <div
                    key={day.dateLabel}
                    className="group relative flex-1 flex flex-col items-center justify-end gap-2 h-full"
                  >
                    <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-2 z-10 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-mono shadow-lg whitespace-nowrap border border-slate-700">
                      <div className="font-semibold text-slate-200">{day.dateLabel} · Total {total}</div>
                      <div className="text-red-300">Fire: {day.fire}</div>
                      <div className="text-amber-300">Smoke: {day.smoke}</div>
                    </div>

                    <span className="font-mono text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                      {total}
                    </span>
                    <div className="w-full max-w-[44px] flex flex-col justify-end rounded-t-md overflow-hidden bg-slate-100 dark:bg-slate-800 group-hover:ring-2 group-hover:ring-orange-500/40 transition-all">
                      {day.smoke > 0 && (
                        <div
                          style={{ height: `${Math.max(10, sh)}px` }}
                          className="w-full bg-amber-500 transition-all"
                        />
                      )}
                      {day.fire > 0 && (
                        <div
                          style={{ height: `${Math.max(10, fh)}px` }}
                          className="w-full bg-red-600 transition-all"
                        />
                      )}
                    </div>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {day.dateLabel}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Source & Status Breakdown */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Detections by Input Source
            </h2>
            {analytics.bySource.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                No source data available for the selected date range.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {analytics.bySource.map((row) => {
                  const pct =
                    analytics.totalDetections > 0
                      ? Math.round((row.count / analytics.totalDetections) * 100)
                      : 0;
                  return (
                    <div key={row.source} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                          {row.source}
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {row.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-orange-600 rounded-full transition-all duration-300"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              Resolution Status Breakdown
            </h3>
            {analytics.byStatus.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                No status records in selected timeframe.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {analytics.byStatus.map((row) => (
                  <div
                    key={row.status}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {row.status}
                    </span>
                    <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Alert Configuration & Dispatch Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleTestEmail}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Automated Email Alert Configuration
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            When fire or smoke exceeds persistence thresholds, the system prepares an email alert containing detection time, type, confidence %, and the captured screenshot.
          </p>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.emailAlertsEnabled}
              onChange={(e) => onUpdateSettings({ emailAlertsEnabled: e.target.checked })}
              className="rounded accent-orange-600 w-4 h-4"
            />
            <span>Enable Automated Email Alerts on Detection</span>
          </label>

          <div>
            <label
              htmlFor="alert-email-input"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Safety Officer Recipient Email
            </label>
            <input
              id="alert-email-input"
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Save &amp; Test Email Alert</span>
          </button>

          {testNotice && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{testNotice}</span>
            </div>
          )}
        </form>

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Email Alert Dispatch Log
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            Recent automated and test email payloads generated by the backend
          </p>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {emailLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {log.subject}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                    {log.status}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  To: {log.recipient} · {new Date(log.sentAt).toLocaleString()}
                </div>
              </div>
            ))}
            {emailLogs.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No email alert payloads logged yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
