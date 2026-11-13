import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AIModelStatus,
  AlertSettings,
  AppPage,
  EmailDispatchLog,
  IncidentDetectionType,
  IncidentRecord,
  IncidentSource,
  IncidentStatus,
  SystemStatusState,
} from './types/detection';
import { alarmAudio } from './utils/alarmAudio';
import { formatIncidentsCsv } from './utils/detectionLogic';
import { DEFAULT_MODEL_STATUS, fetchModelStatus } from './services/detectionService';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { EmergencyBanner } from './components/EmergencyBanner';
import { DashboardPage } from './pages/DashboardPage';
import { LiveDetectionPage } from './pages/LiveDetectionPage';
import { ImageDetectionPage } from './pages/ImageDetectionPage';
import { VideoDetectionPage } from './pages/VideoDetectionPage';
import { HistoryPage } from './pages/HistoryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AboutProjectPage } from './pages/AboutProjectPage';

const DEFAULT_SETTINGS: AlertSettings = {
  confidenceThreshold: 75,
  persistenceFrames: 5,
  cooldownSeconds: 15,
  alarmEnabled: false,
  emailAlertsEnabled: true,
  alertEmail: 'safety-officer@campus-lab.edu',
};

export default function App() {
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('pyroguard_theme') === 'dark';
  });

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS);
  const [emailLogs, setEmailLogs] = useState<EmailDispatchLog[]>([]);
  const [modelStatus, setModelStatus] = useState<AIModelStatus>(DEFAULT_MODEL_STATUS);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');

  const [systemStatus, setSystemStatus] = useState<SystemStatusState>('normal');
  const [alertConfidence, setAlertConfidence] = useState<number>(0);
  const [alertSource, setAlertSource] = useState<string>('System');

  // Explicit user-gesture alarm unlock & playback state
  const [alarmEnabled, setAlarmEnabled] = useState<boolean>(false);
  const [alarmSounding, setAlarmSounding] = useState<boolean>(false);
  const lastSoundTriggerRef = useRef<number>(0);

  // Sync Tailwind .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('pyroguard_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('pyroguard_theme', 'light');
    }
  }, [darkMode]);

  // Fetch initial database records & AI backend availability independently
  const fetchIncidents = useCallback(async () => {
    fetchModelStatus().then((model) => setModelStatus(model));
    try {
      const incRes = await fetch('/api/incidents');
      if (!incRes.ok) throw new Error('Failed to load incident history from server.');
      const data = (await incRes.json()) as {
        incidents: IncidentRecord[];
        settings: AlertSettings;
        emailLogs: EmailDispatchLog[];
      };
      setIncidents(data.incidents ?? []);
      if (data.settings) setSettings(data.settings);
      setEmailLogs(data.emailLogs ?? []);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to reach backend API.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleEnableAlarm = useCallback(async () => {
    await alarmAudio.unlockFromUserGesture();
    setAlarmEnabled(true);
    // If a verified fire emergency is already active on screen, start sounding immediately
    if (systemStatus === 'fire_emergency' && !alarmAudio.getIsPlaying()) {
      const started = await alarmAudio.playAlarm();
      if (started) setAlarmSounding(true);
    }
  }, [systemStatus]);

  const handleDisableAlarm = useCallback(() => {
    alarmAudio.silence();
    setAlarmSounding(false);
    setAlarmEnabled(false);
  }, []);

  const handleSilenceAlarm = useCallback(() => {
    alarmAudio.silence();
    setAlarmSounding(false);
  }, []);

  const handleTestAlarm = useCallback(async () => {
    if (!alarmEnabled) {
      await alarmAudio.unlockFromUserGesture();
      setAlarmEnabled(true);
    }
    const started = await alarmAudio.playAlarm();
    if (started) setAlarmSounding(true);
  }, [alarmEnabled]);

  // Stop alarm sound automatically if status clears to normal
  useEffect(() => {
    if (systemStatus === 'normal') {
      alarmAudio.silence();
      setAlarmSounding(false);
    }
  }, [systemStatus]);

  const handleStatusChange = useCallback(
    (
      status: SystemStatusState,
      confidence: number,
      source: string,
      triggerAlarm = true
    ) => {
      setSystemStatus(status);
      setAlertConfidence(confidence);
      setAlertSource(source);

      // Play alarm ONLY on verified Fire detection when alarm is enabled and outside cooldown
      if (status === 'fire_emergency' && triggerAlarm && alarmEnabled) {
        const now = Date.now();
        const cooldownMs = Math.max(5, settings.cooldownSeconds) * 1000;
        if (now - lastSoundTriggerRef.current >= cooldownMs && !alarmAudio.getIsPlaying()) {
          lastSoundTriggerRef.current = now;
          alarmAudio.playAlarm().then((started) => {
            if (started) setAlarmSounding(true);
          });
        }
      }
    },
    [alarmEnabled, settings.cooldownSeconds]
  );

  const handleLogIncident = useCallback(
    async (payload: {
      detectionType: IncidentDetectionType;
      confidence: number;
      screenshotDataUrl: string;
      source: IncidentSource;
      notes?: string;
    }) => {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        incident: IncidentRecord;
        emailLogs: EmailDispatchLog[];
      };
      setIncidents((prev) => [data.incident, ...prev]);
      if (data.emailLogs) setEmailLogs(data.emailLogs);
    },
    []
  );

  const handleUpdateStatus = async (id: string, status: IncidentStatus) => {
    const res = await fetch(`/api/incidents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { incident: IncidentRecord };
    setIncidents((prev) => prev.map((item) => (item.id === id ? data.incident : item)));
  };

  const handleDeleteIncident = async (id: string) => {
    const res = await fetch(`/api/incidents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) return;
    setIncidents((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateSettings = async (partial: Partial<AlertSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (res.ok) {
      const data = (await res.json()) as { settings: AlertSettings };
      setSettings(data.settings);
    }
  };

  const handleSendTestEmail = async (recipient: string) => {
    const res = await fetch('/api/alerts/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient }),
    });
    if (res.ok) {
      const data = (await res.json()) as { emailLogs: EmailDispatchLog[] };
      setEmailLogs(data.emailLogs);
    }
  };

  const handleDownloadCsv = () => {
    const csvContent = formatIncidentsCsv(incidents);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fire_detection_report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeAlertsCount = incidents.filter((i) => i.status === 'Active').length;

  const handleNavigate = (page: AppPage) => {
    setActivePage(page);
    if (page !== 'live' && page !== 'video') {
      alarmAudio.silence();
      setAlarmSounding(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        activeAlertsCount={activeAlertsCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activePage={activePage}
          systemStatus={systemStatus}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((d) => !d)}
          alarmEnabled={alarmEnabled}
          alarmSounding={alarmSounding}
          onEnableAlarm={handleEnableAlarm}
          onDisableAlarm={handleDisableAlarm}
          onTestAlarm={handleTestAlarm}
          onSilenceAlarm={handleSilenceAlarm}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <EmergencyBanner
          status={systemStatus}
          confidence={alertConfidence}
          sourceLabel={alertSource}
          alarmEnabled={alarmEnabled}
          alarmSounding={alarmSounding}
          onEnableAlarm={handleEnableAlarm}
          onSilenceAlarm={handleSilenceAlarm}
          onAcknowledge={() => {
            handleSilenceAlarm();
            setSystemStatus('normal');
          }}
        />

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {loadError && (
            <div className="mb-4 p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
              {loadError}
            </div>
          )}

          {loadingData ? (
            <div className="space-y-4">
              <div className="h-24 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-28 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {activePage === 'dashboard' && (
                <DashboardPage
                  incidents={incidents}
                  systemStatus={systemStatus}
                  onNavigate={handleNavigate}
                  onDownloadCsv={handleDownloadCsv}
                />
              )}

              {activePage === 'live' && (
                <LiveDetectionPage
                  settings={settings}
                  modelStatus={modelStatus}
                  onModelStatusChange={setModelStatus}
                  alarmEnabled={alarmEnabled}
                  alarmSounding={alarmSounding}
                  onEnableAlarm={handleEnableAlarm}
                  onTestAlarm={handleTestAlarm}
                  onSilenceAlarm={handleSilenceAlarm}
                  onUpdateSettings={handleUpdateSettings}
                  onStatusChange={handleStatusChange}
                  onLogIncident={handleLogIncident}
                />
              )}

              {activePage === 'image' && (
                <ImageDetectionPage
                  settings={settings}
                  modelStatus={modelStatus}
                  onModelStatusChange={setModelStatus}
                  onStatusChange={handleStatusChange}
                  onLogIncident={handleLogIncident}
                />
              )}

              {activePage === 'video' && (
                <VideoDetectionPage
                  settings={settings}
                  modelStatus={modelStatus}
                  onModelStatusChange={setModelStatus}
                  onStatusChange={handleStatusChange}
                  onLogIncident={handleLogIncident}
                />
              )}

              {activePage === 'history' && (
                <HistoryPage
                  incidents={incidents}
                  onUpdateStatus={handleUpdateStatus}
                  onDeleteIncident={handleDeleteIncident}
                  onDownloadCsv={handleDownloadCsv}
                />
              )}

              {activePage === 'analytics' && (
                <AnalyticsPage
                  incidents={incidents}
                  settings={settings}
                  emailLogs={emailLogs}
                  onUpdateSettings={handleUpdateSettings}
                  onSendTestEmail={handleSendTestEmail}
                />
              )}

              {activePage === 'about' && <AboutProjectPage />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
