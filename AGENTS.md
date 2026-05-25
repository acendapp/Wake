# Expo HAS CHANGED

This project targets **Expo SDK 54** for now. Read the exact versioned docs at
https://docs.expo.dev/versions/v54.0.0/ before writing any code.

Why 54 and not 56: the public App Store Expo Go ships SDK 54, and SDK 56's Expo Go is
still pending Apple review (as of May 2026). Staying on 54 means the app runs in the
stock Expo Go without a TestFlight beta or a custom dev build.

When the App Store ships Expo Go for SDK 56, bump back up and switch this docs link to
https://docs.expo.dev/versions/v56.0.0/. Note that `@expo/ui`, `expo-glass-effect`, and
`expo-symbols` are installed but not yet imported — the moment any of them is used, even
Expo Go (any SDK) can't run it and a development build becomes mandatory.
