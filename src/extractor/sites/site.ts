import type {Page, ParseResult} from '../types';

// What the generic sources found on the page.
export type Sources = {
  schema: ParseResult;
  openGraph: ParseResult;
};

// Rules for a shop whose pages need more than the generic sources.
export type Site = {
  // matched against the host name of the page
  host: RegExp;
  // improves the generic result with what only this shop has
  refine(page: Page, result: ParseResult, sources: Sources): ParseResult;
};
