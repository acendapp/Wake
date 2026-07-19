import * as WebBrowser from 'expo-web-browser'

// The hosted legal documents, live at trywake.org (Vercel, clean URLs; source in
// /site → privacy.html / terms.html). Apple's subscription rules (Guideline 3.1.2)
// require BOTH to be working links on the purchase screen, and App Store Connect
// requires the Privacy Policy URL on the listing.
export const PRIVACY_POLICY_URL = 'https://trywake.org/privacy'
export const TERMS_OF_SERVICE_URL = 'https://trywake.org/terms'

/** Open a legal document in an in-app browser. Best-effort — never throws. */
export function openLegal(url: string): void {
  WebBrowser.openBrowserAsync(url).catch(() => {})
}
