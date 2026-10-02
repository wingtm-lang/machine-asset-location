/**
 * Storage service simulating Google Sheets + Apps Script backend with LockService & Atomic Transactions
 */

import {
  Machine,
  Site,
  Location,
  Rack,
  Movement,
  Transfer,
  StatusLog,
  OpnameSession,
  OpnameItem,
  User,
  ReportRecipient,
  DailyReport,
  AuditLog,
  AppSettings,
  MachineStatus,
  SiteId,
} from '../types';
import { postGasApi } from './gasAuthService';
import {
  INITIAL_SITES,
  INITIAL_RACKS,
  INITIAL_SETTINGS,
  INITIAL_USERS,
  INITIAL_RECIPIENTS,
  generateLocations,
  generateMachineDataset,
} from './seedData';

class StorageService {
  private machines: Machine[] = [];
  private sites: Site[] = [];
  private locations: Location[] = [];
  private racks: Rack[] = [];
  private movements: Movement[] = [];
  private transfers: Transfer[] = [];
  private statusLogs: StatusLog[] = [];
  private opnameSessions: OpnameSession[] = [];
  private opnameItems: OpnameItem[] = [];
  private users: User[] = [];
  private reportRecipients: ReportRecipient[] = [];
  private dailyReports: DailyReport[] = [];
  private auditLogs: AuditLog[] = [];
  private settings: AppSettings = INITIAL_SETTINGS;

  // Fast hash maps for O(1) searches across 5,700+ records
  private barcodeMap = new Map<string, Machine>();
  private assetCodeMap = new Map<string, Machine>();
  private listeners: Array<() => void> = [];
  private syncStatusListeners: Array<(isSyncing: boolean) => void> = [];
  private isAutoSyncing = false;
  private lastAutoSyncTime: number = 0;

  private isInitialized = false;

