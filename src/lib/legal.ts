import * as WebBrowser from 'expo-web-browser'

// Where the hosted legal documents live. The source markdown is in /legal at the
// repo root (privacy-policy.md, terms-of-service.md) — host those and replace
// these placeholders with the real public URLs before App Store submission.
// Apple's subscription rules (Guideline 3.1.2) require BOTH of these to be working
// links presented on the purchase screen, and App Store Connect requires the
// Privacy Policy URL on the listing.
//
// ⚠️ PLACEHOLDERS — swap for the real URLs before shipping.
export const PRIVACY_POLICY_URL = 'https://wake.app/privacy' // TODO: real hosted URL
export const TERMS_OF_SERVICE_URL = 'https://wake.app/terms' // TODO: real hosted URL

/** Open a legal document in an in-app browser. Best-effort — never throws. */
export function openLegal(url: string): void {
  WebBrowser.openBrowserAsync(url).catch(() => {})
}
