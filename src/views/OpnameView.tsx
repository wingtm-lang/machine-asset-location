import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Search,
  Building,
  MapPin,
  Calendar,
  Lock,
  Unlock,
  Shield,
  ShieldCheck,
  Users,
  Settings,
  Loader2,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sliders,
  Check,
  Info,
  Play,
  StopCircle,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { soundService } from '../services/sound';

import { Location, Machine, OpnameItem, OpnameResult, SiteId } from '../types';
import { getMachineLabel } from '../utils/machineName';

export interface ServerOpnameSession {
  sessionId: string;
  siteId: string;
  locationId?: string;
  status: 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  allowedSites: string[];
  lockMoves?: boolean;
  startedBy: string;
  startedAt: string;
  endedAt?: string;
  finishedAt?: string;
  expected?: number;
  scanned?: number;
  match?: number;
  missing?: number;
  misplaced?: number;
  week?: string;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

const FACTORY_SITES = ['PW1', 'PW2', 'PW3'];

export interface OpnameViewProps {
  onOpenScanner?: () => void;
}

export const OpnameView: React.FC<OpnameViewProps> = ({ onOpenScanner }) => {
  const { currentUser, language, canAccessSite } = useAuth();
  const allSites = storageService.getSites();

  // Role calculation
  const isAdminMasterOrAllSites = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || '').toLowerCase();
    const auth = ((currentUser as any).authority || '').toLowerCase();
    const hasAll = currentUser.siteAccess?.includes('ALL');
    return (
      role === 'admin' ||
      role === 'admin master' ||
      role === 'all sites' ||
      auth === 'admin master' ||
      auth === 'all sites' ||
      hasAll
    );
  }, [currentUser]);

  // Accessible sites for dropdown
  const accessibleSites = useMemo(() => {
    if (!currentUser) return [];
    if (isAdminMasterOrAllSites || currentUser.siteAccess.includes('ALL')) {
      return allSites;
    }
    return allSites.filter((s) => currentUser.siteAccess.includes(s.siteId));
  }, [allSites, currentUser, isAdminMasterOrAllSites]);

  // Form State for Starting Session
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    if (accessibleSites.length > 0) return accessibleSites[0].siteId;
    return 'PW1';
  });

  const availableLocations = useMemo(() => {
    return storageService.getLocations(selectedSiteId).filter((l) => l.active);
  }, [selectedSiteId]);

  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Update selected location when available locations change
  useEffect(() => {
    if (availableLocations.length > 0) {
      const exists = availableLocations.some((l) => l.locationId === selectedLocationId);
      if (!exists) {
        setSelectedLocationId(availableLocations[0].locationId);
      }
    } else {
      setSelectedLocationId('');
    }
  }, [availableLocations, selectedLocationId]);

  // Form Access config
  const [formAllowedSites, setFormAllowedSites] = useState<string[]>(['PW1']);
  const [formLockMoves, setFormLockMoves] = useState<boolean>(false);

  // Sync formAllowedSites when selectedSiteId changes
  useEffect(() => {
    setFormAllowedSites((prev) => {
      const set = new Set(prev);
      set.add(selectedSiteId);
      return Array.from(set);
    });
  }, [selectedSiteId]);

  // Expected machines registered in selected location
  const expectedMachines = useMemo(() => {
    if (!selectedLocationId) return [];
    return storageService.getMachinesAtLocation(selectedLocationId);
  }, [selectedLocationId]);

  // Live Session State
  const [activeSession, setActiveSession] = useState<ServerOpnameSession | null>(null);
  const [scannedItems, setScannedItems] = useState<OpnameItem[]>([]);
  const [inputScanCode, setInputScanCode] = useState('');
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isFinishingSession, setIsFinishingSession] = useState(false);
  const [relocatingCode, setRelocatingCode] = useState<string | null>(null);

  // Sessions List State (from Server)
  const [serverSessions, setServerSessions] = useState<ServerOpnameSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(true);
  const [sessionsFetchError, setSessionsFetchError] = useState<string | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(false);

  // Modal State for "Atur Akses Sesi"
  const [editingSession, setEditingSession] = useState<ServerOpnameSession | null>(null);
  const [modalAllowedSites, setModalAllowedSites] = useState<string[]>([]);
  const [modalLockMoves, setModalLockMoves] = useState<boolean>(false);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState<boolean>(false);

  // Toast System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input when live session is active
  useEffect(() => {
    if (activeSession && (activeSession.status === 'ACTIVE' || activeSession.status === 'IN_PROGRESS')) {
      inputRef.current?.focus();
    }
  }, [activeSession]);

  // Fetch Sessions from Server
  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setSessionsFetchError(null);
    try {
      const res = await storageService.listOpnameSessions();

      if (res && res.success && Array.isArray(res.sessions)) {
        setServerSessions(res.sessions);
      } else {
        const errMsg = res?.message || 'Gagal memuat daftar sesi dari server.';
        setSessionsFetchError(errMsg);
      }
    } catch (err: any) {
      const errMsg = err.message || 'Tidak dapat terhubung ke server.';
      setSessionsFetchError(errMsg);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Check if there is an active session for the currently selected site in the form
  const activeSessionForSelectedSite = useMemo(() => {
    return serverSessions.find(
      (s) => s.siteId === selectedSiteId && (s.status === 'ACTIVE' || s.status === 'IN_PROGRESS')
    );
  }, [serverSessions, selectedSiteId]);

  // Separate Active vs Completed/Cancelled sessions
  const activeServerSessions = useMemo(() => {
    return serverSessions.filter((s) => s.status === 'ACTIVE' || s.status === 'IN_PROGRESS');
  }, [serverSessions]);

  const historyServerSessions = useMemo(() => {
    return serverSessions.filter((s) => s.status === 'COMPLETED' || s.status === 'CANCELLED');
  }, [serverSessions]);

  // Start Session handler (via START_OPNAME_SESSION)
  const handleStartSession = async () => {
    if (!currentUser || !selectedSiteId || isStartingSession) return;

    setIsStartingSession(true);

    const allowedSitesPayload = Array.from(new Set([selectedSiteId, ...formAllowedSites]));

    try {
      const res = await storageService.startOpnameSession({
        siteId: selectedSiteId,
        locationId: selectedLocationId || undefined,
        allowedSites: allowedSitesPayload,
        lockMoves: isAdminMasterOrAllSites ? formLockMoves : false,
      });

      if (res && res.success && res.session) {
        soundService.playSuccess();
        addToast('success', res.message || `Sesi ${res.session.sessionId} berhasil dimulai di server!`);
        setActiveSession(res.session);
        setScannedItems([]);
        fetchSessions();
      } else {
        soundService.playError();
        addToast('error', res?.message || 'Gagal memulai sesi di server.');
      }
    } catch (err: any) {
      soundService.playError();
      addToast('error', err.message || 'Tidak dapat terhubung ke server.');
    } finally {
      setIsStartingSession(false);
    }
  };

  // Resume active session
  const handleResumeSession = (session: ServerOpnameSession) => {
    setActiveSession(session);
    if (session.locationId) {
      setSelectedLocationId(session.locationId);
    }
    setSelectedSiteId(session.siteId);
    soundService.playSuccess();
    addToast('info', `Melanjutkan sesi ${session.sessionId} (${session.siteId})`);
  };

  // Open "Atur Akses" Modal
  const handleOpenAccessModal = (session: ServerOpnameSession) => {
    setEditingSession(session);
    setModalAllowedSites(session.allowedSites || [session.siteId]);
    setModalLockMoves(Boolean(session.lockMoves));
  };

  // Save "Atur Akses" (via UPDATE_OPNAME_ACCESS)
  const handleSaveAccess = async () => {
    if (!editingSession || isUpdatingAccess) return;

    setIsUpdatingAccess(true);
    const guaranteedSites = Array.from(new Set([editingSession.siteId, ...modalAllowedSites]));

    try {
      const res = await storageService.updateOpnameAccess({
        sessionId: editingSession.sessionId,
        allowedSites: guaranteedSites,
        lockMoves: modalLockMoves,
      });

      if (res && res.success) {
        soundService.playSuccess();
        addToast('success', res.message || 'Pengaturan akses sesi berhasil diperbarui!');
        // Update activeSession if currently running
        if (activeSession && activeSession.sessionId === editingSession.sessionId) {
          setActiveSession((prev) =>
            prev
              ? {
                  ...prev,
                  allowedSites: guaranteedSites,
                  lockMoves: modalLockMoves,
                }
              : null
          );
        }
        setEditingSession(null);
        fetchSessions();
      } else {
        soundService.playError();
        addToast('error', res?.message || 'Gagal memperbarui akses sesi.');
      }
    } catch (err: any) {
      soundService.playError();
      addToast('error', err.message || 'Gagal menghubungi server.');
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  // Process Scanned Code in Active Session
  const handleProcessScan = async (code: string) => {
    if (!activeSession || !currentUser) return;
    const clean = code.trim();
    if (!clean) return;

    // Check duplicate in current session
    if (scannedItems.some((i) => i.barcode === clean || i.assetCode.toUpperCase() === clean.toUpperCase())) {
      soundService.playWarning();
      addToast('warning', `Kode ${clean} sudah pernah di-scan pada sesi ini.`);
      setInputScanCode('');
      return;
    }

    const { machine } = storageService.getMachineByCode(clean);

    let result: OpnameResult = 'UNKNOWN_BARCODE';
    let assetCode = clean;

    if (!machine) {
      result = 'UNKNOWN_BARCODE';
      soundService.playError();
    } else {
      assetCode = machine.assetCode;
      const targetLoc = activeSession.locationId || selectedLocationId;
      if (machine.locationId === targetLoc) {
        result = 'MATCH';
        soundService.playMatch();
      } else if (machine.siteId === activeSession.siteId) {
        result = 'MISPLACED_SAME_SITE';
        soundService.playWarning();
      } else {
        result = 'MISPLACED_OTHER_SITE';
        soundService.playError();
      }
    }

    const targetLoc = activeSession.locationId || selectedLocationId;
    const newItem: OpnameItem = {
      sessionId: activeSession.sessionId,
      assetCode,
      barcode: machine?.barcode || clean,
      result,
      currentActualLocation: targetLoc,
      registeredLocation: machine?.locationId,
      registeredSite: machine?.siteId,
      scannedAt: new Date().toISOString(),
    };

    const updatedItems = [newItem, ...scannedItems];
    setScannedItems(updatedItems);
    setInputScanCode('');

    // Update session counters
    const matchCount = updatedItems.filter((i) => i.result === 'MATCH').length;
    const misplacedCount = updatedItems.filter(
      (i) => i.result === 'MISPLACED_SAME_SITE' || i.result === 'MISPLACED_OTHER_SITE'
    ).length;
    const totalExpected = activeSession.expected || expectedMachines.length;
    const missingCount = Math.max(totalExpected - matchCount, 0);

    const updatedSession: ServerOpnameSession = {
      ...activeSession,
      scanned: updatedItems.length,
      match: matchCount,
      missing: missingCount,
      misplaced: misplacedCount,
    };

    setActiveSession(updatedSession);
  };

  // Quick move misplaced machine here
  const handleQuickMoveHere = async (item: OpnameItem) => {
    if (!activeSession || !currentUser || relocatingCode) return;
    const targetLoc = activeSession.locationId || selectedLocationId;
    if (!targetLoc) return;

    setRelocatingCode(item.assetCode);
    try {
      const res = await storageService.resolveOpnameMisplaced({
        assetCode: item.assetCode,
        targetLocationId: targetLoc,
        username: currentUser.username,
        sessionId: activeSession.sessionId,
      });

      if (res.success) {
        soundService.playSuccess();
        setScannedItems((prev) =>
          prev.map((i) =>
            i.assetCode === item.assetCode ? { ...i, result: 'MATCH', resolution: 'MOVED_HERE' } : i
          )
        );
        addToast('success', `Mesin ${item.assetCode} berhasil dipindahkan ke ${targetLoc}.`);
      } else {
        soundService.playError();
        addToast('error', res.message || 'Gagal memindahkan mesin di server.');
      }
    } catch (err: any) {
      soundService.playError();
      addToast('error', err.message || 'Tidak dapat terhubung ke server.');
    } finally {
      setRelocatingCode(null);
    }
  };

  // Finish (COMPLETED) or Cancel (CANCELLED) Session (via SAVE_OPNAME)
  const handleCloseSession = async (status: 'COMPLETED' | 'CANCELLED') => {
    if (!activeSession || isFinishingSession) return;

    setIsFinishingSession(true);
    // finishedAt/endedAt sekarang ditentukan oleh server (kolom ended_at), tidak perlu dihitung di sini.

    try {
      const res = await storageService.closeOpnameSession(
        { sessionId: activeSession.sessionId, status },
        scannedItems.map((it) => ({
          assetCode: it.assetCode,
          barcode: it.barcode,
          result: it.result,
          scannedLocationId: it.currentActualLocation,
          expectedLocationId: it.registeredLocation,
        }))
      );

      if (res && res.success) {
        soundService.playSuccess();
        addToast(
          'success',
          status === 'COMPLETED'
            ? 'Sesi Weekly Machine List berhasil diselesaikan dan disimpan di server!'
            : 'Sesi berhasil dibatalkan.'
        );
        setActiveSession(null);
        setScannedItems([]);
        fetchSessions();
      } else {
        soundService.playError();
        addToast('error', res?.message || 'Gagal menutup sesi di server. Sesi tetap terbuka.');
      }
    } catch (err: any) {
      soundService.playError();
      addToast('error', err.message || 'Tidak dapat terhubung ke server. Sesi tetap terbuka.');
    } finally {
      setIsFinishingSession(false);
    }
  };

  // Missing Machines List
  const missingMachines = useMemo(() => {
    if (!activeSession) return [];
    const matchedAssetCodes = new Set(
      scannedItems.filter((i) => i.result === 'MATCH').map((i) => i.assetCode)
    );
    return expectedMachines.filter((m) => !matchedAssetCodes.has(m.assetCode));
  }, [activeSession, expectedMachines, scannedItems]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in pb-12">
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-2xl shadow-xl text-xs font-semibold flex items-start gap-2.5 border transition-all animate-in slide-in-from-bottom-3 duration-200 ${
              t.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-100 border-emerald-500/40 shadow-emerald-950/30'
                : t.type === 'error'
                ? 'bg-rose-950/95 text-rose-100 border-rose-500/40 shadow-rose-950/30'
                : t.type === 'warning'
                ? 'bg-amber-950/95 text-amber-100 border-amber-500/40 shadow-amber-950/30'
                : 'bg-slate-900/95 text-slate-100 border-slate-700 shadow-black/40'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-white/60 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Weekly Machine List
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sistem audit & rekonsiliasi mesin mingguan dengan sinkronisasi langsung di Server.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchSessions}
            disabled={isLoadingSessions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Segarkan data sesi dari server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* VIEW JIKA BELUM ADA SESI AKTIF YANG DIBUKA */}
      {!activeSession ? (
        <div className="space-y-6">
          {/* 1) FORM MULAI SESI */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Mulai Sesi Audit Lokasi Baru (Server)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Dropdown Site: HANYA berisi site dari currentUser.siteAccess */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Site (Sesuai Hak Akses):
                </label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => {
                    const newSite = e.target.value;
                    setSelectedSiteId(newSite);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900 hover:bg-white focus:bg-white dark:hover:bg-slate-800 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white font-bold focus:border-emerald-500 transition-colors"
                >
                  {accessibleSites.map((s) => (
                    <option key={s.siteId} value={s.siteId}>
                      {s.siteId} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown Lokasi yang Diaudit */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Lokasi yang Diaudit:
                </label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 hover:bg-white focus:bg-white dark:hover:bg-slate-800 dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white font-mono font-bold focus:border-emerald-500 transition-colors"
                >
                  {availableLocations.length > 0 ? (
                    availableLocations.map((l) => (
                      <option key={l.locationId} value={l.locationId}>
                        {l.locationId} ({l.displayName})
                      </option>
                    ))
                  ) : (
                    <option value="">Semua Lokasi di {selectedSiteId}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Panel Pengaturan Akses Sesi */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Pengaturan Akses Sesi</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {isAdminMasterOrAllSites ? 'Otoritas Admin' : 'Akun Factory'}
                </span>
              </div>

              {isAdminMasterOrAllSites ? (
                <div className="space-y-3">
                  {/* Badge Admin Master & All Sites (Selalu ikut) */}
                  <div className="flex items-center flex-wrap gap-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Otoritas Otomatis:</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[11px]">
                      <ShieldCheck className="w-3 h-3 text-indigo-500" />
                      Admin Master
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[11px]">
                      <ShieldCheck className="w-3 h-3 text-indigo-500" />
                      All Sites
                    </span>
                  </div>

                  {/* Checkbox Factory Authority (PW1, PW2, PW3) */}
                  <div>
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Authority Factory yang diizinkan ikut sesi:
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {FACTORY_SITES.map((siteCode) => {
                        const isTargetSite = siteCode === selectedSiteId;
                        const isChecked = formAllowedSites.includes(siteCode) || isTargetSite;

                        return (
                          <label
                            key={siteCode}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors select-none ${
                              isChecked
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                            } ${isTargetSite ? 'opacity-90 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isTargetSite}
                              onChange={(e) => {
                                if (isTargetSite) return;
                                if (e.target.checked) {
                                  setFormAllowedSites((prev) => [...prev, siteCode]);
                                } else {
                                  setFormAllowedSites((prev) => prev.filter((s) => s !== siteCode));
                                }
                              }}
                              className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                            />
                            <span>{siteCode}</span>
                            {isTargetSite && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                                (Site Diaudit)
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Switch Kunci Pemindahan Mesin */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between flex-wrap gap-2">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Kunci pemindahan mesin di site ini</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Kunci mutasi mesin di site {selectedSiteId} selama opname berlangsung (kecuali peserta sesi).
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formLockMoves}
                        onChange={(e) => setFormLockMoves(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                </div>
              ) : (
                /* Akun Factory: Panel Hanya Baca */
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Akses sesi: site Anda saja ({selectedSiteId})</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Pengaturan akses multi-site dan penguncian mutasi dikelola oleh Admin Master / All Sites.
                  </p>
                </div>
              )}
            </div>

            {/* Total Mesin Terdaftar Banner */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                Jumlah mesin terdaftar di {selectedLocationId || selectedSiteId}:
              </span>
              <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
                {expectedMachines.length} Mesin
              </span>
            </div>

            {/* Tombol Mulai Sesi / Peringatan Sesi Aktif */}
            {activeSessionForSelectedSite ? (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Sesi aktif sudah ada untuk Site {selectedSiteId}!</span>
                </div>
                <div className="text-[11px] text-amber-800 dark:text-amber-300">
                  ID Sesi: <span className="font-mono font-bold">{activeSessionForSelectedSite.sessionId}</span> • Dimulai oleh: <span className="font-semibold">{activeSessionForSelectedSite.startedBy}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleResumeSession(activeSessionForSelectedSite)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Lanjutkan Sesi Ini</span>
                  </button>
                  <button
                    type="button"
                    disabled
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-xl text-xs font-bold cursor-not-allowed opacity-60"
                  >
                    Sesi aktif: {activeSessionForSelectedSite.sessionId}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartSession}
                disabled={isStartingSession || !selectedSiteId}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-extrabold shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
              >
                {isStartingSession ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Membuat Sesi di Server...</span>
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Mulai Sesi Opname di Server</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* 2) DAFTAR SESI DARI SERVER */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Sesi Berjalan & Riwayat (Server)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold border border-emerald-200 dark:border-emerald-800">
                  {activeServerSessions.length} Aktif
                </span>
              </div>
            </div>

            {/* Skeleton Loading State */}
            {isLoadingSessions && (
              <div className="space-y-3 py-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 animate-pulse flex flex-col gap-2"
                  >
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {!isLoadingSessions && sessionsFetchError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{sessionsFetchError}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchSessions}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 transition-colors shrink-0"
                >
                  Coba lagi
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoadingSessions && !sessionsFetchError && serverSessions.length === 0 && (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs space-y-2">
                <ClipboardCheck className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-semibold">Belum ada sesi Weekly Machine List di server.</p>
                <p className="text-[11px] text-slate-400">
                  Gunakan formulir di atas untuk memulai sesi audit baru.
                </p>
              </div>
            )}

            {/* Active Sessions List */}
            {!isLoadingSessions && !sessionsFetchError && activeServerSessions.length > 0 && (
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Sesi Aktif:
                </span>
                <div className="grid grid-cols-1 gap-3">
                  {activeServerSessions.map((s) => (
                    <div
                      key={s.sessionId}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                              {s.sessionId}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold uppercase border border-emerald-300 dark:border-emerald-800">
                              ● {s.status}
                            </span>
                            {s.lockMoves && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-800"
                                title="Pemindahan mesin di site ini dikunci"
                              >
                                <Lock className="w-3 h-3 text-amber-600" />
                                Mutasi Dikunci
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            Site: <span className="font-bold text-slate-800 dark:text-slate-200">{s.siteId}</span>
                            {s.locationId && (
                              <span> • Lokasi: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{s.locationId}</span></span>
                            )}
                            <span> • Oleh: <span className="font-semibold">{s.startedBy}</span></span>
                            {s.startedAt && (
                              <span className="text-[11px] text-slate-400 font-mono">
                                {' '}
                                ({new Date(s.startedAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isAdminMasterOrAllSites && (
                            <button
                              type="button"
                              onClick={() => handleOpenAccessModal(s)}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Atur akses authority factory & penguncian mutasi"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Atur akses</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleResumeSession(s)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Lanjutkan</span>
                          </button>
                        </div>
                      </div>

                      {/* Chip Site yang Diizinkan */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/70 dark:border-slate-800 text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Akses Sesi:</span>
                        <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                          Admin Master
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                          All Sites
                        </span>
                        {s.allowedSites &&
                          s.allowedSites.map((siteCode) => (
                            <span
                              key={siteCode}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-[10px] border border-emerald-200 dark:border-emerald-800/60"
                            >
                              {siteCode}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History Sessions Section (Completed / Cancelled) */}
            {!isLoadingSessions && !sessionsFetchError && historyServerSessions.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsHistoryExpanded((prev) => !prev)}
                  className="flex items-center justify-between w-full py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Riwayat Sesi Selesai ({historyServerSessions.length})</span>
                  </span>
                  {isHistoryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isHistoryExpanded && (
                  <div className="space-y-2 pt-2">
                    {historyServerSessions.slice(0, 15).map((s) => (
                      <div
                        key={s.sessionId}
                        className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 opacity-70 hover:opacity-100 transition-opacity text-xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                              {s.sessionId}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                s.status === 'COMPLETED'
                                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {s.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            Site: {s.siteId} • Oleh: {s.startedBy}
                          </div>
                        </div>

                        {s.endedAt && (
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {new Date(s.endedAt).toLocaleDateString('id-ID')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 3) LIVE IN-PROGRESS SCANNING SESSION */
        <div className="space-y-6">
          {/* Active Counters Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Sesi Opname Aktif di Server
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                    [{activeSession.sessionId}]
                  </span>
                  {activeSession.lockMoves && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-800">
                      <Lock className="w-3 h-3 text-amber-600" />
                      Mutasi Dikunci
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-black text-slate-900 dark:text-white font-mono">
                  {activeSession.locationId || 'Semua Lokasi'} ({activeSession.siteId})
                </h2>

                {/* Chips of Allowed Sites */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs pt-0.5">
                  <span className="text-slate-500 text-[11px]">Akses Terbuka:</span>
                  <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                    Admin Master
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                    All Sites
                  </span>
                  {activeSession.allowedSites?.map((siteCode) => (
                    <span
                      key={siteCode}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-[10px] border border-emerald-200 dark:border-emerald-800"
                    >
                      {siteCode}
                    </span>
                  ))}

                  {isAdminMasterOrAllSites && (
                    <button
                      type="button"
                      onClick={() => handleOpenAccessModal(activeSession)}
                      className="ml-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                    >
                      (Ubah Akses)
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons: Selesaikan & Batal */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    // Tidak pakai window.confirm(): bisa diblokir di sebagian lingkungan dan
                    // membuat tombol ini gagal diam-diam tanpa pesan apa pun.
                    handleCloseSession('CANCELLED');
                  }}
                  disabled={isFinishingSession}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Batal</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCloseSession('COMPLETED')}
                  disabled={isFinishingSession}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {isFinishingSession ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Selesaikan & Simpan</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Counters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-slate-500">Terdaftar (Expected)</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-1">
                  {activeSession.expected || expectedMachines.length}
                </div>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center">
                <div className="text-emerald-800 dark:text-emerald-300 font-bold">MATCH (Sesuai)</div>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-1">
                  {activeSession.match || 0}
                </div>
              </div>

              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-center">
                <div className="text-rose-800 dark:text-rose-300 font-bold">MISSING</div>
                <div className="text-xl font-bold text-rose-700 dark:text-rose-400 font-mono mt-1">
                  {missingMachines.length}
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-center">
                <div className="text-amber-800 dark:text-amber-300 font-bold">MISPLACED</div>
                <div className="text-xl font-bold text-amber-700 dark:text-amber-400 font-mono mt-1">
                  {activeSession.misplaced || 0}
                </div>
              </div>
            </div>

            {/* Live Input Field for Scanner */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleProcessScan(inputScanCode);
              }}
              className="space-y-2 pt-2"
            >
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputScanCode}
                  onChange={(e) => setInputScanCode(e.target.value)}
                  placeholder="Scan QR / Barcode atau ketik Barcode / Kode Aset di sini..."
                  className="w-full bg-slate-50 dark:bg-slate-900 hover:bg-white focus:bg-white dark:hover:bg-slate-800 dark:focus:bg-slate-800 border-2 border-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white font-mono placeholder:text-slate-400 shadow-xs transition-colors"
                  autoComplete="off"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {onOpenScanner && (
                    <button
                      type="button"
                      onClick={onOpenScanner}
                      className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      title="Buka Kamera Scanner"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Scan
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Scanned Items Stream */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between">
              <span>Hasil Scan Terkini ({scannedItems.length})</span>
              <span className="text-xs text-slate-500">Urut waktu scan terbaru</span>
            </h3>

            {scannedItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                Arahkan barcode scanner untuk mulai mendeteksi mesin di lokasi ini.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {scannedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {item.assetCode}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            item.result === 'MATCH'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                              : item.result === 'MISPLACED_SAME_SITE'
                              ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {item.result}
                        </span>
                      </div>

                      {item.result === 'MISPLACED_SAME_SITE' && (
                        <div className="text-amber-800 dark:text-amber-300 text-[11px]">
                          Tercatat di <span className="font-bold">{item.registeredLocation}</span> (Site {item.registeredSite})
                        </div>
                      )}

                      {item.result === 'MISPLACED_OTHER_SITE' && (
                        <div className="text-rose-800 dark:text-rose-300 text-[11px]">
                          Milik pabrik lain! Tercatat di Site <span className="font-bold">{item.registeredSite}</span> ({item.registeredLocation})
                        </div>
                      )}
                    </div>

                    {item.result === 'MISPLACED_SAME_SITE' && (
                      <button
                        type="button"
                        onClick={() => handleQuickMoveHere(item)}
                        disabled={relocatingCode === item.assetCode}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 self-start sm:self-auto shadow-xs transition-colors cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>
                          {relocatingCode === item.assetCode
                            ? 'Memindahkan...'
                            : getTranslation('move_to_this_location', language)}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Missing Machines List */}
          {missingMachines.length > 0 && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/80 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Belum Terscan di Lokasi Ini (Missing: {missingMachines.length})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {missingMachines.slice(0, 12).map((m) => (
                  <div
                    key={m.assetCode}
                    className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200 flex justify-between"
                  >
                    <div>
                      <div className="font-mono font-bold text-rose-950 dark:text-rose-100">{m.assetCode}</div>
                      <div className="text-[11px] text-rose-800 dark:text-rose-300 truncate max-w-[220px]">
                        {getMachineLabel(m).primary}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                      {m.serial}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL ATUR AKSES SESI (Hanya Admin Master / All Sites) */}
      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Atur Akses Sesi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <div className="text-slate-500">ID Sesi:</div>
              <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                {editingSession.sessionId}
              </div>
              <div className="text-slate-500">
                Site Utama: <span className="font-bold text-slate-800 dark:text-slate-200">{editingSession.siteId}</span>
              </div>
            </div>

            {/* Checkbox Sites */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Authority Factory yang Diizinkan:
              </span>
              <div className="flex flex-wrap gap-2.5">
                {FACTORY_SITES.map((siteCode) => {
                  const isMainSite = siteCode === editingSession.siteId;
                  const isChecked = modalAllowedSites.includes(siteCode) || isMainSite;

                  return (
                    <label
                      key={siteCode}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold select-none ${
                        isChecked
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      } ${isMainSite ? 'opacity-90 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isMainSite}
                        onChange={(e) => {
                          if (isMainSite) return;
                          if (e.target.checked) {
                            setModalAllowedSites((prev) => [...prev, siteCode]);
                          } else {
                            setModalAllowedSites((prev) => prev.filter((s) => s !== siteCode));
                          }
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                      <span>{siteCode}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Switch Kunci Mutasi */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Kunci pemindahan mesin di site ini</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Cegah mutasi mesin selama opname berlangsung.
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalLockMoves}
                  onChange={(e) => setModalLockMoves(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveAccess}
                disabled={isUpdatingAccess}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isUpdatingAccess ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Akses</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
