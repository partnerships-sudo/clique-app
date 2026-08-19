/**
 * Serves the Apple App Site Association file for universal links.
 *
 * `ios/Clique/Clique.entitlements` declares `applinks:vaultedmediagroup.com`,
 * and `handleDeepLink` in the app expects to receive
 * `https://vaultedmediagroup.com/premiere/{id}`. Until this file exists at
 * `/.well-known/apple-app-site-association`, iOS never associates the domain,
 * so those links open in Safari instead of the app — shared premiere links
 * silently do not work.
 *
 * Served as a route handler rather than a file in `public/` because Apple
 * requires `Content-Type: application/json` and the file has no extension, so
 * static hosting tends to serve it as `application/octet-stream`.
 *
 * Apple's requirements, all of which this satisfies:
 *   - HTTPS, no redirects (a 301/302 makes iOS reject it)
 *   - `application/json` content type
 *   - reachable unauthenticated
 *
 * IMPORTANT: this only works if THIS app is what serves
 * vaultedmediagroup.com. If that domain is hosted elsewhere, the file has to
 * live there instead, or the entitlement should point at whichever domain this
 * app does serve.
 */

const TEAM_ID = 'M943AW25Y8';
const BUNDLE_ID = 'com.lanapolitano.thecliqueapp';

const ASSOCIATION = {
  applinks: {
    details: [
      {
        appIDs: [`${TEAM_ID}.${BUNDLE_ID}`],
        components: [
          {
            '/': '/premiere/*',
            comment: 'Premiere invite and share links open in the app',
          },
        ],
      },
    ],
  },
};

export const dynamic = 'force-static';

export function GET() {
  return new Response(JSON.stringify(ASSOCIATION, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      // iOS fetches this through Apple's CDN; a short cache keeps changes
      // propagating without hammering the origin.
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
