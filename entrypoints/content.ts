import {parseDocument} from '../src/extractor';

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  main() {
    browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
      if ((msg as {text: string}).text === 'wishlephant_fetch_dom_content') {
        sendResponse(parseDocument(document));
      }
    });
  },
});
