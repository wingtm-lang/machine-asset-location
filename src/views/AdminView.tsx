import React, { useState } from 'react';
import {
  ShieldAlert,
  Building,
  Layers,
  Users,
  FileSpreadsheet,
  CheckCircle2,
  Plus,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../services/authContext';
import { getTranslation, makeT, localizeMessage } from '../services/translations';
import { storageService } from '../services/storage';
import { UserManagementView } from './UserManagementView';
import { gasAuthService } from '../services/gasAuthService';

export const AdminView: React.FC = () => {
  const { currentUser, language } = useAuth();
  const t = makeT(language);

  const [activeSection, setActiveSection] = useState<
    'sites' | 'racks' | 'users' | 'import_export'
  >('sites');

  // New Site Form
  const [newSiteId, setNewSiteId] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteType, setNewSiteType] = useState<'FACTORY' | 'WAREHOUSE' | 'LAB' | 'SITE'>('FACTORY');

  const sites = storageService.getSites();
  const racks = storageService.getRacks();
  const settings = storageService.getSettings();

  const [spreadsheetId, setSpreadsheetId] = useState(
    settings.spreadsheetId || '1-D87s2xI6ERVQydmP1Gbmj7XzqB5o7Ziib7mvKVhtio'
  );
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [connectionMsg, setConnectionMsg] = useState('');

  const [notification, setNotification] = useState<string | null>(null);

  // Live Sheet Sync State
  const [targetSheetName, setTargetSheetName] = useState('machine_asset');
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    success: boolean;
    message: string;
    count?: number;
    source?: string;
  } | null>(null);

  // Sync Data Directly from Sheet (machine_asset)
  const handleSyncDataFromSheet = async () => {
    setIsSyncingSheet(true);
    setSyncFeedback(null);
    try {
      const res = await storageService.syncFromGoogleSheet(spreadsheetId, targetSheetName);
      setSyncFeedback(res);
      if (res.success) {
        setNotification(t('adm_sync_ok', { count: res.count ?? '', sheet: targetSheetName }));
      }
    } catch (e: any) {
      setSyncFeedback({
        success: false,
        message: t('adm_sync_err') + e.message,
      });
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Test GAS Web App Connection via PING & Save Spreadsheet ID
  const handleTestGasConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('IDLE');
    setConnectionMsg(t('adm_ping_testing'));

    try {
      // Save spreadsheet ID to local settings
      storageService.updateSettings({
        ...settings,
        spreadsheetId: spreadsheetId.trim(),
      });

      const res = await gasAuthService.ping();
      if (res && res.success) {
        setConnectionStatus('SUCCESS');
        setConnectionMsg(
          res.timestamp
            ? t('adm_conn_ok_time', { version: res.version || 'v1.0', time: res.timestamp })
            : t('adm_conn_ok', { version: res.version || 'v1.0' })
        );
      } else {
        setConnectionStatus('ERROR');
        setConnectionMsg(res?.message ? localizeMessage(res.message, language) : t('adm_ping_noresp'));
      }
    } catch (err: any) {
      setConnectionStatus('ERROR');
      setConnectionMsg(t('adm_conn_fail', { error: err.message ? localizeMessage(err.message, language) : t('adm_net_error') }));
    } finally {
      setTestingConnection(false);
    }
  };

  // Add Site
  const handleAddSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteId.trim() || !newSiteName.trim()) {
      setNotification(t('adm_site_required'));
      return;
    }

    const res = storageService.addSite({
      siteId: newSiteId.trim().toUpperCase(),
      name: newSiteName.trim(),
      type: newSiteType,
      active: true,
    });

    setNotification(localizeMessage(res.message, language));
    if (res.success) {
      setNewSiteId('');
      setNewSiteName('');
    }
  };

  // Update Rack Columns
  const handleUpdateRack = (rackNo: number, cols: number) => {
    const res = storageService.updateRackConfig(rackNo, cols);
    setNotification(localizeMessage(res.message, language));
  };

  // Export Full DB
  const handleExportFullDb = () => {
    const machines = storageService.getAllMachines();
    const ws = XLSX.utils.json_to_sheet(machines);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Machines_Full_Backup');
    XLSX.writeFile(wb, `PT_WINNERS_Complete_Backup_${Date.now()}.xlsx`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900">
            {t('adm_title', { admin: getTranslation('admin', language) })}
          </h1>
        </div>
        <p className="text-xs text-slate-500">
          {t('adm_subtitle')}
        </p>
      </div>

      {/* Navigation Pills */}
      <div className="flex gap-2 p-1.5 bg-white border border-slate-200/90 rounded-2xl overflow-x-auto text-xs font-bold shadow-xs">
        <button
          onClick={() => setActiveSection('sites')}
          className={`py-2 px-3.5 rounded-xl whitespace-nowrap transition-all ${
            activeSection === 'sites' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building className="w-3.5 h-3.5 inline mr-1.5" />
          <span>{t('adm_tab_sites')}</span>
        </button>

        <button
          onClick={() => setActiveSection('racks')}
          className={`py-2 px-3.5 rounded-xl whitespace-nowrap transition-all ${
            activeSection === 'racks' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5 inline mr-1.5" />
          <span>{t('adm_tab_racks')}</span>
        </button>

        <button
          onClick={() => setActiveSection('users')}
          className={`py-2 px-3.5 rounded-xl whitespace-nowrap transition-all ${
            activeSection === 'users' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          <span>{t('adm_tab_users')}</span>
        </button>

        <button
          onClick={() => setActiveSection('import_export')}
          className={`py-2 px-3.5 rounded-xl whitespace-nowrap transition-all ${
            activeSection === 'import_export' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1.5" />
          <span>{t('adm_tab_impexp')}</span>
        </button>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* SECTION 2: SITES & LINES MANAGEMENT */}
      {activeSection === 'sites' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <span>{t('adm_sites_title')}</span>
          </h2>

          {/* Add Site Form */}
          <form onSubmit={handleAddSite} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700">{t('adm_add_site')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={newSiteId}
                onChange={(e) => setNewSiteId(e.target.value)}
                placeholder={t('adm_ph_siteid')}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 uppercase font-bold focus:outline-none focus:border-blue-500"
                required
              />
              <input
                type="text"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder={t('adm_ph_sitename')}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                required
              />
              <select
                value={newSiteType}
                onChange={(e) => setNewSiteType(e.target.value as 'FACTORY' | 'WAREHOUSE' | 'LAB' | 'SITE')}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="FACTORY">{t('adm_opt_factory')}</option>
                <option value="WAREHOUSE">{t('adm_opt_warehouse')}</option>
                <option value="LAB">{t('adm_opt_lab')}</option>
                <option value="SITE">{t('adm_opt_site')}</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t('adm_add_site_btn')}</span>
            </button>
          </form>

          {/* Existing Sites Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {sites.map((s) => (
              <div key={s.siteId} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-blue-700">{s.siteId}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {s.type}
                  </span>
                </div>
                <div className="font-bold text-slate-900">{s.name}</div>
                <div className="text-[11px] text-slate-500">
                  {t('adm_site_locs', { n: storageService.getLocations(s.siteId).length })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: RACKS CONFIGURATION */}
      {activeSection === 'racks' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>{t('adm_racks_title')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {t('adm_racks_desc', { code: 'WH2-R{rak}-{kolom}{stack}' })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {racks.map((rack) => {
              const slotsCount = rack.columnCount * 3;
              return (
                <div key={rack.rackNo} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900">{t('adm_rack_n', { n: rack.rackNo })}</span>
                    <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                      {t('adm_rack_slots', { n: slotsCount })}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-600">{t('adm_rack_cols')}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        defaultValue={rack.columnCount}
                        onBlur={(e) => handleUpdateRack(rack.rackNo, Number(e.target.value))}
                        className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono w-24 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-slate-500 text-[11px]">{t('adm_rack_col_unit')}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500">
                    {t('adm_rack_example')} <span className="font-mono text-cyan-700 font-semibold">WH2-R{rack.rackNo}-1A</span>,{' '}
                    <span className="font-mono text-cyan-700 font-semibold">WH2-R{rack.rackNo}-1B</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kelola Pengguna (dipindahkan dari sidebar) */}
      {activeSection === 'users' && <UserManagementView />}

      {/* SECTION 5: IMPORT / EXPORT EXCEL */}
      {activeSection === 'import_export' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>{t('adm_ie_title')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {t('adm_ie_desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="font-bold text-slate-900 text-sm">{t('adm_exp_title')}</div>
              <p className="text-slate-500">
                {t('adm_exp_desc')}
              </p>
              <button
                onClick={handleExportFullDb}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>{t('adm_exp_btn')}</span>
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="font-bold text-slate-900 text-sm">{t('adm_imp_title')}</div>
              <p className="text-slate-500">
                {t('adm_imp_desc')}
              </p>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      try {
                        const bstr = evt.target?.result;
                        const wb = XLSX.read(bstr, { type: 'binary' });
                        const wsname = wb.SheetNames[0];
                        const ws = wb.Sheets[wsname];
                        const data = XLSX.utils.sheet_to_json(ws);
                        setNotification(t('adm_imp_read', { name: file.name, rows: data.length }));
                      } catch {
                        setNotification(t('adm_imp_fail', { name: file.name }));
                      }
                    };
                    reader.readAsBinaryString(file);
                  }
                }}
                className="block w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
