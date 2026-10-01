/**
 * Bilingual Translation Dictionary for PT.WINNERS Machine Asset Location Tracker
 */

export interface Translations {
  [key: string]: {
    id: string;
    en: string;
  };
}

export const defaultTranslations: Translations = {
  // App General
  app_title: { id: 'Pelacak Lokasi Mesin PT.WINNERS', en: 'PT.WINNERS Machine Location Tracker' },
  app_subtitle: { id: 'Sistem Manajemen Aset Mesin Jahit 6 Lokasi Pabrik & Gudang', en: 'Sewing Machine Asset Location System for 6 Factory & Warehouse Sites' },
  home: { id: 'Beranda', en: 'Home' },
  dashboard: { id: 'Dashboard', en: 'Dashboard' },
  machines: { id: 'Daftar Mesin', en: 'Machines' },
  rackmap: { id: 'Mapping Rak WH2', en: 'WH2 Rack Map' },
  move: { id: 'Pindah Lokasi', en: 'Move Location' },
  transfers: { id: 'Transfer Antar Site', en: 'Inter-Site Transfer' },
  opname: { id: 'Opname Mingguan', en: 'Weekly Opname' },
  reports: { id: 'Laporan Harian', en: 'Daily Reports' },
  admin: { id: 'Admin & Pengaturan', en: 'Admin & Settings' },
  login: { id: 'Masuk', en: 'Sign In' },
  logout: { id: 'Keluar', en: 'Log Out' },
  search: { id: 'Cari', en: 'Search' },
  scan: { id: 'Scan QR / Barcode', en: 'Scan QR / Barcode' },
  actions: { id: 'Aksi', en: 'Actions' },
  status: { id: 'Status', en: 'Status' },
  cancel: { id: 'Batal', en: 'Cancel' },
  save: { id: 'Simpan', en: 'Save' },
  confirm: { id: 'Konfirmasi', en: 'Confirm' },
  refresh: { id: 'Segarkan', en: 'Refresh' },
  filter: { id: 'Filter', en: 'Filter' },
  reset: { id: 'Reset', en: 'Reset' },
  details: { id: 'Detail', en: 'Details' },
  history: { id: 'Riwayat', en: 'History' },
  export_excel: { id: 'Ekspor Excel', en: 'Export Excel' },
  import_excel: { id: 'Impor Excel', en: 'Import Excel' },
  all: { id: 'Semua', en: 'All' },
  loading: { id: 'Memuat data...', en: 'Loading data...' },

  // Machine Fields
  asset_code: { id: 'Kode Aset', en: 'Asset Code' },
  barcode: { id: 'Barcode (12 Digit)', en: 'Barcode (12 Digits)' },
  item_name_kr: { id: 'Nama Item (Korea)', en: 'Item Name (Korean)' },
  std_machine_name: { id: 'Nama Mesin Standar', en: 'Standard Machine Name' },
  home_factory: { id: 'Home Factory (Pabrik Asal)', en: 'Home Factory' },
  acq_date: { id: 'Tgl Perolehan', en: 'Acq. Date' },
  serial: { id: 'Nomor Seri (Serial)', en: 'Serial Number' },
  manufacturer: { id: 'Merk / Produsen', en: 'Manufacturer' },
  model: { id: 'Model / Tipe', en: 'Model' },
  current_location: { id: 'Lokasi Saat Ini', en: 'Current Location' },
  current_site: { id: 'Site Saat Ini', en: 'Current Site' },
  last_moved: { id: 'Terakhir Dipindah', en: 'Last Moved' },
  last_opname: { id: 'Terakhir Opname', en: 'Last Opname' },
  notes: { id: 'Catatan', en: 'Notes' },
  loan_to: { id: 'Dipinjamkan Ke', en: 'Loaned To' },
  loan_due_date: { id: 'Batas Waktu Pinjam', en: 'Loan Due Date' },
  data_flag: { id: 'Status Flag Data', en: 'Data Flag' },

  // Statuses
  status_ACTIVE: { id: 'Aktif (Beroperasi)', en: 'Active' },
  status_BROKEN: { id: 'Rusak', en: 'Broken' },
  status_IN_REPAIR: { id: 'Sedang Diperbaiki', en: 'In Repair' },
  status_LOANED: { id: 'Dipinjam', en: 'Loaned' },
  status_SOLD: { id: 'Dijual / Afkir', en: 'Sold / Disposed' },

  // Sites
  site_PW1: { id: 'PT.WINNERS (1) - Pabrik 1', en: 'PT.WINNERS (1) - Factory 1' },
  site_PW2: { id: 'PT.WINNERS (2) - Pabrik 2', en: 'PT.WINNERS (2) - Factory 2' },
  site_PW3: { id: 'PT.WINNERS (3) - Pabrik 3', en: 'PT.WINNERS (3) - Factory 3' },
  site_WH2: { id: 'Warehouse 2 (Gudang Rak)', en: 'Warehouse 2 (Racked)' },
  site_SW: { id: 'Smart Warehouse', en: 'Smart Warehouse' },
  site_QA: { id: 'QA Lab', en: 'QA Lab' },

  // Location Types
  loc_LINE: { id: 'Line Produksi', en: 'Production Line' },
  loc_LINE_EXTRA: { id: 'Line Ekstra', en: 'Extra Line' },
  loc_GUDANG: { id: 'Gudang Pabrik', en: 'Factory Storage' },
  loc_UNASSIGNED: { id: 'Belum Ditentukan Line / Slot', en: 'Unassigned Line / Slot' },
  loc_RACK_SLOT: { id: 'Slot Rak (WH2)', en: 'Rack Slot (WH2)' },
  loc_MAIN: { id: 'Lokasi Utama', en: 'Main Site Area' },

  // Move & Status View
  move_single: { id: 'Pindah 1 Mesin', en: 'Move 1 Machine' },
  move_batch: { id: 'Pindah Banyak Mesin (Batch)', en: 'Batch Move Machines' },
  select_dest_location: { id: 'Pilih Lokasi Tujuan', en: 'Select Target Location' },
  change_status_optional: { id: 'Ubah Status (Opsional)', en: 'Update Status (Optional)' },
  reason: { id: 'Alasan Pemindahan', en: 'Reason' },
  undo_last_move: { id: 'Batalkan Pindah Terakhir (Undo)', en: 'Undo Last Move' },
  undo_available_within: { id: 'Tersedia dalam 60 menit terakhir', en: 'Available within 60 minutes' },
  slot_capacity_warning: { id: 'Slot rak WH2 maksimal 3 mesin!', en: 'WH2 rack slots can hold at most 3 machines!' },
  slot_full_error: { id: 'Slot rak ini sudah penuh (kapasitas 3 mesin tercapai).', en: 'This rack slot is full (capacity limit of 3 machines reached).' },
  move_success: { id: 'Mesin berhasil dipindahkan ke', en: 'Machine successfully moved to' },
  machine_in_transit_error: { id: 'Mesin sedang dalam status In Transit (Transfer) dan terkunci!', en: 'Machine is currently In Transit and locked!' },
  machine_sold_error: { id: 'Mesin berstatus SOLD tidak dapat dipindahkan.', en: 'SOLD machines cannot be moved.' },
  no_site_access_error: { id: 'Akses ditolak! Anda tidak memiliki izin mengelola mesin di site ini.', en: 'Access denied! You do not have permission for machines in this site.' },

  // Transfers View
  transfer_in_transit: { id: 'Sedang Dikirim (In Transit)', en: 'In Transit' },
  transfer_received: { id: 'Telah Diterima', en: 'Received' },
  transfer_cancelled: { id: 'Dibatalkan', en: 'Cancelled' },
  send_transfer: { id: 'Kirim Mesin ke Site Lain', en: 'Send Machine to Another Site' },
  select_target_site: { id: 'Pilih Site Tujuan', en: 'Select Destination Site' },
  pending_inbound: { id: 'Menunggu Diterima (Inbound)', en: 'Pending Inbound Receipts' },
  pending_outbound: { id: 'Terkirim Belum Diterima (Outbound)', en: 'Pending Outbound Dispatches' },
  receive_transfer: { id: 'Terima Mesin', en: 'Receive Machine' },
  cancel_transfer: { id: 'Batalkan Transfer', en: 'Cancel Transfer' },
  overdue_alert: { id: 'PERINGATAN: Transfer belum diterima lebih dari 3 hari!', en: 'ALERT: Transfer has been pending for over 3 days!' },

  // Opname View
  opname_title: { id: 'Audit Fisik / Opname Mingguan', en: 'Weekly Physical Opname Audit' },
  select_opname_loc: { id: 'Pilih Lokasi yang Di-Audit', en: 'Select Location to Audit' },
  start_opname: { id: 'Mulai Sesi Opname', en: 'Start Opname Session' },
  finish_opname: { id: 'Selesaikan & Simpan Opname', en: 'Finish & Save Opname' },
  scanned_count: { id: 'Terscan', en: 'Scanned' },
  expected_count: { id: 'Terdaftar di Lokasi', en: 'Expected' },
  match_count: { id: 'Sesuai (Match)', en: 'Match' },
  missing_count: { id: 'Belum Terscan (Missing)', en: 'Missing' },
  misplaced_count: { id: 'Salah Lokasi (Misplaced)', en: 'Misplaced' },
  move_to_this_location: { id: 'Pindahkan ke Sini', en: 'Move to this location' },
  reported_to_admin: { id: 'Dilaporkan ke Admin & Pabrik Terkait', en: 'Reported to Admin & Home Site' },
  opname_progress_week: { id: 'Progres Opname Minggu Ini', en: 'Weekly Opname Progress' },

  // Reports View
  daily_report_title: { id: 'Laporan Harian Mesin & Rekapitulasi', en: 'Daily Machine Asset & Movement Report' },
  send_report_now: { id: 'Kirim Laporan Email Sekarang', en: 'Dispatch Email Report Now' },
  email_recipients: { id: 'Daftar Penerima Email', en: 'Email Recipients' },
  auto_dispatch_time: { id: 'Jadwal Otomatis:', en: 'Scheduled Time:' },

  // Admin View
  manage_sites_lines: { id: 'Kelola Site & Line Pabrik', en: 'Manage Sites & Lines' },
  manage_wh2_racks: { id: 'Konfigurasi Rak WH2 (6 Rak)', en: 'Configure WH2 Racks (6 Racks)' },
  manage_users: { id: 'Kelola Pengguna & Hak Akses', en: 'Manage Users & Permissions' },
  data_cleaning_audit: { id: 'Audit & Perbaikan Data (Bagian C)', en: 'Data Audit & Auto-Fix Suite (Part C)' },
  gas_code_export: { id: 'Kode Google Apps Script', en: 'Google Apps Script Code' },
  system_settings: { id: 'Pengaturan Sistem', en: 'System Settings' },
  speed_benchmark: { id: 'Uji Kecepatan 5.700 Mesin (Fase 0)', en: '5,700 Machine Speed Benchmark' },

  // QR Scanner Modal
  scan_modal_title: { id: 'Pemindai QR Code & Barcode Mesin', en: 'Machine QR Code & Barcode Scanner' },
  scan_input_placeholder: { id: 'Arahkan scanner fisik 2D ke sini atau ketik Barcode / Kode Aset...', en: 'Point 2D physical scanner here or type Barcode / Asset Code...' },
  camera_mode: { id: 'Kamera HP / Webcam', en: 'Camera Mode' },
  physical_mode: { id: 'Scanner Fisik 2D / Keyboard', en: 'Physical 2D Scanner / Keyboard' },
  camera_not_allowed: { id: 'Kamera tidak dapat diakses atau diblokir. Silakan gunakan input manual di bawah.', en: 'Camera is not accessible. Please use the manual input below.' },
  switch_camera: { id: 'Ganti Kamera', en: 'Switch Camera' },
  torch_toggle: { id: 'Lampu Senter', en: 'Flashlight' }
};

export function getTranslation(key: string, lang: 'id' | 'en' = 'id'): string {
  const item = defaultTranslations[key];
  if (!item) return key;
  return lang === 'en' ? item.en : item.id;
}
