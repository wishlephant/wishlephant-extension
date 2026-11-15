const CURRENCY_SYMBOLS: Record<string, string> = {
  '€': 'EUR',
  $: 'USD',
  US$: 'USD',
  '£': 'GBP',
  '¥': 'JPY',
  Fr: 'CHF',
  'Fr.': 'CHF',
  kr: 'SEK',
  zł: 'PLN',
};

// An ISO currency code for "eur", "EUR" or "€".
export function normalizeCurrency(currency: string | undefined): string | undefined {
  const value = currency?.trim();
  if (!value) return undefined;
  if (/^[a-z]{3}$/i.test(value)) return value.toUpperCase();
  return CURRENCY_SYMBOLS[value];
}

// digits with optional thousands groups ("1.299", "2 199", "1'299") and decimals
const NUMBER = /-?(?:\d{1,3}(?:[.,'\u2019 \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?/;

// Turns "1.299,00 €", "1,299.00", "12,5" or 12.5 into "1299.00", "1299.00",
// "12.5" and "12.5". Only the first number counts, so "19,90 € * inkl. 19%
// MwSt." is 19.90. The last separator is the decimal one, except when a single
// kind of separator shows up several times ("1.299.000") or a single comma is
// followed by three digits ("1,299"). A single "1.299" stays 1.299, schema.org
// prices use a dot for decimals.
export function normalizePrice(price: string | number | undefined | null): string | undefined {
  if (price === undefined || price === null) return undefined;
  if (typeof price === 'number') return Number.isFinite(price) ? String(price) : undefined;

  const number = price.match(NUMBER)?.[0];
  if (!number) return undefined;
  const cleaned = number.replace(/[^\d.,-]/g, '');

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const decimalIndex = Math.max(lastDot, lastComma);
  let integer = cleaned;
  let fraction = '';

  if (decimalIndex >= 0) {
    const separator = cleaned[decimalIndex];
    const digitsAfter = cleaned.length - decimalIndex - 1;
    const onlyOneKind = lastDot < 0 || lastComma < 0;
    const occurrences = cleaned.split(separator).length - 1;
    const isThousands = onlyOneKind && (occurrences > 1 || (digitsAfter === 3 && separator === ','));
    if (!isThousands) {
      integer = cleaned.slice(0, decimalIndex);
      fraction = cleaned.slice(decimalIndex + 1).replace(/\D/g, '');
    }
  }

  integer = integer.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '') || '0';
  const result = fraction ? `${integer}.${fraction}` : integer;
  return Number.isFinite(Number(result)) ? result : undefined;
}
