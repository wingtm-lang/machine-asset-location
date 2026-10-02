/**
 * Google Apps Script (Code.gs) Generator & Exporter
 * Standalone & Container-bound Code.gs for PT.WINNERS Machine Asset Location Tracker.
 */

export function generateGasCodeGs(spreadsheetId: string = '1-D87s2xI6ERVQydmP1Gbmj7XzqB5o7Ziib7mvKVhtio'): string {
  return `/**
 * ============================================================================
 * PT.WINNERS MACHINE ASSET LOCATION TRACKER - BACKEND CODE.gs
 * Target: Google Spreadsheet PT.WINNERS
 * 
 * FITUR UTAMA & KESELARASAN STRUKTUR TABEL:
 * 1. Menulis langsung mutasi ke kolom "Location ID", "Site ID", "Status",
 *    "Last Moved At", "Last Moved By", "Pending Transfer ID" pada sheet 'machine_asset'.
 * 2. Mencatat setiap riwayat pemindahan ke sheet 'Movement_History' secara otomatis.
 * 3. Mendukung fitur Undo Pemindahan (mengembalikan lokasi awal di sheet & menandai log).
 * 4. Mendukung alur Transfer Antar Site (Kirim -> In Transit -> Terima di sheet tujuan).
 * 5. Mendukung rekonsiliasi Stok Opname & pembaruan kolom "Last Opname At".
 * 6. Deteksi kolom dinamis: Script otomatis mencari indeks kolom berdasarkan nama header
 *    tanpa terpengaruh urutan kolom, dan otomatis membuat kolom tracking jika belum ada.
 * ============================================================================
 */

var SPREADSHEET_ID = "${spreadsheetId}";
var PEPPER = "PT_WINNERS_APP_SECRET_PEPPER_2026";
var SESSION_TTL_HOURS = 12;

function getSpreadsheet() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getMachineAssetSheet(ss) {
  var candidates = ['machine_asset', 'machine_assets', 'Machine_Asset', 'Machines', 'machines', 'Sheet1'];
  for (var i = 0; i < candidates.length; i++) {
    var sh = ss.getSheetByName(candidates[i]);
    if (sh) return sh;
  }
  return ss.getSheets()[0];
}

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
    '<p>Waktu Server: ' + new Date().toString() + '</p>' +
    '<hr>' +
    '<p style="font-size:12px;color:#64748b;">Endpoint ini melayani sinkronisasi data mesin, pemindahan lokasi, transfer antar site, dan audit stok opname.</p>' +
    '</div>'
  ).setTitle('PT.WINNERS Tracker API').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

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
    localName: findCol(['localname', 'namalokal', 'namamesinlokal', 'alias']),
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

function formatCurrentDateTime() {
  return Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
}

function nameKey(s) {
  return String(s || '').trim().toLowerCase().replace(/ +/g, ' ');
}

function getLocalNameMap() {
  var sh = getSpreadsheet().getSheetByName('Machine_Names');
  var map = {};
  if (!sh) return map;
  var d = sh.getDataRange().getValues();
  for (var i = 1; i < d.length; i++) {
    var k = nameKey(d[i][0]), v = String(d[i][1] || '').trim();
    if (k && v) map[k] = v;
  }
  return map;
}

// Prioritas: kolom per mesin > pemetaan nama standar > pemetaan nama item (Korea)
function resolveLocalName(map, own, stdName, item) {
  if (own) return own;
  return map[nameKey(stdName)] || map[nameKey(item)] || '';
}

// Jalankan sekali dari editor. Membuat sheet dan mengisi daftar tipe mesin unik.
function setupMachineNamesSheet() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('Machine_Names');
  if (!sh) {
    sh = ss.insertSheet('Machine_Names');
    sh.appendRow(['StandardName', 'LocalName']);
    sh.getRange(1, 1, 1, 2).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  var existing = {}, cur = sh.getDataRange().getValues();
  for (var i = 1; i < cur.length; i++) existing[nameKey(cur[i][0])] = true;

  var idx = getSheetColumnIndices(getMachineAssetSheet(ss));
  if (idx.standardMachineName === -1) throw new Error('Kolom nama mesin standar tidak ditemukan');
  var counts = {};
  for (var r = 1; r < idx.data.length; r++) {
    var n = String(idx.data[r][idx.standardMachineName] || '').trim();
    if (n) counts[n] = (counts[n] || 0) + 1;
  }
  var rows = Object.keys(counts).sort().filter(function (n) { return !existing[nameKey(n)]; })
    .map(function (n) { return [n, '']; });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
  Logger.log('Tipe mesin ditambahkan: ' + rows.length + '. Isi kolom LocalName di sheet Machine_Names.');
}

function handleGetInitialData(user) {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  if (!mSheet) {
    return { success: false, message: 'Sheet machine_asset tidak ditemukan di spreadsheet' };
  }

  var indices = getSheetColumnIndices(mSheet);
  indices = ensureTrackingColumns(mSheet, indices);
  var data = mSheet.getDataRange().getValues();

  var localMap = getLocalNameMap();
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
      localName: resolveLocalName(localMap,
        indices.localName !== -1 ? String(row[indices.localName] || '').trim() : '', mName, item),
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

  var rowIndex = findMachineRow(data, indices, targetAsset, targetBarcode, targetSerial);
  if (rowIndex === -1) {
    return { success: false, message: 'Mesin ' + (targetAsset || targetBarcode) + ' tidak ditemukan di sheet' };
  }

  // Validasi target rak WH2 jika lokasi mengarah ke slot rak
  if (targetLoc) {
    var rackErr = validateRackTarget(targetLoc, data, indices, rowIndex);
    if (rackErr) {
      return { success: false, message: rackErr };
    }
  }

  var currentRow = data[rowIndex - 1];
  var fromLoc = indices.locationId !== -1 ? String(currentRow[indices.locationId] || '') : 'UNKNOWN';
  var fromSite = indices.siteId !== -1 ? String(currentRow[indices.siteId] || '') : 'PW1';
  var currentSerial = indices.serial !== -1 ? String(currentRow[indices.serial] || '') : targetSerial;
  var currentName = indices.standardMachineName !== -1 ? String(currentRow[indices.standardMachineName] || '') : 'Sewing Machine';

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
    mSheet.getRange(rowIndex, indices.pendingTransferId + 1).setValue('');
  }

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
    false
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
  var originalLoc = record[5];
  var originalSite = record[7];

  var indices = getSheetColumnIndices(mSheet);
  var mData = mSheet.getDataRange().getValues();
  var mRow = findMachineRow(mData, indices, originalAsset, originalBarcode, '');

  var timestampStr = formatCurrentDateTime();

  if (mRow !== -1) {
    if (originalLoc) {
      var undoRackErr = validateRackTarget(originalLoc, mData, indices, mRow);
      if (undoRackErr) {
        return { success: false, message: 'Tidak dapat mengembalikan lokasi ke ' + originalLoc + ': ' + undoRackErr };
      }
    }
    if (indices.locationId !== -1) mSheet.getRange(mRow, indices.locationId + 1).setValue(originalLoc);
    if (indices.siteId !== -1 && originalSite) mSheet.getRange(mRow, indices.siteId + 1).setValue(originalSite);
    if (indices.lastMovedAt !== -1) mSheet.getRange(mRow, indices.lastMovedAt + 1).setValue(timestampStr);
    if (indices.lastMovedBy !== -1) mSheet.getRange(mRow, indices.lastMovedBy + 1).setValue(username + ' (UNDO)');
  }

  hSheet.getRange(targetHRow, 15).setValue(true);

  return {
    success: true,
    message: 'Undo berhasil: Mesin ' + (originalAsset || originalBarcode) + ' dikembalikan ke lokasi ' + originalLoc
  };
}

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

      if (indices.locationId !== -1) mSheet.getRange(mRow, indices.locationId + 1).setValue(toSite + '-IN_TRANSIT');
      if (indices.status !== -1) mSheet.getRange(mRow, indices.status + 1).setValue('IN_TRANSIT');
      if (indices.pendingTransferId !== -1) mSheet.getRange(mRow, indices.pendingTransferId + 1).setValue(transferId);
      if (indices.lastMovedAt !== -1) mSheet.getRange(mRow, indices.lastMovedAt + 1).setValue(timestampStr);
      if (indices.lastMovedBy !== -1) mSheet.getRange(mRow, indices.lastMovedBy + 1).setValue(sentBy);

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
    '',
    timestampStr,
    ''
  ]);

  return {
    success: true,
    transferId: transferId,
    updatedCount: updatedCount,
    message: updatedCount + ' mesin berhasil dikirim ke ' + toSite + ' (Status: In Transit)'
  };
}

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

  if (toLocationId && String(toLocationId).trim().toUpperCase().indexOf('WH2-R') === 0) {
    return { success: false, message: 'Terima ke WH2-UNASSIGNED dulu, lalu tempatkan di rak.' };
  }

  var indices = getSheetColumnIndices(mSheet);
  indices = ensureTrackingColumns(mSheet, indices);
  var mData = mSheet.getDataRange().getValues();

  var tData = tSheet.getDataRange().getValues();
  var machineList = [];

  for (var t = 1; t < tData.length; t++) {
    if (String(tData[t][0]) === String(transferId)) {
      if (!toSite) toSite = tData[t][3];
      try {
        machineList = JSON.parse(tData[t][1]);
      } catch (e) {
        machineList = [tData[t][1]];
      }

      tSheet.getRange(t + 1, 5).setValue('RECEIVED');
      tSheet.getRange(t + 1, 10).setValue(receivedBy);
      tSheet.getRange(t + 1, 12).setValue(timestampStr);
      break;
    }
  }

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

      if (indices.locationId !== -1) mSheet.getRange(mRow, indices.locationId + 1).setValue(toLocationId);
      if (indices.siteId !== -1 && toSite) mSheet.getRange(mRow, indices.siteId + 1).setValue(toSite);
      if (indices.status !== -1) mSheet.getRange(mRow, indices.status + 1).setValue('ACTIVE');
      if (indices.pendingTransferId !== -1) mSheet.getRange(mRow, indices.pendingTransferId + 1).setValue('');
      if (indices.lastMovedAt !== -1) mSheet.getRange(mRow, indices.lastMovedAt + 1).setValue(timestampStr);
      if (indices.lastMovedBy !== -1) mSheet.getRange(mRow, indices.lastMovedBy + 1).setValue(receivedBy);

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

function handleCancelTransfer(user, params) {
  params = params || {};
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  var tSheet = getOrCreateTransferOrdersSheet(ss);
  var hSheet = getOrCreateMovementHistorySheet(ss);

  var transferId = String(params.transferId || '').trim();
  var oneAsset = String(params.assetCode || '').trim();
  var username = (user && user.username) ? user.username : (params.username || 'Admin');
  var ts = formatCurrentDateTime();

  var indices = getSheetColumnIndices(mSheet);
  indices = ensureTrackingColumns(mSheet, indices);
  var mData = mSheet.getDataRange().getValues();
  var hData = hSheet.getDataRange().getValues();
  var tData = tSheet.getDataRange().getValues();

  // 1) Cari order transfer yang masih IN_TRANSIT (lewat ID atau kode aset)
  var orderRow = -1, orderList = [];
  for (var t = tData.length - 1; t >= 1; t--) {
    if (String(tData[t][4]).toUpperCase() !== 'IN_TRANSIT') continue;
    var list = [];
    try { list = JSON.parse(tData[t][1]); } catch (e) { list = [tData[t][1]]; }
    var idHit = transferId && String(tData[t][0]) === transferId;
    var assetHit = oneAsset && list.some(function (x) {
      return String(x).toUpperCase() === oneAsset.toUpperCase();
    });
    if (idHit || assetHit) { orderRow = t + 1; orderList = list; break; }
  }

  var targets = oneAsset ? [oneAsset] : orderList.slice();
  if (!targets.length) {
    return { success: false, message: 'Transfer tidak ditemukan, sudah diterima, atau sudah dibatalkan.' };
  }

  var cancelled = [], keys = [], skipped = [], fallbacks = [];

  for (var i = 0; i < targets.length; i++) {
    var target = targets[i];
    var mRow = findMachineRow(mData, indices, target, target, '');
    if (mRow === -1) { skipped.push(target + ' (tidak ditemukan)'); continue; }

    var row = mData[mRow - 1];
    var asset = indices.assetCode !== -1 ? String(row[indices.assetCode] || '').trim() : String(target);
    var barcode = indices.barcode !== -1 ? String(row[indices.barcode] || '').trim() : '';
    var curStatus = indices.status !== -1 ? String(row[indices.status] || '').trim().toUpperCase() : '';
    var pending = indices.pendingTransferId !== -1 ? String(row[indices.pendingTransferId] || '').trim() : '';
    var curLoc = indices.locationId !== -1 ? String(row[indices.locationId] || '').trim() : '';

    if (curStatus.indexOf('TRANSIT') === -1 && !pending) {
      skipped.push(asset + ' (tidak sedang In Transit)');
      continue;
    }

    // 2) Cari baris pengiriman terakhir di Movement_History (asal + status lama)
    var origin = null;
    for (var h = hData.length - 1; h >= 1; h--) {
      if (String(hData[h][2]).trim().toUpperCase() === asset.toUpperCase() &&
          String(hData[h][6]).toUpperCase().indexOf('-IN_TRANSIT') !== -1) {
        origin = {
          loc: String(hData[h][5] || '').trim(),
          site: String(hData[h][7] || '').trim().toUpperCase(),
          status: String(hData[h][15] || '').trim()
        };
        break;
      }
    }

    var orderFrom = orderRow !== -1 ? String(tData[orderRow - 1][2] || '').trim().toUpperCase() : '';
    var orderTo = orderRow !== -1 ? String(tData[orderRow - 1][3] || '').trim().toUpperCase() : '';
    var restoreLoc, restoreSite, restoreStatus;

    if (origin && origin.loc) {
      restoreLoc = origin.loc;
      restoreSite = origin.site || siteOfLocation(origin.loc);
      restoreStatus = origin.status || 'ACTIVE';
    } else {
      restoreSite = orderFrom || (indices.siteId !== -1 ? String(row[indices.siteId] || '').trim().toUpperCase() : 'PW1');
      restoreLoc = restoreSite + '-UNASSIGNED';
      restoreStatus = 'ACTIVE';
      fallbacks.push(asset + ' (riwayat pengiriman tidak ditemukan)');
    }

    // 3) Hanya pengirim dari site asal (atau admin / all sites) yang boleh membatalkan
    if (restoreSite && !hasSite(user, restoreSite)) {
      skipped.push(asset + ' (di luar akses site asal ' + restoreSite + ')');
      continue;
    }

    // 4) Slot rak lama sudah terisi mesin lain -> jatuhkan ke UNASSIGNED
    if (validateRackTarget(restoreLoc, mData, indices, mRow)) {
      restoreLoc = restoreSite + '-UNASSIGNED';
      fallbacks.push(asset + ' (slot lama sudah terisi)');
    }

    // 5) Tulis ke sheet mesin
    if (indices.locationId !== -1) mSheet.getRange(mRow, indices.locationId + 1).setValue(restoreLoc);
    if (indices.siteId !== -1 && restoreSite) mSheet.getRange(mRow, indices.siteId + 1).setValue(restoreSite);
    if (indices.status !== -1) mSheet.getRange(mRow, indices.status + 1).setValue(restoreStatus);
    if (indices.pendingTransferId !== -1) mSheet.getRange(mRow, indices.pendingTransferId + 1).setValue('');
    if (indices.lastMovedAt !== -1) mSheet.getRange(mRow, indices.lastMovedAt + 1).setValue(ts);
    if (indices.lastMovedBy !== -1) mSheet.getRange(mRow, indices.lastMovedBy + 1).setValue(username);

    // Perbarui salinan memori agar validasi rak untuk mesin berikutnya akurat
    if (indices.locationId !== -1) row[indices.locationId] = restoreLoc;

    // 6) Catat riwayat
    hSheet.appendRow([
      'MOV-' + Date.now() + '-' + (i + 1),
      barcode,
      asset,
      indices.serial !== -1 ? row[indices.serial] : '',
      indices.standardMachineName !== -1 ? row[indices.standardMachineName] : '',
      curLoc,
      restoreLoc,
      siteOfLocation(curLoc) || orderTo,
      restoreSite,
      restoreStatus,
      'Transfer dibatalkan oleh ' + username,
      username,
      ts,
      'Pembatalan transfer ' + (orderRow !== -1 ? tData[orderRow - 1][0] : transferId),
      false,
      ''
    ]);

    cancelled.push(asset);
    keys.push(asset.toUpperCase());
    if (barcode) keys.push(barcode.toUpperCase());
  }

  if (!cancelled.length) {
    return { success: false, message: 'Tidak ada mesin yang dibatalkan. ' + skipped.join('; ') };
  }

  // 7) Keluarkan mesin yang dibatalkan dari daftar order; tutup order bila kosong
  if (orderRow !== -1) {
    var remaining = orderList.filter(function (x) {
      return keys.indexOf(String(x).toUpperCase()) === -1;
    });
    tSheet.getRange(orderRow, 2).setValue(JSON.stringify(remaining));
    var oldNote = String(tData[orderRow - 1][7] || '');
    tSheet.getRange(orderRow, 8).setValue(
      (oldNote ? oldNote + ' | ' : '') + 'Dibatalkan oleh ' + username + ': ' + cancelled.join(', ')
    );
    if (remaining.length === 0) tSheet.getRange(orderRow, 5).setValue('CANCELLED');
  }

  var msg = cancelled.length + ' mesin dikembalikan ke lokasi asal';
  if (fallbacks.length) msg += '. Dikembalikan ke UNASSIGNED: ' + fallbacks.join('; ');
  if (skipped.length) msg += '. Dilewati: ' + skipped.join('; ');
  return { success: true, message: msg, cancelled: cancelled };
}

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

function handleSearchMachine(user, query) {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  var indices = getSheetColumnIndices(mSheet);
  var data = mSheet.getDataRange().getValues();
  var q = String(query).trim().toUpperCase();

  var rowIndex = findMachineRow(data, indices, q, q, q);
  if (rowIndex !== -1) {
    var row = data[rowIndex - 1];
    var lm = getLocalNameMap();
    var own = indices.localName !== -1 ? String(row[indices.localName] || '').trim() : '';
    var sName = indices.standardMachineName !== -1 ? String(row[indices.standardMachineName] || '').trim() : '';
    var sItem = indices.item !== -1 ? String(row[indices.item] || '').trim() : '';

    return {
      success: true,
      machine: {
        assetCode: indices.assetCode !== -1 ? row[indices.assetCode] : '',
        barcode: indices.barcode !== -1 ? row[indices.barcode] : '',
        serial: indices.serial !== -1 ? row[indices.serial] : '',
        standardMachineName: indices.standardMachineName !== -1 ? row[indices.standardMachineName] : '',
        localName: resolveLocalName(lm, own, sName, sItem),
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

function computeSha256(input) {
  if (input === null || typeof input === 'undefined') input = "";
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(input), Utilities.Charset.UTF_8);
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

function testDirectMutation() {
  var ss = getSpreadsheet();
  var mSheet = getMachineAssetSheet(ss);
  Logger.log("Target Sheet: " + mSheet.getName());

  var indices = getSheetColumnIndices(mSheet);
  Logger.log("Indices found: " + JSON.stringify(indices));

  var initial = handleGetInitialData({ username: 'Admin' });
  Logger.log("Total Mesin Terbaca: " + initial.totalRows);
}

// ============================================================================
// FITUR MAPPING POSISI MESIN DI RAK (khusus site WH2)
// Format Location ID: WH2-{RAK}-{TINGKAT}{KOLOM}-S{SLOT}
// Contoh: WH2-R4-B12-S2 = rak R4, tingkat B, kolom 12, slot 2
// ============================================================================

var RACK_SITE = 'WH2';
var RACK_MAX_COL = { R1: 32, R2: 28, R3: 28, R4: 26, R5: 15, R6: 15 };
var RACK_LEVELS = ['A', 'B', 'C'];
var RACK_MAX_SLOT = 3;

function parseRackLoc(loc) {
  if (!loc) return null;
  var re = /^WH2-(R[1-6])-([ABC])(\d+)-S([1-3])$/i;
  var m = re.exec(String(loc).trim());
  if (!m) return null;
  var rak = m[1].toUpperCase();
  var tingkat = m[2].toUpperCase();
  var kolom = Number(m[3]);
  var slot = Number(m[4]);
  return {
    rak: rak,
    tingkat: tingkat,
    kolom: kolom,
    slot: slot,
    locationId: 'WH2-' + rak + '-' + tingkat + kolom + '-S' + slot
  };
}

function validateRackTarget(loc, data, idx, excludeRow) {
  if (!loc) return null;
  var strLoc = String(loc).trim();
  if (strLoc.toUpperCase().indexOf('WH2-R') !== 0) {
    return null; // Bukan lokasi slot rak (mis. WH2-UNASSIGNED atau site lain)
  }

  var parsed = parseRackLoc(strLoc);
  if (!parsed) {
    return 'Format lokasi rak salah: "' + strLoc + '". Format yang valid: WH2-R[1-6]-[A-C][kolom]-S[1-3] (contoh: WH2-R4-B12-S2)';
  }

  var maxCol = RACK_MAX_COL[parsed.rak];
  if (!maxCol) {
    return 'Rak tidak valid: ' + parsed.rak;
  }
  if (parsed.kolom < 1 || parsed.kolom > maxCol) {
    return 'Kolom ' + parsed.kolom + ' di luar rentang rak ' + parsed.rak + ' (1-' + maxCol + ')';
  }
  if (parsed.slot < 1 || parsed.slot > RACK_MAX_SLOT) {
    return 'Slot tidak valid (harus 1-' + RACK_MAX_SLOT + ')';
  }

  // Cek duplikasi slot terisi di data sheet
  if (idx && idx.locationId !== -1 && data) {
    var targetUpper = parsed.locationId.toUpperCase();
    for (var r = 1; r < data.length; r++) {
      if (excludeRow && (r + 1) === excludeRow) continue;
      var curLoc = String(data[r][idx.locationId] || '').trim().toUpperCase();
      if (curLoc === targetUpper) {
        var occupant = idx.assetCode !== -1 ? String(data[r][idx.assetCode] || '').trim() : ('baris ' + (r + 1));
        return 'Slot ' + parsed.locationId + ' sudah dipakai mesin ' + occupant;
      }
    }
  }

  return null;
}

function handleGetRackMap(user, params) {
  var sh = getMachineAssetSheet(getSpreadsheet());
  var idx = getSheetColumnIndices(sh);
  var data = idx.data;

  if (idx.locationId === -1) {
    return { success: false, message: 'Kolom Location ID tidak ditemukan', slots: [], issues: [] };
  }

  var slots = [];
  var issues = [];
  var seenSlots = {};
  var lm = getLocalNameMap();
  function cell(r, col) {
    return col !== -1 ? String(data[r][col] || '').trim() : '';
  }

  for (var r = 1; r < data.length; r++) {
    var loc = String(data[r][idx.locationId] || '').trim();
    if (!loc || loc.toUpperCase().indexOf('WH2-R') !== 0) continue;

    var aCode = idx.assetCode !== -1 ? String(data[r][idx.assetCode] || '').trim() : '';
    var bCode = idx.barcode !== -1 ? String(data[r][idx.barcode] || '').trim() : '';
    var sNum = idx.serial !== -1 ? String(data[r][idx.serial] || '').trim() : '';
    var mName = idx.standardMachineName !== -1 ? String(data[r][idx.standardMachineName] || '').trim() : '';
    var model = idx.model !== -1 ? String(data[r][idx.model] || '').trim() : '';
    var rawStatus = idx.status !== -1 ? String(data[r][idx.status] || '').trim().toUpperCase() : 'ACTIVE';

    var parsed = parseRackLoc(loc);
    if (!parsed) {
      issues.push({
        row: r + 1,
        assetCode: aCode,
        locationId: loc,
        problem: 'FORMAT_TIDAK_VALID'
      });
      continue;
    }

    var maxCol = RACK_MAX_COL[parsed.rak];
    if (!maxCol || parsed.kolom < 1 || parsed.kolom > maxCol) {
      issues.push({
        row: r + 1,
        assetCode: aCode,
        locationId: loc,
        problem: 'KOLOM_DILUAR_RENTANG'
      });
      continue;
    }

    var normId = parsed.locationId;
    if (seenSlots[normId]) {
      issues.push({
        row: r + 1,
        assetCode: aCode,
        locationId: loc,
        problem: 'DUPLIKAT_SLOT'
      });
      continue;
    }

    seenSlots[normId] = true;
    slots.push({
      assetCode: aCode,
      barcode: bCode,
      serial: sNum,
      name: mName,
      localName: resolveLocalName(lm, cell(r, idx.localName), cell(r, idx.standardMachineName), cell(r, idx.item)),
      model: model,
      status: rawStatus || 'ACTIVE',
      site: RACK_SITE,
      rak: parsed.rak,
      tingkat: parsed.tingkat,
      kolom: parsed.kolom,
      slot: parsed.slot
    });
  }

  return {
    success: true,
    total: slots.length,
    slots: slots,
    issues: issues
  };
}

function handleAssignRackSlot(user, params) {
  params = params || {};

  var reqSite = String(params.siteId || RACK_SITE).trim().toUpperCase();
  if (reqSite !== RACK_SITE) {
    return { success: false, message: 'Fitur rak hanya berlaku untuk site ' + RACK_SITE };
  }

  var rak = String(params.rak || '').trim().toUpperCase();
  var tingkat = String(params.tingkat || '').trim().toUpperCase();
  var kolom = Number(params.kolom);
  var slot = Number(params.slot);

  var targetLoc = RACK_SITE + '-' + rak + '-' + tingkat + kolom + '-S' + slot;

  var sh = getMachineAssetSheet(getSpreadsheet());
  var idx = getSheetColumnIndices(sh);
  var data = idx.data;

  var qAsset = String(params.assetCode || '').trim();
  var qBarcode = String(params.barcode || '').trim();
  var qSerial = String(params.serial || '').trim();
  if (!qAsset && !qBarcode && !qSerial) {
    return { success: false, message: 'Kode aset / barcode / serial wajib diisi' };
  }

  var rowIndex = findMachineRow(data, idx, qAsset, qBarcode, qSerial);
  if (rowIndex === -1) {
    return { success: false, message: 'Mesin ' + (qAsset || qBarcode || qSerial) + ' tidak ditemukan' };
  }

  var machineRow = data[rowIndex - 1];
  var machineAsset = idx.assetCode !== -1 ? String(machineRow[idx.assetCode] || '').trim() : qAsset;
  var currentLoc = idx.locationId !== -1 ? String(machineRow[idx.locationId] || '').trim() : '';
  var rawStatus = idx.status !== -1 ? String(machineRow[idx.status] || '').trim().toUpperCase() : 'ACTIVE';
  var pending = idx.pendingTransferId !== -1 ? String(machineRow[idx.pendingTransferId] || '').trim() : '';

  if (currentLoc.toUpperCase().indexOf(RACK_SITE) !== 0) {
    return { success: false, message: 'Mesin ' + machineAsset + ' berada di lokasi ' + currentLoc + ', bukan di ' + RACK_SITE };
  }
  if (rawStatus.indexOf('SOLD') !== -1) {
    return { success: false, message: 'Mesin ' + machineAsset + ' berstatus SOLD dan tidak bisa ditempatkan' };
  }
  if (pending) {
    return { success: false, message: 'Mesin ' + machineAsset + ' sedang dalam proses transfer (' + pending + ')' };
  }
  if (currentLoc.toUpperCase() === targetLoc.toUpperCase()) {
    return { success: false, message: 'Mesin ' + machineAsset + ' sudah berada di slot ini' };
  }

  var validateErr = validateRackTarget(targetLoc, data, idx, rowIndex);
  if (validateErr) {
    return { success: false, message: validateErr };
  }

  var moveParams = {
    assetCode: machineAsset,
    locationId: targetLoc,
    siteId: RACK_SITE,
    reason: params.reason || ('Penempatan di rak ' + targetLoc),
    byUser: params.byUser || (user && user.username) || 'Admin'
  };
  var result = handleMoveMachine(user, moveParams);

  if (result && result.success) {
    result.rak = rak;
    result.tingkat = tingkat;
    result.kolom = kolom;
    result.slot = slot;
    result.locationId = targetLoc;
  }
  return result;
}

function auditRackLocations() {
  var sh = getMachineAssetSheet(getSpreadsheet());
  var idx = getSheetColumnIndices(sh);
  var data = idx.data;
  var report = {
    totalWh2Rows: 0,
    validSlots: 0,
    legacyCount: 0,
    invalidCount: 0,
    duplicateCount: 0,
    issues: []
  };

  var seen = {};
  var legacyRe = /^WH2-(R[1-6])-(\d+)([ABC])$/i; // e.g. WH2-R1-1A

  for (var r = 1; r < data.length; r++) {
    var loc = String(data[r][idx.locationId] || '').trim();
    if (!loc || loc.toUpperCase().indexOf('WH2-R') !== 0) continue;
    report.totalWh2Rows++;

    var aCode = idx.assetCode !== -1 ? String(data[r][idx.assetCode] || '').trim() : '';
    var parsed = parseRackLoc(loc);

    if (parsed) {
      var maxCol = RACK_MAX_COL[parsed.rak];
      if (parsed.kolom < 1 || parsed.kolom > maxCol) {
        report.invalidCount++;
        report.issues.push({ row: r + 1, assetCode: aCode, locationId: loc, problem: 'KOLOM_DILUAR_RENTANG' });
      } else if (seen[parsed.locationId]) {
        report.duplicateCount++;
        report.issues.push({ row: r + 1, assetCode: aCode, locationId: loc, problem: 'DUPLIKAT_SLOT' });
      } else {
        seen[parsed.locationId] = true;
        report.validSlots++;
      }
    } else {
      var legM = legacyRe.exec(loc);
      if (legM) {
        report.legacyCount++;
        report.issues.push({ row: r + 1, assetCode: aCode, locationId: loc, problem: 'FORMAT_LEGACY' });
      } else {
        report.invalidCount++;
        report.issues.push({ row: r + 1, assetCode: aCode, locationId: loc, problem: 'FORMAT_TIDAK_VALID' });
      }
    }
  }

  Logger.log("=== AUDIT RACK LOCATIONS REPORT ===");
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

function migrateRackDryRun() {
  var sh = getMachineAssetSheet(getSpreadsheet());
  var idx = getSheetColumnIndices(sh);
  var data = idx.data;

  var occupied = {};
  for (var r = 1; r < data.length; r++) {
    var loc = String(data[r][idx.locationId] || '').trim();
    var p = parseRackLoc(loc);
    if (p) occupied[p.locationId.toUpperCase()] = true;
  }

  var legacyRe = /^WH2-(R[1-6])-(\d+)([ABC])$/i; // WH2-R1-1A
  var plans = [];

  for (var r = 1; r < data.length; r++) {
    var loc = String(data[r][idx.locationId] || '').trim();
    var m = legacyRe.exec(loc);
    if (!m) continue;

    var rak = m[1].toUpperCase();
    var col = Number(m[2]);
    var level = m[3].toUpperCase();
    var aCode = idx.assetCode !== -1 ? String(data[r][idx.assetCode] || '').trim() : '';

    var assignedLoc = null;
    for (var s = 1; s <= 3; s++) {
      var candidate = 'WH2-' + rak + '-' + level + col + '-S' + s;
      if (!occupied[candidate.toUpperCase()]) {
        assignedLoc = candidate;
        occupied[candidate.toUpperCase()] = true;
        break;
      }
    }

    if (assignedLoc) {
      plans.push({
        row: r + 1,
        assetCode: aCode,
        from: loc,
        to: assignedLoc
      });
    } else {
      plans.push({
        row: r + 1,
        assetCode: aCode,
        from: loc,
        to: 'WH2-UNASSIGNED',
        note: 'Kolom ' + rak + '-' + level + col + ' sudah penuh (3 slot terisi)'
      });
    }
  }

  Logger.log("=== MIGRATE RACK DRY RUN (" + plans.length + " planned) ===");
  plans.forEach(function(p) {
    Logger.log("Baris " + p.row + " (" + p.assetCode + "): " + p.from + " -> " + p.to);
  });
  return { plannedMigrations: plans.length, plans: plans };
}

function migrateRackApply() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var sh = getMachineAssetSheet(getSpreadsheet());
    var idx = getSheetColumnIndices(sh);

    var dry = migrateRackDryRun();
    var plans = dry.plans || [];
    var appliedCount = 0;

    for (var i = 0; i < plans.length; i++) {
      var p = plans[i];
      sh.getRange(p.row, idx.locationId + 1).setValue(p.to);
      appliedCount++;
    }

    Logger.log("=== MIGRATE RACK APPLY SUCCESS (" + appliedCount + " updated) ===");
    return { success: true, appliedCount: appliedCount, message: appliedCount + ' lokasi rak legacy berhasil dimigrasi ke format baru.' };
  } catch (err) {
    return { success: false, message: 'Gagal migrasi rak: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// AUTENTIKASI & OTORISASI - sheet "user" (NIK | PASSWORD | PROFILE | AUTHORITY)
// ============================================================================
var ALL_SITES = ['PW1', 'PW2', 'PW3', 'WH2', 'SW', 'QA'];
var MAX_FAIL = 5;
var LOCK_SECONDS = 600;

// ---------- Pengaman password ----------
function getPepper() {
  var prop = PropertiesService.getScriptProperties().getProperty('PEPPER');
  return prop || PEPPER || 'PT_WINNERS_APP_SECRET_PEPPER_2026';
}

function hashPassword(pw, nik) {
  var cleanNik = String(nik || '').trim().toLowerCase();
  var cleanPw = String(pw || '');
  return 'h1$' + computeSha256(cleanNik + ':' + cleanPw + ':' + getPepper());
}

function verifyPassword(stored, input, nik) {
  stored = String(stored || '').trim();
  input = String(input || '');
  var cleanNik = String(nik || '').trim().toLowerCase();
  var rawNik = String(nik || '').trim();
  var pep = getPepper();
  if (!stored || !input) return false;

  // 1. Direct plaintext match & exact comparison
  if (stored === input || stored.trim() === input.trim()) {
    return true;
  }

  // 2. Format hash h1$ (h1$ + SHA256)
  if (stored.toLowerCase().indexOf('h1$') === 0) {
    var storedLower = stored.toLowerCase();
    var h1Clean = ('h1$' + computeSha256(cleanNik + ':' + input + ':' + pep)).toLowerCase();
    var h1Raw = ('h1$' + computeSha256(rawNik + ':' + input + ':' + pep)).toLowerCase();
    var h1Rev = ('h1$' + computeSha256(input + ':' + cleanNik + ':' + pep)).toLowerCase();
    var h1NoNik = ('h1$' + computeSha256(input + ':' + pep)).toLowerCase();
    var h1Direct = ('h1$' + computeSha256(cleanNik + ':' + input.trim() + ':' + pep)).toLowerCase();

    if (
      storedLower === h1Clean ||
      storedLower === h1Raw ||
      storedLower === h1Rev ||
      storedLower === h1NoNik ||
      storedLower === h1Direct
    ) {
      return true;
    }
  }

  // 3. Format 64-hex karakter SHA-256 hash
  var storedHexLower = stored.toLowerCase();
  var cleanInputHash = computeSha256(cleanNik + ':' + input + ':' + pep).toLowerCase();
  var rawInputHash = computeSha256(rawNik + ':' + input + ':' + pep).toLowerCase();
  var directHash = computeSha256(input + pep).toLowerCase();
  var pureHash = computeSha256(input).toLowerCase();

  if (
    storedHexLower === cleanInputHash ||
    storedHexLower === rawInputHash ||
    storedHexLower === directHash ||
    storedHexLower === pureHash
  ) {
    return true;
  }

  return false;
}

// ---------- Sheet user ----------
function getUserSheet() {
  var ss = getSpreadsheet();
  var sheets = ss.getSheets();
  var candidates = ['user', 'users', 'pengguna', 'daftar_user', 'users_list', 'akun', 'account', 'accounts', 'sheet_user', 'data_user', 'master_user'];
  for (var i = 0; i < sheets.length; i++) {
    var n = sheets[i].getName().toLowerCase().replace(/[^a-z0-9]/g, '');
    for (var j = 0; j < candidates.length; j++) {
      if (n === candidates[j]) return sheets[i];
    }
  }
  // Cek sheet yang mengandung kata 'user' atau 'pengguna'
  for (var i = 0; i < sheets.length; i++) {
    var n = sheets[i].getName().toLowerCase();
    if (n.indexOf('user') !== -1 || n.indexOf('pengguna') !== -1 || n.indexOf('akun') !== -1) {
      return sheets[i];
    }
  }

  // Jika belum ada, otomatis buat sheet 'user' dengan header standar
  var newSh = ss.insertSheet('user');
  newSh.appendRow(['NIK', 'PASSWORD', 'PROFILE', 'AUTHORITY', 'ACTIVE']);
  newSh.getRange(1, 1, 1, 5).setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
  newSh.appendRow(['admin', hashPassword('winners123', 'admin'), 'Super Administrator', 'admin master', true]);
  newSh.getRange(2, 1).setNumberFormat('@');
  return newSh;
}

function getUserCols(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    return { nik: 0, password: 1, profile: 2, authority: 3, active: 4, width: 5 };
  }
  var head = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, ''); });

  var findIndex = function(terms, defaultIdx) {
    for (var i = 0; i < terms.length; i++) {
      var cleanTerm = terms[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      var idx = head.indexOf(cleanTerm);
      if (idx !== -1) return idx;
    }
    return defaultIdx;
  };

  return {
    nik: findIndex(['nik', 'username', 'userid', 'id', 'noinduk', 'nomorinduk', 'nip', 'user'], 0),
    password: findIndex(['password', 'passwordhash', 'pass', 'katasandi', 'hash', 'pwd'], 1),
    profile: findIndex(['profile', 'displayname', 'nama', 'namalengkap', 'name', 'fullname', 'username'], 2),
    authority: findIndex(['authority', 'role', 'hakakses', 'otoritas', 'akses', 'level', 'jabatan'], 3),
    active: findIndex(['active', 'status', 'aktif', 'isactive', 'enabled'], -1),
    width: Math.max(head.length, 5)
  };
}

function parseAuthority(a) {
  var s = String(a || '').toLowerCase().replace(/\\s+/g, '');
  if (s === 'adminmaster' || s === 'admin' || s === 'administrator' || s === 'superadmin' || s === 'admin_master' || s === 'master') {
    return { role: 'ADMIN_MASTER', sites: ALL_SITES.slice() };
  }
  if (s === 'allsites' || s === 'all' || s === 'semuasite' || s === 'all_sites' || s === 'semuapabrik') {
    return { role: 'ALL_SITES', sites: ALL_SITES.slice() };
  }
  var m = s.match(/(?:pt\\.?winners|pw|factory|pabrik)?\\(?([1-3])\\)?/);
  if (m && m[1]) {
    return { role: 'FACTORY', sites: ['PW' + m[1]], factory: m[1] };
  }
  if (s.indexOf('1') > -1) return { role: 'FACTORY', sites: ['PW1'], factory: '1' };
  if (s.indexOf('2') > -1) return { role: 'FACTORY', sites: ['PW2'], factory: '2' };
  if (s.indexOf('3') > -1) return { role: 'FACTORY', sites: ['PW3'], factory: '3' };
  return { role: 'FACTORY', sites: ['PW1'], factory: '1' };
}

function canonicalAuthority(a) {
  var p = parseAuthority(a);
  if (!p) return 'PW1';
  if (p.role === 'ADMIN_MASTER') return 'admin master';
  if (p.role === 'ALL_SITES') return 'All sites';
  return 'PT.Winners(' + p.factory + ')';
}

function ensureSessionsSheet() {
  var ss = getSpreadsheet(), sh = ss.getSheetByName('Sessions');
  if (!sh) {
    sh = ss.insertSheet('Sessions');
    sh.appendRow(['Token', 'Username', 'Role', 'SiteAccess', 'CreatedAt', 'ExpiresAt']);
  }
  return sh;
}

// ---------- LOGIN ----------
function handleLogin(username, password) {
  username = String(username || '').trim();
  password = String(password || '');
  if (!username || !password) return { success: false, message: 'NIK dan password wajib diisi' };

  var cache = CacheService.getScriptCache();
  var key = 'fail_' + username.toLowerCase();
  var fails = parseInt(cache.get(key) || '0', 10);
  if (fails >= MAX_FAIL) {
    return { success: false, message: 'Terlalu banyak percobaan gagal. Coba lagi dalam 10 menit.' };
  }

  var sh = getUserSheet();
  if (!sh) return { success: false, message: 'Sheet "user" tidak ditemukan' };
  var c = getUserCols(sh);
  if (c.nik < 0 || c.password < 0 || c.authority < 0) {
    return { success: false, message: 'Header sheet user harus: NIK, PASSWORD, PROFILE, AUTHORITY' };
  }

  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[c.nik]).trim().toLowerCase() !== username.toLowerCase()) continue;

    if (c.active > -1 &&
        ['false', 'no', '0', 'nonaktif'].indexOf(String(row[c.active]).trim().toLowerCase()) > -1) {
      return { success: false, message: 'Akun dinonaktifkan' };
    }
    if (verifyPassword(row[c.password], password, username)) {
      var auth = parseAuthority(row[c.authority]);
      if (!auth) return { success: false, message: 'Authority akun tidak dikenali. Hubungi admin.' };

      cache.remove(key);
      var nik = String(row[c.nik]).trim();
      var token = 'TKN-' + Utilities.getUuid();
      ensureSessionsSheet();
      saveSession(token, nik, auth.role, auth.sites);
      return {
        success: true,
        token: token,
        user: {
          username: nik,
          displayName: c.profile > -1 ? String(row[c.profile]) : nik,
          role: auth.role,
          siteAccess: auth.sites,
          canAddUser: auth.role === 'ADMIN_MASTER',
          canUseRackMap: auth.sites.indexOf('WH2') > -1
        }
      };
    }
  }
  cache.put(key, String(fails + 1), LOCK_SECONDS);
  return { success: false, message: 'NIK atau password salah' };
}

// ---------- Manajemen user ----------
function handleAddUser(user, p) {
  var nik = String(p.nik || '').trim();
  var pw = String(p.password || '');
  var profile = String(p.profile || '').trim();
  var auth = canonicalAuthority(p.authority);

  if (!/^[A-Za-z0-9._-]{3,20}$/.test(nik)) return { success: false, message: 'NIK harus 3-20 karakter (huruf/angka)' };
  if (pw.length < 6) return { success: false, message: 'Password minimal 6 karakter' };
  if (!profile) return { success: false, message: 'Nama (profile) wajib diisi' };
  if (!auth) return { success: false, message: 'Authority tidak valid (admin master / all sites / PW1 / PW2 / PW3)' };

  var sh = getUserSheet();
  if (!sh) return { success: false, message: 'Sheet "user" tidak ditemukan' };
  var c = getUserCols(sh);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][c.nik]).trim().toLowerCase() === nik.toLowerCase()) {
      return { success: false, message: 'NIK ' + nik + ' sudah terdaftar' };
    }
  }
  var row = [];
  for (var k = 0; k < c.width; k++) row.push('');
  row[c.nik] = nik;
  row[c.password] = hashPassword(pw, nik);
  row[c.profile] = profile;
  row[c.authority] = auth;
  if (c.active > -1) row[c.active] = true;
  sh.appendRow(row);
  sh.getRange(sh.getLastRow(), c.nik + 1).setNumberFormat('@').setValue(nik);
  return { success: true, message: 'User ' + nik + ' (' + profile + ') berhasil ditambahkan' };
}

function handleListUsers(user) {
  var sh = getUserSheet();
  if (!sh) return { success: false, message: 'Sheet "user" tidak ditemukan' };
  var c = getUserCols(sh), data = sh.getDataRange().getValues(), out = [];
  for (var i = 1; i < data.length; i++) {
    var rawNik = String(data[i][c.nik] || '').trim();
    if (!rawNik) continue;
    var rawProfile = c.profile > -1 ? String(data[i][c.profile] || '').trim() : '';
    var rawAuth = String(data[i][c.authority] || 'PW1').trim();
    var rawActive = c.active > -1 ? (data[i][c.active] === true || String(data[i][c.active]).toLowerCase() === 'true' || data[i][c.active] === 1 || data[i][c.active] === '1') : true;

    var authLower = rawAuth.toLowerCase();
    var serverRole = 'UNKNOWN';
    var sites = [];
    var rackMap = false;
    var canAdd = false;

    if (authLower === 'admin master' || authLower === 'admin' || authLower === 'administrator') {
      serverRole = 'ADMIN_MASTER';
      sites = ['PW1', 'PW2', 'PW3', 'WH2', 'SW', 'QA'];
      rackMap = true;
      canAdd = true;
    } else if (authLower === 'all sites' || authLower === 'all') {
      serverRole = 'ALL_SITES';
      sites = ['PW1', 'PW2', 'PW3', 'WH2', 'SW', 'QA'];
      rackMap = true;
      canAdd = false;
    } else if (['PW1', 'PW2', 'PW3'].indexOf(rawAuth.toUpperCase()) > -1) {
      serverRole = 'FACTORY';
      sites = [rawAuth.toUpperCase()];
      rackMap = false;
      canAdd = false;
    }

    out.push({
      nik: rawNik,
      profile: rawProfile,
      authority: rawAuth,
      role: serverRole,
      sites: sites,
      rackMap: rackMap,
      canAddUser: canAdd,
      active: rawActive
    });
  }
  return { success: true, users: out };
}

function handleUpdateUser(user, p) {
  var targetNik = String(p.nik || '').trim();
  if (!targetNik) return { success: false, message: 'NIK wajib ditentukan' };
  var sh = getUserSheet();
  if (!sh) return { success: false, message: 'Sheet "user" tidak ditemukan' };
  var c = getUserCols(sh), data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][c.nik]).trim().toLowerCase() === targetNik.toLowerCase()) {
      if (typeof p.profile !== 'undefined' && c.profile > -1) {
        sh.getRange(i + 1, c.profile + 1).setValue(String(p.profile).trim());
      }
      if (typeof p.authority !== 'undefined') {
        var auth = canonicalAuthority(p.authority);
        if (auth) sh.getRange(i + 1, c.authority + 1).setValue(auth);
      }
      if (typeof p.active !== 'undefined' && c.active > -1) {
        sh.getRange(i + 1, c.active + 1).setValue(Boolean(p.active));
      }
      return { success: true, message: 'Pengguna ' + targetNik + ' berhasil diperbarui' };
    }
  }
  return { success: false, message: 'Pengguna ' + targetNik + ' tidak ditemukan' };
}

function handleResetPassword(user, p) {
  var targetNik = String(p.nik || '').trim();
  var newPw = String(p.newPassword || '');
  if (!targetNik) return { success: false, message: 'NIK wajib ditentukan' };
  if (newPw.length < 6) return { success: false, message: 'Password baru minimal 6 karakter' };
  var sh = getUserSheet();
  if (!sh) return { success: false, message: 'Sheet "user" tidak ditemukan' };
  var c = getUserCols(sh), data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][c.nik]).trim().toLowerCase() === targetNik.toLowerCase()) {
      sh.getRange(i + 1, c.password + 1).setNumberFormat('@').setValue(hashPassword(newPw, targetNik));
      return { success: true, message: 'Password pengguna ' + targetNik + ' berhasil direset' };
    }
  }
  return { success: false, message: 'Pengguna ' + targetNik + ' tidak ditemukan' };
}

function handleChangePassword(user, p) {
  var oldPw = String(p.oldPassword || ''), newPw = String(p.newPassword || '');
  if (newPw.length < 6) return { success: false, message: 'Password baru minimal 6 karakter' };
  var sh = getUserSheet(), c = getUserCols(sh), data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][c.nik]).trim().toLowerCase() === String(user.username).toLowerCase()) {
      if (!verifyPassword(data[i][c.password], oldPw, user.username)) {
        return { success: false, message: 'Password lama salah' };
      }
      sh.getRange(i + 1, c.password + 1).setValue(hashPassword(newPw, user.username));
      return { success: true, message: 'Password berhasil diubah' };
    }
  }
  return { success: false, message: 'User tidak ditemukan' };
}

// ---------- Hak akses per site ----------
function hasSite(user, site) {
  site = String(site || '').trim().toUpperCase();
  if (!site) return false;
  return user.siteAccess.map(function (s) { return String(s).toUpperCase(); }).indexOf(site) > -1;
}

function siteOfLocation(loc) {
  var s = String(loc || '').trim().toUpperCase().split('-')[0];
  return ALL_SITES.indexOf(s) > -1 ? s : '';
}

function currentSiteOfMachine(p) {
  var sh = getMachineAssetSheet(getSpreadsheet());
  var idx = getSheetColumnIndices(sh);
  var row = findMachineRow(idx.data, idx, p.assetCode, p.barcode || p.barcode12, p.serial);
  if (row === -1) return null;
  var r = idx.data[row - 1];
  var s = idx.locationId !== -1 ? siteOfLocation(r[idx.locationId]) : '';
  if (!s && idx.siteId !== -1) s = String(r[idx.siteId] || '').trim().toUpperCase();
  return s;
}

function deny(msg) { return { success: false, error: 'FORBIDDEN', message: msg }; }

function checkPermission(user, action, p) {
  if (['ADD_USER', 'LIST_USERS', 'UPDATE_USER', 'RESET_PASSWORD', 'ADMIN_AUDIT_FIX'].indexOf(action) > -1 && user.role !== 'ADMIN_MASTER') {
    return deny('Hanya admin master yang dapat melakukan aksi ini');
  }
  if (action === 'GET_RACK_MAP' || action === 'ASSIGN_RACK_SLOT') {
    if (!hasSite(user, 'WH2')) return deny('Rack Map WH2 tidak dapat diakses oleh akun factory');
  }
  if (['MOVE_MACHINE', 'UPDATE_MACHINE', 'UNDO_MOVE'].indexOf(action) > -1) {
    var cur = currentSiteOfMachine(p);
    if (cur && !hasSite(user, cur)) return deny('Mesin berada di site ' + cur + ', di luar akses Anda');
    if (action !== 'UNDO_MOVE') {
      var targets = [siteOfLocation(p.locationId || p.toLocationId), String(p.siteId || p.toSiteId || '').toUpperCase()];
      for (var i = 0; i < targets.length; i++) {
        if (targets[i] && ALL_SITES.indexOf(targets[i]) > -1 && !hasSite(user, targets[i])) {
          return deny('Anda tidak memiliki akses ke site ' + targets[i]);
        }
      }
    }
  }
  if (action === 'SEND_TRANSFER' && p.fromSite && !hasSite(user, p.fromSite)) return deny('Site asal di luar akses Anda');
  if (action === 'RECEIVE_TRANSFER' && p.toSite && !hasSite(user, p.toSite)) return deny('Site tujuan di luar akses Anda');
  if (action === 'SAVE_OPNAME' && p.session) {
    var os = p.session.siteId || p.session.site || siteOfLocation(p.session.locationId);
    if (os && !hasSite(user, os)) return deny('Opname di site ' + os + ' di luar akses Anda');
  }
  return null;
}

function filterForUser(res, user) {
  if (!res || !res.success) return res;
  var ok = function (s) { return hasSite(user, s); };
  res.machines = (res.machines || []).filter(function (m) { return ok(m.siteId); });
  res.transfers = (res.transfers || []).filter(function (t) { return ok(t.FromSite) || ok(t.ToSite); });
  res.sites = (res.sites || []).filter(function (s) { return ok(s.SiteID); });
  res.locations = (res.locations || []).filter(function (l) { return ok(l.SiteID); });
  res.totalRows = res.machines.length;
  return res;
}

function filterSearch(res, user) {
  if (!res || !res.success || !res.machine) return res;
  var s = siteOfLocation(res.machine.locationId) || String(res.machine.siteId || '').toUpperCase();
  if (s && !hasSite(user, s)) return { success: false, message: 'Mesin tidak ditemukan atau di luar akses Anda' };
  return res;
}

function handleGetMovements(user, params) {
  params = params || {};
  var ss = getSpreadsheet();
  var hSheet = ss.getSheetByName('Movement_History');
  if (!hSheet) {
    return { success: true, movements: [], hasMore: false };
  }

  var data = hSheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, movements: [], hasMore: false };
  }

  var qAsset = String(params.assetCode || '').trim().toUpperCase();
  var qSite = String(params.site || '').trim().toUpperCase();
  var qFrom = String(params.from || '').trim();
  var qTo = String(params.to || '').trim();
  var limit = Number(params.limit) || 200;
  if (limit > 1000) limit = 1000;

  var results = [];
  for (var i = data.length - 1; i >= 1; i--) {
    var r = data[i];
    var hId = String(r[0] || '');
    var bCode = String(r[1] || '');
    var aCode = String(r[2] || '');
    var serial = String(r[3] || '');
    var mName = String(r[4] || '');
    var fromLoc = String(r[5] || '');
    var toLoc = String(r[6] || '');
    var fromSite = String(r[7] || '');
    var toSite = String(r[8] || '');
    var status = String(r[9] || '');
    var reason = String(r[10] || '');
    var movedBy = String(r[11] || '');
    var timestamp = String(r[12] || '');
    var notes = String(r[13] || '');
    var isUndone = r[14] === true || String(r[14]).toUpperCase() === 'TRUE';

    // Filter hak akses site
    if (user && user.role !== 'ADMIN_MASTER') {
      var hasAccess = false;
      if (fromSite && hasSite(user, fromSite)) hasAccess = true;
      if (toSite && hasSite(user, toSite)) hasAccess = true;
      if (!fromSite && !toSite) hasAccess = true;
      if (!hasAccess) continue;
    }

    if (qAsset && aCode.toUpperCase() !== qAsset && bCode.toUpperCase() !== qAsset && serial.toUpperCase() !== qAsset) {
      continue;
    }
    if (qSite && qSite !== 'ALL' && fromSite !== qSite && toSite !== qSite) {
      continue;
    }
    if (qFrom && timestamp && timestamp.slice(0, 10) < qFrom) {
      continue;
    }
    if (qTo && timestamp && timestamp.slice(0, 10) > qTo) {
      continue;
    }

    results.push({
      historyId: hId,
      barcode: bCode,
      assetCode: aCode,
      serial: serial,
      machineName: mName,
      fromLocation: fromLoc,
      toLocation: toLoc,
      fromSite: fromSite,
      toSite: toSite,
      status: status,
      reason: reason,
      movedBy: movedBy,
      timestamp: timestamp,
      notes: notes,
      isUndone: isUndone
    });

    if (results.length >= limit) break;
  }

  return {
    success: true,
    movements: results,
    hasMore: data.length - 1 > results.length
  };
}

// ---------- Router utama ----------
function authorize(token, action, params) {
  params = params || {};
  var PUBLIC = { LOGIN: 1, PING: 1 };
  var user = null;

  if (!PUBLIC[action]) {
    user = validateSession(token);
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED', message: 'Sesi tidak valid atau sudah berakhir. Silakan login kembali.' };
    }
    var denied = checkPermission(user, action, params);
    if (denied) return denied;
  }

  // 1. Aksi baca murni diproses langsung tanpa antrean LockService
  var READ_ACTIONS = {
    GET_INITIAL_DATA: 1,
    GET_MACHINES: 1,
    SEARCH_MACHINE: 1,
    GET_RACK_MAP: 1,
    GET_MOVEMENTS: 1,
    LIST_USERS: 1,
    PING: 1,
    ME: 1
  };

  if (READ_ACTIONS[action]) {
    switch (action) {
      case 'PING':             return { success: true, message: 'Koneksi ke Google Apps Script berhasil', timestamp: new Date().toISOString() };
      case 'ME':               return { success: true, user: user };
      case 'GET_INITIAL_DATA':
      case 'GET_MACHINES':     return filterForUser(handleGetInitialData(user), user);
      case 'SEARCH_MACHINE':   return filterSearch(handleSearchMachine(user, params.query), user);
      case 'GET_RACK_MAP':     return handleGetRackMap(user, params);
      case 'GET_MOVEMENTS':    return handleGetMovements(user, params);
      case 'LIST_USERS':       return handleListUsers(user);
    }
  }

  // 2. Aksi tulis dilindungi dengan Script Lock
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    switch (action) {
      case 'LOGIN':            return handleLogin(params.username, params.password);

      case 'MOVE_MACHINE':
      case 'UPDATE_MACHINE':   return handleMoveMachine(user, params);
      case 'UNDO_MOVE':        return handleUndoMove(user, params);
      case 'SEND_TRANSFER':    return handleSendTransfer(user, params);
      case 'RECEIVE_TRANSFER': return handleReceiveTransfer(user, params);
      case 'CANCEL_TRANSFER':  return handleCancelTransfer(user, params);
      case 'SAVE_OPNAME':      return handleSaveOpname(user, params);
      case 'ADMIN_AUDIT_FIX':  return handleAdminAuditFix(user);

      case 'ASSIGN_RACK_SLOT': return handleAssignRackSlot(user, params);

      case 'ADD_USER':         return handleAddUser(user, params);
      case 'UPDATE_USER':      return handleUpdateUser(user, params);
      case 'RESET_PASSWORD':   return handleResetPassword(user, params);
      case 'CHANGE_PASSWORD':  return handleChangePassword(user, params);

      default: return { success: false, message: 'Aksi tidak dikenal: ' + action };
    }
  } catch (err) {
    return { success: false, message: 'Server Lock/Timeout Error: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ---------- Setup sekali jalan (jalankan manual dari editor) ----------
function setupSecurity() {
  PropertiesService.getScriptProperties().setProperty('PEPPER', PEPPER || 'PT_WINNERS_APP_SECRET_PEPPER_2026');
}

function migratePasswordsToHash() {
  var pepper = getPepper();
  if (!pepper) throw new Error('Pepper keamanan tidak ditemukan. Jalankan setupSecurity() terlebih dahulu.');
  var sh = getUserSheet();
  if (!sh) throw new Error('Sheet "user" tidak ditemukan');
  var c = getUserCols(sh), data = sh.getDataRange().getValues(), n = 0;
  for (var i = 1; i < data.length; i++) {
    var nik = String(data[i][c.nik]).trim(), pw = String(data[i][c.password]);
    if (nik && pw && pw.indexOf('h1$') !== 0) {
      sh.getRange(i + 1, c.password + 1).setNumberFormat('@').setValue(hashPassword(pw, nik));
      n++;
    }
  }
  Logger.log('Password dimigrasi: ' + n + ' akun');
}
`;
}
