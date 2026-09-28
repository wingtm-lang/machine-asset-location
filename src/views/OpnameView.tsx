import React, { useState, useMemo, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getTranslation } from '../services/translations';
import { storageService } from '../services/storage';
import { soundService } from '../services/sound';
import { Location, Machine, OpnameItem, OpnameResult, OpnameSession } from '../types';

interface OpnameViewProps {
  onOpenScanner: () => void;
}

export const OpnameView: React.FC<OpnameViewProps> = () => {
  const { currentUser, language, canAccessSite } = useAuth();
  const sites = storageService.getSites();

  const [selectedSiteId, setSelectedSiteId] = useState<string>('PW1');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('PW1-L01');
  const [activeSession, setActiveSession] = useState<OpnameSession | null>(null);
  const [scannedItems, setScannedItems] = useState<OpnameItem[]>([]);
  const [inputScanCode, setInputScanCode] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  const availableLocations = useMemo(() => {
    return storageService.getLocations(selectedSiteId).filter((l) => l.active);
  }, [selectedSiteId]);

  // Expected machines registered in this location
  const expectedMachines = useMemo(() => {
    if (!selectedLocationId) return [];
    return storageService.getMachinesAtLocation(selectedLocationId);
  }, [selectedLocationId]);

  // Auto focus input when session is running
  useEffect(() => {
    if (activeSession && activeSession.status === 'IN_PROGRESS') {
      inputRef.current?.focus();
    }
  }, [activeSession]);

  // Start new opname session
  const handleStartSession = () => {
    if (!currentUser || !selectedLocationId) return;

    const currentYear = new Date().getFullYear();
    const weekNum = 39; // ISO week sample
    const weekStr = `${currentYear}-W${String(weekNum).padStart(2, '0')}`;
    const sessionId = `OPN-${weekStr}-${selectedLocationId}-${Date.now()}`;

    const session: OpnameSession = {
      sessionId,
      week: weekStr,
      locationId: selectedLocationId,
      siteId: selectedSiteId,
      startedAt: new Date().toISOString(),
      startedBy: currentUser.username,
      expected: expectedMachines.length,
      scanned: 0,
      match: 0,
      missing: expectedMachines.length,
      misplaced: 0,
      status: 'IN_PROGRESS',
    };

    setActiveSession(session);
    setScannedItems([]);
    storageService.saveOpnameSession(session, []);
    soundService.playSuccess();
  };

  // Process scanned code in Opname session (A5.4)
  const handleProcessScan = (code: string) => {
    if (!activeSession || !currentUser) return;
    const clean = code.trim();
    if (!clean) return;

    // Check if already scanned in this session
    if (scannedItems.some((i) => i.barcode === clean || i.assetCode.toUpperCase() === clean.toUpperCase())) {
      soundService.playWarning();
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
      if (machine.locationId === activeSession.locationId) {
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

    const newItem: OpnameItem = {
      sessionId: activeSession.sessionId,
      assetCode,
      barcode: machine?.barcode || clean,
      result,
      currentActualLocation: activeSession.locationId,
      registeredLocation: machine?.locationId,
      registeredSite: machine?.siteId,
      scannedAt: new Date().toISOString(),
    };

    const updatedItems = [newItem, ...scannedItems];
    setScannedItems(updatedItems);
    setInputScanCode('');

    // Update Session Counters
    const matchCount = updatedItems.filter((i) => i.result === 'MATCH').length;
    const misplacedCount = updatedItems.filter(
      (i) => i.result === 'MISPLACED_SAME_SITE' || i.result === 'MISPLACED_OTHER_SITE'
    ).length;
    const missingCount = Math.max(activeSession.expected - matchCount, 0);

    const updatedSession: OpnameSession = {
      ...activeSession,
      scanned: updatedItems.length,
      match: matchCount,
      missing: missingCount,
      misplaced: misplacedCount,
    };

    setActiveSession(updatedSession);
    storageService.saveOpnameSession(updatedSession, updatedItems);
  };

  // 1-Click Relocate Misplaced Machine to Current Location (A5.4)
  const handleQuickMoveHere = (item: OpnameItem) => {
    if (!activeSession || !currentUser) return;
    const res = storageService.resolveOpnameMisplaced({
      assetCode: item.assetCode,
      targetLocationId: activeSession.locationId,
      username: currentUser.username,
      sessionId: activeSession.sessionId,
    });

    if (res.success) {
      soundService.playSuccess();
      // Update item result to MATCH
      setScannedItems((prev) =>
        prev.map((i) =>
          i.assetCode === item.assetCode ? { ...i, result: 'MATCH', resolution: 'MOVED_HERE' } : i
        )
      );
    }
  };

  // Complete Opname Session
  const handleFinishSession = () => {
    if (!activeSession) return;
    const finished: OpnameSession = {
      ...activeSession,
      finishedAt: new Date().toISOString(),
      status: 'COMPLETED',
    };
    storageService.saveOpnameSession(finished, scannedItems);
    setActiveSession(null);
    soundService.playSuccess();
    alert('Sesi opname mingguan berhasil diselesaikan dan disimpan!');
  };

  // Missing Machines List (Expected at location but not yet scanned as MATCH)
  const missingMachines = useMemo(() => {
    if (!activeSession) return [];
    const matchedAssetCodes = new Set(
      scannedItems.filter((i) => i.result === 'MATCH').map((i) => i.assetCode)
    );
    return expectedMachines.filter((m) => !matchedAssetCodes.has(m.assetCode));
  }, [activeSession, expectedMachines, scannedItems]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900">
            {getTranslation('opname_title', language)} (Mingguan)
          </h1>
        </div>
        <p className="text-xs text-slate-500">
          Pilih lokasi lalu scan barcode mesin. Sistem otomatis mengklasifikasikan MATCH, MISSING, dan MISPLACED.
        </p>
      </div>

      {/* Opname Setup / In-Progress Area */}
      {!activeSession ? (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-700" />
            <span>Mulai Sesi Audit Lokasi Baru</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Site:</label>
              <select
                value={selectedSiteId}
                onChange={(e) => {
                  setSelectedSiteId(e.target.value);
                  const locs = storageService.getLocations(e.target.value);
                  if (locs.length > 0) setSelectedLocationId(locs[0].locationId);
                }}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-bold focus:border-emerald-500"
              >
                {sites.map((s) => (
                  <option key={s.siteId} value={s.siteId}>
                    {s.siteId} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Lokasi yang Diaudit:
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-mono font-bold focus:border-emerald-500"
              >
                {availableLocations.map((l) => (
                  <option key={l.locationId} value={l.locationId}>
                    {l.locationId} ({l.displayName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <span className="text-slate-600">
              Jumlah mesin terdaftar di {selectedLocationId}:
            </span>
            <span className="font-mono font-black text-emerald-700 text-sm">
              {expectedMachines.length} Mesin
            </span>
          </div>

          <button
            onClick={handleStartSession}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-extrabold shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Mulai Sesi Opname Sekarang</span>
          </button>
        </div>
      ) : (
        /* LIVE IN-PROGRESS SCANNING SESSION */
        <div className="space-y-6">
          {/* Active Counters Card */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                  ● Sesi Opname Berlangsung
                </span>
                <h2 className="text-lg font-black text-slate-900 font-mono">
                  {activeSession.locationId} ({activeSession.siteId})
                </h2>
              </div>

              <button
                onClick={handleFinishSession}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Selesaikan & Simpan
              </button>
            </div>

            {/* Counters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                <div className="text-slate-500">Terdaftar (Expected)</div>
                <div className="text-xl font-bold text-slate-900 font-mono mt-1">
                  {activeSession.expected}
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                <div className="text-emerald-800 font-bold">MATCH (Sesuai)</div>
                <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
                  {activeSession.match}
                </div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-center">
                <div className="text-rose-800 font-bold">MISSING</div>
                <div className="text-xl font-bold text-rose-700 font-mono mt-1">
                  {missingMachines.length}
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                <div className="text-amber-800 font-bold">MISPLACED</div>
                <div className="text-xl font-bold text-amber-700 font-mono mt-1">
                  {activeSession.misplaced}
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
                  placeholder="Scan QR / Barcode atau ketik di sini..."
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border-2 border-emerald-500 rounded-xl px-4 py-3 text-sm text-slate-900 font-mono placeholder:text-slate-400 shadow-xs"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  Scan
                </button>
              </div>
            </form>
          </div>

          {/* Scanned Items Stream */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center justify-between">
              <span>Hasil Scan Terkini ({scannedItems.length})</span>
              <span className="text-xs text-slate-500">Urut waktu scan terbaru</span>
            </h3>

            <div className="space-y-2.5 max-h-96 overflow-y-auto">
              {scannedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-700">{item.assetCode}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          item.result === 'MATCH'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : item.result === 'MISPLACED_SAME_SITE'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {item.result}
                      </span>
                    </div>

                    {item.result === 'MISPLACED_SAME_SITE' && (
                      <div className="text-amber-800 text-[11px]">
                        Tercatat di <span className="font-bold">{item.registeredLocation}</span> (Site {item.registeredSite})
                      </div>
                    )}

                    {item.result === 'MISPLACED_OTHER_SITE' && (
                      <div className="text-rose-800 text-[11px]">
                        Milik pabrik lain! Tercatat di Site <span className="font-bold">{item.registeredSite}</span> ({item.registeredLocation})
                      </div>
                    )}
                  </div>

                  {item.result === 'MISPLACED_SAME_SITE' && (
                    <button
                      onClick={() => handleQuickMoveHere(item)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 self-start sm:self-auto shadow-xs"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>{getTranslation('move_to_this_location', language)}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* MISSING MACHINES LIST */}
          {missingMachines.length > 0 && (
            <div className="p-6 rounded-3xl bg-white border border-rose-200 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Belum Terscan di Lokasi Ini (Missing: {missingMachines.length})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {missingMachines.slice(0, 10).map((m) => (
                  <div
                    key={m.assetCode}
                    className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex justify-between"
                  >
                    <div>
                      <div className="font-mono font-bold text-rose-950">{m.assetCode}</div>
                      <div className="text-[11px] text-rose-800">{m.standardMachineName}</div>
                    </div>
                    <span className="font-mono text-[10px] text-rose-600 font-bold">{m.serial}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
