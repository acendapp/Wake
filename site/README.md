# Wake — website

Static marketing + legal site for Wake. No build step, no dependencies — plain
HTML/CSS/JS. Styled to match the app (cream ground, antique-gold accent, Playfair
Display serif; see `../src/theme/colors.ts`).

```
site/
  index.html     landing page (hero + phone mockup, features, how-it-works,
                 pricing, waitlist capture, FAQ)
  privacy.html   Privacy Policy   (mirrors ../legal/privacy-policy.md)
  terms.html     Terms of Service (mirrors ../legal/terms-of-service.md)
  styles.css     shared styles
  app.js         waitlist form handling
```

## ⚠️ Wire the waitlist before launch

The hero/CTA waitlist posts to a placeholder endpoint. To collect real signups,
create a free form on [Formspree](https://formspree.io) (or similar) and replace
`your-form-id` in `index.html`'s `<form action="…">`. Until it's wired, submissions
are caught client-side and just show a thank-you so the page still demos cleanly.

## Preview locally

```sh
cd site && python3 -m http.server 8080
# open http://localhost:8080
```

## ⚠️ Before it goes live — fill the placeholders

The legal pages still contain highlighted `[BRACKETED]` tokens (rendered with a
gold dashed underline so they're obvious). Find every `class="ph"` span in
`privacy.html` and `terms.html` and replace the token text:

- `[LEGAL_ENTITY]` — who owns Wake (e.g. your name or LLC)
- `[CONTACT_EMAIL]` — a real, monitored support/privacy address
- `[JURISDICTION]` — governing law (e.g. "the Commonwealth of Pennsylvania, USA")
- `[EFFECTIVE_DATE]` — the publish date
- `[PRICE …]` (terms only) — must match the in-app paywall **and** App Store Connect
- `[WEBSITE_URL]` (privacy §12, optional) — your site URL

Then **have a lawyer review** (Wake handles mood/reflection data, treated as
sensitive in several regions). Keep these pages and `../legal/*.md` in sync.

## Deploy (any static host)

Point a host at this folder — e.g. **Vercel**, **Netlify**, **Cloudflare Pages**,
or **GitHub Pages**. Example (Vercel CLI):

```sh
cd site && npx vercel --prod
```

You'll get a URL like `https://<project>.vercel.app`. When your domain is ready,
add it in the host's dashboard and update DNS — the same files serve from it.

## Wire the app to the live URLs

Once hosted, set the two constants in `../src/lib/legal.ts` to the real URLs:

```ts
export const PRIVACY_POLICY_URL = 'https://<your-domain>/privacy.html'
export const TERMS_OF_SERVICE_URL = 'https://<your-domain>/terms.html'
```

(Or configure clean `/privacy` and `/terms` routes on the host and use those.)
These power the You-page **Legal** rows and the paywall's required links, and the
Privacy URL also goes in **App Store Connect**.
