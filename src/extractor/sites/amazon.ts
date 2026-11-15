import {formatIsbn} from '../isbn';
import {elementText, findNonBlank} from '../util';
import type {Site} from './site';

const IMAGE_ELEMENTS = ['#landingImage', '#imgBlkFront', '#ebooksImgBlkFront'];
const DETAIL_ELEMENTS = 'li, #detailBullets_feature_div span, #rpi-attribute-book_details-isbn13 span';

// data-a-dynamic-image is a json object with an image url per size, the first
// one is the main image.
function image(doc: Document, selector: string): string | undefined {
  const element = doc.querySelector(selector);
  const json = element?.getAttribute('data-a-dynamic-image');
  if (json) {
    try {
      const urls = Object.keys(JSON.parse(json) as Record<string, unknown>);
      if (urls[0]) return urls[0];
    } catch {}
  }
  return element?.getAttribute('data-old-hires') || element?.getAttribute('src') || undefined;
}

// ISBN-13 wins over ISBN-10, wherever it is in the list of details.
function isbn(doc: Document): string | undefined {
  const details = [...doc.querySelectorAll(DETAIL_ELEMENTS)].map((item) => item.textContent ?? '');
  const find = (pattern: RegExp) => details.map((value) => formatIsbn(value.match(pattern)?.[1])).find(Boolean);
  return find(/ISBN-13\s*:?\s*([\d-]{13,17})/) ?? find(/ISBN-10\s*:?\s*(\d{9}[\dX])/);
}

export const amazon: Site = {
  host: /(^|\.)amazon\.[a-z.]+$/,
  refine({doc}, result) {
    return {
      ...result,
      name: findNonBlank(
        elementText(doc.querySelector('#productTitle')),
        elementText(doc.querySelector('#title')),
        result.name
      ),
      image: findNonBlank(...IMAGE_ELEMENTS.map((selector) => image(doc, selector)), result.image),
      isbn: findNonBlank(isbn(doc), result.isbn),
    };
  },
};
