/**
 * Lapisan data (Supabase). Nama dan bentuk metode publik SAMA dengan versi lama agar view
 * tidak perlu diubah, tetapi cara kerjanya berbeda secara mendasar:
 *
 *   - Server (Postgres) adalah satu-satunya sumber kebenaran. Cache di memori hanya
 *     cermin baca; TIDAK ada localStorage untuk data mesin (tidak ada lagi konflik
 *     "data lokal menang atas sheet" dan tidak ada kebocoran antar pengguna).
 *   - Semua tulis (pindah, undo, transfer, opname) memanggil fungsi server (RPC), lalu
 *     cache diperbarui dari server. Aturan bisnis ditegakkan di database, bukan di sini.
 *   - Fitur yang dulu hanya palsu/lokal (laporan email, tambah site, audit lokal, impor
 *     Excel) mengembalikan pesan jujur "belum tersedia" dan tidak berpura-pura berhasil.
 */

import { supabase } from './supabase';
import { emitForbidden, emitUnauthorized } from './authService';
import {
  Site,
  SiteType,
  Location,
  LocationType,
  Rack,
  Machine,
  MachineStatus,
  Movement,
  MovementType,
  StatusLog,
  Transfer,
  TransferStatus,
  OpnameSession,
  OpnameItem,
  User,
  ReportRecipient,
  DailyReport,
  AuditLog,
  AppSettings,
} from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const UI_SETTINGS_KEY = 'ptwinners_ui_settings_v2';
const POLL_INTERVAL_MS = 90_000;
// Batas pengaman murni untuk mencegah loop tak berhenti bila API berperilaku aneh.
// HARUS selalu jauh lebih besar dari jumlah mesin sesungguhnya (saat ini 5.247),
// jika tidak, data akan terpotong diam-diam tanpa pesan error.
const MAX_ROWS = 50_000;
const NOT_AVAILABLE = 'Fitur ini belum tersedia di versi Supabase. Kelola lewat dashboard Supabase atau tunggu pembaruan berikutnya.';

const DEFAULT_SETTINGS: AppSettings = {
  dailyReportTime: '16:30',
  transferOverdueDays: 3,
  undoTimeLimitMinutes: 60,
  sessionExpiryHours: 8,
  rackSlotCapacity: 1,
  companyName: 'PT.WINNERS',
  themePreset: 'sky_cyan',
  layoutStyle: 'sidebar',
  accentColor: 'emerald',
  cardRadius: 'rounded-2xl',
};

const MACHINE_COLS =
  'id, asset_code, barcode, item, standard_machine_name, serial, manufacturer, model, home_site_id, acq_date, ' +
  'status, status_since, site_id, location_id, loan_to, loan_due_date, data_flag, notes, ' +
  'last_moved_at, last_opname_at, updated_at, machine_types(local_name)';

// ---------- pembantu ----------
function uuid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function isoWeek(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function errMessage(e: unknown): string {
  const err = (e ?? {}) as { message?: string };
  const msg = String(err.message ?? '');
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg)) {
    return 'Tidak dapat terhubung ke server. Coba lagi.';
  }
  return msg || 'Terjadi kesalahan saat menghubungi server.';
}

function isAuthError(e: unknown): boolean {
  const err = (e ?? {}) as { code?: string; status?: number; message?: string };
  return err.code === 'PGRST301' || err.code === 'PGRST303' || err.status === 401 || /jwt/i.test(String(err.message ?? ''));
}

function mapMovementType(t: string): MovementType {
  switch (t) {
    case 'MOVE':
    case 'STATUS_CHANGE':
      return 'MOVE';
    case 'TRANSFER_OUT':
      return 'TRANSFER_OUT';
    case 'TRANSFER_IN':
      return 'TRANSFER_IN';
    case 'TRANSFER_CANCEL':
    case 'UNDO':
      return 'UNDO';
    case 'OPNAME_FIX':
      return 'OPNAME_FIX';
    default:
      return 'ADMIN_FIX';
  }
}

interface RpcResult {
  success: boolean;
  message: string;
  code?: string;
  data: Row;
}

interface TransferMeta {
  orderId: number;
  assetCode: string;
}

/**
 * Bentuk sesi opname SAMA PERSIS dengan ServerOpnameSession di OpnameView.tsx, supaya
 * OpnameView tidak perlu diubah tipenya, hanya sumber panggilannya (postGasApi -> storageService).
 */
export interface ServerOpnameSession {
  sessionId: string;
  siteId: string;
  locationId?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  allowedSites: string[];
  lockMoves?: boolean;
  startedBy: string;
  startedAt: string;
  endedAt?: string;
  expected?: number;
  scanned?: number;
  match?: number;
  missing?: number;
  misplaced?: number;
  week?: string;
}

