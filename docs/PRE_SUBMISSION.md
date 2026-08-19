# Clique — pre-submission checklist

Last updated 2026-08-18. Everything security-related from the 16–18 Aug audit is
done; what remains is listed here.

Ordered by what blocks submission, not by effort.

---

## 1. Money paths — both are currently non-functional

These are the biggest gap. Both look wired up from the outside and are not.

### 1a. RevenueCat is stubbed out

`src/features/purchases/api.ts` is a no-op module. The real import is commented
out and every function is a stub:

```ts
export async function purchaseVerified() {
  throw new Error('Purchases not available');
}
```

`configureRevenueCat` is also commented out in `src/app/_layout.tsx` (lines 24,
139, 142), so the SDK never initialises.

**Consequence:** tapping subscribe in `get-verified-modal` throws immediately.
The global mutation handler turns that into "Something went wrong". The paid
verification tier cannot be bought by anyone.

**Steps:**
1. Create the subscription products in App Store Connect (see §2) — the code
   comment says RevenueCat was disabled precisely because they didn't exist yet.
2. In RevenueCat: create the app, add the App Store products, define the
   `Verified` entitlement (the code expects that exact string —
   `VERIFIED_ENTITLEMENT`), and attach the products to it.
3. Restore `src/features/purchases/api.ts` to its real implementation
   (`git log -- src/features/purchases/api.ts` will show the version before it
   was stubbed).
4. Uncomment `configureRevenueCat` in `_layout.tsx`.
5. Confirm `EXPO_PUBLIC_RC_API_KEY` is the production `appl_` key — it is as of
   2026-08-18.
6. Test a sandbox purchase on a real device with a sandbox Apple ID. This
   cannot be tested in the simulator.

**If you are not launching with paid verification:** remove or hide the
`get-verified-modal` entry point instead. Shipping a visible upgrade button that
always errors is worse than not offering it, and Apple rejects non-functional
purchase UI.

### 1b. Stripe is on a test key

`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts with `pk_test_`.

Stripe here is **Stripe Identity**, not payments — `get-verified-modal` calls
the `create-verification-session` edge function after a successful purchase, and
`stripe-identity-webhook` receives the result. So it gates the verification
checkmark, not money.

**Steps:**
1. Decide whether ID verification ships in v1.
2. If yes: switch to the live publishable key, set the live secret key in
   Supabase Edge Function secrets (`STRIPE_SECRET_KEY`), and re-point the
   webhook at the live endpoint with its live signing secret
   (`STRIPE_IDENTITY_WEBHOOK_SECRET`).
3. Complete Stripe Identity onboarding in the Stripe dashboard — it needs
   business details before live mode works.
4. Test one real verification end to end.

Note that 1a and 1b are chained: the ID check only runs after a purchase
succeeds, so RevenueCat has to work first.

---

## 2. App Store Connect

1. **App record** — bundle ID `com.lanapolitano.thecliqueapp` registered, app
   created.
2. **Subscription products** — create the tiers `get-verified-modal` offers,
   matching the prices shown in `TIERS`. Needed before RevenueCat (§1a).
3. **Screenshots** — 6.9" and 6.5" iPhone required. iPad too if you declare iPad
   support.
4. **Privacy nutrition labels** — must match what the app actually collects.
   Note `profiles` stores `gender`, `age_range` and `location`, so declare those
   even though nothing displays them.
5. **Age rating** — the signup age gate blocks under-13s; rating should reflect
   user-generated content and messaging.
6. **Demo account for review** — the app is login-only, so App Review needs
   working credentials in the review notes, plus any steps to reach premieres or
   watch parties. This is a common rejection cause.
7. **Export compliance** — standard HTTPS-only answer, declared at upload.

---

## 2b. Capabilities, entitlements and auth providers

`ios/Clique/Clique.entitlements` currently declares Sign in with Apple, push,
associated domains and Apple Pay. Three of those need attention.

### Sign in with Apple — code side done, config side unverified

The entitlement is present in both `app.json` and `Clique.entitlements`, and
`expo-apple-authentication` is wired into both auth screens. **Apple requires
Sign in with Apple because the app also offers Google login**, so this is not
optional.

Still to confirm outside the repo:
1. "Sign In with Apple" capability enabled on the App ID in the Apple Developer
   portal (the entitlement fails to sign without it).
2. Supabase → Authentication → Providers → Apple configured with Services ID,
   Team ID, Key ID and the `.p8` private key.
3. One real sign-in on a device build — the simulator is unreliable for this.

### Google sign-in

No native plugin: `f8cd3c3` moved this to an `expo-auth-session` web flow, so
there is nothing to configure in Xcode. Confirm instead:
1. Supabase → Authentication → Providers → Google enabled, with the OAuth
   client ID and secret from Google Cloud.
2. Redirect URI matches what `signInWithGoogle` builds:
   `thecliqueapp://auth/callback`.
3. The OAuth consent screen is published, not left in testing mode — in testing
   mode only allow-listed accounts can sign in.

### `aps-environment` — fixed in code, still needs a live test

Both build configurations pointed at the same entitlements file declaring
`development`, so App Store builds would have registered against the APNs
sandbox and push would have silently failed for every real user.

Fixed in `8e87de8`: `ios/Clique/CliqueRelease.entitlements` carries
`production` and the Release configuration points at it, while Debug keeps the
sandbox.

**Still to do:** send yourself a push from a TestFlight build. That is the only
way to confirm delivery, and it cannot be tested in the simulator.

**Caveat:** `expo prebuild --clean` regenerates `ios/` and would drop this.

