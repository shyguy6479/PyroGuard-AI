import React, { useMemo, useState } from 'react';
import { Mail, Send, CheckCircle2 } from 'lucide-react';
import type {
  AlertSettings,
  EmailDispatchLog,
  IncidentRecord,
} from '../types/detection';
import { computeAnalytics } from '../utils/detectionLogic';

interface AnalyticsPageProps {
  incidents: IncidentRecord[];
  settings: AlertSettings;
  emailLogs: EmailDispatchLog[];
  onUpdateSettings: (partial: Partial<AlertSettings>) => Promise<void>;
  onSendTestEmail: (recipient: string) => Promise<void>;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  incidents,
  settings,
  emailLogs,
  onUpdateSettings,
  onSendTestEmail,
}) => {
  const analytics = useMemo(() => computeAnalytics(incidents), [incidents]);
  const [emailInput, setEmailInput] = useState(settings.alertEmail);
  const [testNotice, setTestNotice] = useState('');

  const firePct =
    analytics.totalDetections > 0
      ? Math.round((analytics.fireDetections / analytics.totalDetections) * 100)
      : 0;
  const smokePct = 100 - firePct;
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
      {/* Top Analytical Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Incidents</div>
          <div className="mt-1.5 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {analytics.totalDetections}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Fire Share</div>
          <div className="mt-1.5 font-display text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {firePct}%
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Smoke Share</div>
          <div className="mt-1.5 font-display text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {smokePct}%
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Mean Confidence</div>
          <div className="mt-1.5 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {analytics.avgConfidence}%
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stacked Daily Trend */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Daily Fire &amp; Smoke Distribution
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Incident count breakdown across the last 7 active days
          </p>

          <div className="mt-6 h-52 flex items-end gap-4 px-2">
            {analytics.byDay.map((day) => {
              const fh = Math.round((day.fire / maxDayTotal) * 150);
              const sh = Math.round((day.smoke / maxDayTotal) * 150);
              return (
                <div
                  key={day.dateLabel}
                  className="flex-1 flex flex-col items-center justify-end gap-2 h-full"
                >
                  <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {day.fire + day.smoke}
                  </span>
                  <div className="w-full max-w-[44px] flex flex-col justify-end rounded-t-md overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {day.smoke > 0 && (
                      <div
                        style={{ height: `${Math.max(10, sh)}px` }}
                        className="w-full bg-amber-500"
                      />
                    )}
                    {day.fire > 0 && (
                      <div
                        style={{ height: `${Math.max(10, fh)}px` }}
                        className="w-full bg-red-600"
                      />
                    )}
                  </div>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {day.dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Source & Status Breakdown */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Detections by Input Source
            </h2>
            <div className="mt-3 space-y-2.5">
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
                        className="h-full bg-orange-600 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              Resolution Status Breakdown
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {analytics.byStatus.map((row) => (
                <div
                  key={row.status}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs"
                >
                  <span className="text-slate-600 dark:text-slate-300">{row.status}</span>
                  <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Email Alert Configuration & Dispatch Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleTestEmail}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-orange-600" />
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Automated Email Alert Configuration
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            When fire or smoke exceeds persistence thresholds, the system prepares an email alert containing detection time, type, confidence %, and the captured screenshot.
          </p>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.emailAlertsEnabled}
              onChange={(e) => onUpdateSettings({ emailAlertsEnabled: e.target.checked })}
              className="rounded accent-orange-600"
            />
            <span>Enable Automated Email Alerts on Detection</span>
          </label>

          <div>
            <label
              htmlFor="alert-email-input"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-colors"
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

          <div className="space-y-2.5 max-h-64 overflow-y-auto">
            {emailLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {log.subject}
                  </span>
                  <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 shrink-0">
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
