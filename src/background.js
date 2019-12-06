var browser = browser || chrome;

function openPage() {
  browser.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs[0];
    browser.tabs.create({
      url:
        "https://wishlephant.com/add_entry?url=" + encodeURIComponent(tab.url)
    });
  });
}

browser.browserAction.onClicked.addListener(openPage);
