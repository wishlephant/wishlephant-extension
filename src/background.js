import parse from './parser';

const browserInstance = browser || chrome;

function openPage() {
  browserInstance.tabs.query({active: true, currentWindow: true}, function (tabs) {
    const tab = tabs[0];
    const url = new URL(tab.url);

    function analyzeDom(domContent) {
      const result = parse(domContent);
      Object.keys(result).forEach((key) => result[key] === undefined && delete result[key]);
      result.url = tab.url;
      const params = new URLSearchParams(result);
      try {
        browser.tabs.create({
          url: 'https://wishlephant.com/add_entry?' + params.toString(),
        });
      } catch (e) {
        console.log('not a valid url');
      }
    }

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      chrome.tabs.sendMessage(tab.id, {text: 'wishlephant_fetch_dom_content'}, analyzeDom);
    }
  });
}

browser.browserAction.onClicked.addListener(openPage);
