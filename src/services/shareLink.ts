/**
 * Wave 5 W5.4 — read-only project share links.
 *
 * The current project state (project + requirements + changes) is JSON-
 * serialized and base64url-encoded into the URL fragment, e.g.
 *   https://app/.../#share=<base64url>
 *
 * No backend, no compression dep — the size is bounded by IndexedDB's
 * `MAX_CHANGES = 200` and a few KB of requirements. Browsers safely handle
 * 50KB+ URLs; if a project ever blows past that, we'll add lz-string.
 *
 * Decode is forgiving: any decoding failure returns null so the app falls
 * back to its normal route.
 */
import type { Change, Project, Requirement } from '../types';

export interface SharedSnapshot {
  v: 1;
  project: Project;
  requirements: Requirement[];
  changes: Change[];
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodeShareLink(s: SharedSnapshot): string {
  const json = JSON.stringify(s);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

export function decodeShareLink(token: string): SharedSnapshot | null {
  try {
    const bytes = base64UrlToBytes(token);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as SharedSnapshot;
    if (parsed.v !== 1 || !parsed.project || !Array.isArray(parsed.requirements) || !Array.isArray(parsed.changes)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareUrl(s: SharedSnapshot): string {
  const token = encodeShareLink(s);
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#share=${token}`;
}

export function readShareTokenFromHash(): string | null {
  const m = /(?:^|&)share=([^&]+)/.exec(window.location.hash.replace(/^#/, ''));
  return m ? m[1] : null;
}
