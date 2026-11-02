import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { makeT } from '../services/translations';
import { useAuth } from '../services/authContext';
import { storageService } from '../services/storage';
import { sortSites } from '../services/siteOrder';
import { supabase } from '../services/supabase';
import { getMachineLabel } from '../utils/machineName';

// Satu baris mesin yang sudah disamakan bentuknya (sewing dan non sewing tidak dibedakan).
interface Unit {
  siteId: string;
  locationId: string;
  status: string;
  local: string;
  std: string;
  item: string;
}
interface Loc { location_id: string; site_id: string; type: string; display_name: string; sort_order: number }
interface Part { key: string; label: string; code: string; rank: number; order: number; units: Unit[] }

const RACK_RE = /^WH2-(R[1-6])-/;

export const FactoryMapView: React.FC = () => {
  const { language, canAccessSite } = useAuth();
  const t = makeT(language);
  const [, setTick] = useState(0);
  useEffect(() => storageService.subscribe(() => setTick((n) => n + 1)), []);

  const [nsUnits, setNsUnits] = useState<Unit[]>([]);
  const [nsAreas, setNsAreas] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows: any[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error: e } = await supabase
            .from('machines')
            .select('item, standard_machine_name, site_id, location_id, status')
            .eq('category', 'NON_SEWING')
            .order('id')
            .range(from, from + 999);
          if (e) throw e;
          rows.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        const [tp, lc] = await Promise.all([
          supabase.from('machine_types').select('standard_name, local_name').eq('category', 'NON_SEWING'),
          supabase.from('locations').select('location_id, site_id, type, display_name, sort_order').eq('type', 'NS_AREA').eq('active', true),
        ]);
        const localOf = new Map<string, string>(
          ((tp.data ?? []) as any[]).filter((x) => x.local_name).map((x) => [x.standard_name, x.local_name])
        );
        if (!alive) return;
        setNsUnits(
          rows.map((r) => ({
            siteId: r.site_id,
            locationId: r.location_id ?? '',
            status: r.status,
            local: localOf.get(r.standard_machine_name) ?? '',
            std: r.standard_machine_name ?? '',
            item: r.item ?? '',
          }))
        );
        setNsAreas((lc.data ?? []) as unknown as Loc[]);
      } catch (e: any) {
        if (alive) setError(String(e?.message ?? ''));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const sites = useMemo(
    () => sortSites(storageService.getSites().filter((s) => s.active && canAccessSite(s.siteId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageService.getSites().length]
  );
  const [site, setSite] = useState('');
  useEffect(() => {
    if (!site && sites.length > 0) setSite(sites[0].siteId);
  }, [sites, site]);

  const [open, setOpen] = useState<Set<string>>(new Set());

  const sewingUnits: Unit[] = storageService.getAllMachines().map((m) => ({
    siteId: m.siteId,
    locationId: m.locationId,
    status: m.status,
    local: m.localName ?? '',
    std: m.standardMachineName,
    item: m.item,
  }));

  const parts: Part[] = useMemo(() => {
    if (!site) return [];
    const map = new Map<string, Part>();
    const ensure = (key: string, label: string, code: string, rank: number, order: number) => {
      let p = map.get(key);
      if (!p) {
        p = { key, label, code, rank, order, units: [] };
        map.set(key, p);
      }
      return p;
    };
    const locs = storageService.getLocations(site).filter((l) => l.active);
    locs.forEach((l, i) => {
      const type = String(l.type);
      if (type === 'RACK_SLOT') {
        const m = RACK_RE.exec(l.locationId);
        if (m) ensure(`RACK-${m[1]}`, t('fm_rack', { r: m[1] }), `${site}-${m[1]}`, 3, Number(m[1].slice(1)));
        return;
      }
      const rank = type === 'UNASSIGNED' ? 4 : type === 'GUDANG' || type === 'MAIN' ? 2 : 0;
      ensure(l.locationId, l.displayName, l.locationId, rank, i);
    });
    nsAreas
      .filter((l) => l.site_id === site)
      .forEach((l, i) => ensure(l.location_id, l.display_name, l.location_id, l.location_id.endsWith('-NS-UNASSIGNED') ? 4 : 1, l.sort_order ?? i));

    for (const u of [...sewingUnits, ...nsUnits]) {
      if (u.siteId !== site || u.status === 'SOLD') continue;
      let p: Part | undefined;
      if (u.status === 'IN_TRANSIT' || !u.locationId) {
        p = ensure('IN_TRANSIT', t('fm_in_transit'), '', 5, 0);
      } else {
        const rm = RACK_RE.exec(u.locationId);
        p = map.get(rm ? `RACK-${rm[1]}` : u.locationId) ?? ensure(u.locationId, u.locationId, u.locationId, 4, 999);
      }
      p.units.push(u);
    }
    // bagian In Transit hanya muncul bila ada isinya
    const it = map.get('IN_TRANSIT');
    if (it && it.units.length === 0) map.delete('IN_TRANSIT');
    return [...map.values()].sort(
      (a, b) => a.rank - b.rank || a.order - b.order || a.label.localeCompare(b.label, undefined, { numeric: true })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, nsUnits, nsAreas, sewingUnits.length, language, storageService.getLocations(site).length]);

  const breakdown = (units: Unit[]) => {
    const g = new Map<string, { primary: string; secondary: string; n: number }>();
    for (const u of units) {
      const lab = getMachineLabel({ localName: u.local, standardMachineName: u.std, item: u.item });
      const key = `${lab.primary}|${lab.secondary}`;
      const cur = g.get(key);
      if (cur) cur.n += 1;
      else g.set(key, { primary: lab.primary, secondary: lab.secondary, n: 1 });
    }
    return [...g.values()].sort((a, b) => b.n - a.n || a.primary.localeCompare(b.primary));
  };

  const total = parts.reduce((n, p) => n + p.units.length, 0);
  const toggle = (k: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="block">
          <span className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">{t('fm_pick_site')}</span>
          <select
            value={site}
            onChange={(e) => {
              setSite(e.target.value);
              setOpen(new Set());
            }}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium min-w-[240px]"
          >
            {sites.map((s) => (
              <option key={s.siteId} value={s.siteId}>
                {s.siteId} - {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm text-slate-600 dark:text-slate-300 sm:ml-2 flex-1">
          {loading ? (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" />{t('fm_loading')}</span>
          ) : (
            t('fm_summary', { n: total, k: parts.length })
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(new Set(parts.filter((p) => p.units.length > 0).map((p) => p.key)))}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t('fm_open_all')}
          </button>
          <button
            type="button"
            onClick={() => setOpen(new Set())}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t('fm_close_all')}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">{t('fm_ns_failed')}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {parts.map((p) => {
          const isOpen = open.has(p.key);
          const empty = p.units.length === 0;
          return (
            <div
              key={p.key}
              className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden ${empty ? 'opacity-60' : ''}`}
            >
              <button
                type="button"
                disabled={empty}
                onClick={() => toggle(p.key)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left disabled:cursor-default"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {empty ? <span className="w-4" /> : isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <span className="min-w-0">
                    <span className="block font-bold text-sm text-slate-900 dark:text-white truncate">{p.label}</span>
                    {p.code && <span className="block font-mono text-[10px] text-slate-400">{p.code}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                  {empty ? t('fm_empty') : t('fm_n_machines', { n: p.units.length })}
                </span>
              </button>
              {isOpen && !empty && (
                <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                  {breakdown(p.units).map((r) => (
                    <div key={`${r.primary}|${r.secondary}`} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-800 dark:text-slate-100 truncate">{r.primary}</span>
                        {r.secondary && <span className="block text-[10px] text-slate-400 truncate">{r.secondary}</span>}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">{r.n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
