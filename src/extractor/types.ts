export type ParseResult = {
  name?: string;
  image?: string;
  price?: string;
  priceCurrency?: string;
  isbn?: string;
};

// The page we extract from.
export type Page = {
  doc: Document;
  // the url of the page
  url: string;
  // what relative urls on the page are relative to (the <base> element or the url)
  base: string;
};

export type Json = null | boolean | number | string | Json[] | JsonObject;
export type JsonObject = {[key: string]: Json};
