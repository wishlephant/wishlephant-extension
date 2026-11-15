import {text} from './util';

const checkDigit = (isbn: string): string => {
  const digits = [...isbn.slice(0, -1)].map(Number);
  if (isbn.length === 10) {
    const sum = digits.reduce((acc, digit, i) => acc + digit * (i + 1), 0) % 11;
    return sum === 10 ? 'X' : String(sum);
  }
  const sum = digits.reduce((acc, digit, i) => acc + digit * (i % 2 === 0 ? 1 : 3), 0) % 10;
  return sum === 0 ? '0' : String(10 - sum);
};

// Checks the check digit and formats like 978-31-0397-500-0 / 38-6680-192-0.
export function formatIsbn(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const isbn = raw
    .replace(/^isbn(-1[03])?:?/i, '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
  if (!/^(\d{9}[\dX]|\d{13})$/.test(isbn) || checkDigit(isbn) !== isbn.at(-1)) return undefined;

  return isbn.length === 10
    ? `${isbn.slice(0, 2)}-${isbn.slice(2, 6)}-${isbn.slice(6, 9)}-${isbn.slice(9)}`
    : `${isbn.slice(0, 3)}-${isbn.slice(3, 5)}-${isbn.slice(5, 9)}-${isbn.slice(9, 12)}-${isbn.slice(12)}`;
}
