import parse from '../src/parser';
import {readFileSync} from 'fs';

describe('parser', () => {
  test('Parses basic html header data', () => {
    const html = readFileSync('tests/data/base.html', 'utf8');
    expect(parse(html)).toEqual({
      name: 'Steve Jobs',
      image: undefined,
      isbn: undefined,
      price: undefined,
      priceCurrency: undefined,
    });
  });

  test('Parses data from opengraph', () => {
    const html = readFileSync('tests/data/opengraph.html', 'utf8');
    expect(parse(html)).toEqual({
      image: 'http://examples.opengraphprotocol.us/media/images/50.png',
      isbn: '978-1451648539',
      name: 'Steve Jobs',
      price: '18.99',
      priceCurrency: 'EUR',
    });
  });

  test('Parses data from ldjson', () => {
    const html = readFileSync('tests/data/ldjson.html', 'utf8');
    expect(parse(html)).toEqual({
      image:
        'https://cdn.idealo.com/folder/Product/202093/1/202093190/s1_produktbild_gross/apple-iphone-14-128gb-mitternacht.jpg',
      name: 'Apple iPhone 14',
      price: 722.99,
      priceCurrency: 'EUR',
    });
  });

  test('Parses data from ldjsonaggregate', () => {
    const html = readFileSync('tests/data/ldjsonaggregate.html', 'utf8');
    expect(parse(html)).toEqual({
      image:
        'https://cdn.idealo.com/folder/Product/202093/1/202093190/s1_produktbild_gross/apple-iphone-14-128gb-mitternacht.jpg',
      name: 'Apple iPhone 14',
      price: 722.99,
      priceCurrency: 'EUR',
    });
  });

  test('Parses data from microdata', () => {
    const html = readFileSync('tests/data/microdata.html', 'utf8');
    expect(parse(html)).toEqual({
      image: 'kenmore-microwave-17in.jpg',
      isbn: undefined,
      name: 'Kenmore White 17" Microwave',
      price: '1000.00',
      priceCurrency: 'USD',
    });
  });

  test('Parses data from thalia', () => {
    const html = readFileSync('tests/data/thalia.html', 'utf8');
    expect(parse(html)).toEqual({
      image:
        'https://images.thalia.media/-/BF2000-2000/b4e150444399425ba829ddec4f90605e/pageboy-gebundene-ausgabe-elliot-page.jpeg',
      isbn: '978-3-10-397500-0',
      name: 'Pageboy',
      price: '24.0',
      priceCurrency: 'EUR',
    });
  });

  test('Parses data from mytoys', () => {
    const html = readFileSync('tests/data/mytoys.html', 'utf8');
    expect(parse(html)).toEqual({
      image: 'https://mytoys.scene7.com/is/image/myToys/ext/10620639-01.jpg',
      isbn: undefined,
      name: 'LEGO® 10766 Juniors Toy Story 4: Woody & Turbo',
      price: '8.49',
      priceCurrency: 'EUR',
    });
  });
});
