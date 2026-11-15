import {formatIsbn} from '../isbn';
import {elementText, findNonBlank} from '../util';
import type {Site} from './site';

// The details are a list of <div><span>Label</span> value</div> rows. Books list
// their identifier as ISBN or EAN.
function isbnFromDetails(doc: Document): string | undefined {
  for (const row of doc.querySelectorAll('.info-block div')) {
    const label = row.firstElementChild;
    if (label?.tagName !== 'SPAN' || !['ISBN', 'EAN'].includes(elementText(label) ?? '')) continue;
    const isbn = formatIsbn((row.textContent ?? '').slice((label.textContent ?? '').length));
    if (isbn) return isbn;
  }
}

const authors = (doc: Document): string =>
  [...doc.querySelectorAll('h2.articleHeadline a')].map(elementText).filter(Boolean).join(', ');

export const genialokal: Site = {
  host: /(^|\.)genialokal\.de$/,
  refine({doc}, result, {schema, openGraph}) {
    const by = authors(doc);
    return {
      ...result,
      name: result.name && by ? `${result.name} - ${by}` : result.name,
      // the product image is better than their sharing image
      image: findNonBlank(schema.image, openGraph.image),
      isbn: findNonBlank(isbnFromDetails(doc), result.isbn),
    };
  },
};
