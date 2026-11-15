import {pageTitle} from './util';

const CHALLENGE_TITLES = [
  'client challenge',
  'just a moment...',
  'attention required! | cloudflare',
  'pardon our interruption',
  'access denied',
  'making sure you’re not a bot!',
  "making sure you're not a bot!",
];

// A bot challenge has no product data. Sending its title would store "Just a
// moment..." as the wish, without a name wishlephant fetches the page itself.
export function isChallenge(doc: Document): boolean {
  return CHALLENGE_TITLES.includes(pageTitle(doc)?.toLowerCase() ?? '');
}
