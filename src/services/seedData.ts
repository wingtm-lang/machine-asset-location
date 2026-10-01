import { Site, Location, Rack, Machine, User, ReportRecipient, AppSettings, Movement, StatusLog } from '../types';

export const INITIAL_SITES: Site[] = [
  { siteId: 'PW1', name: 'PT.WINNERS(1)', type: 'FACTORY', active: true },
  { siteId: 'PW2', name: 'PT.WINNERS(2)', type: 'FACTORY', active: true },
  { siteId: 'PW3', name: 'PT.WINNERS(3)', type: 'FACTORY', active: true },
  { siteId: 'WH2', name: 'Warehouse 2', type: 'WAREHOUSE', active: true },
  { siteId: 'SW', name: 'Smart Warehouse', type: 'SITE', active: true },
  { siteId: 'QA', name: 'QA Lab', type: 'LAB', active: true },
];

export const INITIAL_RACKS: Rack[] = [
  { siteId: 'WH2', rackNo: 1, columnCount: 6, active: true },
  { siteId: 'WH2', rackNo: 2, columnCount: 6, active: true },
  { siteId: 'WH2', rackNo: 3, columnCount: 8, active: true },
  { siteId: 'WH2', rackNo: 4, columnCount: 8, active: true },
  { siteId: 'WH2', rackNo: 5, columnCount: 5, active: true },
  { siteId: 'WH2', rackNo: 6, columnCount: 5, active: true },
];

export function generateLocations(): Location[] {
  const locations: Location[] = [];
  let sortOrder = 1;

  // PW1
  for (let i = 1; i <= 30; i++) {
    const num = String(i).padStart(2, '0');
    locations.push({
      locationId: `PW1-L${num}`,
      siteId: 'PW1',
      type: 'LINE',
      displayName: `Line ${num}`,
      active: true,
      sortOrder: sortOrder++,
    });
  }
  ['A', 'B', 'C', 'D'].forEach((extra) => {
    locations.push({
      locationId: `PW1-LX${extra}`,
      siteId: 'PW1',
      type: 'LINE_EXTRA',
      displayName: `Line Extra ${extra}`,
      active: true,
      sortOrder: sortOrder++,
    });
  });
  locations.push({
    locationId: 'PW1-GUD',
    siteId: 'PW1',
    type: 'GUDANG',
    displayName: 'Gudang Factory PW1',
    active: true,
    sortOrder: sortOrder++,
  });
  locations.push({
    locationId: 'PW1-UNASSIGNED',
    siteId: 'PW1',
    type: 'UNASSIGNED',
    displayName: 'PW1 Belum Ditentukan Line',
    active: true,
    sortOrder: sortOrder++,
  });

  // PW2
  for (let i = 1; i <= 30; i++) {
    const num = String(i).padStart(2, '0');
    locations.push({
      locationId: `PW2-L${num}`,
      siteId: 'PW2',
      type: 'LINE',
      displayName: `Line ${num}`,
      active: true,
      sortOrder: sortOrder++,
    });
  }
  ['A', 'B', 'C', 'D'].forEach((extra) => {
    locations.push({
      locationId: `PW2-LX${extra}`,
      siteId: 'PW2',
      type: 'LINE_EXTRA',
      displayName: `Line Extra ${extra}`,
      active: true,
      sortOrder: sortOrder++,
    });
  });
  locations.push({
    locationId: 'PW2-GUD',
    siteId: 'PW2',
    type: 'GUDANG',
    displayName: 'Gudang Factory PW2',
    active: true,
    sortOrder: sortOrder++,
  });
  locations.push({
    locationId: 'PW2-UNASSIGNED',
    siteId: 'PW2',
    type: 'UNASSIGNED',
    displayName: 'PW2 Belum Ditentukan Line',
    active: true,
    sortOrder: sortOrder++,
  });

  // PW3 (No Gudang)
  for (let i = 1; i <= 30; i++) {
    const num = String(i).padStart(2, '0');
    locations.push({
      locationId: `PW3-L${num}`,
      siteId: 'PW3',
      type: 'LINE',
      displayName: `Line ${num}`,
      active: true,
      sortOrder: sortOrder++,
    });
  }
  ['A', 'B', 'C', 'D'].forEach((extra) => {
    locations.push({
      locationId: `PW3-LX${extra}`,
      siteId: 'PW3',
      type: 'LINE_EXTRA',
      displayName: `Line Extra ${extra}`,
      active: true,
      sortOrder: sortOrder++,
    });
  });
  locations.push({
    locationId: 'PW3-UNASSIGNED',
    siteId: 'PW3',
    type: 'UNASSIGNED',
    displayName: 'PW3 Belum Ditentukan Line',
    active: true,
    sortOrder: sortOrder++,
  });

  // WH2 Rack Slots
  INITIAL_RACKS.forEach((rack) => {
    for (let col = 1; col <= rack.columnCount; col++) {
      ['A', 'B', 'C'].forEach((stack) => {
        locations.push({
          locationId: `WH2-R${rack.rackNo}-${col}${stack}`,
          siteId: 'WH2',
          type: 'RACK_SLOT',
          displayName: `Rak ${rack.rackNo} Kolom ${col} Stack ${stack}`,
          rackNo: rack.rackNo,
          columnNo: col,
          stack,
          capacity: 3,
          active: true,
          sortOrder: sortOrder++,
        });
      });
    }
  });
  locations.push({
    locationId: 'WH2-UNASSIGNED',
    siteId: 'WH2',
    type: 'UNASSIGNED',
    displayName: 'WH2 Belum Ditentukan Slot',
    active: true,
    sortOrder: sortOrder++,
  });

  // SW
  locations.push({
    locationId: 'SW-MAIN',
    siteId: 'SW',
    type: 'MAIN',
    displayName: 'Smart Warehouse Area Utama',
    active: true,
    sortOrder: sortOrder++,
  });

  // QA
  locations.push({
    locationId: 'QA-MAIN',
    siteId: 'QA',
    type: 'MAIN',
    displayName: 'QA Lab Area Utama',
    active: true,
    sortOrder: sortOrder++,
  });

  return locations;
}

