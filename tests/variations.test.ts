import {parseHTML} from 'linkedom';
import {parseDocument} from '../src/extractor';

// Small, made up pages for the ways shops mark up their products, including the
// broken ones seen in the wild.

const URL = 'https://shop.example.com/products/thing';

const page = (html: string) => parseHTML(`<!doctype html><html>${html}</html>`).document;
const parse = (html: string, url = URL) => parseDocument(page(html), url);
const ldJson = (data: unknown) =>
  `<script type="application/ld+json">${typeof data === 'string' ? data : JSON.stringify(data)}</script>`;
const meta = (property: string, content: string) => `<meta property="${property}" content="${content}">`;

describe('OpenGraph', () => {
  test('reads a page that only has OpenGraph tags', () => {
    const html = `<head>
      ${meta('og:title', 'Sunscreen Lipbalm SPF 20')}
      ${meta('og:image', 'https://example.com/lipbalm.jpg')}
      ${meta('og:price:amount', '6,00')}
      ${meta('og:price:currency', 'EUR')}
    </head>`;
    expect(parse(html)).toEqual({
      name: 'Sunscreen Lipbalm SPF 20',
      image: 'https://example.com/lipbalm.jpg',
      price: '6.00',
      priceCurrency: 'EUR',
      isbn: undefined,
    });
  });

  test('prefers product:price over og:price', () => {
    const html = `<head>
      ${meta('og:price:amount', '1')}
      ${meta('product:price:amount', '769.00')}
      ${meta('product:price:currency', 'CHF')}
    </head>`;
    expect(parse(html)).toMatchObject({price: '769.00', priceCurrency: 'CHF'});
  });

  test('ignores empty OpenGraph tags', () => {
    const html = `<head><title>Shop title</title>${meta('og:title', '')}${meta('og:image', '')}</head>`;
    expect(parse(html)).toMatchObject({name: 'Shop title', image: undefined});
  });

  test('reads book:isbn and books:isbn, but only valid ones', () => {
    expect(parse(`<head>${meta('book:isbn', '9781451648539')}</head>`).isbn).toBe('978-14-5164-853-9');
    expect(parse(`<head>${meta('books:isbn', '9783407799371')}</head>`).isbn).toBe('978-34-0779-937-1');
    expect(parse(`<head>${meta('book:isbn', '9781451648530')}</head>`).isbn).toBeUndefined();
  });

  test('uses twitter:image and image_src when there is no other image', () => {
    expect(parse('<head><meta name="twitter:image" content="/t.jpg"></head>').image).toBe(
      'https://shop.example.com/t.jpg'
    );
    expect(parse('<head><link rel="image_src" href="https://example.com/s.jpg"></head>').image).toBe(
      'https://example.com/s.jpg'
    );
  });
});

