# Wake — voice-alarm clip spec

The wake alarm plays a short, warm, spoken good-morning that **rotates one per day**
(`soundForDate` in `src/lib/alarm.ts`). These are the recordings you'll make.

## Hard technical limits (Apple AlarmKit)

- **Format:** `.caf`, `.wav`, or `.aiff` (AlarmKit does **not** accept `.mp3`/`.m4a`).
- **Length:** **≤ 30 seconds** per clip (AlarmKit caps custom sounds). Aim **15–20s**.
- **Bundled only:** files ship inside the app — no streaming/URLs.
- **iOS 26.1+** is required for custom sounds to *loop* until "slide to stop"
  (26.0 plays once then stops). Below that, the notification-fallback tier is used.

## Recording guidance

- **Tone:** calm, warm, unhurried — a gentle nudge, not a hype coach. This is the
  first voice someone hears each day.
- **Pacing:** start soft, leave a beat of silence at the very start (~0.5s) so it
  eases in rather than blasting.
- **Levels:** record clean and fairly quiet; the alarm system handles loudness.
  Avoid clipping. Mono is fine.
- **Sample rate:** 44.1kHz, 16-bit is plenty.
- **Quiet room**, pop filter if you have one. A phone in a closet works in a pinch.

## Suggested lines (write your own — these set the feel)

1. "Good morning. Take a breath… you don't have to rush. Open Wake whenever you're ready to begin your day."
2. "Hey — it's morning. You're up, that's the hard part. Let's start gently."
3. "Morning. The day's quiet right now. Come start it with me, one small step at a time."
4. "Good morning. However you slept, today's a fresh page. Open up when you're ready."
5. "Rise easy. No alarm-panic today — just you, awake, ahead of the day. Let's go."

## Naming + where they go

Name them exactly to match the manifest in `src/lib/alarm.ts` (`WAKE_CLIPS`):

```
wake-01.caf  wake-02.caf  wake-03.caf  wake-04.caf  wake-05.caf
```

Drop them in **`assets/audio/`** (create it at the repo root next to `assets/`).
Add or remove clips by editing the `WAKE_CLIPS` list — the daily rotation adapts to
the library size automatically. Start with as few as 2–3 and grow it.

## Converting to .caf

If you record to WAV/AIFF, convert with macOS's built-in tool:

```sh
afconvert -f caff -d LEI16 wake-01.wav wake-01.caf
```
