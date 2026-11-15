import {formatIsbn} from '../isbn';
import {normalizePrice} from '../price';
import type {Page, ParseResult} from '../types';
import {resolveUrl} from '../url';
import {findNonBlank} from '../util';

// Price tags, the first one with an amount wins.
const PRICE_TAGS: [amount: string, currency: string][] = [
  ['product:price:amount', 'product:price:currency'],
  ['og:price:amount', 'og:price:currency'],
  ['price:amount', 'price:currency'],
];

// All meta tags by their (lowercase) property or name. Empty tags are skipped
// and the last tag wins.
function metaTags(doc: Document): Map<string, string> {
  const tags = new Map<string, string>();
  for (const meta of doc.querySelectorAll('meta')) {
    const key = (meta.getAttribute('property') ?? meta.getAttribute('name') ?? meta.getAttribute('itemprop') ?? '')
      .trim()
      .toLowerCase()
      .replace(/^books:/, 'book:');
    const content = meta.getAttribute('content')?.trim();
    if (key && content) tags.set(key, content);
  }
  return tags;
}

export function fromOpenGraph(page: Page): ParseResult {
  const tags = metaTags(page.doc);
  const get = (...keys: string[]) => findNonBlank(...keys.map((key) => tags.get(key)));

  const [amountTag, currencyTag] = PRICE_TAGS.find(([amount]) => normalizePrice(tags.get(amount))) ?? [];
  const price = amountTag ? normalizePrice(tags.get(amountTag)) : undefined;
  const image = get('og:image', 'og:image:url', 'og:image:secure_url');

  return {
    name: get('og:title'),
    image: image ? resolveUrl(image, page.base) : undefined,
    price,
    priceCurrency: currencyTag ? tags.get(currencyTag) : undefined,
    isbn: formatIsbn(get('book:isbn')),
  };
}
