# App Store listing — copy-paste pack (Wake 1.0)

Fill these into App Store Connect → your app → the 1.0 version + App Information +
App Privacy + App Review Information. Character limits noted.

---

## Name (≤30)
`Wake` — (whatever your ASC record already reserved). If you want a keyword boost and
the plain name is contested, a subtitle-style name is allowed, e.g.:
`Wake: Voice Alarm & Routine` (27)

## Subtitle (≤30)
`Wake to a voice, not a buzz` (27)
Alternates:
- `Your calmer, sharper morning` (28)
- `A smarter way to wake up` (24)

## Promotional text (≤170, editable anytime without review)
`Wake up to a real voice that breaks through silent mode — then a short morning routine built for exactly how you're arriving today. Start your free week.`

## Keywords (≤100, comma-separated, no spaces — Apple recombines single words into phrases)
`alarm,voice,morning,routine,wake,habit,mindful,sunrise,energy,focus,reflect,sleep,gentle,calm,rise`
(98 chars. Don't repeat the app name or category — those already index.)

## Description (≤4000)
Most alarms jolt you awake and leave you to figure out the rest. Wake does the opposite.

A calm, human voice greets you each morning — and it breaks through silent mode and Do Not Disturb, so you actually get up. Then Wake hands you a short, personalized routine built for how you're actually arriving that day.

No two mornings are the same, so no two routines are. Tell Wake how ready you feel and what the day demands, and it builds a focused sequence — move, light, breath, intention — sized to the moment. Each evening's quick reflection makes tomorrow sharper. The more you use it, the better it fits.

Why people wake with Wake:
• A real voice alarm — gentle, not jarring, and loud enough to break through silent/DND
• A rotating cast of voices, so it never feels canned
• A personalized morning routine that adapts to your energy and your day
• One clear focal point each morning — the single highest-leverage thing to do
• Evening reflection that compounds: every day teaches it something
• Private by design — your mornings are yours

Wake is built to end bad mornings for good — not with more pressure, but with a calmer, smarter start that gets better every day.

Voice alarm requires iOS 26.1 or later. On earlier versions, Wake wakes you with a notification instead.

— Subscription —
Wake is a subscription with a 7-day free trial, then:
• Annual — $59.99/year
• Monthly — $9.99/month
Payment is charged to your Apple ID at confirmation of purchase. Subscriptions renew automatically unless auto-renew is turned off at least 24 hours before the current period ends. Manage or cancel anytime in your Apple ID account settings.
Terms of Service: https://trywake.org/terms
Privacy Policy: https://trywake.org/privacy

## URLs
- Privacy Policy URL (required): `https://trywake.org/privacy`
- Support URL (required): `https://trywake.org` (or a /support page if you make one)
- Marketing URL (optional): `https://trywake.org`

## Category
- Primary: **Health & Fitness** (best fit for a wellbeing/morning-habit app)
  - Alternate: **Lifestyle**
- Secondary (optional): **Productivity**

## Pricing
- App price: **Free** (the subscriptions are in-app purchases)

---

## App Privacy ("nutrition label") — questionnaire answers

"Do you or your third-party partners collect data from this app?" → **Yes**
"Is any collected data used to track you?" (cross-app/website ads) → **No** — none of it.

Declare these data types (all: Linked to identity unless noted; NOT used for tracking):

| Data type | Category | Collected | Linked to user | Purpose |
|---|---|---|---|---|
| Email address | Contact Info | Yes | Yes | App Functionality (account) |
| Health — mood/energy/focus/readiness & reflections | Health & Fitness → Health | Yes | Yes | App Functionality (personalize the routine) |
| Purchase history | Purchases | Yes | Yes | App Functionality (manage subscription) |
| Coarse location | Location | Yes | **No** (ephemeral; used to fetch weather, not stored to the account) | App Functionality |
| User ID | Identifiers | Yes | Yes | App Functionality |

Notes:
- Third parties in the data flow: Supabase (backend), Apple/RevenueCat (purchases), Open-Meteo (weather from coarse location), Anthropic (routine generation — receives your onboarding/reflection inputs, not your identity). Your privacy policy already lists these.
- No advertising, no analytics/tracking SDKs, no third-party crash reporting → answer "No" to tracking.
- If you later add crash/analytics tooling, add "Diagnostics" here.

---

## App Review Information (the reviewer-only channel)

**Demo account** (create a real account first, then paste creds here):
- Username: `reviewer@trywake.org` (or any account you make)
- Password: `__________`

**Notes for the reviewer:**
Wake is a subscription app with a sign-in and a paywall. To review the full app:
1. Sign in with the demo account above (already onboarded).
2. The app requires a subscription. This demo account has an active subscription granted for review — OR you can complete the purchase in the StoreKit sandbox (7-day free trial) to proceed.
3. Core feature — the voice alarm — uses Apple AlarmKit and requires **iOS 26.1 or later**. On earlier iOS it intentionally falls back to a standard notification (by design, not a bug). Please test the alarm on iOS 26.1+ if possible.
4. Notifications permission powers the morning/evening reminders.
5. Account deletion is available in-app under You → Account → Delete Account (Guideline 5.1.1(v)).

TIP: The most reviewer-proof option is to grant this demo account's RevenueCat App
User ID a **promotional entitlement** in the RevenueCat dashboard, so premium is
active without any purchase step. Do that after you create the account (its App
User ID is the Supabase user UUID; find it in the RevenueCat customer list).

---

## Open compatibility flag to decide
The voice alarm requires iOS 26.1+. Two honest options so users on older iOS don't
refund/1-star:
- Keep the "requires iOS 26.1" line in the description (done above), AND/OR
- Set the app's **Minimum OS version** high enough that only capable devices install it
  (trade-off: shrinks your addressable install base). Recommend keeping min-OS lower and
  relying on the description line + the in-app fallback, so pre-26.1 users still get value.