export const INITIAL_SETTINGS: AppSettings = {
  dailyReportTime: '16:30',
  transferOverdueDays: 3,
  undoTimeLimitMinutes: 60,
  sessionExpiryHours: 12,
  rackSlotCapacity: 3,
  companyName: 'PT.WINNERS',
  spreadsheetId: '1-D87s2xI6ERVQydmP1Gbmj7XzqB5o7Ziib7mvKVhtio',
  themePreset: 'sky_cyan',
  layoutStyle: 'sidebar',
  accentColor: 'emerald',
  cardRadius: 'rounded-2xl',
};

export const INITIAL_USERS: User[] = [
  {
    username: 'admin',
    displayName: 'System Administrator (PT.WINNERS)',
    role: 'Admin',
    siteAccess: ['ALL'],
    language: 'id',
    active: true,
    failedAttempts: 0,
    mustChangePassword: false,
    lastLogin: '2026-09-24 08:30',
  },
  {
    username: 'mechanic_pw1',
    displayName: 'Budi Santoso (Mekanik PW1)',
    role: 'Mechanic',
    siteAccess: ['PW1'],
    language: 'id',
    active: true,
    failedAttempts: 0,
    mustChangePassword: false,
    lastLogin: '2026-09-24 07:15',
  },
  {
    username: 'mechanic_pw2',
    displayName: 'Ahmad Supriyadi (Mekanik PW2)',
    role: 'Mechanic',
    siteAccess: ['PW2'],
    language: 'id',
    active: true,
    failedAttempts: 0,
    mustChangePassword: false,
    lastLogin: '2026-09-23 16:40',
  },
  {
    username: 'mechanic_pw3',
    displayName: 'Hendra Wijaya (Mekanik PW3)',
    role: 'Mechanic',
    siteAccess: ['PW3'],
    language: 'id',
    active: true,
    failedAttempts: 0,
    mustChangePassword: false,
  },
  {
    username: 'mechanic_wh2',
    displayName: 'Rian Kurniawan (Mekanik WH2, SW, QA)',
    role: 'Mechanic',
    siteAccess: ['WH2', 'SW', 'QA'],
    language: 'id',
    active: true,
    failedAttempts: 0,
    mustChangePassword: false,
  },
  {
    username: 'prod_support_pw1',
    displayName: 'Dewi Lestari (Prod. Support PW1)',
    role: 'Production Support',
    siteAccess: ['PW1'],
    language: 'id',
    active: true,
    failedAttempts: 0,
    mustChangePassword: false,
  },
  {
    username: 'viewer_all',
    displayName: 'Management Viewer (Semua Site)',
    role: 'Viewer',
    siteAccess: ['ALL'],
    language: 'en',
    active: true,
    failedAttempts: 0,
    mustChangePassword: false,
  },
];

