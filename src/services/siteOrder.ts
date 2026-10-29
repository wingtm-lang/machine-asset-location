/** Urutan tampilan site di seluruh aplikasi. Site yang tidak tercantum ditaruh setelahnya, urut abjad. */
export const SITE_ORDER = ['PW1', 'PW2', 'PW3', 'WH1', 'WH2', 'WH3', 'SW', 'TBL', 'BO', 'GE'];

export function siteRank(siteId: string): number {
  const i = SITE_ORDER.indexOf(String(siteId || '').toUpperCase());
  return i === -1 ? SITE_ORDER.length : i;
}

/** Salinan array site yang sudah diurutkan (tidak mengubah array asli). */
export function sortSites<T extends { siteId: string }>(sites: T[]): T[] {
  return [...sites].sort((a, b) => siteRank(a.siteId) - siteRank(b.siteId) || a.siteId.localeCompare(b.siteId));
}
