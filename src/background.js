var browser = browser || chrome;

function openPage() {
  browser.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs[0];
    try {
      var url = new URL(tab.url);
      if (url.protocol === "http:" || url.protocol === "https:") {
        browser.tabs.create({
          url:
            "https://wishlephant.com/add_entry?url=" +
            encodeURIComponent(tab.url)
        });
      }
    } catch (e) {
      console.log("not a valid url");
    }
  });
}

browser.browserAction.onClicked.addListener(openPage);
