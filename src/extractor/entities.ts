import type {Json, JsonObject} from './types';
import {isObject} from './util';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  euro: '€',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  hellip: '…',
  bull: '•',
  trade: '™',
  OElig: 'Œ',
  oelig: 'œ',
};

// &nbsp; to &yuml; are the characters 160 to 255.
'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'
  .split(' ')
  .forEach((name, index) => {
    NAMED_ENTITIES[name] = String.fromCharCode(160 + index);
  });

// Every other entity is decoded by the browser. A textarea never runs or loads
// anything that is set as its html.
function decodeWithBrowser(entity: string, doc: Document | undefined): string | undefined {
  try {
    const textarea = doc?.createElement('textarea');
    if (!textarea) return undefined;
    textarea.innerHTML = `&${entity};`;
    const value = textarea.value ?? textarea.textContent;
    return value && value !== `&${entity};` ? value : undefined;
  } catch {
    return undefined;
  }
}

// Decodes html entities in text that is not html, like json some sites encode.
export function decodeEntities(input: string, doc?: Document): string {
  if (!input.includes('&')) return input;
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1] === 'x' || entity[1] === 'X';
      try {
        return String.fromCodePoint(hex ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()] ?? decodeWithBrowser(entity, doc) ?? match;
  });
}

// Decodes every string in a json value. Twice, as some sites encode twice
// ("&amp;uuml;").
export function decodeDeep(value: Json, doc?: Document): Json {
  if (typeof value === 'string') return decodeEntities(decodeEntities(value, doc), doc);
  if (Array.isArray(value)) return value.map((item) => decodeDeep(item, doc));
  if (isObject(value)) {
    const result: JsonObject = {};
    for (const [key, item] of Object.entries(value)) result[key] = decodeDeep(item, doc);
    return result;
  }
  return value;
}