### Apple Pay entitlement may be unnecessary

```xml
<key>com.apple.developer.in-app-payments</key>
<array><string>merchant.com.thecliqueapp</string></array>
```

Nothing in `src/` uses Apple Pay — Stripe is only used for Identity. This
merchant ID must exist in the Developer portal or signing fails; if you are not
taking Apple Pay, remove the entitlement rather than creating the merchant ID.

### Universal links are broken

`applinks:vaultedmediagroup.com` is declared, but:

```
GET https://vaultedmediagroup.com/.well-known/apple-app-site-association
→ HTTP 404
```

Without that file iOS never associates the domain, so the
`https://vaultedmediagroup.com/premiere/{id}` links that `handleDeepLink`
expects open in Safari instead of the app. Shared premiere links do not work.

Either host the association file at that path (served as
`application/json`, no redirects), or drop the associated domain and rely on
the `thecliqueapp://` scheme alone.

---

## 3. Hosted web pages

Apple requires real URLs; in-app screens are not enough.

1. **Privacy Policy URL** — the in-app copy is `src/app/privacy-policy.tsx`;
   publish the same text to a public page.
2. **Terms of Service URL** — required alongside it, and required by Apple for
   auto-renewing subscriptions.
3. **Support URL** — must resolve, not 404.

The `web/` Next.js app already serves public routes (`/[username]`, `/post`), so
these can live there rather than needing separate hosting.

---

## 4. Affiliate links — revenue you are currently giving away

`src/features/where-to-find/links.ts` and the `GAME_STORE_BY_PLATFORM` map in
`src/features/content/api.ts` build store links for every title. They are plain
search URLs with **no affiliate tags**, so every purchase your users make
through Clique earns nothing.

This is additive, low-risk, and touches one file plus a map.

| Store | Programme | How the link changes |
|---|---|---|
| Amazon (books, Kindle, video) | Amazon Associates | append `&tag=YOURTAG-20` |
| Bookshop.org | Bookshop affiliate | append `?a=YOURID` or use their affiliate path |
| Steam | no public affiliate programme | leave as-is |
| Apple Books / Music / TV | Apple's affiliate programme has changed repeatedly and no longer covers apps — **verify current status before assuming these can be monetised** | — |

**Steps:**
1. Apply to Amazon Associates and Bookshop.org. Approval is not instant, so
   start now — Amazon also requires you to disclose the app as a channel.
2. Add the tags in `links.ts` behind a small helper so the ID lives in one place.
3. **Disclosure:** Apple and the FTC both expect affiliate relationships to be
   disclosed. Add a line to the "Where to buy" section and to your privacy
   policy / terms.

Worth doing before launch because retrofitting tags later means users who
already bought through the app earned you nothing.

---

## 5. Code work still outstanding

Nothing here blocks submission, in rough value order:

- **~20 screens without error states.** 15 of 73 now covered. Two of the eleven
  fixed on 18 Aug were real bugs (a spinner that never resolved, a profile card
  rendering undefined data), so the remainder may hide similar cases.
- **No offline detection.** NetInfo is not installed; the app cannot tell
  "offline" from "server error", and cannot warn before someone loses a long
  post.
- **Sentry trim.** ~0.7 MB of browser-only Sentry code is in the iOS bundle
  (`@sentry-internal/replay`, `@sentry/browser`, `browser-utils`). Needs a
  before/after `EXPO_ATLAS=true npx expo export` to confirm any trim works.
- **39 inline `renderItem`** defeating row memoisation.
- **~50 toggles without `accessibilityState`**; high-traffic ones are done.
- **`EmptyState` component built but never adopted** (commit `7cacc01`).
- **13 screens with `TextInput` and unverified keyboard avoidance**, including
  `book-progress-modal`, whose fix was applied blind and is now testable since
  the simulator shows a keyboard.

---

## 6. Build and release

1. **Archive from Xcode**, not EAS. Use `ios/Clique.xcodeproj` — *not*
   `ios/TheCliqueApp 2.xcodeproj`.
2. **Build number** is 50; 49 is already uploaded. Anything at or below 49 is
   rejected.
3. **Test account deletion** on a real build before submitting — Apple checks
   it. The function went live 17 Aug and has never been exercised. Cascades are
   verified clean (100+ foreign keys, all `ON DELETE CASCADE`), so it should
   remove everything.
4. **Verify the four remaining proxies in-app** — `giphy-proxy`, `rawg-proxy`,
   `books-proxy` are proven at HTTP level but not in the app. Open the GIF
   picker in a chat to cover Giphy.

---

## Already done — do not redo

Security work from 16–18 Aug, all committed and applied as migrations:

- Every third-party API key moved server-side behind five edge function proxies;
  TMDB token rotated
- `ads` no longer writable by anyone holding the anon key (it was — including
  `cta_url`, which controls where "Watch Trailer" sends people)
- `messages` no longer world-readable, and cannot be posted under another user's
  name
- `notifications` cannot be forged from a fake sender
- **Private accounts are actually private** — an over-permissive policy handed
  every `visibility='everyone'` post to any signed-in user, and `visibility`
  defaults to `'everyone'`
- Close-friends posts respect the author's choice — the policy tested the
  relationship backwards, so anyone could self-grant access
- Users can no longer appoint themselves cohost of any premiere
- `gender`, `age_range` and `location` no longer readable by anonymous callers
- Password reset worked for nobody and now works end to end
- Onboarding is no longer skippable via social sign-in, and survives reinstalls
- `patch-package` repaired — a clean `npm install` was failing and would have
  silently dropped the React Native patch
