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
  opname: { id: 'Weekly Machine List', en: 'Weekly Machine List' },
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
  opname_title: { id: 'Weekly Machine List', en: 'Weekly Machine List' },
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
  opname_progress_week: { id: 'Progres Weekly Machine List Minggu Ini', en: 'Weekly Machine List Progress' },

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
  torch_toggle: { id: 'Lampu Senter', en: 'Flashlight' },

  // Common (tambahan)
  apply: { id: 'Terapkan', en: 'Apply' },
  retry: { id: 'Coba Lagi', en: 'Try Again' },
  add: { id: 'Tambah', en: 'Add' },
  previous: { id: 'Sebelumnya', en: 'Previous' },
  next: { id: 'Berikutnya', en: 'Next' },
  close: { id: 'Tutup', en: 'Close' },
  clear_list: { id: 'Kosongkan daftar', en: 'Clear list' },
  clear_filters: { id: 'Bersihkan Filter', en: 'Clear Filters' },
  remove_from_list: { id: 'Hapus dari daftar', en: 'Remove from list' },
  optional: { id: '(Opsional)', en: '(Optional)' },
  select_dest_placeholder: { id: '-- Pilih Lokasi Tujuan --', en: '-- Select Target Location --' },
  col_time: { id: 'Waktu', en: 'Time' },
  col_machine: { id: 'Mesin', en: 'Machine' },
  col_reason_notes: { id: 'Alasan & Catatan', en: 'Reason & Notes' },
  col_by: { id: 'Oleh', en: 'By' },
  export_csv: { id: 'Ekspor CSV', en: 'Export CSV' },
  server_unreachable: { id: 'Tidak dapat terhubung ke server.', en: 'Cannot connect to the server.' },

  // Login & Akun (tambahan)
  nik_username: { id: 'NIK / Username', en: 'Employee ID / Username' },
  password: { id: 'Password', en: 'Password' },
  change_password: { id: 'Ubah Password', en: 'Change Password' },
  logout_system: { id: 'Keluar dari Sistem', en: 'Log Out of the System' },
  change_password_title: { id: 'Ubah Password Akun', en: 'Change Account Password' },
  old_password: { id: 'Password Lama', en: 'Current Password' },
  old_password_ph: { id: 'Masukkan password saat ini', en: 'Enter your current password' },
  new_password: { id: 'Password Baru', en: 'New Password' },
  new_password_ph: { id: 'Minimal 10 karakter', en: 'At least 10 characters' },
  confirm_new_password: { id: 'Konfirmasi Password Baru', en: 'Confirm New Password' },
  confirm_new_password_ph: { id: 'Ulangi password baru', en: 'Repeat the new password' },
  save_changes: { id: 'Simpan Perubahan', en: 'Save Changes' },

  // History View (Riwayat Mesin)
  hist_title: { id: 'Riwayat Mesin', en: 'Machine History' },
  hist_subtitle: { id: 'Log riwayat mutasi dan pergerakan lokasi mesin langsung dari server', en: 'Machine mutation and location movement log, live from the server' },
  hist_search_label: { id: 'Pencarian (Kode / Barcode / Serial):', en: 'Search (Code / Barcode / Serial):' },
  hist_search_ph: { id: 'Contoh: 000000066145 / DDL', en: 'e.g. 000000066145 / DDL' },
  hist_site_filter: { id: 'Filter Site Pabrik / Gudang:', en: 'Filter by Factory / Warehouse Site:' },
  hist_all_sites: { id: 'Semua Site Terjangkau', en: 'All Accessible Sites' },
  hist_from_date: { id: 'Dari Tanggal:', en: 'From Date:' },
  hist_to_date: { id: 'Sampai Tanggal:', en: 'To Date:' },
  hist_reload_title: { id: 'Muat Ulang Data Server', en: 'Reload Server Data' },
  hist_export_title: { id: 'Ekspor Data ke File CSV', en: 'Export Data to CSV File' },
  hist_empty_title: { id: 'Belum ada riwayat untuk site Anda', en: 'No history for your site yet' },
  hist_empty_desc: { id: 'Tidak ada catatan pergerakan mesin yang cocok dengan kriteria filter yang dipilih.', en: 'No machine movement records match the selected filter criteria.' },
  hist_col_from_to: { id: 'Dari → Ke (Lokasi)', en: 'From → To (Location)' },
  hist_undone_badge: { id: 'Dibatalkan (Undo)', en: 'Cancelled (Undo)' },
  hist_undone: { id: 'Dibatalkan', en: 'Cancelled' },
  hist_by: { id: 'Oleh:', en: 'By:' },
  hist_load_failed: { id: 'Gagal memuat riwayat pemindahan mesin dari server.', en: 'Failed to load machine movement history from the server.' },

  // Transfers View (tambahan)
  xfer_title: { id: 'Transfer Antar Site (Alur 2 Langkah)', en: 'Inter-Site Transfer (2-Step Flow)' },
  xfer_desc: { id: 'Proses transfer antar pabrik: (1) Pengirim memindai mesin & mengirim (In Transit), (2) Penerima mengonfirmasi penerimaan & memilih lokasi tujuan.', en: 'Inter-factory transfer process: (1) The sender scans the machines and dispatches them (In Transit), (2) The receiver confirms receipt and selects the destination location.' },
  xfer_tab_inbound: { id: 'Menunggu Diterima', en: 'Awaiting Receipt' },
  xfer_tab_outbound: { id: 'Transfer Terkirim', en: 'Sent Transfers' },
  xfer_tab_send: { id: 'Kirim Transfer Baru', en: 'Send New Transfer' },
  xfer_inbound_title: { id: 'Daftar Mesin yang Sedang Dikirim Menuju Site Anda', en: 'Machines Being Sent to Your Site' },
  xfer_inbound_empty: { id: 'Tidak ada mesin yang sedang dalam perjalanan menuju site Anda.', en: 'No machines are currently on their way to your site.' },
  xfer_from_site: { id: 'Dari Site:', en: 'From Site:' },
  xfer_sent_by: { id: 'Dikirim oleh:', en: 'Sent by:' },
  xfer_outbound_title: { id: 'Riwayat Transfer Keluar dari Site Anda', en: 'Outgoing Transfer History from Your Site' },
  xfer_from: { id: 'Dari:', en: 'From:' },
  xfer_to: { id: 'Ke:', en: 'To:' },
  xfer_sent_label: { id: 'Dikirim:', en: 'Sent:' },
  xfer_received_label: { id: 'Diterima:', en: 'Received:' },
  xfer_showing: { id: 'Menampilkan {from}-{to} dari {total} transfer', en: 'Showing {from}-{to} of {total} transfers' },
  xfer_pagination_label: { id: 'Paginasi riwayat transfer terkirim', en: 'Sent transfer history pagination' },
  xfer_prev_page: { id: 'Halaman sebelumnya', en: 'Previous page' },
  xfer_next_page: { id: 'Halaman berikutnya', en: 'Next page' },
  xfer_page_n: { id: 'Halaman {n}', en: 'Page {n}' },
  xfer_scan_label: { id: 'Scan Barcode / Kode Aset / Nomor Seri:', en: 'Scan Barcode / Asset Code / Serial Number:' },
  xfer_scan_ph: { id: 'Arahkan barcode scanner fisik atau ketik kode lalu tekan Enter...', en: 'Point the physical barcode scanner or type a code, then press Enter...' },
  xfer_paste_toggle: { id: 'Tempel Banyak Kode / Barcode', en: 'Paste Multiple Codes / Barcodes' },
  xfer_paste_hint: { id: 'Pisahkan dengan spasi, koma, titik koma, atau baris baru', en: 'Separate with spaces, commas, semicolons, or new lines' },
  xfer_paste_ph: { id: 'Contoh:\nIDN-8-2009-1396\n000000066145\nIDN-9-2009-1397', en: 'Example:\nIDN-8-2009-1396\n000000066145\nIDN-9-2009-1397' },
  xfer_add_all: { id: 'Tambahkan Semua ke Daftar', en: 'Add All to List' },
  xfer_close_paste: { id: 'Tutup Tempel Banyak', en: 'Close Multi-Paste' },
  xfer_ready_list: { id: 'Daftar Mesin Siap Dikirim:', en: 'Machines Ready to Send:' },
  xfer_empty_list_title: { id: 'Daftar transfer masih kosong.', en: 'The transfer list is empty.' },
  xfer_empty_list_desc: { id: 'Gunakan input scan di atas untuk menambahkan mesin ke dalam batch pengiriman ini.', en: 'Use the scan input above to add machines to this shipment batch.' },
  xfer_col_asset: { id: 'Kode Aset / Barcode', en: 'Asset Code / Barcode' },
  xfer_col_name: { id: 'Nama Mesin', en: 'Machine Name' },
  xfer_col_origin: { id: 'Site Asal', en: 'Origin Site' },
  xfer_vehicle: { id: 'Nomor Kendaraan / Truk (Opsional):', en: 'Vehicle / Truck Number (Optional):' },
  xfer_vehicle_ph: { id: 'Contoh: B 1234 XYZ', en: 'e.g. B 1234 XYZ' },
  xfer_driver: { id: 'Nama Sopir (Opsional):', en: 'Driver Name (Optional):' },
  xfer_driver_ph: { id: 'Contoh: Pak Joko', en: 'e.g. Mr. Joko' },
  xfer_note: { id: 'Catatan / Alasan Transfer (Opsional):', en: 'Transfer Note / Reason (Optional):' },
  xfer_note_ph: { id: 'Contoh: Pemenuhan kapasitas order export site tujuan', en: 'e.g. Meeting export order capacity at the destination site' },
  xfer_sending: { id: 'Sedang Mengirim ke Server...', en: 'Sending to Server...' },
  xfer_send_button: { id: 'Kirim {n} Mesin ke {site} (Kunci In Transit)', en: 'Send {n} Machines to {site} (Lock as In Transit)' },
  xfer_receive_title: { id: 'Terima Mesin di Site {site}', en: 'Receive Machine at Site {site}' },
  xfer_receive_asset: { id: 'Kode Aset:', en: 'Asset Code:' },
  xfer_receive_from: { id: 'Dikirim dari:', en: 'Sent from:' },
  xfer_receive_location: { id: 'Pilih Lokasi Penempatan di Site {site} *', en: 'Select Placement Location at Site {site} *' },
  xfer_confirm_receipt: { id: 'Konfirmasi Diterima', en: 'Confirm Receipt' },
  xfer_saving: { id: 'Menyimpan di Server...', en: 'Saving to Server...' },
  xfer_cancelling: { id: 'Membatalkan...', en: 'Cancelling...' },
  xfer_err_no_codes: { id: 'Tidak ada kode valid yang dimasukkan.', en: 'No valid codes were entered.' },
  xfer_err_send: { id: 'Gagal mengirim transfer.', en: 'Failed to send the transfer.' },
  xfer_err_receive: { id: 'Gagal menerima transfer.', en: 'Failed to receive the transfer.' },
  xfer_err_cancel: { id: 'Gagal membatalkan transfer.', en: 'Failed to cancel the transfer.' },

  // Move View (tambahan)
  mv_desc: { id: 'Pindahkan mesin ke Line, Line Extra, Gudang, atau Slot Rak WH2 (Kapasitas maks 3 mesin per slot).', en: 'Move machines to a Line, Extra Line, Storage, or WH2 Rack Slot (max capacity of 3 machines per slot).' },
  mv_empty: { id: 'Pilih mesin dari menu "Daftar Mesin" atau gunakan fitur Scan Barcode.', en: 'Select machines from the "Machines" menu or use the Barcode Scan feature.' },
  mv_origin: { id: 'Lokasi Asal:', en: 'Origin Location:' },
  mv_status_keep: { id: '-- Tetap (Tidak Mengubah Status) --', en: '-- Keep (Do Not Change Status) --' },
  mv_status_active: { id: 'ACTIVE (Aktif)', en: 'ACTIVE (Active)' },
  mv_status_in_repair: { id: 'IN_REPAIR (Sedang Diperbaiki)', en: 'IN_REPAIR (In Repair)' },
  mv_status_broken: { id: 'BROKEN (Rusak)', en: 'BROKEN (Broken)' },
  mv_status_loaned: { id: 'LOANED (Dipinjamkan)', en: 'LOANED (Loaned Out)' },
  mv_status_sold: { id: 'SOLD (Dijual/Afkir)', en: 'SOLD (Sold / Disposed)' },
  mv_sold_title: { id: 'Status SOLD Terpilih — Tidak Perlu Memilih Lokasi di Site', en: 'SOLD Status Selected: No Need to Choose a Location in the Site' },
  mv_sold_desc_before: { id: 'Mesin telah terjual atau dikeluarkan dari operasional pabrik. Lokasi mesin akan otomatis dicatat sebagai', en: 'The machine has been sold or removed from factory operations. Its location will be recorded automatically as' },
  mv_sold_desc_after: { id: 'tanpa memerlukan pemilihan rak atau line.', en: 'without needing to choose a rack or line.' },
  mv_slot_capacity: { id: 'Kapasitas Slot Rak WH2:', en: 'WH2 Rack Slot Capacity:' },
  mv_target: { id: 'Lokasi Tujuan:', en: 'Target Location:' },
  mv_auto_sold: { id: 'Otomatis Diset: SOLD', en: 'Automatically Set: SOLD' },
  mv_loan_to: { id: 'Peminjam (Loan To) *:', en: 'Borrower (Loan To) *:' },
  mv_loan_due: { id: 'Batas Waktu Pinjam (Due Date) *:', en: 'Loan Due Date *:' },
  mv_loan_to_ph: { id: 'Nama subkontraktor / pabrik lain', en: 'Subcontractor / other factory name' },
  mv_sold_note: { id: 'Catatan Penjualan / Pembeli (Opsional):', en: 'Sale Notes / Buyer (Optional):' },
  mv_sold_note_ph: { id: 'Contoh: Dijual ke PT Subkon Jaya, No Faktur #123', en: 'e.g. Sold to PT Subkon Jaya, Invoice #123' },
  mv_reason_ph: { id: 'Contoh: Penyesuaian layout line order kemeja...', en: 'e.g. Line layout adjustment for shirt order...' },
  mv_saving: { id: 'Sedang Menyimpan ke Server...', en: 'Saving to Server...' },
  mv_undo_button: { id: 'Undo Pemindahan', en: 'Undo Move' },
  mv_err_none: { id: 'Tidak ada mesin yang dipilih untuk dipindahkan.', en: 'No machines selected to move.' },
  mv_err_no_target: { id: 'Silakan pilih lokasi tujuan.', en: 'Please select a target location.' },
  mv_err_loan: { id: 'Status LOANED wajib mengisi peminjam (Loan To) dan batas waktu (Due Date).', en: 'LOANED status requires the borrower (Loan To) and a due date.' },
  mv_err_move: { id: 'Gagal memindahkan mesin.', en: 'Failed to move the machine.' },
  mv_err_system: { id: 'Terjadi kesalahan sistem.', en: 'A system error occurred.' },
  mv_err_undo: { id: 'Gagal membatalkan pemindahan.', en: 'Failed to undo the move.' }
};

export function getTranslation(key: string, lang: 'id' | 'en' = 'id'): string {
  const item = defaultTranslations[key];
  if (!item) return key;
  return lang === 'en' ? item.en : item.id;
}

/**
 * Terjemahan dengan parameter. Contoh:
 *   formatTranslation('xfer_showing', lang, { from: 1, to: 10, total: 42 })
 *   -> "Menampilkan 1-10 dari 42 transfer" / "Showing 1-10 of 42 transfers"
 * Placeholder yang tidak diberi nilai dibiarkan apa adanya.
 */
export function formatTranslation(
  key: string,
  lang: 'id' | 'en' = 'id',
  params: Record<string, string | number> = {}
): string {
  return getTranslation(key, lang).replace(/\{(\w+)\}/g, (m, name) =>
    name in params ? String(params[name]) : m
  );
}