export const INITIAL_RECIPIENTS: ReportRecipient[] = [
  { email: 'ptwinners7@gmail.com', siteId: 'ALL', language: 'id', active: true },
  { email: 'plant.manager@ptwinners.co.id', siteId: 'ALL', language: 'en', active: true },
  { email: 'head.mechanic.pw1@ptwinners.co.id', siteId: 'PW1', language: 'id', active: true },
  { email: 'head.mechanic.pw2@ptwinners.co.id', siteId: 'PW2', language: 'id', active: true },
  { email: 'head.mechanic.pw3@ptwinners.co.id', siteId: 'PW3', language: 'id', active: true },
  { email: 'warehouse.manager@ptwinners.co.id', siteId: 'WH2', language: 'id', active: true },
];

interface MachineModelTemplate {
  name: string;
  itemKr: string;
  manufacturer: string;
  model: string;
}

const MACHINE_TEMPLATES: MachineModelTemplate[] = [
  { name: '1-Needle Lockstitch Machine', itemKr: '본봉자동', manufacturer: 'JUKI', model: 'DDL-8700-7' },
  { name: '1-Needle Lockstitch Machine Direct Drive', itemKr: '본봉자동', manufacturer: 'JUKI', model: 'DDL-9000C-FMS' },
  { name: '1-Needle Lockstitch with Electronic Feed', itemKr: '본봉직결', manufacturer: 'BROTHER', model: 'S-7300A-403P' },
  { name: '2-Needle Lockstitch Machine', itemKr: '쌍침자동', manufacturer: 'BROTHER', model: 'T-8422C-003' },
  { name: '3-Thread Overlock Machine', itemKr: '오버록 (3침)', manufacturer: 'PEGASUS', model: 'EXT3216-03/233' },
  { name: '4-Thread Super High Speed Overlock Machine', itemKr: '오버록 (4침)', manufacturer: 'JUKI', model: 'MO-6814S' },
  { name: '5-Thread Safety Stitch Machine', itemKr: '인터록 (5침)', manufacturer: 'SIRUBA', model: '757K-516M2-35' },
  { name: 'Flatlock / Interlock Cylinder Bed Machine', itemKr: '삼봉 (플랫락)', manufacturer: 'YAMATO', model: 'VC2700-156M' },
  { name: 'Flatbed Top and Bottom Coverstitch Machine', itemKr: '삼봉평상', manufacturer: 'PEGASUS', model: 'W562PV-01GB' },
  { name: 'Electronic Bar Tacking Machine', itemKr: '바텍 (전자)', manufacturer: 'JUKI', model: 'LK-1900BN-SS' },
  { name: 'Computer-controlled Buttonhole Machine', itemKr: '나나인치 (단추구멍)', manufacturer: 'JUKI', model: 'LBH-1790AN' },
  { name: 'Eyelet Buttonhole Machine', itemKr: '큐큐 (아이렛)', manufacturer: 'BROTHER', model: 'RH-9820-01' },
  { name: 'Electronic Button Attaching Machine', itemKr: '단추달이 (전자)', manufacturer: 'JUKI', model: 'MB-1800B' },
  { name: 'Automatic Placket Attaching Machine', itemKr: '플라켓 자동부착기', manufacturer: 'JACK', model: 'JK-T9820' },
  { name: 'Multi-Needle Elastic Waistband Machine', itemKr: '오비 (밴드부착)', manufacturer: 'KANSAI SPECIAL', model: 'FBX-1104P' },
  { name: 'Programmable Pattern Sewing Machine', itemKr: '전자패턴기', manufacturer: 'MITSUBISHI', model: 'PLK-G2010R' },
  { name: 'Automatic Pocket Welting Machine', itemKr: '주머니 자동봉제기', manufacturer: 'JUKI', model: 'APW-895' },
  { name: 'Hot Air Seam Sealing Machine', itemKr: '심실링기', manufacturer: 'SEAMTEK', model: 'ST-800' },
  { name: 'Straight Knife Cloth Cutting Machine', itemKr: '재단기', manufacturer: 'EASTMAN', model: '629X Blue Streak' },
  { name: 'Continuous Fusing Press Machine', itemKr: '접착기', manufacturer: 'HASHIMA', model: 'HP-450MS' },
];