describe('ld+json', () => {
  test('reads a product with an offer', () => {
    const html = ldJson({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Ozark Trail Tent',
      image: 'https://example.com/tent.jpeg',
      offers: {'@type': 'Offer', price: 170, priceCurrency: 'USD'},
    });
    expect(parse(html)).toEqual({
      name: 'Ozark Trail Tent',
      image: 'https://example.com/tent.jpeg',
      price: '170',
      priceCurrency: 'USD',
      isbn: undefined,
    });
  });

  test('takes the first of several offers', () => {
    const html = ldJson({
      '@type': 'Product',
      name: 'Franky',
      offers: [
        {'@type': 'Offer', price: '78.95', priceCurrency: 'CAD'},
        {'@type': 'Offer', price: '99.95', priceCurrency: 'CAD'},
      ],
    });
    expect(parse(html)).toMatchObject({price: '78.95', priceCurrency: 'CAD'});
  });

  test('reads offers nested in an aggregate offer', () => {
    const html = ldJson({
      '@type': 'Product',
      name: 'Wooden Dog',
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '6.99',
        priceCurrency: 'USD',
        offers: [{'@type': 'Offer', price: '6.99'}],
      },
    });
    expect(parse(html)).toMatchObject({price: '6.99', priceCurrency: 'USD'});
  });

  test('reads lowercase types, capitalized prices and price specification lists', () => {
    expect(parse(ldJson({'@type': 'product', name: 'A', offers: {'@type': 'offer', Price: '13.00'}})).price).toBe(
      '13.00'
    );
    const spec = {
      '@type': 'Product',
      name: 'B',
      offers: {'@type': 'Offer', priceSpecification: [{price: 22.99, priceCurrency: 'GBP'}, {price: 1}]},
    };
    expect(parse(ldJson(spec))).toMatchObject({price: '22.99', priceCurrency: 'GBP'});
  });

  test('ignores prices that are objects', () => {
    const html = ldJson({'@type': 'Product', name: 'C', offers: {'@type': 'Offer', price: {value: 3}}});
    expect(parse(html)).toMatchObject({price: undefined, priceCurrency: undefined});
  });

  test('reads prices without currency as euro', () => {
    expect(parse(ldJson({'@type': 'Product', name: 'D', offers: {price: '9'}}))).toMatchObject({
      price: '9',
      priceCurrency: 'EUR',
    });
  });

  test('reads images as lists, image objects and protocol relative urls', () => {
    const product = (image: unknown) => parse(ldJson({'@type': 'Product', name: 'E', image})).image;
    expect(product(['//cdn.example.com/1.jpg', '//cdn.example.com/2.jpg'])).toBe('https://cdn.example.com/1.jpg');
    expect(product({'@type': 'ImageObject', url: '/img/e.png'})).toBe('https://shop.example.com/img/e.png');
    expect(product([{'@type': 'ImageObject', contentUrl: 'https://example.com/e.webp'}])).toBe(
      'https://example.com/e.webp'
    );
  });

  test('uses the name and image of the offer over the product', () => {
    const html = ldJson({
      '@type': 'Product',
      name: 'Generic',
      offers: {'@type': 'Offer', name: 'Specific', image: 'https://example.com/specific.jpg', price: 1},
    });
    expect(parse(html)).toMatchObject({name: 'Specific', image: 'https://example.com/specific.jpg'});
  });

  test('prefers the OpenGraph title of books, it names the author', () => {
    const html = `<head>${meta('og:title', 'Permanent Record, Edward Snowden, S. FISCHER')}</head>${ldJson({
      '@type': 'Book',
      name: 'Permanent Record',
      workExample: [{'@type': 'Book', isbn: '978-3-10-491167-0'}],
    })}`;
    expect(parse(html)).toMatchObject({
      name: 'Permanent Record, Edward Snowden, S. FISCHER',
      isbn: '978-31-0491-167-0',
    });
  });

  test('uses the name of a book if there is nothing else', () => {
    const html = ldJson({
      '@type': 'Book',
      name: 'Ich und der Anfang der Welt',
      isbn: '9783522305402',
      offers: {'@type': 'Offer', price: '13.00', priceCurrency: 'EUR'},
    });
    expect(parse(html)).toMatchObject({name: 'Ich und der Anfang der Welt', isbn: '978-35-2230-540-2', price: '13.00'});
  });

  test('skips organisations, websites and breadcrumbs', () => {
    const html = `<head><title>Lamp | Shop</title></head>${ldJson({
      '@type': 'Organization',
      name: 'The Shop',
      logo: 'https://example.com/logo.png',
    })}${ldJson({'@type': 'WebSite', name: 'The Shop', url: 'https://example.com'})}${ldJson({
      '@type': 'BreadcrumbList',
      itemListElement: [{'@type': 'ListItem', name: 'Home'}],
    })}`;
    expect(parse(html)).toMatchObject({name: 'Lamp | Shop', image: undefined, price: undefined});
  });

  test('does not take the name or image of the page around an offer', () => {
    const html = `<head><title>Sunscreen</title></head>${ldJson({
      '@type': 'WebPage',
      name: 'Shop page',
      image: 'https://example.com/page-banner.jpg',
      mainEntity: {'@type': 'Offer', price: '6.00'},
    })}`;
    expect(parse(html)).toMatchObject({name: 'Sunscreen', image: undefined, price: '6.00'});
  });

  test('reads ld+json with an unusual script type spelling', () => {
    const html = '<script type=" Application/LD+JSON ">{"@type": "Product", "name": "Spelled"}</script>';
    expect(parse(html).name).toBe('Spelled');
  });

  test('reads broken ld+json next to working blocks', () => {
    const html = `${ldJson('{"@type": "Product", "name": "Ent-Täuschung", "offers": {"price": "38.00"')}${ldJson({
      '@type': 'Product',
      name: 'Working',
    })}`;
    expect(parse(html).name).toBe('Working');
  });
});

