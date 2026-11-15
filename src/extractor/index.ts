// Extracts the product (name, image, price and isbn) of a web page. wishlephant
// uses this data as it is whenever it contains a name, so it has to work on
// broken pages as well.
//
//   1. generic sources: schema.org (ld+json and microdata) and OpenGraph
//   2. combined by priority:
//        name:  schema.org > OpenGraph > <title>
//        image: OpenGraph > schema.org
//        price: OpenGraph > schema.org
//        isbn:  schema.org > OpenGraph
//   3. shop specific rules (sites/)
//   4. without an image, the product image of the page

import {isChallenge} from './challenge';
import {normalizeCurrency} from './price';
import {SITES, type Sources} from './sites';
import {fromOpenGraph} from './sources/open-graph';
import {pageImage} from './sources/page-image';
import {fromSchema} from './sources/schema';
import type {Page, ParseResult} from './types';
import {baseUrl} from './url';
import {findNonBlank, hostMatches, pageTitle, safely} from './util';

export {isChallenge} from './challenge';
export {formatIsbn} from './isbn';
export {normalizePrice} from './price';
export type {ParseResult} from './types';

const MAX_NAME_LENGTH = 255;

// A price always comes with the currency of the same source. Prices without a
// currency are euro.
function combinePrice({schema, openGraph}: Sources): Pick<ParseResult, 'price' | 'priceCurrency'> {
  const source = openGraph.price ? openGraph : schema;
  if (!source.price) return {};
  return {price: source.price, priceCurrency: normalizeCurrency(source.priceCurrency) ?? 'EUR'};
}

function combine(sources: Sources, title: string | undefined): ParseResult {
  const {schema, openGraph} = sources;
  return {
    name: findNonBlank(schema.name, openGraph.name, title),
    image: findNonBlank(openGraph.image, schema.image),
    ...combinePrice(sources),
    isbn: findNonBlank(schema.isbn, openGraph.isbn),
  };
}

export function parseDocument(doc: Document, url: string = doc.location?.href ?? doc.URL): ParseResult {
  if (isChallenge(doc)) return {};

  const page: Page = {doc, url, base: safely(() => baseUrl(doc, url), url)};
  const sources: Sources = {
    schema: safely(() => fromSchema(page), {}),
    openGraph: safely(() => fromOpenGraph(page), {}),
  };

  let result = combine(sources, pageTitle(doc));
  for (const site of SITES) {
    if (hostMatches(url, site.host)) result = safely(() => site.refine(page, result, sources), result);
  }
  result.image ??= safely(() => pageImage(page, result.name), undefined);

  return {
    name: result.name?.slice(0, MAX_NAME_LENGTH),
    image: result.image,
    price: result.price,
    priceCurrency: result.priceCurrency,
    isbn: result.isbn,
  };
}