class StorageService {
  private sites: Site[] = [];
  private locations: Location[] = [];
  private racks: Rack[] = [];
  private machines: Machine[] = [];
  private transfers: Transfer[] = [];
  private movements: Movement[] = [];
  private movementRows: Row[] = [];
  private opnameSessions: OpnameSession[] = [];
  private transferMeta = new Map<string, TransferMeta>();
  private assetCodeMap = new Map<string, Machine>();
  private barcodeMap = new Map<string, Machine>();
  private settings: AppSettings = { ...DEFAULT_SETTINGS };

  private listeners = new Set<() => void>();
  private syncListeners = new Set<(isSyncing: boolean) => void>();
  private syncing = false;
  private syncPromise: Promise<{ success: boolean; message: string; count: number; source: string; details?: unknown }> | null = null;
  private lastSyncAt = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.settings = this.loadUiSettings();
  }

  // ---------------------------------------------------------------- langganan
  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  public subscribeSyncStatus(fn: (isSyncing: boolean) => void): () => void {
    this.syncListeners.add(fn);
    fn(this.syncing);
    return () => {
      this.syncListeners.delete(fn);
    };
  }

  public getIsSyncing(): boolean {
    return this.syncing;
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* abaikan kesalahan pendengar */
      }
    });
  }

  private setSyncing(v: boolean): void {
    this.syncing = v;
    this.syncListeners.forEach((fn) => {
      try {
        fn(v);
      } catch {
        /* abaikan */
      }
    });
  }

  // ---------------------------------------------------------------- sinkronisasi
  /** Dipanggil App setelah login. force=false melewati sinkronisasi bila baru saja dilakukan. */
  public async triggerAutoBackgroundSync(force: boolean = false): Promise<boolean> {
    if (!force && Date.now() - this.lastSyncAt < 60_000) return true;
    const res = await this.syncFromServer();
    return res.success;
  }

  /** Nama lama dipertahankan agar pemanggil tidak perlu diubah. Parameter diabaikan. */
  public async syncFromGoogleSheet(
    _spreadsheetIdParam?: string,
    _sheetName?: string
  ): Promise<{ success: boolean; message: string; count: number; source: string; details?: unknown }> {
    return this.syncFromServer();
  }

  public syncFromServer(): Promise<{ success: boolean; message: string; count: number; source: string; details?: unknown }> {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.doSync().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private async fetchAll(
    build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string; code?: string } | null }>,
    pageSize = 1000
  ): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; from < MAX_ROWS; from += pageSize) {
      const { data, error } = await build(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data ?? [];
      out.push(...rows);
      if (rows.length < pageSize) break;
    }
    return out;
  }

  private async doSync(): Promise<{ success: boolean; message: string; count: number; source: string; details?: unknown }> {
    this.setSyncing(true);
    try {
      const [siteRows, rackRows, locRows, machineRows, settingRows] = await Promise.all([
        this.fetchAll((a, b) => supabase.from('sites').select('site_id, name, type, active').order('site_id').range(a, b)),
        this.fetchAll((a, b) => supabase.from('racks').select('rack_no, column_count, active').order('rack_no').range(a, b)),
        this.fetchAll((a, b) =>
          supabase
            .from('locations')
            .select('location_id, site_id, type, display_name, rack_no, column_no, stack, slot_no, active, sort_order')
            .order('sort_order')
            .order('location_id')
            .range(a, b)
        ),
        this.fetchAll((a, b) => supabase.from('machines').select(MACHINE_COLS).order('id').range(a, b)),
        this.fetchAll((a, b) => supabase.from('app_settings').select('key, value').range(a, b)),
      ]);

      this.sites = siteRows.map((r) => ({
        siteId: String(r.site_id),
        name: String(r.name),
        type: r.type as SiteType,
        active: Boolean(r.active),
      }));
      this.racks = rackRows.map((r) => ({
        siteId: 'WH2',
        rackNo: Number(r.rack_no),
        columnCount: Number(r.column_count),
        active: Boolean(r.active),
      }));
      this.locations = locRows.map((r) => ({
        locationId: String(r.location_id),
        siteId: String(r.site_id),
        type: r.type as LocationType,
        displayName: String(r.display_name),
        rackNo: r.rack_no ?? undefined,
        columnNo: r.column_no ?? undefined,
        stack: r.stack ?? undefined,
        capacity: r.type === 'RACK_SLOT' ? 1 : undefined,
        active: Boolean(r.active),
        sortOrder: Number(r.sort_order ?? 0),
      }));
      this.machines = machineRows.map((r) => this.mapMachine(r));

      for (const s of settingRows) {
        if (s.key === 'undo_time_limit_minutes') this.settings.undoTimeLimitMinutes = Number(s.value) || 60;
        if (s.key === 'transfer_overdue_days') this.settings.transferOverdueDays = Number(s.value) || 3;
      }

      await Promise.all([this.loadTransfers(), this.loadMovements(), this.loadOpnameSessions()]);
      this.applyTransitInfo();
      this.rebuildIndices();
      this.lastSyncAt = Date.now();
      this.startPolling();
      this.notify();
      return {
        success: true,
        message: `${this.machines.length} mesin dimuat dari server.`,
        count: this.machines.length,
        source: 'Supabase',
      };
    } catch (e) {
      if (isAuthError(e)) emitUnauthorized();
      return { success: false, message: errMessage(e), count: this.machines.length, source: 'Supabase' };
    } finally {
      this.setSyncing(false);
    }
  }

  private startPolling(): void {
    if (this.pollTimer || typeof window === 'undefined') return;
    this.pollTimer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void this.triggerAutoBackgroundSync(true);
      }
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Dipanggil saat logout / sesi berakhir: kosongkan semua cache data. */
  public clearLocalMachineCache(): void {
    this.stopPolling();
    this.sites = [];
    this.locations = [];
    this.racks = [];
    this.machines = [];
    this.transfers = [];
    this.movements = [];
    this.movementRows = [];
    this.opnameSessions = [];
    this.transferMeta.clear();
    this.lastSyncAt = 0;
    this.rebuildIndices();
    this.notify();
  }

  public rebuildIndices(): void {
    this.assetCodeMap = new Map(this.machines.map((m) => [m.assetCode.toUpperCase(), m]));
    this.barcodeMap = new Map(this.machines.map((m) => [m.barcode, m]));
  }

  // ---------------------------------------------------------------- pemuat data
  private mapMachine(r: Row): Machine {
    const mt = r.machine_types as Row | null | undefined;
    const status = String(r.status) as MachineStatus;
    return {
      assetCode: String(r.asset_code),
      barcode: String(r.barcode),
      item: String(r.item ?? ''),
      homeFactory: String(r.home_site_id ?? r.site_id ?? ''),
      acqDate: String(r.acq_date ?? ''),
      standardMachineName: String(r.standard_machine_name ?? ''),
      localName: mt && mt.local_name ? String(mt.local_name) : undefined,
      serial: String(r.serial ?? ''),
      manufacturer: String(r.manufacturer ?? ''),
      model: String(r.model ?? ''),
      status,
      locationId: r.location_id ? String(r.location_id) : status === 'SOLD' ? 'SOLD' : '',
      siteId: String(r.site_id),
      lastMovedAt: r.last_moved_at ?? undefined,
      lastOpnameAt: r.last_opname_at ?? undefined,
      statusSince: r.status_since ?? undefined,
      loanTo: r.loan_to ?? undefined,
      loanDueDate: r.loan_due_date ?? undefined,
      dataFlag: r.data_flag ?? undefined,
      updatedAt: String(r.updated_at ?? ''),
      updatedBy: '',
      notes: r.notes ?? undefined,
    };
  }

  private async loadTransfers(): Promise<void> {
    const rows = await this.fetchAll((a, b) =>
      supabase
        .from('transfer_items')
        .select(
          'id, transfer_id, status, to_location_id, received_at, received_by_nik, cancelled_at, cancelled_by_nik, asset_code, ' +
            'transfers(transfer_no, from_site_id, to_site_id, note, created_at, created_by_nik)'
        )
        .order('id', { ascending: false })
        .range(a, b)
    );
    this.transferMeta.clear();
    const list: Transfer[] = [];
    for (const r of rows) {
      const t = (r.transfers ?? {}) as Row;
      const id = String(r.id);
      const assetCode = String(r.asset_code ?? '');
      this.transferMeta.set(id, { orderId: Number(r.transfer_id), assetCode });
      list.push({
        transferId: id,
        batchId: t.transfer_no ? String(t.transfer_no) : undefined,
        assetCode,
        fromSite: String(t.from_site_id ?? ''),
        toSite: String(t.to_site_id ?? ''),
        status: String(r.status) as TransferStatus,
        sentAt: String(t.created_at ?? ''),
        sentBy: String(t.created_by_nik ?? ''),
        receivedAt: r.received_at ?? r.cancelled_at ?? undefined,
        receivedBy: r.received_by_nik ?? r.cancelled_by_nik ?? undefined,
        toLocation: r.to_location_id ?? undefined,
        note: t.note ?? undefined,
      });
    }
    this.transfers = list;
  }

  private async loadMovements(): Promise<void> {
    const { data, error } = await supabase
      .from('movements')
      .select(
        'id, movement_type, from_location, to_location, from_site_id, to_site_id, status_before, status_after, ' +
          'reason, moved_by_nik, moved_at, asset_code, transfer_id, opname_session_id'
      )
      .order('id', { ascending: false })
      .limit(300);
    if (error) throw error;
    this.movementRows = (data ?? []) as Row[];
    this.movements = this.movementRows.map((r) => ({
      movementId: String(r.id),
      timestamp: String(r.moved_at),
      assetCode: String(r.asset_code ?? ''),
      type: mapMovementType(String(r.movement_type)),
      fromLocation: String(r.from_location ?? ''),
      toLocation: String(r.to_location ?? ''),
      fromSite: String(r.from_site_id ?? ''),
      toSite: String(r.to_site_id ?? ''),
      transferId: r.transfer_id != null ? String(r.transfer_id) : undefined,
      opnameSessionId: r.opname_session_id != null ? String(r.opname_session_id) : undefined,
      reason: r.reason ?? undefined,
      byUser: String(r.moved_by_nik ?? ''),
    }));
  }

  private async loadOpnameSessions(): Promise<void> {
    const { data, error } = await supabase
      .from('opname_sessions')
      .select(
        'session_no, site_id, location_id, status, started_by_nik, started_at, ended_at, ' +
          'expected_count, scanned_count, match_count, missing_count, misplaced_count'
      )
      .order('id', { ascending: false })
      .limit(200);
    if (error) throw error;
    this.opnameSessions = ((data ?? []) as Row[]).map((r) => ({
      sessionId: String(r.session_no),
      week: isoWeek(String(r.started_at)),
      locationId: String(r.location_id ?? ''),
      siteId: String(r.site_id),
      startedAt: String(r.started_at),
      startedBy: String(r.started_by_nik ?? ''),
      finishedAt: r.ended_at ?? undefined,
      expected: Number(r.expected_count ?? 0),
      scanned: Number(r.scanned_count ?? 0),
      match: Number(r.match_count ?? 0),
      missing: Number(r.missing_count ?? 0),
      misplaced: Number(r.misplaced_count ?? 0),
      status: r.status === 'ACTIVE' ? 'IN_PROGRESS' : (r.status as 'COMPLETED' | 'CANCELLED'),
    }));
  }

  /** Mesin yang sedang IN_TRANSIT: tampilkan lokasi "<tujuan>-IN_TRANSIT" dan id transfernya. */
  private applyTransitInfo(): void {
    const open = new Map<string, Transfer>();
    for (const t of this.transfers) {
      if (t.status === 'IN_TRANSIT') open.set(t.assetCode.toUpperCase(), t);
    }
    for (const m of this.machines) {
      if (m.status === 'IN_TRANSIT') {
        const t = open.get(m.assetCode.toUpperCase());
        m.pendingTransferId = t ? t.transferId : undefined;
        m.locationId = t ? `${t.toSite}-IN_TRANSIT` : 'IN_TRANSIT';
      } else {
        m.pendingTransferId = undefined;
      }
    }
  }

  private async refreshMachinesByCode(codes: string[]): Promise<void> {
    const unique = Array.from(new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean)));
    if (unique.length === 0) return;
    const { data, error } = await supabase.from('machines').select(MACHINE_COLS).in('asset_code', unique);
    if (error) throw error;
    const fresh = new Map<string, Machine>();
    for (const r of (data ?? []) as Row[]) {
      const m = this.mapMachine(r);
      fresh.set(m.assetCode.toUpperCase(), m);
    }
    const next: Machine[] = [];
    for (const m of this.machines) {
      const code = m.assetCode.toUpperCase();
      if (!unique.includes(code)) next.push(m);
      else if (fresh.has(code)) next.push(fresh.get(code) as Machine);
      // tidak ada di hasil = tidak lagi terlihat (mis. sudah pindah ke site di luar akses) -> dibuang
    }
    for (const [code, m] of fresh) {
      if (!next.some((x) => x.assetCode.toUpperCase() === code)) next.push(m);
    }
    this.machines = next;
  }

  /** Setelah tulis berhasil: perbarui mesin terkait + transfer + riwayat dari server. */
  private async afterMutation(codes: string[]): Promise<void> {
    try {
      await Promise.all([this.refreshMachinesByCode(codes), this.loadTransfers(), this.loadMovements()]);
      this.applyTransitInfo();
      this.rebuildIndices();
    } catch (e) {
      if (isAuthError(e)) emitUnauthorized();
    }
    this.notify();
  }

  // ---------------------------------------------------------------- pembaca
  public getSites(): Site[] {
    return this.sites;
  }

  public getLocations(siteId?: string): Location[] {
    if (!siteId || siteId === 'ALL') return this.locations;
    return this.locations.filter((l) => l.siteId === siteId);
  }

  public getRacks(): Rack[] {
    return this.racks;
  }

  public getAllMachines(): Machine[] {
    return this.machines;
  }

  public getTotalMachineCount(): number {
    return this.machines.length;
  }

  public getMachineByCode(query: string): { machine: Machine | null; searchTimeMs: number } {
    const t0 = performance.now();
    const clean = (query || '').trim();
    const upper = clean.toUpperCase();
    let m = this.barcodeMap.get(clean) || this.assetCodeMap.get(upper);
    if (!m && clean) {
      m = this.machines.find((x) => x.serial === clean || x.serial.toUpperCase() === upper);
    }
    return { machine: m || null, searchTimeMs: Number((performance.now() - t0).toFixed(2)) };
  }

  public getMachinesAtLocation(locationId: string): Machine[] {
    return this.machines.filter((m) => m.locationId === locationId);
  }

  /** 300 riwayat terbaru yang terlihat oleh pengguna. Riwayat lengkap: gasAuthService.getMovements (server). */
  public getMovements(assetCode?: string): Movement[] {
    if (!assetCode) return this.movements;
    return this.movements.filter((mov) => mov.assetCode === assetCode);
  }

  /** Perubahan status diturunkan dari riwayat terbaru (bukan arsip lengkap). */
  public getStatusLogs(assetCode?: string): StatusLog[] {
    const logs: StatusLog[] = [];
    for (const r of this.movementRows) {
      const type = String(r.movement_type);
      if (type.startsWith('TRANSFER')) continue;
      if (!r.status_before || !r.status_after || r.status_before === r.status_after) continue;
      if (assetCode && r.asset_code !== assetCode) continue;
      logs.push({
        logId: String(r.id),
        timestamp: String(r.moved_at),
        assetCode: String(r.asset_code ?? ''),
        oldStatus: r.status_before as MachineStatus,
        newStatus: r.status_after as MachineStatus,
        byUser: String(r.moved_by_nik ?? ''),
        note: r.reason ?? undefined,
      });
    }
    return logs;
  }

  public getTransfers(siteId?: string): Transfer[] {
    if (!siteId || siteId === 'ALL') return this.transfers;
    return this.transfers.filter((t) => t.fromSite === siteId || t.toSite === siteId);
  }

  public getPendingTransfersForSite(siteId: string): Transfer[] {
    return this.transfers.filter((t) => t.toSite === siteId && t.status === 'IN_TRANSIT');
  }

  public getOpnameSessions(siteId?: string): OpnameSession[] {
    if (!siteId || siteId === 'ALL') return this.opnameSessions;
    return this.opnameSessions.filter((s) => s.siteId === siteId);
  }

  public getOpnameItems(_sessionId: string): OpnameItem[] {
    return [];
  }

  public getUsers(): User[] {
    return [];
  }

  public getReportRecipients(): ReportRecipient[] {
    return [];
  }

  public getDailyReports(): DailyReport[] {
    return [];
  }

  public getAuditLogs(): AuditLog[] {
    return [];
  }

  public getSettings(): AppSettings {
    return this.settings;
  }

  // ---------------------------------------------------------------- pengaturan tampilan (lokal)
  private loadUiSettings(): AppSettings {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(UI_SETTINGS_KEY) : null;
      if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
    } catch {
      /* pakai bawaan */
    }
    return { ...DEFAULT_SETTINGS };
  }

  public updateSettings(newSettings: AppSettings): { success: boolean; message: string } {
    this.settings = { ...this.settings, ...newSettings };
    try {
      // Hanya preferensi tampilan; angka aturan bisnis berasal dari server (app_settings).
      const ui = {
        themePreset: this.settings.themePreset,
        layoutStyle: this.settings.layoutStyle,
        accentColor: this.settings.accentColor,
        cardRadius: this.settings.cardRadius,
      };
      window.localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(ui));
    } catch {
      /* abaikan */
    }
    this.notify();
    return { success: true, message: 'Pengaturan tampilan disimpan.' };
  }

  // ---------------------------------------------------------------- tulis (semua lewat fungsi server)
  private async rpc(fn: string, args: Row): Promise<RpcResult> {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      if (isAuthError(error)) {
        emitUnauthorized();
        return { success: false, message: 'Sesi berakhir, silakan login kembali', code: 'UNAUTHORIZED', data: {} };
      }
      return { success: false, message: errMessage(error), data: {} };
    }
    const r = (data ?? {}) as Row;
    if (r.success === false) {
      if (r.code === 'FORBIDDEN' || r.code === 'LOCKED') emitForbidden(String(r.message ?? ''));
      return { success: false, message: String(r.message ?? 'Operasi gagal.'), code: r.code, data: r };
    }
    return { success: true, message: String(r.message ?? ''), data: r };
  }

  public async moveMachine(params: {
    assetCode: string;
    targetLocationId: string;
    username: string;
    userSiteAccess: string[];
    reason?: string;
    newStatus?: MachineStatus;
    loanTo?: string;
    loanDueDate?: string;
  }): Promise<{ success: boolean; message: string; machine?: Machine; movement?: Movement }> {
    const { assetCode, targetLocationId, reason, newStatus, loanTo, loanDueDate } = params;
    const res = await this.rpc('move_machine', {
      p_asset_code: assetCode,
      p_location_id: targetLocationId ? targetLocationId : null,
      p_status: newStatus ? newStatus : null,
      p_reason: reason ? reason : null,
      p_loan_to: loanTo ? loanTo : null,
      p_loan_due_date: loanDueDate ? loanDueDate : null,
      p_request_id: uuid(),
    });
    if (!res.success) return { success: false, message: res.message };
    await this.afterMutation([assetCode]);
    return {
      success: true,
      message: res.message,
      machine: this.assetCodeMap.get(assetCode.toUpperCase()),
      movement: this.movements[0],
    };
  }

  public async undoLastMove(params: {
    assetCode: string;
    username: string;
    isAdmin: boolean;
  }): Promise<{ success: boolean; message: string }> {
    const code = params.assetCode.trim().toUpperCase();
    const { data, error } = await supabase
      .from('movements')
      .select('id, movement_type')
      .eq('asset_code', code)
      .order('id', { ascending: false })
      .limit(1);
    if (error) return { success: false, message: errMessage(error) };
    const last = ((data ?? []) as Row[])[0];
    if (!last) return { success: false, message: 'Belum ada riwayat pemindahan untuk mesin ini.' };
    if (last.movement_type !== 'MOVE' && last.movement_type !== 'STATUS_CHANGE') {
      return { success: false, message: 'Perubahan terakhir mesin ini bukan pemindahan biasa, jadi tidak bisa di-undo.' };
    }
    const res = await this.rpc('undo_move', { p_movement_id: last.id, p_request_id: uuid() });
    if (!res.success) return { success: false, message: res.message };
    await this.afterMutation([code]);
    return { success: true, message: res.message };
  }

  public async sendTransfer(params: {
    assetCodes: string[];
    toSite: string;
    sentBy: string;
    userSiteAccess: string[];
    vehicleNo?: string;
    driverName?: string;
    note?: string;
  }): Promise<{
    success: boolean;
    message: string;
    count: number;
    skipped?: { code: string; reason: 'NOT_FOUND' | 'NO_ACCESS' | 'PENDING' | 'SOLD' | 'SAME_SITE'; assetCode?: string }[];
  }> {
    const res = await this.rpc('send_transfer', {
      p_asset_codes: params.assetCodes,
      p_to_site: params.toSite,
      p_note: params.note ? params.note : null,
      p_vehicle_no: params.vehicleNo ? params.vehicleNo : null,
      p_driver_name: params.driverName ? params.driverName : null,
      p_request_id: uuid(),
    });
    if (!res.success) return { success: false, message: res.message, count: 0, skipped: [] };
    await this.afterMutation(params.assetCodes);
    return { success: true, message: res.message, count: Number(res.data.count ?? params.assetCodes.length), skipped: [] };
  }

  public async receiveTransfer(params: {
    transferId: string;
    toLocationId: string;
    receivedBy: string;
    userSiteAccess: string[];
  }): Promise<{ success: boolean; message: string }> {
    const meta = this.transferMeta.get(params.transferId);
    if (!meta) return { success: false, message: 'Transfer tidak ditemukan. Muat ulang data lalu coba lagi.' };
    const res = await this.rpc('receive_transfer', {
      p_transfer_id: meta.orderId,
      p_to_location_id: params.toLocationId,
      p_asset_codes: [meta.assetCode],
      p_request_id: uuid(),
    });
    if (!res.success) return { success: false, message: res.message };
    await this.afterMutation([meta.assetCode]);
    return { success: true, message: res.message };
  }

  public async cancelTransfer(
    transferId: string,
    _username: string,
    _userSiteAccess: string[]
  ): Promise<{ success: boolean; message: string }> {
    const meta = this.transferMeta.get(transferId);
    if (!meta) return { success: false, message: 'Transfer tidak ditemukan. Muat ulang data lalu coba lagi.' };
    const res = await this.rpc('cancel_transfer', {
      p_transfer_id: meta.orderId,
      p_asset_codes: [meta.assetCode],
      p_request_id: uuid(),
    });
    if (!res.success) return { success: false, message: res.message };
    await this.afterMutation([meta.assetCode]);
    return { success: true, message: res.message };
  }

  private async resolveSessionId(sessionNo: string): Promise<number | null> {
    const { data, error } = await supabase.from('opname_sessions').select('id').eq('session_no', sessionNo).limit(1);
    if (error) return null;
    const row = ((data ?? []) as Row[])[0];
    return row ? Number(row.id) : null;
  }

  private static readonly OPNAME_SESSION_COLS =
    'session_no, site_id, location_id, status, allowed_sites, lock_moves, started_by_nik, started_at, ended_at, ' +
    'expected_count, scanned_count, match_count, missing_count, misplaced_count';

  private mapServerOpnameSession(r: Row): ServerOpnameSession {
    return {
      sessionId: String(r.session_no),
      siteId: String(r.site_id),
      locationId: r.location_id ?? undefined,
      status: r.status as ServerOpnameSession['status'],
      allowedSites: Array.isArray(r.allowed_sites) ? (r.allowed_sites as string[]) : [],
      lockMoves: Boolean(r.lock_moves),
      startedBy: String(r.started_by_nik ?? ''),
      startedAt: String(r.started_at),
      endedAt: r.ended_at ?? undefined,
      expected: Number(r.expected_count ?? 0),
      scanned: Number(r.scanned_count ?? 0),
      match: Number(r.match_count ?? 0),
      missing: Number(r.missing_count ?? 0),
      misplaced: Number(r.misplaced_count ?? 0),
      week: isoWeek(String(r.started_at)),
    };
  }

  /** Daftar sesi opname yang terlihat oleh pengguna (RLS: dibuat sendiri, atau site yang diizinkan). */
  public async listOpnameSessions(): Promise<{ success: boolean; sessions: ServerOpnameSession[]; message?: string }> {
    try {
      const { data, error } = await supabase
        .from('opname_sessions')
        .select(StorageService.OPNAME_SESSION_COLS)
        .order('id', { ascending: false })
        .limit(100);
      if (error) throw error;
      return { success: true, sessions: ((data ?? []) as Row[]).map((r) => this.mapServerOpnameSession(r)) };
    } catch (e) {
      if (isAuthError(e)) emitUnauthorized();
      return { success: false, sessions: [], message: errMessage(e) };
    }
  }

  public async startOpnameSession(params: {
    siteId: string;
    locationId?: string;
    allowedSites?: string[];
    lockMoves?: boolean;
  }): Promise<{ success: boolean; message: string; session?: ServerOpnameSession }> {
    const res = await this.rpc('start_opname_session', {
      p_site_id: params.siteId,
      p_location_id: params.locationId || null,
      p_allowed_sites: params.allowedSites && params.allowedSites.length ? params.allowedSites : null,
      p_lock_moves: Boolean(params.lockMoves),
      p_request_id: uuid(),
    });
    if (!res.success) return { success: false, message: res.message };
    const { data, error } = await supabase
      .from('opname_sessions')
      .select(StorageService.OPNAME_SESSION_COLS)
      .eq('id', res.data.session_id)
      .maybeSingle();
    if (error || !data) return { success: false, message: 'Sesi dibuat, tapi gagal memuat detailnya. Segarkan halaman.' };
    return { success: true, message: res.message, session: this.mapServerOpnameSession(data) };
  }

  public async updateOpnameAccess(params: {
    sessionId: string;
    allowedSites: string[];
    lockMoves: boolean;
  }): Promise<{ success: boolean; message: string; session?: ServerOpnameSession }> {
    const id = await this.resolveSessionId(params.sessionId);
    if (id == null) return { success: false, message: 'Sesi opname tidak ditemukan di server.' };
    const res = await this.rpc('update_opname_access', {
      p_session_id: id,
      p_allowed_sites: params.allowedSites,
      p_lock_moves: params.lockMoves,
    });
    if (!res.success) return { success: false, message: res.message };
    const { data, error } = await supabase
      .from('opname_sessions')
      .select(StorageService.OPNAME_SESSION_COLS)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return { success: false, message: 'Akses diperbarui, tapi gagal memuat ulang detailnya. Segarkan halaman.' };
    try {
      await this.loadOpnameSessions();
      this.notify();
    } catch {
      /* abaikan */
    }
    return { success: true, message: res.message, session: this.mapServerOpnameSession(data) };
  }

  /** Menutup sesi (COMPLETED/CANCELLED) beserta hasil scan. Dipakai OpnameView; bentuk item mengikuti field lokal OpnameView (camelCase scannedLocationId/expectedLocationId). */
  public async closeOpnameSession(
    session: { sessionId: string; status: 'COMPLETED' | 'CANCELLED' },
    items: {
      assetCode: string;
      barcode?: string;
      result: string;
      scannedLocationId?: string;
      expectedLocationId?: string;
    }[]
  ): Promise<{ success: boolean; message: string }> {
    const id = await this.resolveSessionId(session.sessionId);
    if (id == null) return { success: false, message: 'Sesi opname tidak ditemukan di server.' };
    const res = await this.rpc('save_opname', {
      p_session_id: id,
      p_items: items.map((it) => ({
        asset_code: it.assetCode,
        barcode: it.barcode ?? null,
        result: it.result,
        scanned_location_id: it.scannedLocationId ?? null,
        expected_location_id: it.expectedLocationId ?? null,
      })),
      p_status: session.status,
      p_request_id: uuid(),
    });
    if (!res.success) return { success: false, message: res.message };
    await this.afterMutation(items.map((i) => i.assetCode));
    try {
      await this.loadOpnameSessions();
      this.notify();
    } catch {
      /* abaikan */
    }
    return { success: true, message: res.message };
  }

  public async saveOpnameSession(session: OpnameSession, items: OpnameItem[]): Promise<{ success: boolean; message: string }> {
    const id = await this.resolveSessionId(session.sessionId);
    if (id == null) return { success: false, message: 'Sesi opname tidak ditemukan di server.' };
    const status = session.status === 'IN_PROGRESS' ? 'ACTIVE' : session.status;
    const res = await this.rpc('save_opname', {
      p_session_id: id,
      p_items: items.map((it) => ({
        asset_code: it.assetCode,
        barcode: it.barcode ?? null,
        result: it.result,
        scanned_location_id: it.currentActualLocation ?? null,
        expected_location_id: it.registeredLocation ?? null,
        resolution: it.resolution ?? null,
      })),
      p_status: status,
      p_request_id: uuid(),
    });
    if (!res.success) return { success: false, message: res.message };
    await this.afterMutation(items.map((i) => i.assetCode));
    try {
      await this.loadOpnameSessions();
      this.notify();
    } catch {
      /* abaikan */
    }
    return { success: true, message: res.message };
  }

  /** Mesin salah lokasi saat opname dipindahkan ke lokasi sesi (lewat fungsi pindah biasa). */
  public async resolveOpnameMisplaced(params: {
    assetCode: string;
    targetLocationId: string;
    username: string;
    sessionId: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await this.rpc('move_machine', {
      p_asset_code: params.assetCode,
      p_location_id: params.targetLocationId,
      p_status: null,
      p_reason: `Opname ${params.sessionId}: dipindahkan ke lokasi yang sesuai`,
      p_loan_to: null,
      p_loan_due_date: null,
      p_request_id: uuid(),
    });
    if (!res.success) return { success: false, message: res.message };
    await this.afterMutation([params.assetCode]);
    return { success: true, message: res.message };
  }

  // ---------------------------------------------------------------- fitur yang belum tersedia (jujur, tanpa pura-pura)
  public generateDailyReport(siteId: string = 'ALL'): DailyReport {
    return {
      reportId: 'BELUM-TERSEDIA',
      date: new Date().toISOString().slice(0, 10),
      siteId,
      content: 'Laporan harian belum tersedia di versi Supabase.',
      stats: {
        totalMoves: 0,
        transfersSent: 0,
        transfersReceived: 0,
        transfersPending: 0,
        statusChanges: 0,
        opnameLocationsCompleted: 0,
        opnameMissingCount: 0,
        opnameMisplacedCount: 0,
      },
    };
  }

  public addSite(_newSite: Site, _addLineTemplate: boolean = true): { success: boolean; message: string } {
    return { success: false, message: NOT_AVAILABLE };
  }

  public updateRackConfig(_rackNo: number, _columnCount: number): { success: boolean; message: string } {
    return { success: false, message: NOT_AVAILABLE };
  }

  public addLocation(_loc: Location): { success: boolean; message: string } {
    return { success: false, message: NOT_AVAILABLE };
  }

  public toggleLocationActive(_locationId: string): { success: boolean; message: string } {
    return { success: false, message: NOT_AVAILABLE };
  }

  public saveUser(_user: User): { success: boolean; message: string } {
    return { success: false, message: NOT_AVAILABLE };
  }

  public unlockUser(_username: string): { success: boolean; message: string } {
    return { success: false, message: 'Supabase tidak memakai kunci akun per NIK. Tidak ada yang perlu dibuka.' };
  }

  public runDataAuditAndFix(): {
    fixedEmptyLocations: number;
    fixedFacMappings: number;
    fixedMissingNames: number;
    fixedTrimSpaces: number;
    normalizedLegacyCodes: number;
    flaggedSerials: number;
  } {
    // Constraint database sudah mencegah data rusak; tidak ada yang diperbaiki di klien.
    return {
      fixedEmptyLocations: 0,
      fixedFacMappings: 0,
      fixedMissingNames: 0,
      fixedTrimSpaces: 0,
      normalizedLegacyCodes: 0,
      flaggedSerials: 0,
    };
  }

  public batchImportMachines(_newMachines: Machine[]): { success: boolean; importedCount: number; errors: string[] } {
    return { success: false, importedCount: 0, errors: [NOT_AVAILABLE] };
  }

  /** Dulu menghapus data lokal. Sekarang hanya mengosongkan cache memori; data server tidak tersentuh. */
  public clearAllData(_keepSettings: boolean = true): void {
    this.clearLocalMachineCache();
  }
}

export const storageService = new StorageService();