describe('microdata', () => {
  test('reads a product with a nested offer', () => {
    const html = `<body><div itemscope itemtype="http://schema.org/Product">
      <h1 itemprop="name"> Nuova Kombikinderwagen </h1>
      <img itemprop="image" src="https://example.com/wagen.jpg">
      <div itemprop="offers" itemscope itemtype="http://schema.org/Offer">
        <meta itemprop="price" content="549.90"><meta itemprop="priceCurrency" content="EUR">
      </div>
    </div></body>`;
    expect(parse(html)).toEqual({
      name: 'Nuova Kombikinderwagen',
      image: 'https://example.com/wagen.jpg',
      price: '549.90',
      priceCurrency: 'EUR',
      isbn: undefined,
    });
  });

  test('reads data-vocabulary.org and https schema urls', () => {
    const html = `<div itemscope itemtype="https://data-vocabulary.org/Product"><span itemprop="name">Old</span>
      <span itemprop="offers" itemscope itemtype="https://data-vocabulary.org/Offer"><span itemprop="price">5</span></span>
    </div>`;
    expect(parse(html)).toMatchObject({name: 'Old', price: '5'});
  });

  test('reads a product split over several items with a separate offer', () => {
    const html = `<body>
      <div itemscope itemtype="http://schema.org/Product"><h1 itemprop="name">Charly Teddybär</h1></div>
      <div itemscope itemtype="http://schema.org/Product"><img itemprop="image" src="/media/0128461.jpg"></div>
      <div itemscope itemtype="http://schema.org/Offer">
        <div itemprop="price"><span class="price">19,90 €</span> <span>inkl. 19% MwSt.</span> 1 Stück</div>
      </div>
      <img src="/media/care_labels/plush/2/9.png">
    </body>`;
    expect(parse(html)).toEqual({
      name: 'Charly Teddybär',
      image: 'https://shop.example.com/media/0128461.jpg',
      price: '19.90',
      priceCurrency: 'EUR',
      isbn: undefined,
    });
  });

  test('reads values from content, src, href and text', () => {
    const html = `<div itemscope itemtype="http://schema.org/Product">
      <span itemprop="name" content="Sortiment &amp; Backzutaten">Visible name</span>
      <link itemprop="image" href="//cdn.example.com/backen.jpg">
      <span itemprop="offers" itemscope itemtype="http://schema.org/Offer">
        <span itemprop="price">€ 19,39</span><span itemprop="priceCurrency">EUR</span>
      </span>
    </div>`;
    expect(parse(html)).toMatchObject({
      name: 'Sortiment & Backzutaten',
      image: 'https://cdn.example.com/backen.jpg',
      price: '19.39',
    });
  });

  test('reads react markup with breadcrumbs inside the product', () => {
    const html = `<head><title>Müllpresse 75339 | Star Wars™ | LEGO® Shop</title>
      ${meta('og:title', 'Müllpresse 75339 | Star Wars™ | LEGO® Shop')}</head>
      <body><div itemscope="" itemType="http://schema.org/Product">
        <ol itemscope="" itemType="http://schema.org/BreadcrumbList">
          <li itemProp="itemListElement" itemscope="" itemType="http://schema.org/ListItem">
            <span itemProp="name">Home</span><meta itemProp="position" content="1"/>
          </li>
        </ol>
        <h1 itemProp="name">Müllpresse im Todesstern™ – Diorama</h1>
        <div itemProp="offers" itemscope="" itemType="http://schema.org/Offer"><meta itemProp="price" content="89.99"/></div>
      </div></body>`;
    expect(parse(html)).toMatchObject({name: 'Müllpresse im Todesstern™ – Diorama', price: '89.99'});
  });

  test('reads itemref and items with an itemprop but no parent item', () => {
    const html = `<body>
      <div itemscope itemtype="http://schema.org/Product" itemref="title image"></div>
      <h1 id="title" itemprop="name">Klopf! Klopf!</h1>
      <img id="image" itemprop="image" src="https://example.com/cover.jpg">
      <span id="offer" itemscope itemprop="offers" itemtype="http://schema.org/Offer">
        <span itemprop="price" content="12.99"></span>
      </span>
    </body>`;
    expect(parse(html)).toMatchObject({name: 'Klopf! Klopf!', image: 'https://example.com/cover.jpg', price: '12.99'});
  });

  test('survives itemref loops', () => {
    const html = `<div id="a" itemscope itemtype="http://schema.org/Product" itemref="a b"><span itemprop="name">Loop</span></div>
      <div id="b" itemref="a"></div>`;
    expect(parse(html).name).toBe('Loop');
  });

  test('takes the offer of the main product and not the related products', () => {
    const html = `<head>${meta('og:title', 'Sunscreen Lipbalm SPF 20')}</head>
      <body itemscope itemtype="http://schema.org/WebPage">
        <main itemscope itemtype="http://schema.org/WebPageElement" itemprop="mainContentOfPage">
          <aside><img class="zoom" src="/det/lipbalm.jpg" data-zoom-image="/orig/lipbalm.jpg" alt="Mimitika Sunscreen Lipbalm SPF 20"></aside>
          <div itemprop="offers" itemscope itemtype="http://schema.org/Offer"><span itemprop="price" content="6.00">€ 6,00</span></div>
          <section>
            <img src="/rlist/daily-defence-sunscreen-spf-30.jpg" alt="Daily Defence Sunscreen SPF 30">
            <span itemprop="name">Daily Defence Sunscreen SPF 30</span>
            <div itemprop="offers" itemscope itemtype="http://schema.org/Offer"><span itemprop="price" content="70.00"></span></div>
          </section>
        </main>
      </body>`;
    expect(parse(html)).toMatchObject({
      name: 'Sunscreen Lipbalm SPF 20',
      image: 'https://shop.example.com/orig/lipbalm.jpg',
      price: '6.00',
    });
  });
});

