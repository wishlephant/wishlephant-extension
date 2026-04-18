import type {ParseResult} from '../src/extractor';

export default defineBackground(() => {
  async function fetchPageData(tabId: number): Promise<ParseResult> {
    try {
      return await browser.tabs.sendMessage(tabId, {text: 'wishlephant_fetch_dom_content'});
    } catch {
      await browser.scripting.executeScript({
        target: {tabId},
        files: ['/content-scripts/content.js'],
      });
      return await browser.tabs.sendMessage(tabId, {text: 'wishlephant_fetch_dom_content'});
    }
  }

  async function openPage(): Promise<void> {
    const tabs = await browser.tabs.query({active: true, currentWindow: true});
    const tab = tabs[0];
    if (!tab.id || !tab.url) return;

    const url = new URL(tab.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    let result: ParseResult = {};
    try {
      result = await fetchPageData(tab.id);
    } catch (e) {
      console.error('wishlephant: failed to extract page data', e);
    }

    const params: Record<string, string> = {url: tab.url};
    for (const [key, value] of Object.entries(result)) {
      if (value !== undefined) {
        params[key] = String(value);
      }
    }

    await browser.tabs.create({
      url: `https://wishlephant.com/add_entry?${new URLSearchParams(params).toString()}`,
    });
  }

  // Firefox MV2 exposes browserAction; MV3 and Chrome expose action
  const actionApi = browser.action ?? (browser as unknown as {browserAction: typeof browser.action}).browserAction;
  actionApi.onClicked.addListener(openPage);
});
