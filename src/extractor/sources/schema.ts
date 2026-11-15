import {formatIsbn} from '../isbn';
import {normalizePrice} from '../price';
import type {Json, JsonObject, Page, ParseResult} from '../types';
import {resolveUrl} from '../url';
import {findNonBlank, first, isObject, text} from '../util';
import {fromJsonLd} from './json-ld';
import {fromMicrodata} from './microdata';

// Reads schema.org data, from ld+json and microdata alike. The offer decides
// the price, its name and image come from the item it belongs to.

const RELATED_ITEMS = ['isRelatedTo', 'isSimilarTo', 'isAccessoryOrSparePartFor'];

// Books are no products: their name is often only the title, while the
// OpenGraph title of book shops also names the author.
const PRODUCT_TYPE = /^(?:.*[/:])?(Product|ProductGroup|IndividualProduct|ProductModel)$/i;

// An offer within these belongs to the page, not to a product, so their name
// and image are not the product's.
const PAGE_TYPES =
  /^(webpage|itempage|collectionpage|searchresultspage|webpageelement|website|wpheader|wpfooter|wpsidebar|sitenavigationelement|itemlist|listitem|breadcrumblist|organization|onlinestore|store)$/;

// "Offer", "https://schema.org/Offer" and ["Offer", ...] all are "offer".
const nodeType = (node: JsonObject): string | undefined =>
  text(node['@type'])
    ?.replace(/^.*[/:]/, '')
    .toLowerCase();

function removeRelatedItems(node: Json): Json {
  if (Array.isArray(node)) return node.map(removeRelatedItems);
  if (!isObject(node)) return node;
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(node)) {
    if (!RELATED_ITEMS.includes(key)) result[key] = removeRelatedItems(value);
  }
  return result;
}

// Many pages leave out the @type of their offers.
function withOfferType(offers: Json): Json {
  if (Array.isArray(offers)) return offers.map(withOfferType);
  if (!isObject(offers) || offers['@type']) return offers;
  const isAggregate = offers.lowPrice !== undefined && offers.price === undefined;
  return {...offers, '@type': isAggregate ? 'AggregateOffer' : 'Offer'};
}

// Collects every offer together with the name and image of the item it belongs
// to. AggregateOffers without single offers count as an offer of their own.
function findOffers(node: Json, inherited: JsonObject = {}): JsonObject[] {
  if (Array.isArray(node)) return node.flatMap((item) => findOffers(item, inherited));
  if (!isObject(node)) return [];

  const type = nodeType(node);
  if (type === 'offer') return [{...inherited, ...node}];
  if (type === 'aggregateoffer') {
    const aggregate: JsonObject = {
      ...inherited,
      priceCurrency: node.priceCurrency ?? null,
      price: node.lowPrice ?? node.price ?? null,
    };
    const offers = node.offers ? findOffers(node.offers, aggregate) : [];
    return offers.length > 0 ? offers : [aggregate];
  }

  const values = PAGE_TYPES.test(type ?? '')
    ? {...inherited, name: null, image: null}
    : {...inherited, name: node.name ?? null, image: first(node.image) ?? null};
  return Object.entries(node).flatMap(([key, value]) =>
    findOffers(key === 'offers' ? withOfferType(value) : value, values)
  );
}

const isProduct = (node: JsonObject): boolean =>
  (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]).some(
    (type) => typeof type === 'string' && PRODUCT_TYPE.test(type)
  );

function findProducts(node: Json, products: JsonObject[] = []): JsonObject[] {
  if (Array.isArray(node)) {
    for (const item of node) findProducts(item, products);
  } else if (isObject(node)) {
    if (isProduct(node)) products.push(node);
    findProducts(Object.values(node), products);
  }
  return products;
}

// The first value of a key anywhere in the data.
function findKey(node: Json, key: string): Json | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const value = findKey(item, key);
      if (value !== undefined) return value;
    }
  } else if (isObject(node)) {
    if (key in node && node[key] !== null && node[key] !== '') return node[key];
    return findKey(Object.values(node), key);
  }
}

// An image can be a url, an ImageObject or a list of both.
function imageUrl(image: Json | undefined, base: string): string | undefined {
  const item = first(image as Json);
  if (typeof item === 'string') return resolveUrl(item, base);
  if (isObject(item)) return imageUrl(item.url ?? item.contentUrl ?? item['@id'], base);
}

function offerPrice(offer: JsonObject | undefined): {price?: string; currency?: string} {
  if (!offer) return {};
  const spec = first(offer.priceSpecification);
  const specification = isObject(spec) ? spec : undefined;
  const price = findNonBlank(
    first(offer.price),
    first(offer.Price),
    specification && first(specification.price),
    specification && first(specification.Price)
  );
  // Some sites put an object into price, which is not what the spec says
  if (price === undefined || isObject(price)) return {};
  return {
    price: normalizePrice(price as string | number),
    currency: text(offer.priceCurrency) ?? (specification && text(specification.priceCurrency)),
  };
}

const urlVariant = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url, 'https://example.com').searchParams.get('variant');
  } catch {
    return null;
  }
};

const isShopify = (doc: Document): boolean =>
  [...doc.querySelectorAll('script:not([src])')].some((script) =>
    /Shopify\.shop\s*=\s*["'][^"']+\.myshopify\.com["']/.test(script.textContent ?? '')
  );

// Shopify lists every variant as its own offer with a ?variant= url. When the
// user looks at a variant, we want the offer of exactly that variant.
function pickOffer(offers: JsonObject[], page: Page): JsonObject | undefined {
  const variant = urlVariant(page.url);
  const variantOffer =
    variant && isShopify(page.doc) ? offers.find((offer) => urlVariant(text(offer.url)) === variant) : undefined;
  return variantOffer ?? offers[0];
}

export function fromSchema(page: Page): ParseResult {
  const data = removeRelatedItems([...fromJsonLd(page.doc), ...fromMicrodata(page.doc)]);
  const offer = pickOffer(findOffers(data), page);
  const {price, currency} = offerPrice(offer);

  // Some pages split their product over several items (one with the name, one
  // with the image), so we take the first of every field.
  const products = findProducts(data);
  const productName = products.map((item) => text(item.name)).find(Boolean);
  const productImage = products.map((item) => imageUrl(item.image, page.base)).find(Boolean);

  return {
    name: findNonBlank(text(offer?.name), productName),
    image: findNonBlank(imageUrl(offer?.image, page.base), productImage),
    price,
    priceCurrency: price ? currency : undefined,
    isbn: formatIsbn(findKey(data, 'isbn')),
  };
}