describe('fallback image', () => {
  const withSize = (doc: Document, selector: string, width: number, height: number) => {
    const img = doc.querySelector(selector) as Element;
    Object.defineProperties(img, {
      complete: {value: true},
      naturalWidth: {value: width},
      naturalHeight: {value: height},
    });
  };

  test('uses the biggest image the browser rendered', () => {
    const doc = page(`<body><main>
      <img id="small" src="/thumbnail/tablet/168154.jpg">
      <img id="big" src="/original/desktop/168154.jpg">
    </main></body>`);
    withSize(doc, '#small', 200, 200);
    withSize(doc, '#big', 1200, 1200);
    expect(parseDocument(doc, URL).image).toBe('https://shop.example.com/original/desktop/168154.jpg');
  });

  test('prefers images in main and article over the rest of the page', () => {
    const html = `<body><img src="/sidebar.jpg"><article><img src="/article.jpg"></article></body>`;
    expect(parse(html).image).toBe('https://shop.example.com/article.jpg');
  });

  test('skips navigation, logos, icons and non image files', () => {
    const html = `<body>
      <header><nav><img src="/navigation_image_header/new.jpg"></nav></header>
      <img src="/theme/img/menu/wishlist.png">
      <img src="/assets/logo.jpg">
      <img src="/tracking.gif">
      <img src="/cover.php?id=1">
      <img src="/product/hutte.jpg">
    </body>`;
    expect(parse(html).image).toBe('https://shop.example.com/product/hutte.jpg');
  });

  test('reads lazy loading attributes and srcsets', () => {
    expect(parse('<body><img src="data:image/svg+xml,x" data-src="/lazy.jpg"></body>').image).toBe(
      'https://shop.example.com/lazy.jpg'
    );
    expect(parse('<body><img srcset="/a-1x.jpg 1x, /a-2x.jpg 2x" src="/a.jpg"></body>').image).toBe(
      'https://shop.example.com/a-2x.jpg'
    );
    expect(parse('<body><img srcset="/w400.webp 400w, /w1200.webp 1200w"></body>').image).toBe(
      'https://shop.example.com/w1200.webp'
    );
  });

  test('prefers the image named like the product, even with umlauts', () => {
    const html = `<head><title>Hütte Safari Beige</title></head><body>
      <img src="/banner/sale.jpg" alt="Sale">
      <img src="/images/hutte-safari-beige_94385.jpg">
    </body>`;
    expect(parse(html).image).toBe('https://shop.example.com/images/hutte-safari-beige_94385.jpg');
  });

  test('works on pages without a body element', () => {
    const doc = parseHTML(
      '<title>Globber 4 In 1 Scooter   - Bicycle Store</title><div class="content"><img src="/scooter.jpg"></div>'
    ).document;
    expect(parseDocument(doc, URL)).toMatchObject({
      name: 'Globber 4 In 1 Scooter - Bicycle Store',
      image: 'https://shop.example.com/scooter.jpg',
    });
  });

  test('finds nothing on empty or damaged pages', () => {
    expect(parse('<head></head><body><p>Please enable cookies</p></body>')).toEqual({
      name: undefined,
      image: undefined,
      price: undefined,
      priceCurrency: undefined,
      isbn: undefined,
    });
  });
});

