// Test-only stand-in for `next/link` (see tsx-hook.mjs): renders a plain anchor.
import { createElement } from 'react';

export default function Link({ href, children, prefetch: _prefetch, ...rest }) {
  return createElement('a', { href: typeof href === 'string' ? href : String(href?.pathname || ''), ...rest }, children);
}
