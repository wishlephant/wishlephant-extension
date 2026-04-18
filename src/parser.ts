import WAE from '@rane/web-auto-extractor';

type ParseResult = {
  name?: string;
  image?: string;
  price?: string | number;
  priceCurrency?: string;
  isbn?: string;
};

type MetaTags = {
  [key: string]: string;
};

type SchemaType = {
  Book?: Record<string, unknown>[];
  Product?: Record<string, unknown>[];
};

const cleanUp = (input: unknown): string | undefined => {
  if (Array.isArray(input)) return input[0] as string;
  if (typeof input === 'string') return input;
  return undefined;
};

const cleanUpUrl = (input: unknown): string | undefined => {
  const cleaned = cleanUp(input);
  if (cleaned) {
    if (cleaned.startsWith('//')) return `https:${cleaned}`;
    return cleaned;
  }
  return undefined;
};

export const extractFromBase = (input: string): ParseResult => ({
  name: cleanUp(input.match(/<title>(.*)<\/title>/)?.[1]),
});

export const extractFromMetatags = (metatags: MetaTags): ParseResult => {
  return {
    name: cleanUp(metatags['og:title'] || metatags.title),
    image: cleanUpUrl(metatags['og:image']),
    price: cleanUp(metatags['product:price:amount'] || metatags['og:price:amount'] || metatags.price),
    priceCurrency: cleanUp(
      metatags['product:price:currency'] || metatags['og:price:currency'] || metatags.priceCurrency
    ),
    isbn: cleanUp(metatags['book:isbn']),
  };
};

export const extractFromSchema = (jsonld: SchemaType): ParseResult => {
  let result: ParseResult = {};
  if (jsonld.Book?.[0]) {
    const book = jsonld.Book[0];
    result = {
      name: cleanUp(book.name),
      isbn: cleanUp(book.isbn),
      image: cleanUp(book.image),
    };
  }
  if (jsonld.Product?.[0]) {
    const product = jsonld.Product[0];
    result.name = cleanUp(product.name) || result.name;
    result.image = cleanUp(product.image) || result.image;

    const offers = product.offers;
    if (offers) {
      const offer = (Array.isArray(offers) ? offers[0] : offers) as Record<string, unknown>;
      result.priceCurrency = cleanUp(offer.priceCurrency);
      result.price = (offer.price ?? offer.lowPrice) as string | number | undefined;
    }
  }

  return result;
};

const merge = (...objects: ParseResult[]): ParseResult => {
  let result: ParseResult = {};

  for (const object of objects) {
    result = {
      name: object.name || result.name,
      image: object.image || result.image,
      price: object.price || result.price,
      priceCurrency: object.priceCurrency || result.priceCurrency,
      isbn: object.isbn || result.isbn,
    };
  }
  return result;
};

const parse = (input: string): ParseResult => {
  const result = WAE().parse(input);

  return merge(
    extractFromBase(input),
    extractFromMetatags(result.metatags),
    extractFromSchema(result.microdata),
    extractFromSchema(result.jsonld)
  );
};

export default parse;
