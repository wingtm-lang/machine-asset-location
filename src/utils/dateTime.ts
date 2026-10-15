/**
 * Format tanggal-waktu yang mudah dibaca, selalu dalam WIB (Asia/Jakarta).
 * Database menyimpan waktu dalam UTC (contoh: 2026-10-08T00:34:50.942855+00:00).
 *
 *   formatDateTime('2026-10-08T00:34:50.942855+00:00')                          -> "8 Okt 2026, 07.34 WIB"
 *   formatDateTime('2026-10-08T00:34:50.942855+00:00', { seconds: true })        -> "8 Okt 2026, 07.34.50 WIB"
 *   formatDateTime('2026-10-08T00:34:50.942855+00:00', { lang: 'en' })           -> "8 Oct 2026, 07:34 WIB"
 */
const TIME_ZONE = 'Asia/Jakarta';

type Lang = 'id' | 'en';

const formatters: Record<Lang, Intl.DateTimeFormat> = {
  id: new Intl.DateTimeFormat('id-ID', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }),
  en: new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }),
};

function toDate(input: string | number | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'string') {
    // Sebagian browser menolak pecahan detik lebih dari 3 digit (mikrodetik dari Postgres).
    return new Date(input.replace(/(\.\d{3})\d+/, '$1'));
  }
  return new Date(input);
}

export function formatDateTime(
  input: string | number | Date | null | undefined,
  options: { seconds?: boolean; lang?: Lang } = {}
): string {
  if (input === null || input === undefined || input === '') return '-';
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const lang: Lang = options.lang === 'en' ? 'en' : 'id';
  const parts = formatters[lang].formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const sep = lang === 'en' ? ':' : '.';
  const time = `${get('hour')}${sep}${get('minute')}${options.seconds ? sep + get('second') : ''}`;
  return `${get('day')} ${get('month')} ${get('year')}, ${time} WIB`;
}