/**
 * Generates 5,700 realistic machine records simulating the full PT.WINNERS factory asset base
 */
export function generateMachineDataset(): { machines: Machine[]; movements: Movement[]; statusLogs: StatusLog[] } {
  const locations = generateLocations();
  const pw1Locs = locations.filter((l) => l.siteId === 'PW1' && l.type === 'LINE').map((l) => l.locationId);
  const pw2Locs = locations.filter((l) => l.siteId === 'PW2' && l.type === 'LINE').map((l) => l.locationId);
  const pw3Locs = locations.filter((l) => l.siteId === 'PW3' && l.type === 'LINE').map((l) => l.locationId);
  const wh2Slots = locations.filter((l) => l.siteId === 'WH2' && l.type === 'RACK_SLOT').map((l) => l.locationId);

  const machines: Machine[] = [];
  const movements: Movement[] = [];
  const statusLogs: StatusLog[] = [];

  const totalTarget = 5700;

  // Track counts per slot to respect WH2 rack max 3
  const slotCountMap = new Map<string, number>();

  for (let i = 1; i <= totalTarget; i++) {
    const tmpl = MACHINE_TEMPLATES[i % MACHINE_TEMPLATES.length];

    // Asset code pattern: IDN-{dept}-{YYMM}-{index}
    const dept = (i % 3) + 8; // 8, 9, 10
    const yearMonth = 2000 + (i % 24) + ((i % 12) + 1).toString().padStart(2, '0');
    const assetSeq = String(1000 + i).padStart(4, '0');
    const assetCode = `IDN-${dept}-${yearMonth}-${assetSeq}`;

    // 12-digit barcode with leading zeroes
    const barcodeNumber = 60000 + i;
    const barcode = String(barcodeNumber).padStart(12, '0');

    // Serial with preserved leading zeros e.g. 0976914, 0048123
    const serialPrefix = String((i * 17) % 100).padStart(2, '0');
    const serialSuffix = String((i * 3137) % 100000).padStart(5, '0');
    const serial = `${serialPrefix}${serialSuffix}`;

    // Distribute among sites
    // ~2000 in PW1, ~1900 in PW2, ~1300 in PW3, ~400 in WH2, ~50 in SW, ~50 in QA
    let siteId: string;
    let locationId: string;
    let homeFactory: string;

    const modVal = i % 100;
    if (modVal < 36) {
      siteId = 'PW1';
      homeFactory = 'PT.WINNERS(1)';
      locationId = pw1Locs[i % pw1Locs.length];
    } else if (modVal < 70) {
      siteId = 'PW2';
      homeFactory = 'PT.WINNERS(2)';
      locationId = pw2Locs[i % pw2Locs.length];
    } else if (modVal < 92) {
      siteId = 'PW3';
      homeFactory = 'PT.WINNERS(3)';
      locationId = pw3Locs[i % pw3Locs.length];
    } else if (modVal < 98) {
      siteId = 'WH2';
      homeFactory = i % 2 === 0 ? 'PT.WINNERS(1)' : 'PT.WINNERS(2)';
      const slotIndex = i % wh2Slots.length;
      const targetSlot = wh2Slots[slotIndex];
      const curCount = slotCountMap.get(targetSlot) || 0;
      if (curCount < 3) {
        locationId = targetSlot;
        slotCountMap.set(targetSlot, curCount + 1);
      } else {
        locationId = 'WH2-UNASSIGNED';
      }
    } else if (modVal === 98) {
      siteId = 'SW';
      homeFactory = 'PT.WINNERS(1)';
      locationId = 'SW-MAIN';
    } else {
      siteId = 'QA';
      homeFactory = 'PT.WINNERS(3)';
      locationId = 'QA-MAIN';
    }

    // Status distribution
    let status: Machine['status'] = 'ACTIVE';
    let loanTo: string | undefined = undefined;
    let loanDueDate: string | undefined = undefined;

    if (i % 73 === 0) {
      status = 'BROKEN';
    } else if (i % 89 === 0) {
      status = 'IN_REPAIR';
    } else if (i % 149 === 0) {
      status = 'LOANED';
      loanTo = 'Subcontractor CV. Mandiri Jaya';
      loanDueDate = '2026-10-15';
    } else if (i === 5698 || i === 5699) {
      status = 'SOLD';
    }

    // Specific known test cases from Checklist C
    if (i === 1) {
      // Automatic Placket Attaching Machine
      // 'IDN-8-2509-3775'
    }

    const machine: Machine = {
      assetCode,
      barcode,
      item: tmpl.itemKr,
      homeFactory,
      acqDate: `20${18 + (i % 8)}-${String((i % 12) + 1).padStart(2, '0')}-15`,
      standardMachineName: tmpl.name,
      serial,
      manufacturer: tmpl.manufacturer,
      model: tmpl.model,
      status,
      locationId,
      siteId,
      lastMovedAt: `2026-09-${String((i % 24) + 1).padStart(2, '0')}T09:15:00Z`,
      lastMovedBy: 'mechanic_pw1',
      lastOpnameAt: i % 2 === 0 ? '2026-09-21T14:20:00Z' : undefined,
      statusSince: '2026-08-01T08:00:00Z',
      loanTo,
      loanDueDate,
      dataFlag: i % 250 === 0 ? 'SERIAL_SPACE' : undefined,
      updatedAt: '2026-09-24T02:00:00Z',
      updatedBy: 'system',
      notes: i % 50 === 0 ? 'Mesin jahit berkecepatan tinggi dengan pemotong benang otomatis' : undefined,
    };

    machines.push(machine);

    // Initial movement log for sample
    if (i <= 40) {
      movements.push({
        movementId: `MOV-${1000 + i}`,
        timestamp: machine.lastMovedAt || '2026-09-20T10:00:00Z',
        assetCode: machine.assetCode,
        type: 'MOVE',
        fromLocation: `${siteId}-UNASSIGNED`,
        toLocation: locationId,
        fromSite: siteId,
        toSite: siteId,
        reason: 'Setup line produksi awal',
        byUser: 'mechanic_pw1',
      });
    }
  }

  return { machines, movements, statusLogs };
}