describe('bot challenges', () => {
  test.each([
    'Just a moment...',
    'Attention Required! | Cloudflare',
    'Pardon Our Interruption',
    'Access Denied',
    'Client Challenge',
    'Making sure you’re not a bot!',
  ])('%s', (title) => {
    expect(parse(`<head><title> ${title} </title></head>${ldJson({'@type': 'Product', name: 'X'})}`)).toEqual({});
  });
});

describe('genialokal', () => {
  const url = 'https://www.genialokal.de/Produkt/Lea-Korsgaard/Das-Jahr-der-Schmetterlinge_lid_1.html';

  test('reads books with authors, the product image and the isbn', () => {
    const html = `<head>
      ${meta('og:title', 'Das Jahr der Schmetterlinge')}
      ${meta('og:image', 'https://cover.example.com/sharing.jpg')}
    </head><body>
      <div itemscope itemtype="http://schema.org/Product" itemref="cover offer">
        <h1 itemprop="name">Das Jahr der Schmetterlinge</h1>
      </div>
      <img id="cover" itemprop="image" src="https://cover.example.com/product.jpg">
      <h2 class="articleHeadline"><a> Lea Korsgaard </a></h2>
      <span id="offer" itemscope itemprop="offers" itemtype="http://schema.org/Offer">
        <span itemprop="price" content="22.99"></span><span itemprop="priceCurrency" content="EUR"></span>
      </span>
      <div class="info-block">
        <div><span>Seiten</span> 300</div>
        <div><span>EAN</span> 9783864933806</div>
      </div>
    </body>`;
    expect(parse(html, url)).toEqual({
      name: 'Das Jahr der Schmetterlinge - Lea Korsgaard',
      image: 'https://cover.example.com/product.jpg',
      price: '22.99',
      priceCurrency: 'EUR',
      isbn: '978-38-6493-380-6',
    });
  });

  test('joins several authors and finds isbns in tables', () => {
    const html = `<head>${meta('og:title', 'Kinderbuch')}</head><body>
      <h2 class="articleHeadline"><a>Anna A</a><a>Bert B</a></h2>
      <table><tr><th>ISBN</th><td itemprop="isbn">3845829826</td></tr></table>
    </body>`;
    expect(parse(html, url)).toMatchObject({name: 'Kinderbuch - Anna A, Bert B', isbn: '38-4582-982-6'});
  });

  test('applies only to genialokal', () => {
    const html = `<head>${meta('og:title', 'Book')}</head><body><h2 class="articleHeadline"><a>Author</a></h2></body>`;
    expect(parse(html, 'https://www.example.com/book').name).toBe('Book');
  });
});

describe('amazon', () => {
  test('reads the main product image and isbn 13 of books', () => {
    const html = `<head><title>Amazon.de: Bücher</title>${meta('og:image', 'https://example.com/amazon-logo.png')}</head>
      <body>
        <span id="productTitle">Programmieren für Kids</span>
        <img id="imgBlkFront" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/front.jpg":[500,500],"https://m.media-amazon.com/images/I/small.jpg":[100,100]}'>
        <div id="detailBullets_feature_div"><ul>
          <li><span>ISBN-10 : 3741525774</span></li>
          <li><span>ISBN-13 : 978-3741525773</span></li>
        </ul></div>
      </body>`;
    expect(parse(html, 'https://www.amazon.de/dp/3741525774')).toEqual({
      name: 'Programmieren für Kids',
      image: 'https://m.media-amazon.com/images/I/front.jpg',
      price: undefined,
      priceCurrency: undefined,
      isbn: '978-37-4152-577-3',
    });
  });

  test('falls back to the regular data when the amazon elements are missing', () => {
    const html = `<head><title>Amazon.com: Engel Adapter</title>${meta('og:image', 'https://example.com/engel.jpg')}</head>`;
    expect(parse(html, 'https://www.amazon.com/dp/B07F4C4NVW')).toMatchObject({
      name: 'Amazon.com: Engel Adapter',
      image: 'https://example.com/engel.jpg',
    });
  });
});
