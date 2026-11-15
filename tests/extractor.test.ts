import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {formatIsbn, normalizePrice, parseDocument} from '../src/extractor';

const URL = 'https://shop.example.com/products/thing';

const parseFile = (file: string, url = URL) => parseDocument(parseHTML(readFileSync(file, 'utf8')).document, url);
const parse = (html: string, url = URL) =>
  parseDocument(parseHTML(`<!doctype html><html>${html}</html>`).document, url);
const ldJson = (json: string) => `<head><script type="application/ld+json">${json}</script></head>`;

describe('extractor', () => {
  test('Parses basic html header data', () => {
    expect(parseFile('tests/data/base.html')).toEqual({
      name: 'Steve Jobs',
      image: undefined,
      price: undefined,
      priceCurrency: undefined,
      isbn: undefined,
    });
  });

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
      price: '722.99',
      priceCurrency: 'EUR',
    });
  });

  test('Parses data from ldjson with an aggregate offer', () => {
    expect(parseFile('tests/data/ldjsonaggregate.html')).toMatchObject({
      name: 'Apple iPhone 14',
      price: '722.99',
      priceCurrency: 'EUR',
    });
  });

  test('Parses data from opengraph', () => {
    expect(parseFile('tests/data/opengraph.html')).toMatchObject({
      image: 'http://examples.opengraphprotocol.us/media/images/50.png',
      isbn: '978-14-5164-853-9',
      name: 'Steve Jobs',
    });
  });

  test('Parses data from microdata and resolves relative images', () => {
    expect(parseFile('tests/data/microdata.html', 'https://www.example.com/shop/microwave')).toEqual({
      image: 'https://www.example.com/shop/kenmore-microwave-17in.jpg',
      isbn: undefined,
      name: 'Kenmore White 17" Microwave',
      price: '1000.00',
      priceCurrency: 'USD',
    });
  });

  test('Parses data from thalia', () => {
    // the OpenGraph image wins
    expect(parseFile('tests/data/thalia.html')).toEqual({
      image:
        'https://images.thalia.media/07/-/b4e150444399425ba829ddec4f90605e/pageboy-gebundene-ausgabe-elliot-page.jpeg',
      isbn: '978-31-0397-500-0',
      name: 'Pageboy',
      price: '24.0',
      priceCurrency: 'EUR',
    });
  });

  test('Parses data from mytoys', () => {
    expect(parseFile('tests/data/mytoys.html')).toMatchObject({
      image: 'https://mytoys.scene7.com/is/image/myToys/ext/10620639-01.jpg',
      name: 'LEGO® 10766 Juniors Toy Story 4: Woody & Turbo',
      price: '8.49',
      priceCurrency: 'EUR',
    });
  });
});

