/**
 * Format tanggal-waktu yang mudah dibaca, selalu dalam WIB (Asia/Jakarta).
 * Database menyimpan waktu dalam UTC (contoh: 2026-10-08T00:34:50.942855+00:00).
 *
 *   formatDateTime('2026-10-08T00:34:50.942855+00:00')                   -> "8 Okt 2026, 07.34 WIB"
 *   formatDateTime('2026-10-08T00:34:50.942855+00:00', { seconds: true }) -> "8 Okt 2026, 07.34.50 WIB"
 */
const TIME_ZONE = 'Asia/Jakarta';

const formatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

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
  options: { seconds?: boolean } = {}
): string {
  if (input === null || input === undefined || input === '') return '-';
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const time = `${get('hour')}.${get('minute')}${options.seconds ? '.' + get('second') : ''}`;
  return `${get('day')} ${get('month')} ${get('year')}, ${time} WIB`;
}
