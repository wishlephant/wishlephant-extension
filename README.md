# Wishlephant Browser Extension

Browser extension for [wishlephant.com](https://wishlephant.com). Click the
toolbar button on any product or book page and it extracts the name, price,
image and ISBN — then opens wishlephant.com with those details pre-filled.

- [Install in Firefox](https://addons.mozilla.org/en-US/firefox/addon/wishlephant/?src=search)
- [Install in Chrome](https://chrome.google.com/webstore/detail/wishlephant/jlboplkjmpihnagigadfbghilalnpgkl?hl=de)

Alternatively you can use
[this iOS shortcut](https://www.icloud.com/shortcuts/d2bc9187df2349a7a1417976dd2b795b)
or a bookmark:

```js
javascript: void open(
  'https://wishlephant.com/add_entry?url=' + encodeURIComponent(location.href),
  '_blank'
);
```

## Development

```sh
yarn install

yarn dev           # Chrome — opens a browser window with the extension loaded
yarn dev:firefox   # Firefox
```

## Tests

```sh
yarn test
```

## Release

```sh
yarn build         # Chrome  → .output/chrome-mv3/
yarn build:firefox # Firefox → .output/firefox-mv2/

yarn zip           # Chrome zip for store submission
yarn zip:firefox   # Firefox zip for store submission
```

## How it works

- **`entrypoints/background.ts`** — listens for the toolbar button click, asks
  the content script for page data, opens wishlephant.com with the result as
  URL parameters.
- **`entrypoints/content.ts`** — responds to the background's message by
  running `parseDocument(document)`.
- **`src/extractor.ts`** — DOM-based metadata extractor: reads Open Graph tags,
  JSON-LD and microdata directly from the live document. Zero dependencies,
  no eval.
- **`src/parser.ts`** — string-based parser used only by the test suite.

## Project structure

```
entrypoints/    WXT entrypoints (background + content script)
src/            Shared logic (extractor, parser)
tests/          Jest test suite
public/         Static assets (icons, locales) copied into the built extension
wxt.config.ts   Extension manifest configuration
```
