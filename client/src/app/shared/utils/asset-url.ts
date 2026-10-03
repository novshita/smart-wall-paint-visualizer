import { environment } from '../../../environments/environment';

/**
 * Resolves server asset paths such as "/static/patterns/x.svg". When the API lives on
 * another origin (production), assets come from that origin too.
 */
export function assetUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const api = environment.apiUrl;
  const origin = /^https?:\/\//.test(api) ? new URL(api).origin : window.location.origin;
  return new URL(path, origin).toString();
}
