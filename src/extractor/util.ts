import type {JsonObject} from './types';

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Pages often use a list where a single value is expected, we use the first one.
export const first = <T>(value: T | T[]): T | undefined => (Array.isArray(value) ? value[0] : value);

// A trimmed, non empty string of a value (or of the first value of a list).
export const text = (value: unknown): string | undefined => {
  const item = first(value);
  if (typeof item === 'string') return item.trim() || undefined;
  if (typeof item === 'number') return String(item);
  return undefined;
};

export const findNonBlank = <T>(...values: (T | undefined | null | '')[]): T | undefined =>
  values.find((value): value is T => value !== undefined && value !== null && value !== '');

export const elementText = (element: Element | null | undefined): string | undefined =>
  element?.textContent?.replace(/\s+/g, ' ').trim() || undefined;

export const pageTitle = (doc: Document): string | undefined =>
  elementText(doc.querySelector('head title')) ?? elementText(doc.querySelector('title'));

export const hostMatches = (url: string, pattern: RegExp): boolean => {
  try {
    return pattern.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

// Runs one extraction step. A step that breaks on a broken page must not take
// the data of the other steps with it.
export const safely = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch (error) {
    console.error('wishlephant: extraction step failed', error);
    return fallback;
  }
};