  constructor() {
    this.init();
    // Timer otomatis di konstruktor telah dihapus agar sync dipicu setelah login / restore sesi
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  public subscribeSyncStatus(fn: (isSyncing: boolean) => void): () => void {
    this.syncStatusListeners.push(fn);
    fn(this.isAutoSyncing);
    return () => {
      this.syncStatusListeners = this.syncStatusListeners.filter((l) => l !== fn);
    };
  }

  private notifySyncStatus(isSyncing: boolean) {
    for (const listener of this.syncStatusListeners) {
      try {
        listener(isSyncing);
      } catch (e) {
        console.error('Error notifying sync status listener:', e);
      }
    }
  }

  public getIsSyncing(): boolean {
    return this.isAutoSyncing;
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('Error notifying storage listener:', e);
      }
    }
  }

  /**
   * Auto background sync: berjalan otomatis saat dipanggil setelah login / sesi pulih
   * @param force Jika true, lewati batas jeda throttle 15 detik
   */
  public async triggerAutoBackgroundSync(force: boolean = false): Promise<boolean> {
    if (this.isAutoSyncing) return false;
    const now = Date.now();
    // Cegah spam sync (minimal jeda 15 detik), kecuali dipaksa (force = true)
    if (!force && now - this.lastAutoSyncTime < 15000) return false;

    this.isAutoSyncing = true;
    this.notifySyncStatus(true);
    try {
      const res = await this.syncFromGoogleSheet(this.settings.spreadsheetId, 'machine_asset');
      if (res.success) {
        this.lastAutoSyncTime = Date.now();
        this.notifyListeners();
      }
      return Boolean(res.success);
    } catch (err) {
      console.warn('Background auto-sync check completed with offline fallback.', err);
      return false;
    } finally {
      this.isAutoSyncing = false;
      this.notifySyncStatus(false);
    }
  }

  /**
   * Membersihkan seluruh cache data mesin lokal saat pengguna logout
   * agar tidak terjadi sisa data lokal antar pengguna yang berbeda di perangkat yang sama
   */
  public clearLocalMachineCache() {
    this.machines = [];
    this.movements = [];
    this.transfers = [];
    this.statusLogs = [];
    this.opnameSessions = [];
    this.opnameItems = [];
    this.rebuildIndices();
    this.save();
    this.notifyListeners();
  }

  public init() {
    if (this.isInitialized) return;

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ptwinners_tracker_settings');
        localStorage.removeItem('ptwinners_gas_url');
        localStorage.removeItem('gas_url');
      } catch {}
    }

    // Check LocalStorage or seed fresh
    const savedData = typeof window !== 'undefined' ? localStorage.getItem('ptwinners_tracker_db_v1') : null;

    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.settings && parsed.settings.gasWebAppUrl) {
          delete parsed.settings.gasWebAppUrl;
        }
        this.sites = parsed.sites || INITIAL_SITES;
        this.racks = parsed.racks || INITIAL_RACKS;
        this.locations = parsed.locations || generateLocations();
        this.machines = parsed.machines || [];
        this.movements = parsed.movements || [];
        this.transfers = parsed.transfers || [];
        this.statusLogs = parsed.statusLogs || [];
        this.opnameSessions = parsed.opnameSessions || [];
        this.opnameItems = parsed.opnameItems || [];
        this.users = parsed.users || INITIAL_USERS;
        this.reportRecipients = parsed.reportRecipients || INITIAL_RECIPIENTS;
        this.dailyReports = parsed.dailyReports || [];
        this.auditLogs = parsed.auditLogs || [];
        this.settings = { ...INITIAL_SETTINGS, ...(parsed.settings || {}) };
        if (!this.settings.spreadsheetId) {
          this.settings.spreadsheetId = INITIAL_SETTINGS.spreadsheetId;
        }

        if (this.machines.length === 0) {
          // Inisialisasi bersih (tanpa data dummy)
          this.machines = [];
          this.movements = [];
        }
      } catch (e) {
        console.error('Error loading stored DB, initializing clean...', e);
        this.seedFresh();
      }
    } else {
      this.seedFresh();
    }

    this.rebuildIndices();
    this.isInitialized = true;
  }

  private seedFresh() {
    this.sites = [...INITIAL_SITES];
    this.racks = [...INITIAL_RACKS];
    this.locations = generateLocations();
    this.users = [...INITIAL_USERS];
    this.reportRecipients = [...INITIAL_RECIPIENTS];
    this.settings = { ...INITIAL_SETTINGS };

    // Inisialisasi bersih tanpa dummy mesin
    this.machines = [];
    this.movements = [];
    this.statusLogs = [];
    this.transfers = [];
    this.opnameSessions = [];
    this.opnameItems = [];

    this.save();
  }

  /**
   * Menghapus seluruh data dummy / mesin dan mengosongkan database
   */
  public clearAllData(keepSettings: boolean = true) {
    this.machines = [];
    this.movements = [];
    this.transfers = [];
    this.statusLogs = [];
    this.opnameSessions = [];
    this.opnameItems = [];
    
    if (!keepSettings) {
      this.sites = [...INITIAL_SITES];
      this.racks = [...INITIAL_RACKS];
      this.locations = generateLocations();
      this.users = [...INITIAL_USERS];
      this.settings = { ...INITIAL_SETTINGS };
    }

    this.rebuildIndices();
    this.save();
    this.notifyListeners();
    this.logAudit('System', 'CLEAR_DATABASE', 'Seluruh data dummy dan mesin telah dihapus dan dikosongkan.');
  }

  public rebuildIndices() {
    this.barcodeMap.clear();
    this.assetCodeMap.clear();
    for (const m of this.machines) {
      if (m.barcode) this.barcodeMap.set(m.barcode.trim(), m);
      if (m.assetCode) this.assetCodeMap.set(m.assetCode.trim().toUpperCase(), m);
    }
  }

  private save() {
    if (typeof window === 'undefined') return;
    try {
      // Don't save full 5700 machines in localstorage if exceeds limit, save to indexed state
      const lightweight = {
        sites: this.sites,
        racks: this.racks,
        locations: this.locations,
        users: this.users,
        settings: this.settings,
        reportRecipients: this.reportRecipients,
        transfers: this.transfers,
        opnameSessions: this.opnameSessions,
        dailyReports: this.dailyReports,
        // store sample first 300 machines or full if size allows
        machines: this.machines.slice(0, 1000),
        movements: this.movements.slice(-200),
        statusLogs: this.statusLogs.slice(-200),
        auditLogs: this.auditLogs.slice(-200),
      };
      localStorage.setItem('ptwinners_tracker_db_v1', JSON.stringify(lightweight));
    } catch {
      // Storage quota exceeded or disabled
    }
  }

  // --- QUERY APIS ---

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
    const clean = query.trim();
    const cleanUpper = clean.toUpperCase();

    // 1. Direct O(1) lookup by Barcode
    let m = this.barcodeMap.get(clean);
    // 2. Direct O(1) lookup by Asset Code
    if (!m) m = this.assetCodeMap.get(cleanUpper);

    // 3. Fallback: Serial Number exact match
    if (!m) {
      m = this.machines.find((x) => x.serial === clean || x.serial.toUpperCase() === cleanUpper);
    }

    const t1 = performance.now();
    return { machine: m || null, searchTimeMs: Number((t1 - t0).toFixed(2)) };
  }

  public getMachinesAtLocation(locationId: string): Machine[] {
    return this.machines.filter((m) => m.locationId === locationId);
  }

  public getMovements(assetCode?: string): Movement[] {
    if (!assetCode) return this.movements;
    return this.movements.filter((mov) => mov.assetCode === assetCode);
  }

  public getStatusLogs(assetCode?: string): StatusLog[] {
    if (!assetCode) return this.statusLogs;
    return this.statusLogs.filter((log) => log.assetCode === assetCode);
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

  public getOpnameItems(sessionId: string): OpnameItem[] {
    return this.opnameItems.filter((i) => i.sessionId === sessionId);
  }

  public getUsers(): User[] {
    return this.users;
  }

  public getReportRecipients(): ReportRecipient[] {
    return this.reportRecipients;
  }

  public getDailyReports(): DailyReport[] {
    return this.dailyReports;
  }

  public getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }

  public getSettings(): AppSettings {
    return this.settings;
  }

  // --- MUTATION / TRANSACTION APIS (Enforcing A5 Rules) ---

  /**
   * Move Machine within the same site (Fase 3 & A5.1)
   * Menunggu respons server (MOVE_MACHINE), hanya terapkan di lokal jika server sukses.
   */
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
    const { assetCode, targetLocationId, username, userSiteAccess, reason, newStatus, loanTo, loanDueDate } = params;

    const machine = this.assetCodeMap.get(assetCode.toUpperCase());
    if (!machine) {
      return { success: false, message: `Mesin dengan kode ${assetCode} tidak ditemukan.` };
    }

    // Site permission check
    if (!userSiteAccess.includes('ALL') && !userSiteAccess.includes(machine.siteId)) {
      return { success: false, message: `Akses ditolak: Anda tidak memiliki izin untuk mengelola site ${machine.siteId}.` };
    }

    // Check In Transit
    if (machine.pendingTransferId) {
      return { success: false, message: 'Mesin sedang In Transit (Transfer) dan terkunci. Harus diterima atau dibatalkan lebih dulu.' };
    }

    // Check SOLD
    if (machine.status === 'SOLD') {
      return { success: false, message: 'Mesin berstatus SOLD tidak dapat dipindahkan.' };
    }

    // Target Location validation
    let finalTargetLocationId = targetLocationId ? targetLocationId.trim() : '';

    if (newStatus === 'SOLD') {
      finalTargetLocationId = finalTargetLocationId || 'SOLD';
    } else {
      if (!finalTargetLocationId) {
        return { success: false, message: 'Lokasi tujuan wajib dipilih.' };
      }

      const targetLoc = this.locations.find((l) => l.locationId === finalTargetLocationId);
      if (!targetLoc) {
        return { success: false, message: `Lokasi tujuan ${finalTargetLocationId} tidak ditemukan.` };
      }

      if (!targetLoc.active) {
        return { success: false, message: `Lokasi tujuan ${finalTargetLocationId} sedang dinonaktifkan.` };
      }

      if (targetLoc.siteId !== machine.siteId) {
        return { success: false, message: `Pindah lokasi biasa hanya untuk site yang sama (${machine.siteId}). Untuk antar site, gunakan fitur Transfer Antar Site.` };
      }

      // WH2 Rack Slot Capacity Check (Max 3 machines)
      if (targetLoc.type === 'RACK_SLOT') {
        const currentSlotMachines = this.getMachinesAtLocation(finalTargetLocationId).filter((m) => m.assetCode !== machine.assetCode);
        const limit = targetLoc.capacity || this.settings.rackSlotCapacity || 3;
        if (currentSlotMachines.length >= limit) {
          return {
            success: false,
            message: `Slot ${targetLoc.displayName} sudah PENUH (kapasitas ${limit} mesin tercapai). Silakan pilih slot lain.`,
          };
        }
      }
    }

    // Kirim ke backend server Google Apps Script dan TUNGGU respons
    try {
      const serverRes = await this.postToGasBackend<{ success: boolean; message?: string }>('MOVE_MACHINE', {
        assetCode: machine.assetCode,
        barcode: machine.barcode,
        locationId: finalTargetLocationId,
        siteId: machine.siteId,
        status: newStatus || machine.status,
        reason: reason || (newStatus === 'SOLD' ? 'Status diubah menjadi SOLD (Terjual/Afkir)' : 'Pemindahan normal'),
      });

      if (!serverRes || !serverRes.success) {
        return {
          success: false,
          message: serverRes?.message || 'Gagal memindahkan mesin di server.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat terhubung ke server untuk memindahkan mesin.',
      };
    }

    // Hanya jika respons server success: true, terapkan perubahan di lokal
    const fromLoc = machine.locationId;
    const now = new Date().toISOString();

    machine.locationId = finalTargetLocationId;
    machine.lastMovedAt = now;
    machine.lastMovedBy = username;
    machine.updatedAt = now;
    machine.updatedBy = username;

    if (newStatus && newStatus !== machine.status) {
      const oldStatus = machine.status;
      machine.status = newStatus;
      machine.statusSince = now;
      if (newStatus === 'LOANED') {
        machine.loanTo = loanTo;
        machine.loanDueDate = loanDueDate;
      } else {
        machine.loanTo = undefined;
        machine.loanDueDate = undefined;
      }

      this.statusLogs.unshift({
        logId: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: now,
        assetCode: machine.assetCode,
        oldStatus,
        newStatus,
        byUser: username,
        note: reason || 'Diubah bersamaan dengan pemindahan lokasi',
        loanTo,
        loanDueDate,
      });
    }

    const movement: Movement = {
      movementId: `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now,
      assetCode: machine.assetCode,
      type: 'MOVE',
      fromLocation: fromLoc,
      toLocation: finalTargetLocationId,
      fromSite: machine.siteId,
      toSite: machine.siteId,
      reason: reason || (newStatus === 'SOLD' ? 'Status diubah menjadi SOLD (Terjual/Afkir)' : 'Pemindahan normal oleh mekanik'),
      byUser: username,
    };

    const targetLocDisplayName = newStatus === 'SOLD'
      ? 'SOLD (Terjual/Afkir)'
      : (this.locations.find((l) => l.locationId === finalTargetLocationId)?.displayName || finalTargetLocationId);

    this.movements.unshift(movement);
    this.logAudit(username, 'MOVE_MACHINE', `Pindah ${machine.assetCode} dari ${fromLoc} ke ${finalTargetLocationId}`);
    this.save();
    this.notifyListeners();

    return {
      success: true,
      message: newStatus === 'SOLD'
        ? `Status mesin ${machine.assetCode} berhasil diubah menjadi SOLD (Terjual/Afkir).`
        : `Mesin ${machine.assetCode} berhasil dipindahkan ke ${targetLocDisplayName}.`,
      machine,
      movement,
    };
  }

  /**
   * Undo Last Move within 60 minutes by same user (A5.5)
   * Menunggu respons server (UNDO_MOVE), hanya terapkan di lokal jika server sukses.
   */
  public async undoLastMove(params: {
    assetCode: string;
    username: string;
    isAdmin: boolean;
  }): Promise<{ success: boolean; message: string }> {
    const { assetCode, username, isAdmin } = params;
    const machine = this.assetCodeMap.get(assetCode.toUpperCase());
    if (!machine) {
      return { success: false, message: 'Mesin tidak ditemukan.' };
    }

    const lastMov = this.movements.find((m) => m.assetCode === machine.assetCode && m.type !== 'UNDO');
    if (!lastMov) {
      return { success: false, message: 'Tidak ada riwayat pemindahan untuk mesin ini.' };
    }

    if (!isAdmin && lastMov.byUser !== username) {
      return { success: false, message: `Hanya user yang memindahkan (${lastMov.byUser}) atau Admin yang bisa membatalkan.` };
    }

    const moveTime = new Date(lastMov.timestamp).getTime();
    const now = Date.now();
    const diffMinutes = (now - moveTime) / (1000 * 60);

    if (diffMinutes > this.settings.undoTimeLimitMinutes) {
      return { success: false, message: `Batas waktu Undo (${this.settings.undoTimeLimitMinutes} menit) telah terlewati.` };
    }

    const previousLocation = lastMov.fromLocation;
    const currentLocation = machine.locationId;
    const isoNow = new Date().toISOString();

    // Kirim UNDO_MOVE ke server TERLEBIH DAHULU
    try {
      const serverRes = await this.postToGasBackend<{ success: boolean; message?: string }>('UNDO_MOVE', {
        assetCode: machine.assetCode,
        historyId: lastMov.movementId,
      });

      if (!serverRes || !serverRes.success) {
        return {
          success: false,
          message: serverRes?.message || 'Gagal membatalkan pemindahan di server.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat terhubung ke server untuk membatalkan pemindahan.',
      };
    }

    // Hanya jika server berhasil, terapkan di lokal
    machine.locationId = previousLocation;
    machine.lastMovedAt = isoNow;
    machine.lastMovedBy = `${username} (UNDO)`;
    machine.updatedAt = isoNow;
    machine.updatedBy = username;

    const undoMovement: Movement = {
      movementId: `MOV-UNDO-${Date.now()}`,
      timestamp: isoNow,
      assetCode: machine.assetCode,
      type: 'UNDO',
      fromLocation: currentLocation,
      toLocation: previousLocation,
      fromSite: machine.siteId,
      toSite: machine.siteId,
      reason: `Undo pemindahan terakhir (${lastMov.movementId})`,
      byUser: username,
    };

    this.movements.unshift(undoMovement);
    this.logAudit(username, 'UNDO_MOVE', `Undo ${machine.assetCode} kembali ke ${previousLocation}`);
    this.save();
    this.notifyListeners();

    return { success: true, message: `Pemindahan dibatalkan. Mesin ${machine.assetCode} dikembalikan ke ${previousLocation}.` };
  }

  /**
   * Pemindahan lokasi langsung (digunakan oleh Rack Mapping WH2 & integrasi backend)
   */
  public setMachineLocationDirect(params: {
    assetCode: string;
    locationId: string;
    siteId?: string;
    username: string;
    reason?: string;
  }): { success: boolean; message: string } {
    const { assetCode, locationId, username, reason } = params;
    const siteId = params.siteId || 'WH2';
    const machine = this.assetCodeMap.get(assetCode.toUpperCase());
    if (!machine) {
      return { success: false, message: `Mesin ${assetCode} tidak ditemukan di database lokal.` };
    }

    const fromLoc = machine.locationId;
    const now = new Date().toISOString();

    machine.locationId = locationId;
    machine.siteId = siteId;
    machine.lastMovedAt = now;
    machine.lastMovedBy = username;
    machine.updatedAt = now;
    machine.updatedBy = username;

    const movement: Movement = {
      movementId: `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now,
      assetCode: machine.assetCode,
      type: 'MOVE',
      fromLocation: fromLoc,
      toLocation: locationId,
      fromSite: machine.siteId,
      toSite: siteId,
      reason: reason || `Penempatan di rak ${locationId}`,
      byUser: username,
    };

    this.movements.unshift(movement);
    this.logAudit(username, 'ASSIGN_RACK_SLOT', `Pindah ${machine.assetCode} dari ${fromLoc} ke ${locationId}`);
    this.save();
    this.notifyListeners();

    return { success: true, message: `Mesin ${machine.assetCode} berhasil ditempatkan di ${locationId}.` };
  }

  /**
   * Transfer Step 1: Send Transfer to another site (Fase 4 & A5.2)
   */
  public async sendTransfer(params: {
    assetCodes: string[];
    toSite: SiteId;
    sentBy: string;
    userSiteAccess: string[];
    vehicleNo?: string;
    driverName?: string;
    note?: string;
  }): Promise<{ success: boolean; message: string; count: number }> {
    const { assetCodes, toSite, sentBy, userSiteAccess, vehicleNo, driverName, note } = params;

    const validCodes: string[] = [];
    for (const code of assetCodes) {
      const machine = this.assetCodeMap.get(code.toUpperCase());
      if (!machine) continue;
      if (!userSiteAccess.includes('ALL') && !userSiteAccess.includes(machine.siteId)) continue;
      if (machine.pendingTransferId || machine.status === 'SOLD') continue;
      if (machine.siteId === toSite) continue;
      validCodes.push(machine.assetCode);
    }

    if (validCodes.length === 0) {
      return { success: false, message: 'Tidak ada mesin yang valid untuk dikirim (periksa status atau izin).', count: 0 };
    }

    const firstMachine = this.assetCodeMap.get(validCodes[0].toUpperCase());
    const fromSite = firstMachine?.siteId || '';

    // Wait for server response first
    try {
      const serverRes = await this.postToGasBackend<{ success: boolean; message?: string }>('SEND_TRANSFER', {
        assetCodes: validCodes,
        fromSite,
        toSite,
        vehicleNo: vehicleNo || '',
        driverName: driverName || '',
        note: note || '',
      });

      if (!serverRes || !serverRes.success) {
        return {
          success: false,
          message: serverRes?.message || 'Gagal mengirim transfer di server.',
          count: 0,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat terhubung ke server untuk mengirim transfer.',
        count: 0,
      };
    }

    // Apply mutation locally only after server success
    let count = 0;
    const now = new Date().toISOString();
    const batchId = `BATCH-${Date.now()}`;

    for (const code of validCodes) {
      const machine = this.assetCodeMap.get(code.toUpperCase());
      if (!machine) continue;

      const transferId = `TRF-${Date.now()}-${count + 1}`;
      machine.pendingTransferId = transferId;
      machine.updatedAt = now;
      machine.updatedBy = sentBy;

      const transfer: Transfer = {
        transferId,
        batchId,
        assetCode: machine.assetCode,
        fromSite: machine.siteId,
        toSite,
        status: 'IN_TRANSIT',
        sentAt: now,
        sentBy,
        note,
      };

      this.transfers.unshift(transfer);

      this.movements.unshift({
        movementId: `MOV-${Date.now()}-${count + 1}`,
        timestamp: now,
        assetCode: machine.assetCode,
        type: 'TRANSFER_OUT',
        fromLocation: machine.locationId,
        toLocation: `${toSite}-IN_TRANSIT`,
        fromSite: machine.siteId,
        toSite,
        transferId,
        reason: `Transfer keluar ke ${toSite}: ${note || ''}`,
        byUser: sentBy,
      });

      count++;
    }

    this.logAudit(sentBy, 'SEND_TRANSFER', `Mengirim ${count} mesin ke site ${toSite}`);
    this.save();
    this.notifyListeners();

    return { success: true, message: `${count} mesin berhasil dikirim ke ${toSite} (Status: In Transit).`, count };
  }

  /**
   * Transfer Step 2: Receive Transfer at destination site (Fase 4 & A5.2)
   */
  public async receiveTransfer(params: {
    transferId: string;
    toLocationId: string;
    receivedBy: string;
    userSiteAccess: string[];
  }): Promise<{ success: boolean; message: string }> {
    const { transferId, toLocationId, receivedBy, userSiteAccess } = params;

    const transfer = this.transfers.find((t) => t.transferId === transferId);
    if (!transfer) {
      return { success: false, message: 'Transfer ID tidak ditemukan.' };
    }

    if (transfer.status !== 'IN_TRANSIT') {
      return { success: false, message: `Transfer ini sudah dalam status ${transfer.status}.` };
    }

    if (!userSiteAccess.includes('ALL') && !userSiteAccess.includes(transfer.toSite)) {
      return { success: false, message: `Akses ditolak: Anda tidak memiliki izin untuk menerima mesin di site ${transfer.toSite}.` };
    }

    const machine = this.assetCodeMap.get(transfer.assetCode.toUpperCase());
    if (!machine) {
      return { success: false, message: 'Mesin terkait transfer ini tidak ditemukan.' };
    }

    const targetLoc = this.locations.find((l) => l.locationId === toLocationId);
    if (!targetLoc || targetLoc.siteId !== transfer.toSite) {
      return { success: false, message: `Lokasi tujuan harus berada di site penerima (${transfer.toSite}).` };
    }

    // Check WH2 rack slot capacity if destination is WH2 rack
    if (targetLoc.type === 'RACK_SLOT') {
      const currentSlotMachines = this.getMachinesAtLocation(toLocationId);
      const limit = targetLoc.capacity || this.settings.rackSlotCapacity || 3;
      if (currentSlotMachines.length >= limit) {
        return { success: false, message: `Slot ${targetLoc.displayName} sudah penuh (maksimal ${limit} mesin).` };
      }
    }

    // Wait for server response
    try {
      const serverRes = await this.postToGasBackend<{ success: boolean; message?: string }>('RECEIVE_TRANSFER', {
        transferId,
        toLocationId,
        toSite: transfer.toSite,
      });

      if (!serverRes || !serverRes.success) {
        return {
          success: false,
          message: serverRes?.message || 'Gagal menerima transfer di server.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat terhubung ke server untuk menerima transfer.',
      };
    }

    const now = new Date().toISOString();
    const oldSite = machine.siteId;
    const oldLoc = machine.locationId;

    transfer.status = 'RECEIVED';
    transfer.receivedAt = now;
    transfer.receivedBy = receivedBy;
    transfer.toLocation = toLocationId;

    machine.pendingTransferId = undefined;
    machine.siteId = transfer.toSite;
    machine.locationId = toLocationId;
    machine.lastMovedAt = now;
    machine.lastMovedBy = receivedBy;
    machine.updatedAt = now;
    machine.updatedBy = receivedBy;

    this.movements.unshift({
      movementId: `MOV-${Date.now()}`,
      timestamp: now,
      assetCode: machine.assetCode,
      type: 'TRANSFER_IN',
      fromLocation: oldLoc,
      toLocation: toLocationId,
      fromSite: oldSite,
      toSite: transfer.toSite,
      transferId,
      reason: `Transfer diterima dari ${oldSite} oleh ${receivedBy}`,
      byUser: receivedBy,
    });

    this.logAudit(receivedBy, 'RECEIVE_TRANSFER', `Menerima mesin ${machine.assetCode} di ${toLocationId}`);
    this.save();
    this.notifyListeners();

    return { success: true, message: `Mesin ${machine.assetCode} berhasil diterima dan ditempatkan di ${targetLoc.displayName}.` };
  }

  /**
   * Cancel Transfer before receipt (A5.2)
   */
  public async cancelTransfer(transferId: string, username: string, userSiteAccess: string[]): Promise<{ success: boolean; message: string }> {
    const transfer = this.transfers.find((t) => t.transferId === transferId);
    if (!transfer) return { success: false, message: 'Transfer tidak ditemukan.' };
    if (transfer.status !== 'IN_TRANSIT') return { success: false, message: 'Hanya transfer In Transit yang dapat dibatalkan.' };

    if (!userSiteAccess.includes('ALL') && !userSiteAccess.includes(transfer.fromSite)) {
      return { success: false, message: 'Hanya pengirim dari site asal atau Admin yang bisa membatalkan transfer.' };
    }

    const machine = this.assetCodeMap.get(transfer.assetCode.toUpperCase());

    // Wait for server response
    try {
      const serverRes = await this.postToGasBackend<{ success: boolean; message?: string }>('CANCEL_TRANSFER', {
        transferId,
        assetCode: machine?.assetCode || transfer.assetCode,
      });

      if (!serverRes || !serverRes.success) {
        return {
          success: false,
          message: serverRes?.message || 'Gagal membatalkan transfer di server.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat terhubung ke server untuk membatalkan transfer.',
      };
    }

    if (machine) {
      machine.pendingTransferId = undefined;
    }

    transfer.status = 'CANCELLED';
    this.logAudit(username, 'CANCEL_TRANSFER', `Membatalkan transfer ${transferId} (${transfer.assetCode})`);
    this.save();
    this.notifyListeners();

    return { success: true, message: `Transfer ${transferId} berhasil dibatalkan.` };
  }

  /**
   * Start / Save Opname Session (Fase 5 & A5.4)
   */
  public async saveOpnameSession(session: OpnameSession, items: OpnameItem[]): Promise<{ success: boolean; message: string }> {
    // Wait for server response
    try {
      const serverRes = await this.postToGasBackend<{ success: boolean; message?: string }>('SAVE_OPNAME', {
        session,
        items: items.map((it) => ({
          assetCode: it.assetCode,
          barcode: it.barcode,
          result: it.result,
          scannedLocationId: it.currentActualLocation,
          expectedLocationId: it.registeredLocation,
        })),
      });

      if (!serverRes || !serverRes.success) {
        return {
          success: false,
          message: serverRes?.message || 'Gagal menyimpan sesi opname di server.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat terhubung ke server untuk menyimpan sesi opname.',
      };
    }

    // Check if session exists
    const idx = this.opnameSessions.findIndex((s) => s.sessionId === session.sessionId);
    if (idx >= 0) {
      this.opnameSessions[idx] = session;
    } else {
      this.opnameSessions.unshift(session);
    }

    // Save items
    this.opnameItems = this.opnameItems.filter((i) => i.sessionId !== session.sessionId).concat(items);

    // If completed, update lastOpnameAt for all MATCH items
    if (session.status === 'COMPLETED') {
      const now = new Date().toISOString();
      for (const item of items) {
        if (item.result === 'MATCH') {
          const machine = this.assetCodeMap.get(item.assetCode.toUpperCase());
          if (machine) {
            machine.lastOpnameAt = now;
          }
        }
      }
    }

    this.logAudit(session.startedBy, 'OPNAME_SESSION', `Opname sesi ${session.sessionId} di ${session.locationId} (${session.status})`);
    this.save();
    this.notifyListeners();

    return { success: true, message: 'Sesi opname berhasil disimpan.' };
  }

  /**
   * Quick Relocate Misplaced Machine during Opname (A5.4)
   */
  public async resolveOpnameMisplaced(params: {
    assetCode: string;
    targetLocationId: string;
    username: string;
    sessionId: string;
  }): Promise<{ success: boolean; message: string }> {
    const { assetCode, targetLocationId, username, sessionId } = params;
    const machine = this.assetCodeMap.get(assetCode.toUpperCase());
    if (!machine) return { success: false, message: 'Mesin tidak ditemukan.' };

    const oldLoc = machine.locationId;
    const now = new Date().toISOString();

    // Wait for server response
    try {
      const serverRes = await this.postToGasBackend<{ success: boolean; message?: string }>('MOVE_MACHINE', {
        assetCode: machine.assetCode,
        barcode: machine.barcode,
        locationId: targetLocationId,
        siteId: machine.siteId,
        status: machine.status,
        reason: `Koreksi hasil opname: pindah langsung ke lokasi fisik (${targetLocationId})`,
      });

      if (!serverRes || !serverRes.success) {
        return {
          success: false,
          message: serverRes?.message || 'Gagal memindahkan mesin di server.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat terhubung ke server untuk memindahkan mesin.',
      };
    }

    machine.locationId = targetLocationId;
    machine.lastMovedAt = now;
    machine.lastMovedBy = username;
    machine.lastOpnameAt = now;
    machine.updatedAt = now;
    machine.updatedBy = username;

    this.movements.unshift({
      movementId: `MOV-OPNAME-${Date.now()}`,
      timestamp: now,
      assetCode: machine.assetCode,
      type: 'OPNAME_FIX',
      fromLocation: oldLoc,
      toLocation: targetLocationId,
      fromSite: machine.siteId,
      toSite: machine.siteId,
      opnameSessionId: sessionId,
      reason: `Koreksi hasil opname: pindah langsung ke lokasi fisik (${targetLocationId})`,
      byUser: username,
    });

    this.logAudit(username, 'OPNAME_RESOLVE', `Pindah mesin salah tempat ${assetCode} ke ${targetLocationId}`);
    this.save();
    this.notifyListeners();

    return { success: true, message: `Mesin ${assetCode} berhasil diperbarui lokasinya ke ${targetLocationId}.` };
  }

  /**
   * Generate & Dispatch Daily Report (Fase 6 & A7)
   */
  public generateDailyReport(siteId: string = 'ALL'): DailyReport {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const filteredMoves = this.movements.filter((m) => {
      const isToday = m.timestamp.startsWith(today);
      if (siteId === 'ALL') return isToday;
      return isToday && (m.fromSite === siteId || m.toSite === siteId);
    });

    const filteredTransfers = this.transfers.filter((t) => {
      if (siteId === 'ALL') return true;
      return t.fromSite === siteId || t.toSite === siteId;
    });

    const transfersPending = filteredTransfers.filter((t) => t.status === 'IN_TRANSIT').length;
    const transfersSent = filteredTransfers.filter((t) => t.status === 'IN_TRANSIT' && t.sentAt.startsWith(today)).length;
    const transfersReceived = filteredTransfers.filter((t) => t.status === 'RECEIVED' && t.receivedAt && t.receivedAt.startsWith(today)).length;

    const opnameSessionsToday = this.opnameSessions.filter((s) => {
      const isToday = s.startedAt.startsWith(today);
      if (siteId === 'ALL') return isToday;
      return isToday && s.siteId === siteId;
    });

    const missingCount = opnameSessionsToday.reduce((acc, s) => acc + s.missing, 0);
    const misplacedCount = opnameSessionsToday.reduce((acc, s) => acc + s.misplaced, 0);

    const report: DailyReport = {
      reportId: `RPT-${today}-${siteId}`,
      date: today,
      siteId,
      sentAt: now,
      content: `Ringkasan Laporan Harian Aset Mesin PT.WINNERS - ${siteId} (${today})`,
      stats: {
        totalMoves: filteredMoves.length,
        transfersSent,
        transfersReceived,
        transfersPending,
        statusChanges: this.statusLogs.filter((s) => s.timestamp.startsWith(today)).length,
        opnameLocationsCompleted: opnameSessionsToday.filter((s) => s.status === 'COMPLETED').length,
        opnameMissingCount: missingCount,
        opnameMisplacedCount: misplacedCount,
      },
    };

    this.dailyReports.unshift(report);
    this.logAudit('SYSTEM_CRON', 'DAILY_REPORT', `Laporan harian dibuat untuk ${siteId}`);
    this.save();

    return report;
  }

  // --- ADMIN CONFIGURATION APIS ---

  public addSite(newSite: Site, addLineTemplate: boolean = true): { success: boolean; message: string } {
    if (this.sites.some((s) => s.siteId === newSite.siteId)) {
      return { success: false, message: `Site dengan ID ${newSite.siteId} sudah ada.` };
    }
    this.sites.push(newSite);

    if (addLineTemplate) {
      let maxOrder = Math.max(...this.locations.map((l) => l.sortOrder), 0);
      for (let i = 1; i <= 30; i++) {
        const num = String(i).padStart(2, '0');
        this.locations.push({
          locationId: `${newSite.siteId}-L${num}`,
          siteId: newSite.siteId,
          type: 'LINE',
          displayName: `Line ${num}`,
          active: true,
          sortOrder: ++maxOrder,
        });
      }
      this.locations.push({
        locationId: `${newSite.siteId}-UNASSIGNED`,
        siteId: newSite.siteId,
        type: 'UNASSIGNED',
        displayName: `${newSite.name} Belum Ditentukan Line`,
        active: true,
        sortOrder: ++maxOrder,
      });
    }

    this.save();
    return { success: true, message: `Site ${newSite.name} berhasil ditambahkan.` };
  }

  public updateRackConfig(rackNo: number, columnCount: number): { success: boolean; message: string } {
    const rack = this.racks.find((r) => r.rackNo === rackNo);
    if (!rack) return { success: false, message: 'Rak tidak ditemukan.' };

    rack.columnCount = columnCount;

    // Generate any missing slots
    let maxOrder = Math.max(...this.locations.map((l) => l.sortOrder), 0);
    for (let col = 1; col <= columnCount; col++) {
      ['A', 'B', 'C'].forEach((stack) => {
        const slotId = `WH2-R${rackNo}-${col}${stack}`;
        if (!this.locations.some((l) => l.locationId === slotId)) {
          this.locations.push({
            locationId: slotId,
            siteId: 'WH2',
            type: 'RACK_SLOT',
            displayName: `Rak ${rackNo} Kolom ${col} Stack ${stack}`,
            rackNo,
            columnNo: col,
            stack,
            capacity: 3,
            active: true,
            sortOrder: ++maxOrder,
          });
        }
      });
    }

    this.save();
    return { success: true, message: `Konfigurasi Rak ${rackNo} diperbarui (${columnCount} kolom).` };
  }

  public addLocation(loc: Location): { success: boolean; message: string } {
    if (this.locations.some((l) => l.locationId === loc.locationId)) {
      return { success: false, message: `Lokasi ${loc.locationId} sudah ada.` };
    }
    this.locations.push(loc);
    this.save();
    return { success: true, message: `Lokasi ${loc.displayName} berhasil ditambahkan.` };
  }

  public toggleLocationActive(locationId: string): { success: boolean; message: string } {
    const loc = this.locations.find((l) => l.locationId === locationId);
    if (!loc) return { success: false, message: 'Lokasi tidak ditemukan.' };
    loc.active = !loc.active;
    this.save();
    return { success: true, message: `Lokasi ${loc.displayName} sekarang ${loc.active ? 'Aktif' : 'Non-Aktif'}.` };
  }

  public saveUser(user: User): { success: boolean; message: string } {
    const idx = this.users.findIndex((u) => u.username === user.username);
    if (idx >= 0) {
      this.users[idx] = user;
    } else {
      this.users.push(user);
    }
    this.save();
    return { success: true, message: `Pengguna ${user.username} berhasil disimpan.` };
  }

  public unlockUser(username: string): { success: boolean; message: string } {
    const u = this.users.find((x) => x.username === username);
    if (!u) return { success: false, message: 'Pengguna tidak ditemukan.' };
    u.failedAttempts = 0;
    u.lockedUntil = undefined;
    this.save();
    return { success: true, message: `Akun ${username} berhasil dibuka kuncinya.` };
  }

  public updateSettings(newSettings: AppSettings): { success: boolean; message: string } {
    this.settings = { ...newSettings };
    this.save();
    return { success: true, message: 'Pengaturan sistem berhasil diperbarui.' };
  }

  // --- BAGIAN C DATA CLEANING AUTO-FIX SUITE ---

  public runDataAuditAndFix(): {
    fixedEmptyLocations: number;
    fixedFacMappings: number;
    fixedMissingNames: number;
    fixedTrimSpaces: number;
    normalizedLegacyCodes: number;
    flaggedSerials: number;
  } {
    let fixedEmptyLocations = 0;
    let fixedFacMappings = 0;
    let fixedMissingNames = 0;
    let fixedTrimSpaces = 0;
    let normalizedLegacyCodes = 0;
    let flaggedSerials = 0;

    for (const m of this.machines) {
      // 1. Check empty location
      if (!m.locationId || m.locationId.trim() === '') {
        const homeSite = m.homeFactory.includes('(1)') ? 'PW1' : m.homeFactory.includes('(2)') ? 'PW2' : 'PW3';
        m.locationId = `${homeSite}-UNASSIGNED`;
        m.siteId = homeSite;
        fixedEmptyLocations++;
      }

      // 2. Normalize legacy codes (WH2 -> WH2-UNASSIGNED, SW -> SW-MAIN, QA -> QA-MAIN)
      if (m.locationId === 'WH2') {
        m.locationId = 'WH2-UNASSIGNED';
        m.siteId = 'WH2';
        normalizedLegacyCodes++;
      } else if (m.locationId === 'SW') {
        m.locationId = 'SW-MAIN';
        m.siteId = 'SW';
        normalizedLegacyCodes++;
      } else if (m.locationId === 'QA') {
        m.locationId = 'QA-MAIN';
        m.siteId = 'QA';
        normalizedLegacyCodes++;
      }

      // 3. Fix 3 missing Standard Machine Names from Checklist C
      if (['IDN-8-2509-3775', 'IDN-9-2509-3776', 'IDN-10-2509-3777'].includes(m.assetCode) || !m.standardMachineName) {
        m.standardMachineName = 'Automatic Placket Attaching Machine';
        fixedMissingNames++;
      }

      // 4. Model trim hidden spaces
      if (m.model && m.model !== m.model.trim()) {
        m.model = m.model.trim();
        fixedTrimSpaces++;
      }

      // 5. Flag serial with space
      if (m.serial && m.serial.includes(' ')) {
        m.dataFlag = 'SERIAL_SPACE';
        flaggedSerials++;
      }

      // 6. Ensure Site ID matches Location ID prefix
      if (m.locationId.includes('-')) {
        const prefix = m.locationId.split('-')[0];
        if (prefix && prefix !== m.siteId) {
          m.siteId = prefix;
          fixedFacMappings++;
        }
      }
    }

    this.rebuildIndices();
    this.save();
    return {
      fixedEmptyLocations,
      fixedFacMappings,
      fixedMissingNames,
      fixedTrimSpaces,
      normalizedLegacyCodes,
      flaggedSerials,
    };
  }

  public batchImportMachines(newMachines: Machine[]): { success: boolean; importedCount: number; errors: string[] } {
    const errors: string[] = [];
    let count = 0;

    for (const raw of newMachines) {
      if (!raw.assetCode || !raw.barcode) {
        errors.push(`Baris diabaikan: Asset Code atau Barcode kosong (${raw.assetCode || 'tanpa kode'})`);
        continue;
      }

      // Force text formats and preserve leading zeros
      raw.barcode = String(raw.barcode).padStart(12, '0');
      raw.assetCode = String(raw.assetCode).trim().toUpperCase();
      raw.serial = String(raw.serial || '').trim();

      // Normalization of location
      if (!raw.locationId || raw.locationId.trim() === '') {
        const site = raw.homeFactory?.includes('2') ? 'PW2' : raw.homeFactory?.includes('3') ? 'PW3' : 'PW1';
        raw.locationId = `${site}-UNASSIGNED`;
        raw.siteId = site;
      } else if (raw.locationId === 'WH2') raw.locationId = 'WH2-UNASSIGNED';
      else if (raw.locationId === 'SW') raw.locationId = 'SW-MAIN';
      else if (raw.locationId === 'QA') raw.locationId = 'QA-MAIN';

      if (!raw.siteId && raw.locationId.includes('-')) {
        raw.siteId = raw.locationId.split('-')[0];
      }

      const existingIdx = this.machines.findIndex((m) => m.assetCode === raw.assetCode);
      if (existingIdx >= 0) {
        this.machines[existingIdx] = { ...this.machines[existingIdx], ...raw };
      } else {
        this.machines.push(raw);
      }
      count++;
    }

    this.rebuildIndices();
    this.save();
    return { success: true, importedCount: count, errors };
  }

  /**
   * Tarik data langsung dari Google Spreadsheet tab 'machine_asset' via Google Apps Script Backend
   * Menggunakan helper tunggal postGasApi dengan token sesi aktif.
   * TIDAK ADA fallback CSV/gviz ataupun penimpaan ke data contoh bila gagal.
   */
  public async syncFromGoogleSheet(
    spreadsheetIdParam?: string,
    sheetName: string = 'machine_asset'
  ): Promise<{ success: boolean; message: string; count: number; source: string; details?: any }> {
    const spreadsheetId = (spreadsheetIdParam || this.settings.spreadsheetId || '').trim();

    try {
      const resJson = await postGasApi<{
        success: boolean;
        machines?: any[];
        sheetName?: string;
        message?: string;
      }>('GET_INITIAL_DATA', {
        sheetName,
        spreadsheetId,
      });

      if (resJson && resJson.success && Array.isArray(resJson.machines)) {
        const mapped = this.mapRawObjectsToMachines(resJson.machines);
        const merged = this.mergeWithLocalMutations(mapped);
        this.machines = merged;
        this.rebuildIndices();
        this.save();
        this.notifyListeners();
        this.logAudit(
          'System',
          'GOOGLE_SHEET_SYNC',
          `Berhasil sinkronisasi ${merged.length} mesin dari Google Apps Script (${resJson.sheetName || sheetName})`
        );
        return {
          success: true,
          message: `Berhasil menarik ${merged.length} data mesin dari Google Apps Script backend (${resJson.sheetName || sheetName})!`,
          count: merged.length,
          source: 'Google Apps Script Backend',
        };
      }

      return {
        success: false,
        message: resJson?.message || 'Gagal menyinkronkan data dari Google Apps Script backend.',
        count: 0,
        source: 'Google Apps Script Backend',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Tidak dapat terhubung ke Google Apps Script backend.',
        count: 0,
        source: 'Google Apps Script Backend',
      };
    }
  }

  /**
   * Memetakan raw JSON object dari Apps Script ke Machine[]
   */
  private mapRawObjectsToMachines(rawList: any[]): Machine[] {
    return rawList.map((raw, idx) => {
      const assetCode = raw.assetCode || raw.AssetCode || raw.barcode12 || `AST-${idx + 1}`;
      const barcode = String(raw.barcode || raw.barcode12 || raw.Barcode || assetCode).padStart(12, '0');
      const serial = String(raw.serial || raw.serialNumber || raw.SerialNumber || raw.noSeri || '').trim();
      const loc = raw.locationId || raw.LocationID || raw.lokasi || 'PW1-UNASSIGNED';
      let site = raw.siteId || raw.SiteID || raw.pabrik || '';

      if (!site && loc) {
        if (loc.startsWith('PW1')) site = 'PW1';
        else if (loc.startsWith('PW2')) site = 'PW2';
        else if (loc.startsWith('PW3')) site = 'PW3';
        else if (loc.startsWith('WH2')) site = 'WH2';
        else if (loc.startsWith('SW')) site = 'SW';
        else if (loc.startsWith('QA')) site = 'QA';
        else site = 'PW1';
      }

      return {
        assetCode,
        barcode,
        serial,
        standardMachineName: raw.standardMachineName || raw.name || raw.MachineName || raw.item || 'Sewing Machine',
        item: raw.item || raw.standardMachineName || 'Sewing Machine',
        model: raw.model || raw.Model || '',
        manufacturer: raw.manufacturer || raw.Maker || '',
        locationId: loc,
        siteId: site || 'PW1',
        homeFactory: site || 'PW1',
        status: raw.status || 'ACTIVE',
        acqDate: raw.acqDate || '2024-01-01',
        updatedAt: new Date().toISOString(),
        updatedBy: 'GoogleAppsScript_Sync',
      };
    });
  }

  /**
   * Menggabungkan data dari Google Sheet dengan mutasi status & lokasi lokal
   * agar perubahan lokal (seperti status SOLD, pemindahan lokasi, transfer) tidak hilang tertimpa
   */
  private mergeWithLocalMutations(freshMachines: Machine[]): Machine[] {
    const localMap = new Map<string, Machine>();
    for (const m of this.machines) {
      if (m.assetCode) {
        localMap.set(m.assetCode.trim().toUpperCase(), m);
      }
    }

    return freshMachines.map((sheetMachine) => {
      const assetKey = (sheetMachine.assetCode || '').trim().toUpperCase();
      const local = localMap.get(assetKey);
      if (!local) return sheetMachine;

      // Cek apakah mesin pernah dimutasi lokal atau diubah statusnya (misal SOLD, LOANED, IN_REPAIR, BROKEN)
      const isLocallyModified =
        local.status !== 'ACTIVE' ||
        local.lastMovedAt ||
        local.pendingTransferId ||
        local.locationId === 'SOLD' ||
        local.locationId.includes('SOLD');

      if (isLocallyModified) {
        return {
          ...sheetMachine,
          // Pertahankan status lokal jika di sheet masih default/kosong
          status: sheetMachine.status !== 'ACTIVE' ? sheetMachine.status : (local.status || sheetMachine.status),
          locationId: local.locationId || sheetMachine.locationId,
          siteId: local.siteId || sheetMachine.siteId,
          lastMovedAt: local.lastMovedAt || sheetMachine.lastMovedAt,
          lastMovedBy: local.lastMovedBy || sheetMachine.lastMovedBy,
          statusSince: local.statusSince || sheetMachine.statusSince,
          loanTo: local.loanTo || sheetMachine.loanTo,
          loanDueDate: local.loanDueDate || sheetMachine.loanDueDate,
          pendingTransferId: local.pendingTransferId || sheetMachine.pendingTransferId,
          updatedAt: local.updatedAt || sheetMachine.updatedAt,
          updatedBy: local.updatedBy || sheetMachine.updatedBy,
        };
      }
      return sheetMachine;
    });
  }

  /**
   * Mengirim mutasi / request langsung ke Google Apps Script Web App lewat helper tunggal postGasApi
   */
  public async postToGasBackend<T = any>(
    actionOrPayload: string | { action: string; [key: string]: any; params?: any },
    maybeParams?: any
  ): Promise<T> {
    if (typeof actionOrPayload === 'string') {
      return await postGasApi<T>(actionOrPayload, maybeParams || {});
    } else {
      const { action, params, ...rest } = actionOrPayload;
      return await postGasApi<T>(action, params || rest);
    }
  }

  private logAudit(username: string, action: string, detail: string) {
    this.auditLogs.unshift({
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      username,
      action,
      detail,
    });
  }
}

export const storageService = new StorageService();
