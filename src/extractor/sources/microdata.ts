import type {Json, JsonObject} from '../types';

// Turns microdata into the same shape as ld+json, so both are read the same way.

const SCHEMA_TYPE = /^(?:https?:)?\/\/(?:www\.)?(?:schema\.org|data-vocabulary\.org)\/(.+)$/i;
const SCOPES = '[itemscope], [itemScope]';

// HTML attributes are case insensitive, but XHTML pages keep React's "itemProp".
const attr = (element: Element, name: string): string | null =>
  element.getAttribute(name) ??
  element.getAttribute(name.replace(/^item(.)/, (_, c: string) => `item${c.toUpperCase()}`));

const hasAttr = (element: Element, name: string): boolean => attr(element, name) !== null;

function propertyValue(element: Element): string {
  for (const attribute of ['content', 'src', 'href', 'datetime', 'value']) {
    const value = element.getAttribute(attribute);
    if (value !== null) return value.trim();
  }
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// A property can show up several times, then it becomes a list.
function addProperty(item: JsonObject, names: string, value: Json) {
  for (const name of names.split(/\s+/).filter(Boolean)) {
    const existing = item[name];
    if (existing === undefined) item[name] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else item[name] = [existing, value];
  }
}

function readItem(element: Element, visited = new Set<Element>()): JsonObject {
  const item: JsonObject = {};
  visited.add(element);
  const typeMatch = (attr(element, 'itemtype') ?? '').trim().split(/\s+/)[0].match(SCHEMA_TYPE);
  if (typeMatch) item['@type'] = typeMatch[1].replace(/\/$/, '');

  const visit = (node: Element) => {
    if (visited.has(node) && node !== element) return;
    visited.add(node);
    const prop = attr(node, 'itemprop');
    const isScope = hasAttr(node, 'itemscope');
    if (prop) addProperty(item, prop, isScope ? readItem(node, visited) : propertyValue(node));
    // nested items own their children
    if (!isScope) visitChildren(node);
  };
  const visitChildren = (parent: Element) => {
    for (const child of parent.children) visit(child);
  };

  visitChildren(element);
  // itemref pulls in properties from elsewhere on the page (by id)
  for (const id of (attr(element, 'itemref') ?? '').split(/\s+/).filter(Boolean)) {
    const referenced = element.ownerDocument.getElementById(id);
    if (referenced) visit(referenced);
  }
  return item;
}

// Every item that is not a property of another item. Broken pages often put an
// itemprop on an item that has no parent item, those count as well. Properties
// outside of any item (like a stray <td itemprop="isbn">) end up in an untyped
// item of their own.
export function fromMicrodata(doc: Document): JsonObject[] {
  const items = [...doc.querySelectorAll(SCOPES)]
    .filter((element) => !hasAttr(element, 'itemprop') || !element.parentElement?.closest(SCOPES))
    .map((element) => readItem(element));

  const orphans: JsonObject = {};
  for (const element of doc.querySelectorAll('[itemprop], [itemProp]')) {
    if (!element.closest(SCOPES)) addProperty(orphans, attr(element, 'itemprop') ?? '', propertyValue(element));
  }
  return [...items, orphans].filter((item) => Object.keys(item).length > 0);
}