describe('broken pages', () => {
  test('reads ld+json with newlines inside strings and trailing commas', () => {
    expect(
      parse(ldJson('{"@type": "Product", "name": "Broken\nName", "offers": {"@type": "Offer", "price": "5.00",},}'))
    ).toMatchObject({
      name: 'Broken Name',
      price: '5.00',
      priceCurrency: 'EUR',
    });
  });

  test('reads ld+json wrapped in CDATA and several objects in one script', () => {
    const json = '//<![CDATA[\n{"@type": "WebSite", "name": "Shop"}\n{"@type": "Product", "name": "Second"}\n//]]>';
    expect(parse(ldJson(json)).name).toBe('Second');
  });

  test('ignores ld+json blocks that are null or no objects', () => {
    expect(parse(`${ldJson('null')}${ldJson('"text"')}${ldJson('{"@type": "Product", "name": "Kept"}')}`).name).toBe(
      'Kept'
    );
  });

  test('decodes html entities in ld+json, even when encoded twice', () => {
    expect(
      parse(ldJson('{"@type": "Product", "name": "Gr&amp;ouml;&szlig;e &#039;M&#039; &ndash; Bl&auml;u"}')).name
    ).toBe("Größe 'M' – Bläu");
  });

  test('reads @graph, type lists and full type urls', () => {
    const json = JSON.stringify({
      '@graph': [
        {'@type': 'WebPage', name: 'Page', image: 'https://example.com/page.jpg'},
        {
          '@type': ['http://schema.org/Product', 'Thing'],
          name: 'Graph Product',
          image: [{'@type': 'ImageObject', contentUrl: '//cdn.example.com/a.jpg'}],
          offers: {'@type': 'offer', priceSpecification: {price: '1.299,00', priceCurrency: '€'}},
        },
      ],
    });
    expect(parse(ldJson(json))).toEqual({
      name: 'Graph Product',
      image: 'https://cdn.example.com/a.jpg',
      price: '1299.00',
      priceCurrency: 'EUR',
      isbn: undefined,
    });
  });

  test('uses the lowest price of an aggregate offer', () => {
    const json =
      '{"@type": "Product", "name": "P", "offers": {"@type": "AggregateOffer", "lowPrice": 10, "highPrice": 20, "priceCurrency": "USD"}}';
    expect(parse(ldJson(json))).toMatchObject({price: '10', priceCurrency: 'USD'});
  });

  test('ignores related products', () => {
    const json = JSON.stringify({
      '@type': 'Product',
      name: 'Main',
      isRelatedTo: {'@type': 'Product', name: 'Other', offers: {'@type': 'Offer', price: 1}},
      offers: {'@type': 'Offer', price: 2},
    });
    expect(parse(ldJson(json))).toMatchObject({name: 'Main', price: '2'});
  });

  test('uses the offer of the shopify variant in the url', () => {
    const json = JSON.stringify({
      '@type': 'Product',
      name: 'Shirt',
      offers: [
        {'@type': 'Offer', price: '10.00', url: '/products/shirt?variant=1'},
        {'@type': 'Offer', price: '12.00', url: '/products/shirt?variant=2'},
      ],
    });
    const shopify = '<script>Shopify.shop = "shirts.myshopify.com";</script>';
    expect(parse(`${ldJson(json)}<body>${shopify}</body>`, `${URL}?variant=2`).price).toBe('12.00');
    expect(parse(ldJson(json), `${URL}?variant=2`).price).toBe('10.00');
  });

  test('reads microdata with itemref, react attribute names and stray properties', () => {
    const html = `<body>
      <div itemscope itemType="https://schema.org/Product" itemref="price-box">
        <h1 itemProp="name">Lamp</h1>
        <img itemprop="image" src="/lamp.jpg">
      </div>
      <div id="price-box" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <span itemprop="price">19,90 € * inkl. 19% MwSt.</span>
        <meta itemprop="priceCurrency" content="EUR">
      </div>
      <table><tr><td itemprop="isbn">3-86680-192-0</td></tr></table>
    </body>`;
    expect(parse(html)).toEqual({
      name: 'Lamp',
      image: 'https://shop.example.com/lamp.jpg',
      price: '19.90',
      priceCurrency: 'EUR',
      isbn: '38-6680-192-0',
    });
  });

  test('resolves images against the base element', () => {
    const html =
      '<head><base href="https://cdn.example.com/assets/"><meta property="og:image" content="img/a.jpg"></head>';
    expect(parse(html).image).toBe('https://cdn.example.com/assets/img/a.jpg');
  });

  test('prefers the OpenGraph image and price', () => {
    const html = `<head>
      <meta property="og:image" content="https://example.com/og.jpg">
      <meta property="product:price:amount" content="1.234,50">
      <meta property="product:price:currency" content="eur">
    </head>${ldJson('{"@type": "Product", "name": "P", "image": "https://example.com/ld.jpg", "offers": {"price": 1}}')}`;
    expect(parse(html)).toMatchObject({image: 'https://example.com/og.jpg', price: '1234.50', priceCurrency: 'EUR'});
  });

  test('finds the product image without structured data', () => {
    const html = `<head><title>Red Bike | Shop</title></head><body>
      <header><img src="/logo.png" alt="Shop"></header>
      <main>
        <img src="/banner.jpg" alt="Sale">
        <picture><source data-srcset="/bike-300.jpg 1x, /bike-600.jpg 2x"><img src="data:image/gif;base64,R0lGOD" alt="Red Bike"></picture>
      </main>
    </body>`;
    expect(parse(html).image).toBe('https://shop.example.com/bike-600.jpg');
  });

  test('returns nothing for bot challenges', () => {
    expect(parse('<head><title>Just a moment...</title></head>')).toEqual({});
  });

  test('cuts names to 255 characters', () => {
    expect(parse(`<head><title>${'a'.repeat(300)}</title></head>`).name).toHaveLength(255);
  });
});

describe('site specific', () => {
  test('adds the authors to genialokal books and reads their isbn', () => {
    const html = `<head><meta property="og:title" content="Momo"></head><body>
      <h2 class="articleHeadline"><a>Michael Ende</a></h2>
      <div class="info-block"><div><span>ISBN</span> 978-3-522-20210-7</div></div>
    </body>`;
    expect(parse(html, 'https://www.genialokal.de/Produkt/Michael-Ende/Momo_lid_1.html')).toMatchObject({
      name: 'Momo - Michael Ende',
      isbn: '978-35-2220-210-7',
    });
  });

  test('reads amazon product pages', () => {
    const html = `<head><title>Amazon.de: Paper Girls</title></head><body>
      <span id="productTitle">  Paper Girls Volume 5 </span>
      <img id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/big.jpg":[500,500]}'>
      <ul><li><span>ISBN-10 : 1534308679</span></li></ul>
    </body>`;
    expect(parse(html, 'https://www.amazon.de/dp/1534308679')).toEqual({
      name: 'Paper Girls Volume 5',
      image: 'https://m.media-amazon.com/images/I/big.jpg',
      price: undefined,
      priceCurrency: undefined,
      isbn: '15-3430-867-9',
    });
  });
});

describe('normalizePrice', () => {
  test.each([
    ['12.99', '12.99'],
    ['12,99', '12.99'],
    ['1.299,00 €', '1299.00'],
    ['1,299.00', '1299.00'],
    ['1,299', '1299'],
    ['2 199,00 kr', '2199.00'],
    ["CHF 1'299.50", '1299.50'],
    ['€ 6,00 / 50 ml', '6.00'],
    ['ab 19,90 €', '19.90'],
    [12.5, '12.5'],
    ['', undefined],
    ['kostenlos', undefined],
  ] as const)('%s', (input, expected) => {
    expect(normalizePrice(input)).toBe(expected);
  });
});

describe('formatIsbn', () => {
  test.each([
    ['9783103975000', '978-31-0397-500-0'],
    ['978-3-10-397500-0', '978-31-0397-500-0'],
    ['ISBN: 3-86680-192-0', '38-6680-192-0'],
    ['080442957x', '08-0442-957-X'],
    [9783103975000, '978-31-0397-500-0'],
    ['9783103975001', undefined],
    ['not an isbn', undefined],
  ] as const)('%s', (input, expected) => {
    expect(formatIsbn(input)).toBe(expected);
  });
});
