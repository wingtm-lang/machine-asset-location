import { supabase } from '../../services/supabase';

// Level C rak WH2: slot dinamis, banyak mesin per slot, dan catatan teks (sparepart / dokumen).
export type CState = 'EMPTY' | 'MACHINE' | 'NOTE' | 'BOTH';

export interface CMachine {
  assetCode: string;
  localName: string;
  standardName: string;
  item: string;
  category: string;
  status: string;
}
export interface CNote {
  id: number;
  text: string;
  nik: string;
  createdAt: string;
}
export interface CSlot {
  locationId: string;
  slotNo: number;
  machines: CMachine[];
  notes: CNote[];
}

export function slotState(s: { machines: unknown[]; notes: unknown[] }): CState {
  const m = s.machines.length > 0;
  const n = s.notes.length > 0;
  return m && n ? 'BOTH' : m ? 'MACHINE' : n ? 'NOTE' : 'EMPTY';
}

export function columnState(slots: CSlot[] | undefined): CState {
  if (!slots) return 'EMPTY';
  const m = slots.some((s) => s.machines.length > 0);
  const n = slots.some((s) => s.notes.length > 0);
  return m && n ? 'BOTH' : m ? 'MACHINE' : n ? 'NOTE' : 'EMPTY';
}

/** Semua slot level C satu rak, dikelompokkan per nomor kolom. */
export async function loadLevelC(rackId: string): Promise<Map<number, CSlot[]>> {
  const rackNo = Number(rackId.slice(1));
  const prefix = `WH2-${rackId}-C`;

  const [locs, macs, notes] = await Promise.all([
    supabase
      .from('locations')
      .select('location_id, column_no, slot_no')
      .eq('site_id', 'WH2')
      .eq('type', 'RACK_SLOT')
      .eq('stack', 'C')
      .eq('rack_no', rackNo)
      .eq('active', true)
      .order('column_no')
      .order('slot_no')
      .limit(5000),
    supabase
      .from('machines')
      .select('asset_code, item, standard_machine_name, status, category, location_id, machine_types(local_name)')
      .like('location_id', `${prefix}%`)
      .limit(5000),
    supabase
      .from('rack_notes')
      .select('id, location_id, note, created_by_nik, created_at')
      .like('location_id', `${prefix}%`)
      .order('id')
      .limit(5000),
  ]);
  if (locs.error) throw locs.error;
  if (macs.error) throw macs.error;
  if (notes.error) throw notes.error;

  const bySlot = new Map<string, CSlot>();
  const out = new Map<number, CSlot[]>();
  for (const l of (locs.data ?? []) as any[]) {
    const s: CSlot = { locationId: l.location_id, slotNo: l.slot_no, machines: [], notes: [] };
    bySlot.set(l.location_id, s);
    const arr = out.get(l.column_no) ?? [];
    arr.push(s);
    out.set(l.column_no, arr);
  }
  for (const m of (macs.data ?? []) as any[]) {
    const s = bySlot.get(m.location_id);
    if (!s) continue;
    const mt = m.machine_types as { local_name?: string } | null;
    s.machines.push({
      assetCode: m.asset_code,
      localName: mt?.local_name ?? '',
      standardName: m.standard_machine_name ?? '',
      item: m.item ?? '',
      category: m.category,
      status: m.status,
    });
  }
  for (const n of (notes.data ?? []) as any[]) {
    const s = bySlot.get(n.location_id);
    if (!s) continue;
    s.notes.push({ id: n.id, text: n.note, nik: n.created_by_nik ?? '', createdAt: n.created_at });
  }
  return out;
}

export const LEVEL_C_COLORS: Record<CState, string> = {
  EMPTY: 'bg-slate-200 dark:bg-slate-700/60',
  MACHINE: 'bg-indigo-600 dark:bg-indigo-400', // sama dengan slot terisi di level lain
  NOTE: 'bg-amber-500 dark:bg-amber-400',
  BOTH: 'bg-emerald-600 dark:bg-emerald-400',
};
