import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {parseDocument} from '../src/extractor';

const parseFile = (file: string) => parseDocument(parseHTML(readFileSync(file, 'utf8')).document);

describe('extractor', () => {
  test('Parses image objects from ldjson', () => {
    expect(parseFile('tests/data/hornbach.html')).toEqual({
      image: 'https://media.hornbach.de/hb/packshot/as.47278581.jpg?dvid=8',
      isbn: undefined,
      name: 'Tischbohrmaschine Bosch PBD 40',
      price: '249.99',
      priceCurrency: 'EUR',
    });
  });

  test('Parses data from ldjson', () => {
    expect(parseFile('tests/data/ldjson.html')).toMatchObject({
      image:
        'https://cdn.idealo.com/folder/Product/202093/1/202093190/s1_produktbild_gross/apple-iphone-14-128gb-mitternacht.jpg',
      name: 'Apple iPhone 14',
      price: 722.99,
      priceCurrency: 'EUR',
    });
  });

  test('Parses data from opengraph', () => {
    expect(parseFile('tests/data/opengraph.html')).toMatchObject({
      image: 'http://examples.opengraphprotocol.us/media/images/50.png',
      isbn: '978-1451648539',
      name: 'Steve Jobs',
    });
  });
});
