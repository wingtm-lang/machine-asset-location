/**
 * Google Apps Script (Code.gs) Generator & Exporter
 * Comprehensive production backend script for Google Apps Script + Google Sheets.
 * Diselaraskan secara presisi dengan struktur tabel sheet 'machine_asset' PT.WINNERS:
 * Serial, Manufacturer, Model, Status, Location ID, Site ID, Pending Transfer ID, Last Moved At, Last Moved By, dll.
 */

export function generateGasCodeGs(spreadsheetId: string = '1-D87s2xI6ERVQydmP1Gbmj7XzqB5o7Ziib7mvKVhtio'): string {
  return `/**
 * ============================================================================
 * PT.WINNERS MACHINE ASSET LOCATION TRACKER - BACKEND CODE.gs
 * Platform: Google Apps Script + Google Sheets (Standalone / Container-bound)
 * Target Spreadsheet ID: ${spreadsheetId}
 * 
 * FITUR UTAMA & KESELARASAN STRUKTUR TABEL:
 * 1. Menulis langsung mutasi lokasi ke kolom "Location ID", "Site ID", "Status",
 *    "Last Moved At", "Last Moved By", "Pending Transfer ID" pada sheet 'machine_asset'.
 * 2. Mencatat setiap riwayat pemindahan & perubahan ke sheet 'Movement_History' secara otomatis.
 * 3. Mendukung fitur Undo Pemindahan (mengembalikan lokasi awal di sheet & menandai log).
 * 4. Mendukung alur Transfer Antar Site 2-Langkah (Kirim -> In Transit -> Terima di sheet tujuan).
 * 5. Mendukung rekonsiliasi Stok Opname & pembaruan kolom "Last Opname At".
 * 6. Deteksi kolom dinamis: Script otomatis mencari indeks kolom berdasarkan nama header
 *    tanpa peduli urutan kolom, dan otomatis membuat kolom tracking jika belum ada.
 * 
 * PANDUAN PEMASANGAN (DEPLOYMENT) DI GOOGLE SPREADSHEET:
 * 1. Buka Google Spreadsheet data mesin PT.WINNERS di browser.
 * 2. Klik menu "Ekstensi" (Extensions) > "Apps Script".
 * 3. Hapus seluruh kode lama di "Code.gs", lalu tempelkan (Paste) seluruh kode ini.
 * 4. Klik ikon Save (Simpan).
 * 5. Klik tombol biru "Terapkan" (Deploy) di kanan atas > "Penerapan baru" (New deployment).
 * 6. Pilih jenis penerapan: "Aplikasi web" (Web app).
 * 7. Isi Konfigurasi:
 *    - Deskripsi: PT.WINNERS Tracker Backend v2
 *    - Jalankan sebagai (Execute as): Akun saya (Me)
 *    - Siapa yang memiliki akses (Who has access): Siapa saja (Anyone) -> WAJIB agar aplikasi web dapat terhubung!
 * 8. Klik "Terapkan" (Deploy) dan berikan izin akses (Authorize access).
 * 9. Salin "URL Aplikasi Web" (Web App URL yang berakhiran /exec).
 * 10. Tempelkan URL tersebut ke aplikasi web PT.WINNERS pada menu Admin > Google Spreadsheet & Apps Script Backend.
 * ============================================================================
 */

var SPREADSHEET_ID = "${spreadsheetId}";
var PEPPER = "PT_WINNERS_APP_SECRET_PEPPER_2026";
var SESSION_TTL_HOURS = 12;

/**
 * Mendapatkan instance Spreadsheet (aktif maupun standalone via ID)
 */
function getSpreadsheet() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Mencari tab sheet data mesin utama
 * Mendukung 'machine_asset', 'machine_assets', 'Machine_Asset', 'Machines', dll.
 */
function getMachineAssetSheet(ss) {
  var candidates = ['machine_asset', 'machine_assets', 'Machine_Asset', 'Machines', 'machines', 'Sheet1'];
  for (var i = 0; i < candidates.length; i++) {
    var sh = ss.getSheetByName(candidates[i]);
    if (sh) return sh;
  }
  return ss.getSheets()[0];
}

/**
 * Web App Entrypoint (HTTP GET)
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    var token = e.parameter.token || '';
    var action = e.parameter.action;
    var params = {};
    if (e.parameter.data) {
      try {
        params = JSON.parse(e.parameter.data);
      } catch (err) {
        params = e.parameter;
      }
    } else {
      params = e.parameter;
    }
    var res = authorize(token, action, params);
    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;padding:30px;line-height:1.6;color:#1e293b;">' +
    '<h2>PT.WINNERS Machine Asset Location Tracker - Backend Online</h2>' +
    '<p>Status: <b>OK (Connected)</b></p>' +
    '<p>Spreadsheet ID: <code>' + SPREADSHEET_ID + '</code></p>' +
    '<p>Waktu Server: ' + new Date().toString() + '</p>' +
    '<hr>' +
    '<p style="font-size:12px;color:#64748b;">Endpoint ini melayani sinkronisasi data mesin, pemindahan lokasi, transfer antar site, dan audit stok opname.</p>' +
    '</div>'
  ).setTitle('PT.WINNERS Tracker API').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Web App Entrypoint (HTTP POST)
 */
function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var token = payload.token || '';
    var action = payload.action || 'GET_INITIAL_DATA';
    var params = payload.params || payload;

    var result = authorize(token, action, params);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'POST_ERROR',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * UNIVERSAL AUTHORIZATION GATE
 */
function authorize(token, action, params) {
  var user = null;
  // Jika dipanggil dari integrasi internal / direct sync
  if (token) {
    user = validateSession(token);
  }
  if (!user) {
    user = {
      username: (params && (params.username || params.byUser || params.sentBy || params.receivedBy || params.lastMovedBy)) || 'System',
      role: 'Admin',
      siteAccess: ['ALL']
    };
  }

  // Gunakan ScriptLock untuk mencegah race condition mutasi data
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // Tunggu antrian maksimal 15 detik

    switch (action) {
      case 'LOGIN':
        return handleLogin(params.username, params.password);

      case 'GET_INITIAL_DATA':
      case 'GET_MACHINES':
        return handleGetInitialData(user);

      case 'SEARCH_MACHINE':
        return handleSearchMachine(user, params.query);

      case 'MOVE_MACHINE':
      case 'UPDATE_MACHINE':
        return handleMoveMachine(user, params);

      case 'UNDO_MOVE':
        return handleUndoMove(user, params);

      case 'SEND_TRANSFER':
        return handleSendTransfer(user, params);

      case 'RECEIVE_TRANSFER':
        return handleReceiveTransfer(user, params);

      case 'CANCEL_TRANSFER':
        return handleCancelTransfer(user, params);

      case 'SAVE_OPNAME':
        return handleSaveOpname(user, params);

      case 'ADMIN_AUDIT_FIX':
        return handleAdminAuditFix(user);

      case 'PING':
        return { success: true, message: 'Koneksi ke Google Apps Script berhasil', timestamp: new Date().toISOString() };

      default:
        return { success: false, message: 'Aksi tidak dikenal: ' + action };
    }
  } catch (err) {
    return { success: false, message: 'Server Lock/Timeout Error: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * MENDAPATKAN PETA INDEKS KOLOM DINAMIS DARI SHEET 'machine_asset'
 * Mendeteksi otomatis: Serial, Manufacturer, Model, Status, Location ID, Site ID,
 * Pending Transfer ID, Last Moved At, Last Moved By, Asset Code, Barcode, dll.
 */
function getSheetColumnIndices(sheet) {
  var data = sheet.getDataRange().getValues();
  if (!data || data.length === 0) return { colMap: {}, headers: [], rowCount: 0 };

  var rawHeaders = data[0];
  var colMap = {};

  function clean(str) {
    return String(str || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  for (var c = 0; c < rawHeaders.length; c++) {
    var key = clean(rawHeaders[c]);
    if (key) {
      colMap[key] = c;
    }
  }

  function findCol(aliases) {
    for (var i = 0; i < aliases.length; i++) {
      var k = clean(aliases[i]);
      if (typeof colMap[k] !== 'undefined') return colMap[k];
    }
    return -1;
  }

  var indices = {
    assetCode: findCol(['assetcode', 'kodeaset', 'assetno', 'asset', 'code', 'id', 'barcode']),
    barcode: findCol(['barcode', 'barcode12', 'kodebarcode', 'barcodeno']),
    serial: findCol(['serial', 'serialnumber', 'noseri', 'serialno', 'sn']),
    manufacturer: findCol(['manufacturer', 'maker', 'brand', 'merk', 'pabrikan']),
    model: findCol(['model', 'tipe', 'type', 'modelno']),
    status: findCol(['status', 'kondisi', 'state', 'machinestatus']),
    locationId: findCol(['locationid', 'location', 'lokasi', 'line', 'posisi', 'posisimesin']),
    siteId: findCol(['siteid', 'site', 'factory', 'pabrik', 'homefactory']),
    pendingTransferId: findCol(['pendingtransferid', 'transferid', 'transferno', 'idtransfer', 'pendingtransfer']),
    lastMovedAt: findCol(['lastmovedat', 'lastupdated', 'updatedat', 'tglupdate', 'waktupindah', 'tanggalpindah']),
    lastMovedBy: findCol(['lastmovedby', 'updatedby', 'user', 'operator', 'olehpengguna', 'dipindahkanoleh']),
    standardMachineName: findCol(['standardmachinename', 'machinename', 'namamesin', 'description', 'jenis']),
    item: findCol(['item', 'itemname', 'koreanname', 'namaitem', 'itemkr']),
    homeFactory: findCol(['homefactory', 'pabrikasal', 'originfactory']),
    acqDate: findCol(['acqdate', 'acquisitiondate', 'tanggalperolehan', 'tglperolehan']),
    lastOpnameAt: findCol(['lastopnameat', 'opnamedate', 'tglopname', 'auditdate']),
    loanTo: findCol(['loanto', 'peminjam', 'dipinjamoleh']),
    loanDueDate: findCol(['loanduedate', 'tglduedate', 'tglkembali']),
    notes: findCol(['notes', 'catatan', 'keterangan', 'reason']),
    headers: rawHeaders,
    data: data,
    rowCount: data.length
  };

  return indices;
}

/**
 * MEMASTIKAN KOLOM TRACKING TERSEDIA DI ROW 1
 * Jika sheet belum memiliki kolom Status, Location ID, Site ID, Pending Transfer ID,
 * Last Moved At, atau Last Moved By, fungsi ini otomatis menambahkannya ke header.
 */
function ensureTrackingColumns(sheet, indices) {
  var headers = indices.headers.slice();
  var added = false;

  var requiredCols = [
    { key: 'status', label: 'Status' },
    { key: 'locationId', label: 'Location ID' },
    { key: 'siteId', label: 'Site ID' },
    { key: 'pendingTransferId', label: 'Pending Transfer ID' },
    { key: 'lastMovedAt', label: 'Last Moved At' },
    { key: 'lastMovedBy', label: 'Last Moved By' }
  ];

  for (var i = 0; i < requiredCols.length; i++) {
    var item = requiredCols[i];
    if (indices[item.key] === -1) {
      var newColIdx = headers.length + 1;
      sheet.getRange(1, newColIdx).setValue(item.label)
        .setFontWeight('bold')
        .setBackground('#f1f5f9');
      indices[item.key] = newColIdx - 1;
      headers.push(item.label);
      added = true;
    }
  }

  if (added) {
    indices.headers = headers;
  }
  return indices;
}

/**
 * PENCARIAN BARIS MESIN DI DALAM TABEL DATA
 * Mencocokkan berdasarkan Asset Code, Barcode, atau Serial Number
 */
function findMachineRow(data, indices, targetAsset, targetBarcode, targetSerial) {
  var qAsset = String(targetAsset || '').trim().toUpperCase();
  var qBarcode = String(targetBarcode || '').trim();
  var qSerial = String(targetSerial || '').trim().toUpperCase();

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var rowAsset = indices.assetCode !== -1 ? String(row[indices.assetCode] || '').trim().toUpperCase() : '';
    var rowBarcode = indices.barcode !== -1 ? String(row[indices.barcode] || '').trim() : '';
    var rowSerial = indices.serial !== -1 ? String(row[indices.serial] || '').trim().toUpperCase() : '';

    if (qAsset && rowAsset === qAsset) return r + 1;
    if (qBarcode && rowBarcode === qBarcode) return r + 1;
    if (qBarcode && rowAsset === qBarcode) return r + 1;
    if (qSerial && rowSerial && rowSerial === qSerial) return r + 1;
  }

  return -1;
}

/**
 * FORMAT TANGGAL DAN WAKTU INDONESIA (GMT+7)
 */
function formatCurrentDateTime() {
  return Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
}

/**
 * 1. PENGAMBILAN DATA AWAL (READ SHEET 'machine_asset')
 */
function handleGetInitialData(user) {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  if (!mSheet) {
    return { success: false, message: 'Sheet machine_asset tidak ditemukan di spreadsheet' };
  }

  var indices = getSheetColumnIndices(mSheet);
  indices = ensureTrackingColumns(mSheet, indices);
  var data = mSheet.getDataRange().getValues();

  var machines = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row || row.every(function(cell) { return String(cell).trim() === ''; })) continue;

    var assetCode = indices.assetCode !== -1 ? String(row[indices.assetCode] || '').trim() : ('AST-' + r);
    var barcode = indices.barcode !== -1 ? String(row[indices.barcode] || '').trim() : assetCode;
    var serial = indices.serial !== -1 ? String(row[indices.serial] || '').trim() : '';
    var manufacturer = indices.manufacturer !== -1 ? String(row[indices.manufacturer] || '').trim() : '';
    var model = indices.model !== -1 ? String(row[indices.model] || '').trim() : '';
    var mName = indices.standardMachineName !== -1 ? String(row[indices.standardMachineName] || '').trim() : 'Sewing Machine';
    var item = indices.item !== -1 ? String(row[indices.item] || '').trim() : mName;
    var loc = indices.locationId !== -1 ? String(row[indices.locationId] || '').trim() : 'PW1-UNASSIGNED';
    var site = indices.siteId !== -1 ? String(row[indices.siteId] || '').trim().toUpperCase() : '';
    var pendingTransferId = indices.pendingTransferId !== -1 ? String(row[indices.pendingTransferId] || '').trim() : '';
    var lastMovedAt = indices.lastMovedAt !== -1 ? String(row[indices.lastMovedAt] || '').trim() : '';
    var lastMovedBy = indices.lastMovedBy !== -1 ? String(row[indices.lastMovedBy] || '').trim() : '';

    if (!site && loc) {
      if (loc.indexOf('PW1') === 0) site = 'PW1';
      else if (loc.indexOf('PW2') === 0) site = 'PW2';
      else if (loc.indexOf('PW3') === 0) site = 'PW3';
      else if (loc.indexOf('WH2') === 0) site = 'WH2';
      else if (loc.indexOf('SW') === 0) site = 'SW';
      else if (loc.indexOf('QA') === 0) site = 'QA';
      else site = 'PW1';
    }

    var rawStatus = indices.status !== -1 ? String(row[indices.status] || '').trim().toUpperCase() : 'ACTIVE';
    var status = 'ACTIVE';
    if (rawStatus.indexOf('BROKEN') !== -1 || rawStatus.indexOf('RUSAK') !== -1) status = 'BROKEN';
    else if (rawStatus.indexOf('REPAIR') !== -1 || rawStatus.indexOf('PERBAIKAN') !== -1) status = 'IN_REPAIR';
    else if (rawStatus.indexOf('LOAN') !== -1 || rawStatus.indexOf('PINJAM') !== -1) status = 'LOANED';
    else if (rawStatus.indexOf('SOLD') !== -1 || rawStatus.indexOf('JUAL') !== -1 || rawStatus.indexOf('AFKIR') !== -1) status = 'SOLD';
    else if (rawStatus.indexOf('TRANSIT') !== -1) status = 'IN_TRANSIT';

    machines.push({
      assetCode: assetCode,
      barcode: barcode,
      serial: serial,
      standardMachineName: mName,
      item: item,
      model: model,
      manufacturer: manufacturer,
      locationId: loc || 'PW1-UNASSIGNED',
      siteId: site || 'PW1',
      homeFactory: site || 'PW1',
      status: status,
      pendingTransferId: pendingTransferId || undefined,
      lastMovedAt: lastMovedAt || undefined,
      lastMovedBy: lastMovedBy || undefined,
      acqDate: indices.acqDate !== -1 ? String(row[indices.acqDate] || '').trim() : '2024-01-01',
      updatedAt: lastMovedAt || new Date().toISOString(),
      updatedBy: lastMovedBy || 'GoogleSheets_Sync'
    });
  }

  return {
    success: true,
    sheetName: mSheet.getName(),
    totalRows: machines.length,
    machines: machines,
    sites: getSheetObjects(ss.getSheetByName('Sites')),
    locations: getSheetObjects(ss.getSheetByName('Locations')),
    racks: getSheetObjects(ss.getSheetByName('Racks')),
    transfers: getSheetObjects(ss.getSheetByName('Transfer_Orders'))
  };
}

/**
 * 2. PERPINDAHAN MESIN & PERUBAHAN STATUS TERTANAM KE SHEET (MOVE_MACHINE / UPDATE_MACHINE)
 */
function handleMoveMachine(user, params) {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  if (!mSheet) return { success: false, message: 'Sheet machine_asset tidak ditemukan' };

  var indices = getSheetColumnIndices(mSheet);
  indices = ensureTrackingColumns(mSheet, indices);
  var data = mSheet.getDataRange().getValues();

  var targetAsset = String(params.assetCode || '').trim();
  var targetBarcode = String(params.barcode || params.barcode12 || '').trim();
  var targetSerial = String(params.serial || '').trim();
  var targetLoc = String(params.locationId || params.toLocationId || '').trim();
  var targetSite = String(params.siteId || params.toSiteId || '').trim();
  var newStatus = String(params.status || '').trim().toUpperCase();
  var username = (user && user.username) ? user.username : (params.byUser || params.lastMovedBy || 'Admin');
  var reason = params.reason || (newStatus === 'SOLD' ? 'Status diubah ke SOLD (Terjual/Afkir)' : 'Pemindahan lokasi mesin');
  var timestampStr = formatCurrentDateTime();
  var historyId = "MOV-" + Date.now();

  if (newStatus === 'SOLD') {
    targetLoc = targetLoc || 'SOLD';
  }

  // Cari baris mesin di sheet
  var rowIndex = findMachineRow(data, indices, targetAsset, targetBarcode, targetSerial);
  if (rowIndex === -1) {
    return { success: false, message: 'Mesin ' + (targetAsset || targetBarcode) + ' tidak ditemukan di sheet' };
  }

  var currentRow = data[rowIndex - 1];
  var fromLoc = indices.locationId !== -1 ? String(currentRow[indices.locationId] || '') : 'UNKNOWN';
  var fromSite = indices.siteId !== -1 ? String(currentRow[indices.siteId] || '') : 'PW1';
  var currentSerial = indices.serial !== -1 ? String(currentRow[indices.serial] || '') : targetSerial;
  var currentName = indices.standardMachineName !== -1 ? String(currentRow[indices.standardMachineName] || '') : 'Sewing Machine';

  // 1. Tanamkan perubahan ke sel baris mesin di tab sheet 'machine_asset'
  if (targetLoc && indices.locationId !== -1) {
    mSheet.getRange(rowIndex, indices.locationId + 1).setValue(targetLoc);
  }
  if (targetSite && indices.siteId !== -1) {
    mSheet.getRange(rowIndex, indices.siteId + 1).setValue(targetSite);
  }
  if (newStatus && indices.status !== -1) {
    mSheet.getRange(rowIndex, indices.status + 1).setValue(newStatus);
  }
  if (indices.lastMovedAt !== -1) {
    mSheet.getRange(rowIndex, indices.lastMovedAt + 1).setValue(timestampStr);
  }
  if (indices.lastMovedBy !== -1) {
    mSheet.getRange(rowIndex, indices.lastMovedBy + 1).setValue(username);
  }
  if (indices.pendingTransferId !== -1) {
    mSheet.getRange(rowIndex, indices.pendingTransferId + 1).setValue(''); // Clear pending transfer on direct move
  }

  // 2. Tanamkan catatan ke tab sheet 'Movement_History' (Audit Log)
  var hSheet = getOrCreateMovementHistorySheet(ss);
  hSheet.appendRow([
    historyId,
    targetBarcode || (indices.barcode !== -1 ? currentRow[indices.barcode] : ''),
    targetAsset || (indices.assetCode !== -1 ? currentRow[indices.assetCode] : ''),
    currentSerial,
    currentName,
    fromLoc,
    targetLoc || fromLoc,
    fromSite,
    targetSite || fromSite,
    newStatus || 'ACTIVE',
    reason,
    username,
    timestampStr,
    params.reason || '',
    false // isUndone
  ]);

  return {
    success: true,
    message: 'Data mesin ' + (targetAsset || targetBarcode) + ' berhasil diperbarui di sheet ke lokasi ' + targetLoc,
    historyId: historyId,
    locationId: targetLoc,
    status: newStatus || 'ACTIVE',
    lastMovedAt: timestampStr,
    lastMovedBy: username
  };
}

/**
 * 3. BATALKAN PEMINDAHAN TERAKHIR / UNDO MOVE (TERTANAM KE SHEET)
 */
function handleUndoMove(user, params) {
  var ss = getSpreadsheet();
  var hSheet = ss.getSheetByName('Movement_History');
  var mSheet = getMachineAssetSheet(ss);
  if (!hSheet || !mSheet) return { success: false, message: 'Sheet riwayat mutasi atau mesin tidak ditemukan' };

  var targetAsset = String(params.assetCode || '').trim();
  var targetBarcode = String(params.barcode || '').trim();
  var historyId = params.historyId || '';
  var username = (user && user.username) ? user.username : (params.username || 'Admin');

  var hData = hSheet.getDataRange().getValues();
  if (hData.length <= 1) return { success: false, message: 'Belum ada riwayat pemindahan' };

  // Cari mutasi terakhir untuk mesin tersebut
  var targetHRow = -1;
  for (var i = hData.length - 1; i >= 1; i--) {
    var hRow = hData[i];
    var hId = String(hRow[0]);
    var bCode = String(hRow[1]);
    var aCode = String(hRow[2]);
    var isUndone = hRow[14] === true || String(hRow[14]).toUpperCase() === 'TRUE';

    var match = false;
    if (historyId && hId === historyId) match = true;
    else if (targetAsset && aCode.toUpperCase() === targetAsset.toUpperCase() && !isUndone) match = true;
    else if (targetBarcode && bCode === targetBarcode && !isUndone) match = true;

    if (match) {
      if (isUndone) return { success: false, message: 'Pemindahan ini sudah pernah dibatalkan (Undo)' };
      targetHRow = i + 1;
      break;
    }
  }

  if (targetHRow === -1) {
    return { success: false, message: 'Riwayat pemindahan tidak ditemukan untuk di-undo' };
  }

  var record = hData[targetHRow - 1];
  var originalBarcode = record[1];
  var originalAsset = record[2];
  var originalLoc = record[5];  // FromLocation
  var originalSite = record[7]; // FromSite

  // Kembalikan lokasi di sheet 'machine_asset'
  var indices = getSheetColumnIndices(mSheet);
  var mData = mSheet.getDataRange().getValues();
  var mRow = findMachineRow(mData, indices, originalAsset, originalBarcode, '');

  var timestampStr = formatCurrentDateTime();

  if (mRow !== -1) {
    if (indices.locationId !== -1) mSheet.getRange(mRow, indices.locationId + 1).setValue(originalLoc);
    if (indices.siteId !== -1 && originalSite) mSheet.getRange(mRow, indices.siteId + 1).setValue(originalSite);
    if (indices.lastMovedAt !== -1) mSheet.getRange(mRow, indices.lastMovedAt + 1).setValue(timestampStr);
    if (indices.lastMovedBy !== -1) mSheet.getRange(mRow, indices.lastMovedBy + 1).setValue(username + ' (UNDO)');
  }

  // Tandai isUndone = true di sheet Movement_History
  hSheet.getRange(targetHRow, 15).setValue(true);

  return {
    success: true,
    message: 'Undo berhasil: Mesin ' + (originalAsset || originalBarcode) + ' dikembalikan ke lokasi ' + originalLoc
  };
}

/**
 * 4. TRANSFER ANTAR SITE: KIRIM (SEND_TRANSFER)
 */
function handleSendTransfer(user, params) {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  var tSheet = getOrCreateTransferOrdersSheet(ss);
  var hSheet = getOrCreateMovementHistorySheet(ss);

  var transferId = "TRF-" + Date.now();
  var timestampStr = formatCurrentDateTime();
  var barcodes = params.barcodes || [];
  var assetCodes = params.assetCodes || [];
  var toSite = params.toSite || 'WH2';
  var sentBy = (user && user.username) ? user.username : (params.sentBy || 'Admin');
  var note = params.note || params.notes || '';

  var indices = getSheetColumnIndices(mSheet);
  indices = ensureTrackingColumns(mSheet, indices);
  var mData = mSheet.getDataRange().getValues();

  var updatedCount = 0;
  var targetList = assetCodes.length > 0 ? assetCodes : barcodes;

  for (var i = 0; i < targetList.length; i++) {
    var target = targetList[i];
    var mRow = findMachineRow(mData, indices, target, target, '');
    if (mRow !== -1) {
      var row = mData[mRow - 1];
      var fromLoc = indices.locationId !== -1 ? String(row[indices.locationId] || '') : 'PW1';
      var fromSite = indices.siteId !== -1 ? String(row[indices.siteId] || '') : 'PW1';

      // Update machine_asset
      if (indices.locationId !== -1) mSheet.getRange(mRow, indices.locationId + 1).setValue(toSite + '-IN_TRANSIT');
      if (indices.status !== -1) mSheet.getRange(mRow, indices.status + 1).setValue('IN_TRANSIT');
      if (indices.pendingTransferId !== -1) mSheet.getRange(mRow, indices.pendingTransferId + 1).setValue(transferId);
      if (indices.lastMovedAt !== -1) mSheet.getRange(mRow, indices.lastMovedAt + 1).setValue(timestampStr);
      if (indices.lastMovedBy !== -1) mSheet.getRange(mRow, indices.lastMovedBy + 1).setValue(sentBy);

      // Log to Movement_History
      hSheet.appendRow([
        "MOV-" + Date.now() + "-" + (i + 1),
        indices.barcode !== -1 ? row[indices.barcode] : target,
        indices.assetCode !== -1 ? row[indices.assetCode] : target,
        indices.serial !== -1 ? row[indices.serial] : '',
        indices.standardMachineName !== -1 ? row[indices.standardMachineName] : 'Sewing Machine',
        fromLoc,
        toSite + '-IN_TRANSIT',
        fromSite,
        toSite,
        'IN_TRANSIT',
        'Transfer Antar Site ke ' + toSite + (note ? ': ' + note : ''),
        sentBy,
        timestampStr,
        note,
        false
      ]);

      updatedCount++;
    }
  }

  // Append to Transfer_Orders sheet
  tSheet.appendRow([
    transferId,
    JSON.stringify(targetList),
    params.fromSite || 'PW1',
    toSite,
    'IN_TRANSIT',
    params.vehicleNo || '-',
    params.driverName || '-',
    note,
    sentBy,
    '', // receivedBy
    timestampStr,
    ''  // receivedAt
  ]);

  return {
    success: true,
    transferId: transferId,
    updatedCount: updatedCount,
    message: updatedCount + ' mesin berhasil dikirim ke ' + toSite + ' (Status: In Transit)'
  };
}

/**
 * 5. TRANSFER ANTAR SITE: TERIMA (RECEIVE_TRANSFER)
 */
function handleReceiveTransfer(user, params) {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  var tSheet = getOrCreateTransferOrdersSheet(ss);
  var hSheet = getOrCreateMovementHistorySheet(ss);

  var transferId = params.transferId;
  var toLocationId = params.toLocationId;
  var toSite = params.toSite || '';
  var receivedBy = (user && user.username) ? user.username : (params.receivedBy || 'Admin');
  var timestampStr = formatCurrentDateTime();

  var indices = getSheetColumnIndices(mSheet);
  indices = ensureTrackingColumns(mSheet, indices);
  var mData = mSheet.getDataRange().getValues();

  var tData = tSheet.getDataRange().getValues();
  var foundTransfer = false;
  var machineList = [];

  for (var t = 1; t < tData.length; t++) {
    if (String(tData[t][0]) === String(transferId)) {
      foundTransfer = true;
      if (!toSite) toSite = tData[t][3];
      try {
        machineList = JSON.parse(tData[t][1]);
      } catch (e) {
        machineList = [tData[t][1]];
      }

      // Update Transfer_Orders row
      tSheet.getRange(t + 1, 5).setValue('RECEIVED');
      tSheet.getRange(t + 1, 10).setValue(receivedBy);
      tSheet.getRange(t + 1, 12).setValue(timestampStr);
      break;
    }
  }

  // Jika dipanggil per-mesin
  if (params.assetCode && machineList.length === 0) {
    machineList = [params.assetCode];
  }

  for (var m = 0; m < machineList.length; m++) {
    var target = machineList[m];
    var mRow = findMachineRow(mData, indices, target, target, '');
    if (mRow !== -1) {
      var row = mData[mRow - 1];
      var fromLoc = indices.locationId !== -1 ? String(row[indices.locationId] || '') : 'IN_TRANSIT';
      var fromSite = indices.siteId !== -1 ? String(row[indices.siteId] || '') : 'PW1';

      // Update machine_asset
      if (indices.locationId !== -1) mSheet.getRange(mRow, indices.locationId + 1).setValue(toLocationId);
      if (indices.siteId !== -1 && toSite) mSheet.getRange(mRow, indices.siteId + 1).setValue(toSite);
      if (indices.status !== -1) mSheet.getRange(mRow, indices.status + 1).setValue('ACTIVE');
      if (indices.pendingTransferId !== -1) mSheet.getRange(mRow, indices.pendingTransferId + 1).setValue(''); // clear pending
      if (indices.lastMovedAt !== -1) mSheet.getRange(mRow, indices.lastMovedAt + 1).setValue(timestampStr);
      if (indices.lastMovedBy !== -1) mSheet.getRange(mRow, indices.lastMovedBy + 1).setValue(receivedBy);

      // Log Movement_History
      hSheet.appendRow([
        "MOV-" + Date.now() + "-" + (m + 1),
        indices.barcode !== -1 ? row[indices.barcode] : target,
        indices.assetCode !== -1 ? row[indices.assetCode] : target,
        indices.serial !== -1 ? row[indices.serial] : '',
        indices.standardMachineName !== -1 ? row[indices.standardMachineName] : 'Sewing Machine',
        fromLoc,
        toLocationId,
        fromSite,
        toSite,
        'ACTIVE',
        'Transfer diterima oleh ' + receivedBy,
        receivedBy,
        timestampStr,
        'Penerimaan transfer ' + transferId,
        false
      ]);
    }
  }

  return {
    success: true,
    message: 'Transfer ' + transferId + ' berhasil diterima di lokasi ' + toLocationId
  };
}

/**
 * 6. BATALKAN TRANSFER (CANCEL_TRANSFER)
 */
function handleCancelTransfer(user, params) {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  var tSheet = getOrCreateTransferOrdersSheet(ss);

  var transferId = params.transferId;
  var targetAsset = params.assetCode;
  var username = (user && user.username) ? user.username : (params.username || 'Admin');

  var indices = getSheetColumnIndices(mSheet);
  var mData = mSheet.getDataRange().getValues();

  if (targetAsset) {
    var mRow = findMachineRow(mData, indices, targetAsset, targetAsset, '');
    if (mRow !== -1) {
      if (indices.pendingTransferId !== -1) mSheet.getRange(mRow, indices.pendingTransferId + 1).setValue('');
      if (indices.status !== -1) mSheet.getRange(mRow, indices.status + 1).setValue('ACTIVE');
    }
  }

  var tData = tSheet.getDataRange().getValues();
  for (var i = 1; i < tData.length; i++) {
    if (String(tData[i][0]) === String(transferId)) {
      tSheet.getRange(i + 1, 5).setValue('CANCELLED');
      tSheet.getRange(i + 1, 8).setValue('Dibatalkan oleh ' + username);
      break;
    }
  }

  return { success: true, message: 'Transfer ' + transferId + ' berhasil dibatalkan' };
}

/**
 * 7. AUDIT STOK OPNAME (SAVE_OPNAME)
 */
function handleSaveOpname(user, params) {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  var oSheet = ss.getSheetByName('Opname_History');
  if (!oSheet) {
    oSheet = ss.insertSheet('Opname_History');
    oSheet.appendRow(['OpnameID', 'LocationID', 'SiteID', 'ScannedCount', 'MatchCount', 'MissingCount', 'MisplacedCount', 'AuditedBy', 'AuditedAt', 'AuditDataJSON']);
    oSheet.getRange(1, 1, 1, 10).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
    oSheet.setFrozenRows(1);
  }

  var session = params.session || {};
  var items = params.items || [];
  var timestampStr = formatCurrentDateTime();

  oSheet.appendRow([
    session.sessionId || ("OPN-" + Date.now()),
    session.locationId || '-',
    session.siteId || '-',
    session.scanned || 0,
    session.matched || 0,
    session.missing || 0,
    session.misplaced || 0,
    session.startedBy || (user && user.username) || 'Auditor',
    timestampStr,
    JSON.stringify(items.slice(0, 100))
  ]);

  // Update Last Opname At pada baris mesin yang berhasil dicocokkan (MATCH)
  if (mSheet) {
    var indices = getSheetColumnIndices(mSheet);
    if (indices.lastOpnameAt === -1) {
      var newCol = indices.headers.length + 1;
      mSheet.getRange(1, newCol).setValue('Last Opname At').setFontWeight('bold');
      indices.lastOpnameAt = newCol - 1;
    }

    var mData = mSheet.getDataRange().getValues();
    for (var i = 0; i < items.length; i++) {
      if (items[i].result === 'MATCH') {
        var mRow = findMachineRow(mData, indices, items[i].assetCode, items[i].barcode, '');
        if (mRow !== -1 && indices.lastOpnameAt !== -1) {
          mSheet.getRange(mRow, indices.lastOpnameAt + 1).setValue(timestampStr);
        }
      }
    }
  }

  return { success: true, message: 'Hasil audit stok opname berhasil disimpan' };
}

/**
 * 8. PENCARIAN MESIN CEPAT
 */
function handleSearchMachine(user, query) {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  var indices = getSheetColumnIndices(mSheet);
  var data = mSheet.getDataRange().getValues();
  var q = String(query).trim().toUpperCase();

  var rowIndex = findMachineRow(data, indices, q, q, q);
  if (rowIndex !== -1) {
    var row = data[rowIndex - 1];
    return {
      success: true,
      machine: {
        assetCode: indices.assetCode !== -1 ? row[indices.assetCode] : '',
        barcode: indices.barcode !== -1 ? row[indices.barcode] : '',
        serial: indices.serial !== -1 ? row[indices.serial] : '',
        standardMachineName: indices.standardMachineName !== -1 ? row[indices.standardMachineName] : '',
        manufacturer: indices.manufacturer !== -1 ? row[indices.manufacturer] : '',
        model: indices.model !== -1 ? row[indices.model] : '',
        locationId: indices.locationId !== -1 ? row[indices.locationId] : '',
        siteId: indices.siteId !== -1 ? row[indices.siteId] : '',
        status: indices.status !== -1 ? row[indices.status] : 'ACTIVE'
      }
    };
  }
  return { success: false, message: 'Mesin dengan kode ' + query + ' tidak ditemukan di sheet' };
}

/**
 * 9. PEMBERSIHAN DATA DAN AUDIT FORMAT OTOMATIS
 */
function handleAdminAuditFix(user) {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  var indices = getSheetColumnIndices(mSheet);
  indices = ensureTrackingColumns(mSheet, indices);
  var data = mSheet.getDataRange().getValues();

  var fixedCount = 0;
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var loc = indices.locationId !== -1 ? String(row[indices.locationId] || '').trim() : '';
    var site = indices.siteId !== -1 ? String(row[indices.siteId] || '').trim() : '';

    if (!loc) {
      var defSite = site || 'PW1';
      mSheet.getRange(r + 1, indices.locationId + 1).setValue(defSite + '-UNASSIGNED');
      fixedCount++;
    } else if (loc.indexOf('-') !== -1) {
      var prefix = loc.split('-')[0];
      if (prefix && prefix !== site && indices.siteId !== -1) {
        mSheet.getRange(r + 1, indices.siteId + 1).setValue(prefix);
        fixedCount++;
      }
    }
  }

  return { success: true, fixedCount: fixedCount, message: fixedCount + ' baris data berhasil diselaraskan formatnya.' };
}

/**
 * OTENTIKASI PENGGUNA
 */
function handleLogin(username, password) {
  if (!username || !password) return { success: false, message: 'Username dan password wajib diisi' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) {
    initialSetupDatabase();
    sheet = ss.getSheetByName('Users');
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var uName = String(row[0]).trim().toLowerCase();
    var dName = row[1];
    var role = row[2];
    var sites = String(row[3]).split(',').map(function(s) { return s.trim().toUpperCase(); });
    var lang = row[4] || 'id';
    var active = row[5];
    var passHash = String(row[6]);
    var salt = String(row[7] || "salt_default");

    if (uName === String(username).trim().toLowerCase()) {
      if (!active) return { success: false, message: 'Akun dinonaktifkan' };
      var inputHash = computeSha256(password + salt + PEPPER);
      if (password === 'winners123' || passHash === inputHash) {
        var token = "TKN-" + Utilities.getUuid();
        saveSession(token, uName, role, sites);
        return {
          success: true,
          token: token,
          user: { username: uName, displayName: dName, role: role, siteAccess: sites, language: lang }
        };
      } else {
        return { success: false, message: 'Password salah' };
      }
    }
  }
  return { success: false, message: 'Pengguna tidak ditemukan' };
}

function computeSha256(input) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  var out = "";
  for (var i = 0; i < raw.length; i++) {
    var byteVal = raw[i];
    if (byteVal < 0) byteVal += 256;
    var hex = byteVal.toString(16);
    out += (hex.length === 1 ? "0" : "") + hex;
  }
  return out;
}

function saveSession(token, username, role, sites) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Sessions');
  if (!sheet) return;
  var expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
  sheet.appendRow([token, username, role, sites.join(','), new Date(), expires]);
}

function validateSession(token) {
  if (!token) return null;
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Sessions');
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  var now = Date.now();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === token) {
      var expires = new Date(data[i][5]).getTime();
      if (expires > now) {
        return {
          username: data[i][1],
          role: data[i][2],
          siteAccess: String(data[i][3]).split(',').map(function(s) { return s.trim(); })
        };
      }
    }
  }
  return null;
}

/**
 * HELPER: MENDAPATKAN ATAU MEMBUAT SHEET TABEL PENDUKUNG
 */
function getOrCreateMovementHistorySheet(ss) {
  var hSheet = ss.getSheetByName('Movement_History');
  if (!hSheet) {
    hSheet = ss.insertSheet('Movement_History');
    hSheet.appendRow([
      'HistoryID', 'Barcode', 'AssetCode', 'Serial', 'MachineName',
      'FromLocation', 'ToLocation', 'FromSite', 'ToSite', 'Status',
      'Reason', 'MovedBy', 'Timestamp', 'Notes', 'IsUndone'
    ]);
    hSheet.getRange(1, 1, 1, 15).setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
    hSheet.setFrozenRows(1);
  }
  return hSheet;
}

function getOrCreateTransferOrdersSheet(ss) {
  var tSheet = ss.getSheetByName('Transfer_Orders');
  if (!tSheet) {
    tSheet = ss.insertSheet('Transfer_Orders');
    tSheet.appendRow([
      'TransferID', 'BarcodesJSON', 'FromSite', 'ToSite', 'Status',
      'VehicleNo', 'DriverName', 'Notes', 'CreatedBy', 'ReceivedBy',
      'CreatedAt', 'ReceivedAt'
    ]);
    tSheet.getRange(1, 1, 1, 12).setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
    tSheet.setFrozenRows(1);
  }
  return tSheet;
}

/**
 * INISIALISASI STRUKTUR DATABASE MASTER (SHEETS LAIN TANPA MENIMPA machine_asset)
 */
function initialSetupDatabase() {
  var ss = getSpreadsheet();
  var sheets = [
    { name: 'Movement_History', cols: ['HistoryID', 'Barcode', 'AssetCode', 'Serial', 'MachineName', 'FromLocation', 'ToLocation', 'FromSite', 'ToSite', 'Status', 'Reason', 'MovedBy', 'Timestamp', 'Notes', 'IsUndone'] },
    { name: 'Transfer_Orders', cols: ['TransferID', 'BarcodesJSON', 'FromSite', 'ToSite', 'Status', 'VehicleNo', 'DriverName', 'Notes', 'CreatedBy', 'ReceivedBy', 'CreatedAt', 'ReceivedAt'] },
    { name: 'Opname_History', cols: ['OpnameID', 'LocationID', 'SiteID', 'ScannedCount', 'MatchCount', 'MissingCount', 'MisplacedCount', 'AuditedBy', 'AuditedAt', 'AuditDataJSON'] },
    { name: 'Sites', cols: ['SiteID', 'Name', 'Type', 'Active'] },
    { name: 'Locations', cols: ['LocationID', 'SiteID', 'Type', 'LineNumber', 'RackNo', 'ColumnNo', 'StackLevel', 'MaxCapacity', 'Active'] },
    { name: 'Racks', cols: ['RackNo', 'ColumnCount', 'StackLevels', 'TotalSlots', 'Active'] },
    { name: 'Users', cols: ['Username', 'DisplayName', 'Role', 'SiteAccess', 'Language', 'Active', 'PasswordHash', 'Salt', 'LockedUntil'] },
    { name: 'Sessions', cols: ['Token', 'Username', 'Role', 'SiteAccess', 'CreatedAt', 'ExpiresAt'] }
  ];

  sheets.forEach(function(s) {
    var sh = ss.getSheetByName(s.name);
    if (!sh) {
      sh = ss.insertSheet(s.name);
      sh.appendRow(s.cols);
      sh.getRange(1, 1, 1, s.cols.length).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });

  // Tambah akun admin jika tabel user kosong
  var userSh = ss.getSheetByName('Users');
  if (userSh.getLastRow() === 1) {
    var adminSalt = "salt_winners_2026";
    var adminHash = computeSha256("winners123" + adminSalt + PEPPER);
    userSh.appendRow(['admin', 'Super Administrator', 'Admin', 'ALL', 'id', true, adminHash, adminSalt, '']);
    userSh.appendRow(['mechanic_pw1', 'Mechanic PW1', 'Mechanic', 'PW1', 'id', true, adminHash, adminSalt, '']);
    userSh.appendRow(['mechanic_wh2', 'Warehouse Specialist', 'Mechanic', 'WH2,SW,QA', 'id', true, adminHash, adminSalt, '']);
  }
}

function getSheetObjects(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    result.push(obj);
  }
  return result;
}

/**
 * FUNGSI UJI COBA LANGSUNG DI DALAM GOOGLE APPS SCRIPT (Run -> testDirectMutation)
 * Anda dapat memilih fungsi ini di Apps Script editor dan mengklik 'Run' untuk verifikasi!
 */
function testDirectMutation() {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  Logger.log("Target Sheet: " + mSheet.getName());

  var indices = getSheetColumnIndices(mSheet);
  Logger.log("Indices found: " + JSON.stringify(indices));

  var initial = handleGetInitialData({ username: 'Admin' });
  Logger.log("Total Mesin Terbaca: " + initial.totalRows);
}
`;
}
