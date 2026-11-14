import React, { useMemo, useState } from 'react';
import { Search, Download, Trash2, Mail, Eye } from 'lucide-react';
import type { IncidentRecord, IncidentStatus } from '../types/detection';
import { filterIncidents } from '../utils/detectionLogic';
import { IncidentTypeBadge } from '../components/StatusBadge';
import { IncidentDetailModal, IncidentThumbnail } from '../components/IncidentDetailModal';

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
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Download CSV Report</span>
        </button>
      </div>

      {/* Incidents Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing <strong className="text-slate-900 dark:text-white">{filtered.length}</strong> of{' '}
            {incidents.length} recorded incidents
          </span>
          <span>Click View Details or thumbnail to inspect full evidence</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" data-testid="history-table">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
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
                      className="block rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-orange-500 transition-colors"
                      aria-label={`Inspect screenshot for ${item.id}`}
                      title="Inspect full screenshot"
                    >
                      <IncidentThumbnail
                        src={item.screenshotUrl}
                        alt={`Detected frame ${item.id}`}
                        className="w-20 h-13 object-cover bg-slate-900"
                      />
                    </button>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">
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
                  <td className="py-2.5 px-4">
                    <IncidentTypeBadge type={item.detectionType} />
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                    {item.confidence}%
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
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
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewIncident(item)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors"
                        aria-label={`View details for ${item.id}`}
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteIncident(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                        aria-label={`Delete incident ${item.id}`}
                        title="Delete incident"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No incidents match the current search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <IncidentDetailModal
        incident={previewIncident}
        onClose={() => setPreviewIncident(null)}
      />
    </div>
  );
};
