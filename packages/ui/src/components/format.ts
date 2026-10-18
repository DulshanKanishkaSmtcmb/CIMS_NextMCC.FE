/** Locale for displayed numbers: thousands separators with a comma, decimal point (Sri Lanka uses en-GB style). */
export const NUMBER_LOCALE = 'en-GB';

const cache = new Map<string, Intl.NumberFormat>();

/**
 * Display a number with thousands separators and at most `decimals` decimals (no trailing zeros unless `fixed`).
 * Rounding rules belong to the page (e.g. the legacy Knockout `numeric` extender); this only formats.
 */
export function formatNumber(
  value: number | null | undefined,
  decimals = 0,
  { fixed = false }: { fixed?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const key = `${decimals}|${fixed}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.NumberFormat(NUMBER_LOCALE, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: fixed ? decimals : 0,
    });
    cache.set(key, format);
  }
  return format.format(value);
}
