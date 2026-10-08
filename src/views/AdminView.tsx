import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Building,
  Layers,
  Users,
  Wrench,
  FileSpreadsheet,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Lock,
  Unlock,
  RotateCcw,
  Copy,
  Download,
  Upload,
  Trash2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { gasAuthService, getGasBaseUrl } from '../services/gasAuthService';
import { Site, Location, Rack, User, UserRole, AppSettings } from '../types';

export const AdminView: React.FC = () => {
  const { currentUser, language } = useAuth();

  const [activeSection, setActiveSection] = useState<
    'cleaning' | 'sites' | 'racks' | 'users' | 'import_export'
  >('cleaning');

  // Bagian C Audit results
  const [auditResult, setAuditResult] = useState<{
    fixedEmptyLocations: number;
    fixedFacMappings: number;
    fixedMissingNames: number;
    fixedTrimSpaces: number;
    normalizedLegacyCodes: number;
    flaggedSerials: number;
  } | null>(null);

  // New Site Form
  const [newSiteId, setNewSiteId] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteType, setNewSiteType] = useState<'FACTORY' | 'WAREHOUSE' | 'LAB' | 'SITE'>('FACTORY');

  // User Form
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Mechanic');
  const [newUserSiteAccess, setNewUserSiteAccess] = useState<string>('PW1');

  const sites = storageService.getSites();
  const racks = storageService.getRacks();
  const users = storageService.getUsers();
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
        setNotification(`Sinkronisasi berhasil! ${res.count} data mesin dimuat dari "${targetSheetName}".`);
      }
    } catch (e: any) {
      setSyncFeedback({
        success: false,
        message: 'Terjadi kendala saat menghubungkan ke Google Spreadsheet: ' + e.message,
      });
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Clear Database & Dummy Records
  const handleClearDatabase = () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus seluruh data mesin dummy / lokal? Database akan dikosongkan untuk kemudian ditarik dari Google Spreadsheet.')) {
      storageService.clearAllData(true);
      setNotification('Seluruh data mesin lokal / dummy telah berhasil dihapus. Database sekarang bersih (0 mesin).');
    }
  };

  // Test GAS Web App Connection via PING & Save Spreadsheet ID
  const handleTestGasConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('IDLE');
    setConnectionMsg('Menguji konektivitas server Google Apps Script (PING)...');

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
          `Koneksi Berhasil! Version: ${res.version || 'v1.0'}${
            res.timestamp ? ` (Waktu Server: ${res.timestamp})` : ''
          }`
        );
      } else {
        setConnectionStatus('ERROR');
        setConnectionMsg(res?.message || 'Server Google Apps Script tidak merespons PING.');
      }
    } catch (err: any) {
      setConnectionStatus('ERROR');
      setConnectionMsg(`Gagal terhubung ke server: ${err.message || 'Error jaringan'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  // Run Bagian C Data Cleaning Suite
  const handleRunDataAudit = () => {
    const res = storageService.runDataAuditAndFix();
    setAuditResult(res);
    const totalFixed = Object.values(res).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    if (totalFixed > 0) {
      setNotification('Audit dan perbaikan data Bagian C berhasil dieksekusi ke seluruh database mesin!');
    } else {
      setNotification(
        'Audit otomatis di aplikasi belum tersedia di versi Supabase (constraint database sudah mencegah data rusak). Tidak ada yang diperbaiki.'
      );
    }
  };

  // Add Site
  const handleAddSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteId.trim() || !newSiteName.trim()) {
      setNotification('Isi dulu Kode Site dan Nama Site sebelum menyimpan.');
      return;
    }

    const res = storageService.addSite({
      siteId: newSiteId.trim().toUpperCase(),
      name: newSiteName.trim(),
      type: newSiteType,
      active: true,
    });

    setNotification(res.message);
    if (res.success) {
      setNewSiteId('');
      setNewSiteName('');
    }
  };

  // Update Rack Columns
  const handleUpdateRack = (rackNo: number, cols: number) => {
    const res = storageService.updateRackConfig(rackNo, cols);
    setNotification(res.message);
  };

  // Add User
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newDisplayName.trim()) return;

    const sitesArray = newUserSiteAccess
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    const res = storageService.saveUser({
      username: newUsername.trim().toLowerCase(),
      displayName: newDisplayName.trim(),
      role: newUserRole,
      siteAccess: sitesArray,
      language: 'id',
      active: true,
      failedAttempts: 0,
      mustChangePassword: true,
    });

    setNotification(res.message);
    if (res.success) {
      setNewUsername('');
      setNewDisplayName('');
    }
  };

  // Unlock User
  const handleUnlock = (username: string) => {
    const res = storageService.unlockUser(username);
    setNotification(res.message);
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
            {getTranslation('admin', language)} & Panel Kontrol
          </h1>
        </div>
        <p className="text-xs text-slate-500">
          Kelola master data site, line pabrik, rak WH2, pengguna & hak akses RBAC, audit data Bagian C, dan generator Apps Script.
        </p>
      </div>

      {/* Navigation Pills */}
      <div className="flex gap-2 p-1.5 bg-white border border-slate-200/90 rounded-2xl overflow-x-auto text-xs font-bold shadow-xs">
        <button
          onClick={() => setActiveSection('cleaning')}
          className={`py-2 px-3.5 rounded-xl whitespace-nowrap transition-all ${
            activeSection === 'cleaning' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Wrench className="w-3.5 h-3.5 inline mr-1.5" />
          <span>Audit & Pembersihan Data (Bagian C)</span>
        </button>

        <button
          onClick={() => setActiveSection('sites')}
          className={`py-2 px-3.5 rounded-xl whitespace-nowrap transition-all ${
            activeSection === 'sites' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building className="w-3.5 h-3.5 inline mr-1.5" />
          <span>Site & Line Pabrik</span>
        </button>

        <button
          onClick={() => setActiveSection('racks')}
          className={`py-2 px-3.5 rounded-xl whitespace-nowrap transition-all ${
            activeSection === 'racks' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5 inline mr-1.5" />
          <span>Rak WH2 (6 Rak)</span>
        </button>

        <button
          onClick={() => setActiveSection('users')}
          className={`py-2 px-3.5 rounded-xl whitespace-nowrap transition-all ${
            activeSection === 'users' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          <span>Pengguna & RBAC</span>
        </button>

        <button
          onClick={() => setActiveSection('import_export')}
          className={`py-2 px-3.5 rounded-xl whitespace-nowrap transition-all ${
            activeSection === 'import_export' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1.5" />
          <span>Impor / Ekspor Excel</span>
        </button>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* SECTION 1: BAGIAN C DATA CLEANING & AUDIT SUITE */}
      {activeSection === 'cleaning' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-600" />
                <span>Suite Audit & Pembersihan Data Otomatis (Bagian C Checklist)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Memperbaiki 171 lokasi kosong, memulihkan leading zeroes serial, menormalisasi WH2/SW/QA, dan mengisi nama mesin otomatis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleClearDatabase}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
                title="Hapus seluruh data dummy / cache lokal agar database bersih 0 mesin"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Hapus Data Dummy</span>
              </button>

              <button
                onClick={handleRunDataAudit}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                <Wrench className="w-4 h-4" />
                <span>Jalankan Audit & Auto-Fix Sekarang</span>
              </button>
            </div>
          </div>

          {/* Audit Results Metrics */}
          {auditResult && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-slate-500">171 Lokasi Kosong Diperbaiki</div>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                  +{auditResult.fixedEmptyLocations}
                </div>
                <div className="text-[10px] text-slate-500">Diisi PWx-UNASSIGNED</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-slate-500">Normalisasi WH2/SW/QA</div>
                <div className="text-2xl font-black text-cyan-700 font-mono mt-1">
                  +{auditResult.normalizedLegacyCodes}
                </div>
                <div className="text-[10px] text-slate-500">WH2-UNASSIGNED, SW-MAIN, QA-MAIN</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-slate-500">Nama Mesin Standar Dipulihkan</div>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                  +{auditResult.fixedMissingNames}
                </div>
                <div className="text-[10px] text-slate-500">Automatic Placket Attaching</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-slate-500">Model Spasi Dirapikan (Trim)</div>
                <div className="text-2xl font-black text-purple-700 font-mono mt-1">
                  +{auditResult.fixedTrimSpaces}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-slate-500">Serial Berspasi Ditandai</div>
                <div className="text-2xl font-black text-amber-700 font-mono mt-1">
                  +{auditResult.flaggedSerials}
                </div>
                <div className="text-[10px] text-slate-500">Ditandai di Data Flag</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="text-slate-500">Sinkronisasi Site ID & Prefix</div>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                  +{auditResult.fixedFacMappings}
                </div>
              </div>
            </div>
          )}

          {/* Checklist Status */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <h3 className="font-bold text-slate-900 mb-2">Item Checklist Bagian C yang Aktif & Terpenuhi:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>171 baris Location ID kosong -&gt; PWx-UNASSIGNED</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Serial dengan leading zero dipertahankan (tipe Plain Text)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Normalisasi lokasi WH2, SW, QA ke kode standar</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>3 mesin tanpa nama diisi 'Automatic Placket Attaching Machine'</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Label QR Code menerima Barcode 12-digit atau Asset Code</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Site ID otomatis terisi dari awalan Location ID</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SITES & LINES MANAGEMENT */}
      {activeSection === 'sites' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            <span>Daftar Site & Tambah Site Baru dengan Template Line</span>
          </h2>

          {/* Add Site Form */}
          <form onSubmit={handleAddSite} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700">Tambah Site Baru:</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={newSiteId}
                onChange={(e) => setNewSiteId(e.target.value)}
                placeholder="Site ID (cth: PW4)"
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 uppercase font-bold focus:outline-none focus:border-blue-500"
                required
              />
              <input
                type="text"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="Nama Site (cth: PT.WINNERS(4))"
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                required
              />
              <select
                value={newSiteType}
                onChange={(e) => setNewSiteType(e.target.value as 'FACTORY' | 'WAREHOUSE' | 'LAB' | 'SITE')}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              >
                <option value="FACTORY">Pabrik (FACTORY)</option>
                <option value="WAREHOUSE">Gudang (WAREHOUSE)</option>
                <option value="LAB">Laboratorium (LAB)</option>
                <option value="SITE">Site Umum (SITE)</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Site (Generate Line 1-30 & Extra Otomatis)</span>
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
                  {storageService.getLocations(s.siteId).length} lokasi terdaftar
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
              <span>Konfigurasi 6 Rak Warehouse 2 (WH2)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Setiap rak memiliki 3 stack (A, B, C). Mengubah jumlah kolom otomatis membuat slot baru berkode WH2-R{'{rak}'}-{'{kolom}'}{'{stack}'}.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {racks.map((rack) => {
              const slotsCount = rack.columnCount * 3;
              return (
                <div key={rack.rackNo} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900">Rak {rack.rackNo}</span>
                    <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                      {slotsCount} Slot (3 Stack A/B/C)
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-600">Jumlah Kolom Rak:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        defaultValue={rack.columnCount}
                        onBlur={(e) => handleUpdateRack(rack.rackNo, Number(e.target.value))}
                        className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono w-24 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-slate-500 text-[11px]">kolom</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500">
                    Contoh format slot: <span className="font-mono text-cyan-700 font-semibold">WH2-R{rack.rackNo}-1A</span>,{' '}
                    <span className="font-mono text-cyan-700 font-semibold">WH2-R{rack.rackNo}-1B</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: USERS & RBAC */}
      {activeSection === 'users' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>Kelola Pengguna & Hak Akses Berdasarkan Site (A4)</span>
          </h2>

          {/* Add User Form */}
          <form onSubmit={handleAddUser} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
            <div className="font-bold text-slate-700">Tambah Akun Pengguna Baru:</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Username (cth: mechanic_pw4)"
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                required
              />
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Nama Lengkap & Jabatan"
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                required
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
              >
                <option value="Admin">Admin</option>
                <option value="Mechanic">Mechanic</option>
                <option value="Production Support">Production Support</option>
                <option value="Viewer">Viewer</option>
              </select>
              <input
                type="text"
                value={newUserSiteAccess}
                onChange={(e) => setNewUserSiteAccess(e.target.value)}
                placeholder="Site Access (cth: PW1, PW2 atau ALL)"
                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Simpan Pengguna</span>
            </button>
          </form>

          {/* Users List Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Username</th>
                  <th className="p-3">Nama Pengguna</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Akses Site</th>
                  <th className="p-3">Status Kunci</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                {users.map((u) => {
                  const isLocked = Boolean(u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now());

                  return (
                    <tr key={u.username} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-700">{u.username}</td>
                      <td className="p-3 text-slate-900 font-semibold">{u.displayName}</td>
                      <td className="p-3">
                        <span className="font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-cyan-800 font-bold">{u.siteAccess.join(', ')}</td>
                      <td className="p-3">
                        {isLocked ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Terkunci (5x Gagal)</span>
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Normal</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {isLocked && (
                          <button
                            onClick={() => handleUnlock(u.username)}
                            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold"
                          >
                            Buka Kunci
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 5: IMPORT / EXPORT EXCEL */}
      {activeSection === 'import_export' && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Ekspor Cadangan Lengkap & Impor File Excel</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Unduh cadangan data mesin atau perbarui database melalui file Excel .xlsx
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="font-bold text-slate-900 text-sm">Ekspor Database Lengkap:</div>
              <p className="text-slate-500">
                Unduh seluruh data mesin PT.WINNERS beserta riwayat lengkap dalam format file Excel .xlsx
              </p>
              <button
                onClick={handleExportFullDb}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Excel Backup (.xlsx)</span>
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="font-bold text-slate-900 text-sm">Impor File Excel / CSV:</div>
              <p className="text-slate-500">
                Pilih file .xlsx untuk melakukan batch update data mesin dengan validasi format otomatis.
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
                        setNotification(
                          `File ${file.name} terbaca (${data.length} baris), tapi impor batch belum tersedia di versi Supabase. ` +
                            'Data belum tersimpan ke database. Gunakan SQL Editor Supabase untuk impor massal.'
                        );
                      } catch {
                        setNotification(`Gagal membaca file ${file.name}. Pastikan formatnya .xlsx, .xls, atau .csv yang valid.`);
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
