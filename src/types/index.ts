/**
 * PT.WINNERS Machine Asset Location Tracker - Data Types
 */

export type SiteId = 'PW1' | 'PW2' | 'PW3' | 'WH2' | 'SW' | 'QA' | string;

export type SiteType = 'FACTORY' | 'WAREHOUSE' | 'LAB' | 'SITE';

export interface Site {
  siteId: SiteId;
  name: string;
  type: SiteType;
  active: boolean;
}

export type LocationType = 'LINE' | 'LINE_EXTRA' | 'GUDANG' | 'UNASSIGNED' | 'RACK_SLOT' | 'MAIN';

export interface Location {
  locationId: string; // e.g. 'PW1-L01', 'WH2-R1-1A', 'SW-MAIN'
  siteId: SiteId;
  type: LocationType;
  displayName: string;
  rackNo?: number;
  columnNo?: number;
  stack?: 'A' | 'B' | 'C' | string;
  capacity?: number; // default 3 for rack slots
  active: boolean;
  sortOrder: number;
}

export interface Rack {
  siteId: 'WH2' | string;
  rackNo: number;
  columnCount: number;
  active: boolean;
}

export type MachineStatus = 'ACTIVE' | 'BROKEN' | 'IN_REPAIR' | 'LOANED' | 'SOLD' | 'IN_TRANSIT';

export interface Machine {
  assetCode: string; // e.g. 'IDN-8-2009-1396'
  barcode: string;   // 12-digit e.g. '000000066145'
  item: string;      // Korean name e.g. '본봉자동'
  homeFactory: string; // e.g. 'PT.WINNERS(1)' or 'PW1'
  acqDate: string;   // YYYY-MM-DD
  standardMachineName: string; // e.g. '1-Needle Lockstitch Machine'
  localName?: string; // nama lokal lapangan
  serial: string;    // text with leading zeros e.g. '0976914'
  manufacturer: string; // e.g. 'JUKI', 'BROTHER'
  model: string;     // e.g. 'DDL-8700-7'
  status: MachineStatus;
  locationId: string; // e.g. 'PW1-L12'
  siteId: SiteId;    // Current site
  pendingTransferId?: string; // If in transit
  lastMovedAt?: string; // ISO timestamp
  lastMovedBy?: string; // username
  lastOpnameAt?: string; // ISO timestamp
  statusSince?: string; // ISO timestamp
  loanTo?: string;   // if LOANED
  loanDueDate?: string; // YYYY-MM-DD
  dataFlag?: string; // e.g. 'SERIAL_SPACE', 'UNKNOWN_MODEL', 'FLAGGED'
  updatedAt: string;
  updatedBy: string;
  notes?: string;
}

export interface MachineListFilter {
  status?: string;     // ALL | ACTIVE | IN_TRANSIT | IN_REPAIR | BROKEN | LOANED | SOLD | BROKEN_REPAIR
  site?: string;       // ALL | PW1 | ...
  typeName?: string;   // nama mesin standar (persis)
  manufacturer?: string;
  unassigned?: boolean;
}

export type MovementType = 'MOVE' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'OPNAME_FIX' | 'UNDO' | 'ADMIN_FIX';

export interface Movement {
  movementId: string;
  timestamp: string;
  assetCode: string;
  type: MovementType;
  fromLocation: string;
  toLocation: string;
  fromSite: SiteId;
  toSite: SiteId;
  transferId?: string;
  opnameSessionId?: string;
  reason?: string;
  byUser: string;
}

export type TransferStatus = 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export interface Transfer {
  transferId: string;
  batchId?: string;
  assetCode: string;
  fromSite: SiteId;
  toSite: SiteId;
  status: TransferStatus;
  sentAt: string;
  sentBy: string;
  receivedAt?: string;
  receivedBy?: string;
  toLocation?: string;
  note?: string;
  overdueAlertSent?: boolean;
}

export interface StatusLog {
  logId: string;
  timestamp: string;
  assetCode: string;
  oldStatus: MachineStatus;
  newStatus: MachineStatus;
  byUser: string;
  note?: string;
  loanTo?: string;
  loanDueDate?: string;
}

export type OpnameResult = 'MATCH' | 'MISSING' | 'MISPLACED_SAME_SITE' | 'MISPLACED_OTHER_SITE' | 'UNKNOWN_BARCODE';

export interface OpnameSession {
  sessionId: string;
  week: string; // e.g. '2026-W39'
  locationId: string;
  siteId: SiteId;
  startedAt: string;
  startedBy: string;
  finishedAt?: string;
  expected: number;
  scanned: number;
  match: number;
  missing: number;
  misplaced: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface OpnameItem {
  sessionId: string;
  assetCode: string;
  barcode?: string;
  result: OpnameResult;
  currentActualLocation?: string;
  registeredLocation?: string;
  registeredSite?: string;
  scannedAt: string;
  resolution?: string; // e.g. 'MOVED_HERE', 'REPORTED', 'IGNORED'
}

export type AuthorityRole = 'admin master' | 'all sites' | 'PW1' | 'PW2' | 'PW3' | string;

export type UserRole = 'Admin' | 'Mechanic' | 'Production Support' | 'Viewer' | AuthorityRole;

export interface User {
  username: string; // NIK
  displayName: string; // Nama
  role: UserRole;
  siteAccess: string[]; // e.g. ['PW1', 'PW2', 'PW3', 'WH2', 'SW', 'QA']
  canAddUser?: boolean;
  canUseRackMap?: boolean;
  nik?: string;
  profile?: string;
  authority?: AuthorityRole;
  language?: 'id' | 'en';
  active?: boolean;
  passwordHash?: string;
  salt?: string;
  failedAttempts?: number;
  lockedUntil?: string; // ISO date or null
  mustChangePassword?: boolean;
  lastLogin?: string;
}

export interface ReportRecipient {
  email: string;
  siteId: string; // 'ALL' or specific Site ID
  language: 'id' | 'en';
  active: boolean;
}

export interface DailyReport {
  reportId: string;
  date: string; // YYYY-MM-DD
  siteId: string;
  content: string; // HTML or text summary
  sentAt?: string;
  stats: {
    totalMoves: number;
    transfersSent: number;
    transfersReceived: number;
    transfersPending: number;
    statusChanges: number;
    opnameLocationsCompleted: number;
    opnameMissingCount: number;
    opnameMisplacedCount: number;
  };
}

export interface AuditLog {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  detail: string;
}

export type ThemePreset = 'sky_cyan' | 'sage_emerald' | 'dark_slate' | 'clean_light' | 'midnight_navy';
export type NavLayoutStyle = 'sidebar' | 'topbar';
export type AccentColor = 'emerald' | 'teal' | 'indigo' | 'blue' | 'amber';

export interface AppSettings {
  dailyReportTime: string; // '16:30'
  transferOverdueDays: number; // 3
  undoTimeLimitMinutes: number; // 60
  sessionExpiryHours: number; // 12
  rackSlotCapacity: number; // 3
  companyName: string; // 'PT.WINNERS'
  spreadsheetId?: string; // Google Spreadsheet ID
  themePreset?: ThemePreset; // 'sage_emerald' (default), 'dark_slate', etc.
  layoutStyle?: NavLayoutStyle; // 'sidebar' (default), 'topbar'
  accentColor?: AccentColor; // 'emerald'
  cardRadius?: string; // 'rounded-2xl' | 'rounded-3xl'
}

export interface TranslationItem {
  key: string;
  id: string;
  en: string;
}
