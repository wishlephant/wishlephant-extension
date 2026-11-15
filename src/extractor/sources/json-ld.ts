import {decodeDeep, decodeEntities} from '../entities';
import type {Json, JsonObject} from '../types';
import {isObject} from '../util';

// Splits "{...}{...}" (several objects in one script tag) into its objects.
function splitJsonObjects(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0 && start >= 0) parts.push(input.slice(start, i + 1));
    }
  }
  return parts;
}

// Removes CDATA wrappers, html comments, broken newlines inside strings and
// trailing commas.
const repair = (raw: string): string =>
  raw
    .replace(/^\s*(\/\/)?\s*<!\[CDATA\[/, '')
    .replace(/(\/\/)?\s*\]\]>\s*$/, '')
    .replace(/^\s*<!--/, '')
    .replace(/-->\s*$/, '')
    .replace(/[\n\r\t]/g, ' ')
    .replace(/,\s*([}\]])/g, '$1');

const tryParse = (input: string): Json | undefined => {
  try {
    return JSON.parse(input) as Json;
  } catch {
    return undefined;
  }
};

// Parses the json of a script tag, repairing it if needed. As a last resort it
// reads every object it can find on its own.
function parseLoosely(raw: string): Json[] {
  const repaired = repair(raw);
  for (const attempt of [raw, repaired, decodeEntities(repaired)]) {
    const result = tryParse(attempt);
    if (result !== undefined) return [result];
  }
  return splitJsonObjects(repaired)
    .map(tryParse)
    .filter((item) => item !== undefined);
}

// All objects of all ld+json script tags, with their html entities decoded.
export function fromJsonLd(doc: Document): JsonObject[] {
  const items: Json[] = [];
  for (const script of doc.querySelectorAll('script')) {
    const type = (script.getAttribute('type') ?? '').toLowerCase().trim();
    if (type !== 'application/ld+json') continue;
    for (const item of parseLoosely(script.textContent ?? '')) {
      items.push(...(Array.isArray(item) ? item : [item]));
    }
  }
  return items.filter(isObject).map((item) => decodeDeep(item, doc) as JsonObject);
}
