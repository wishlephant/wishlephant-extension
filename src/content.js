chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (msg.text === 'wishlephant_fetch_dom_content') {
    sendResponse(document.documentElement.outerHTML);
  }
});
