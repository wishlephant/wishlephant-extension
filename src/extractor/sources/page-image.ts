import type {Page} from '../types';
import {resolveUrl} from '../url';
import {findNonBlank} from '../util';

// Finds the product image of a page without structured image data.

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|avif)$/i;
// Full size images first, then what the page shows, then lazy loading sources.
const IMAGE_ATTRIBUTES = [
  'data-zoom-image',
  'data-large_image',
  'data-zoom',
  'srcset',
  'data-srcset',
  'src',
  'data-src',
  'data-lazy-src',
  'data-original',
];
const UNLIKELY_IMAGE = /logo|icon|sprite|placeholder|spinner|loading|avatar|flag|badge|payment|rating|star|\/menu\//i;
const PAGE_CHROME = 'header, nav, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"]';
const CONTENT_CONTAINERS = ['main', 'article', 'div.content', 'body'];

type Candidate = {url: string; match: number; size: number; unlikely: boolean; order: number};

// Navigation is never the product, headers, footers and asides only when they
// belong to the page and not to the main content (product galleries are often
// an <aside> in <main>).
function isPageChrome(element: Element): boolean {
  if (element.closest('nav, [role="navigation"]')) return true;
  const chrome = element.closest(PAGE_CHROME);
  return chrome !== null && !chrome.parentElement?.closest('main, article, [role="main"]');
}

// The largest candidate of a srcset.
function fromSrcset(srcset: string): string | undefined {
  let best: {url: string; size: number} | undefined;
  for (const entry of srcset.split(/,\s+/)) {
    const [url, descriptor = '1x'] = entry.trim().split(/\s+/);
    const size = Number.parseFloat(descriptor) || 1;
    if (url && (!best || size > best.size)) best = {url, size};
  }
  return best?.url;
}

const hasImageExtension = (url: string): boolean => {
  try {
    return IMAGE_EXTENSION.test(new URL(url).pathname);
  } catch {
    return false;
  }
};

function elementImage(element: Element, base: string): string | undefined {
  for (const attribute of IMAGE_ATTRIBUTES) {
    const value = element.getAttribute(attribute)?.trim();
    if (!value) continue;
    const url = resolveUrl(attribute.endsWith('srcset') ? (fromSrcset(value) ?? '') : value, base);
    if (url && hasImageExtension(url)) return url;
  }
}

const words = (value: string): string[] =>
  value
    .normalize('NFD')
    // drop the accents NFD split off ("ü" becomes "u" plus a combining diaeresis)
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);

// How much of the product name an image's alt text, title or file name holds.
function nameMatch(nameWords: string[], label: string): number {
  if (nameWords.length === 0) return 0;
  const labelWords = new Set(words(label));
  return nameWords.filter((word) => labelWords.has(word)).length / nameWords.length;
}

const renderedSize = (img: Element): number => {
  const image = img as HTMLImageElement;
  return image.complete && image.naturalWidth ? image.naturalWidth * image.naturalHeight : 0;
};

const byLikelihood = (a: Candidate, b: Candidate): number =>
  Number(a.unlikely) - Number(b.unlikely) || b.match - a.match || b.size - a.size || a.order - b.order;

// An image of the main content: an image that is labelled with the product
// name wins, then the biggest image the browser rendered, skipping logos, icons
// and the page navigation.
function contentImage(page: Page, name: string | undefined): string | undefined {
  const container = CONTENT_CONTAINERS.map((selector) => page.doc.querySelector(selector)).find((element) =>
    element?.querySelector('img')
  );
  if (!container) return undefined;

  const nameWords = words(name ?? '');
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (const element of container.querySelectorAll('img, picture source')) {
    const url = elementImage(element, page.base);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const img = element.tagName === 'SOURCE' ? element.parentElement?.querySelector('img') : element;
    const label = [img?.getAttribute('alt'), img?.getAttribute('title'), new URL(url).pathname].join(' ');
    candidates.push({
      url,
      // a label that holds most of the name is a match, the better one wins
      match: Math.max(0, nameMatch(nameWords, label) - 0.5),
      size: img ? renderedSize(img) : 0,
      unlikely: UNLIKELY_IMAGE.test(url) || isPageChrome(element),
      order: candidates.length,
    });
  }

  return candidates.sort(byLikelihood)[0]?.url;
}

// Other image tags, still better than guessing.
function metaImage(page: Page): string | undefined {
  const {doc, base} = page;
  const urls = [
    doc.querySelector('meta[name="twitter:image"], meta[property="twitter:image"]')?.getAttribute('content'),
    doc.querySelector('meta[name="twitter:image:src"]')?.getAttribute('content'),
    doc.querySelector('link[rel="image_src"]')?.getAttribute('href'),
  ];
  return findNonBlank(...urls.map((url) => (url ? resolveUrl(url, base) : undefined)));
}

export const pageImage = (page: Page, name: string | undefined): string | undefined =>
  metaImage(page) ?? contentImage(page, name);
