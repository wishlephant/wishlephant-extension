// An absolute url, or nothing for empty values, data: urls and garbage.
export function resolveUrl(url: string, base: string): string | undefined {
  const value = url.trim();
  if (!value || value.startsWith('data:')) return undefined;
  try {
    return new URL(value, base).href;
  } catch {
    return undefined;
  }
}

export function baseUrl(doc: Document, pageUrl: string): string {
  const href = doc.querySelector('base[href]')?.getAttribute('href');
  return (href && resolveUrl(href, pageUrl)) || pageUrl;
}
