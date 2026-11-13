import React, { useMemo, useState } from 'react';
import { Search, Download, Trash2, Mail, X } from 'lucide-react';
import type { IncidentRecord, IncidentStatus } from '../types/detection';
import { filterIncidents } from '../utils/detectionLogic';

interface HistoryPageProps {
  incidents: IncidentRecord[];
  onUpdateStatus: (id: string, status: IncidentStatus) => Promise<void>;
  onDeleteIncident: (id: string) => Promise<void>;
  onDownloadCsv: () => void;
}

const STATUS_OPTIONS: IncidentStatus[] = [
  'Active',
  'Acknowledged',
  'Resolved',
  'False Alarm',
];

export const HistoryPage: React.FC<HistoryPageProps> = ({
  incidents,
  onUpdateStatus,
  onDeleteIncident,
  onDownloadCsv,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [previewIncident, setPreviewIncident] = useState<IncidentRecord | null>(null);

  const filtered = useMemo(
    () => filterIncidents(incidents, search, typeFilter, statusFilter),
    [incidents, search, typeFilter, statusFilter]
  );

  return (
    <div className="space-y-6">
      {/* Search, Filters & CSV Export */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Incident ID, source, or notes..."
              aria-label="Search detection history"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by detection type"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-100"
          >
            <option value="All">All Types</option>
            <option value="Fire">Fire</option>
            <option value="Smoke">Smoke</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by incident status"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-100"
          >
            <option value="All">All Statuses</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onDownloadCsv}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Download CSV Report</span>
        </button>
      </div>

      {/* Incidents Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing <strong className="text-slate-900 dark:text-white">{filtered.length}</strong> of{' '}
            {incidents.length} recorded incidents
          </span>
          <span>Click any thumbnail to inspect full screenshot</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" data-testid="history-table">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                <th className="py-3 px-4">Screenshot</th>
                <th className="py-3 px-4">Incident ID</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Detection Type</th>
                <th className="py-3 px-4 text-right">Confidence</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2.5 px-4">
                    <button
                      type="button"
                      onClick={() => setPreviewIncident(item)}
                      className="block rounded overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-orange-500 transition-colors"
                      aria-label={`Inspect screenshot for ${item.id}`}
                    >
                      <img
                        src={item.screenshotUrl}
                        alt={`Detected frame ${item.id}`}
                        referrerPolicy="no-referrer"
                        className="w-20 h-13 object-cover bg-slate-900"
                      />
                    </button>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      {item.id}
                    </div>
                    {item.emailSent && (
                      <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <Mail className="w-3 h-3" />
                        <span>Email logged</span>
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 font-semibold">
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
                  <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                    {item.confidence}%
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                    {item.source}
                  </td>
                  <td className="py-2.5 px-4">
                    <select
                      value={item.status}
                      onChange={(e) =>
                        onUpdateStatus(item.id, e.target.value as IncidentStatus)
                      }
                      aria-label={`Change status for ${item.id}`}
                      className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-100"
                    >
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteIncident(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                      aria-label={`Delete incident ${item.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No incidents match the current search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Screenshot Inspection Modal */}
      {previewIncident && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Incident ${previewIncident.id} Details`}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  {previewIncident.id} · {previewIncident.detectionType} ({previewIncident.confidence}%)
                </h3>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {new Date(previewIncident.timestamp).toLocaleString()} · {previewIncident.source}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewIncident(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                aria-label="Close incident preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="aspect-[4/3] bg-slate-950 rounded-lg overflow-hidden">
                <img
                  src={previewIncident.screenshotUrl}
                  alt={`Full screenshot for ${previewIncident.id}`}
                  className="w-full h-full object-contain"
                />
              </div>
              {previewIncident.notes && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {previewIncident.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
