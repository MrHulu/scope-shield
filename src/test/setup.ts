/**
 * Vitest setup — runs before every test file.
 *
 * Default env is `node`; component tests opt into jsdom with
 *   // @vitest-environment jsdom
 * at the top of the file. Both branches install jest-dom matchers
 * + fake-indexeddb when their globals exist.
 */

// jest-dom matchers (toBeInTheDocument, toHaveTextContent…) for jsdom tests.
import '@testing-library/jest-dom/vitest';

// fake-indexeddb provides indexedDB in node env so engine/db tests can run.
if (typeof indexedDB === 'undefined') {
  await import('fake-indexeddb/auto');
}
