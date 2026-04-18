export type ParseResult = {
  name?: string;
  image?: string;
  price?: string | number;
  priceCurrency?: string;
  isbn?: string;
};

type JsonLdItem = Record<string, unknown>;

const fixUrl = (url: string): string => (url.startsWith('//') ? `https:${url}` : url);

function getMeta(doc: Document, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const el = doc.querySelector<HTMLMetaElement>(`meta[property="${key}"], meta[name="${key}"]`);
    if (el?.content) return el.content;
  }
}

function fromMeta(doc: Document): ParseResult {
  const image = getMeta(doc, 'og:image');
  return {
    name: getMeta(doc, 'og:title', 'title'),
    image: image ? fixUrl(image) : undefined,
    price: getMeta(doc, 'product:price:amount', 'og:price:amount', 'price'),
    priceCurrency: getMeta(doc, 'product:price:currency', 'og:price:currency', 'priceCurrency'),
    isbn: getMeta(doc, 'book:isbn'),
  };
}

function fromJsonLd(doc: Document): ParseResult {
  const items: JsonLdItem[] = [];
  for (const script of doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent ?? '') as JsonLdItem | JsonLdItem[];
      if (Array.isArray(data)) items.push(...data);
      else items.push(data);
    } catch {}
  }

  const result: ParseResult = {};
  for (const item of items) {
    const type = String(item['@type'] ?? '');
    if (type === 'Book') {
      result.name = (item.name as string) || result.name;
      result.isbn = (item.isbn as string) || result.isbn;
      result.image = (item.image as string) || result.image;
    }
    if (type === 'Product') {
      result.name = (item.name as string) || result.name;
      result.image = (item.image as string) || result.image;
      const offers = item.offers as JsonLdItem | JsonLdItem[] | undefined;
      if (offers) {
        const offer = Array.isArray(offers) ? offers[0] : offers;
        result.priceCurrency = (offer.priceCurrency as string) || result.priceCurrency;
        result.price = (offer.price ?? offer.lowPrice) as string | number | undefined;
      }
    }
  }
  return result;
}

function fromMicrodata(doc: Document): ParseResult {
  const result: ParseResult = {};
  const product = doc.querySelector('[itemtype*="schema.org/Product"]');
  if (!product) return result;

  const prop = (root: Element, name: string): string | undefined => {
    const el = root.querySelector<HTMLElement>(`[itemprop="${name}"]`);
    return el?.getAttribute('content') ?? el?.textContent?.trim() ?? undefined;
  };

  result.name = prop(product, 'name');
  result.image = product.querySelector<HTMLImageElement>('[itemprop="image"]')?.getAttribute('src') ?? undefined;

  const offer = product.querySelector('[itemtype*="schema.org/Offer"]');
  if (offer) {
    result.price = prop(offer, 'price');
    result.priceCurrency = prop(offer, 'priceCurrency');
  }
  return result;
}

const merge = (...objs: ParseResult[]): ParseResult => {
  let r: ParseResult = {};
  for (const o of objs) {
    r = {
      name: o.name || r.name,
      image: o.image || r.image,
      price: o.price || r.price,
      priceCurrency: o.priceCurrency || r.priceCurrency,
      isbn: o.isbn || r.isbn,
    };
  }
  return r;
};

export function parseDocument(doc: Document): ParseResult {
  return merge({name: doc.title || undefined}, fromMeta(doc), fromMicrodata(doc), fromJsonLd(doc));
}
