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

## Voices

The user picks a voice in Settings → Wake alarm. Each voice has its OWN set of
recordings. Voice ids (see `VOICES` in `src/lib/alarmCore.ts`):

| Voice  | Gender | Feel                                              |
| ------ | ------ | ------------------------------------------------- |
| theo   | male   | Warm and grounded — the friend who believes in you |
| atlas  | male   | Strong and motivating — a gentle push to rise      |
| julian | male   | Smooth and unhurried — calm like dawn radio        |
| aurora | female | Bright and hopeful — like sunrise in a voice       |
| sage   | female | Soft and soothing — a calm, steady start           |
| nova   | female | Clear and uplifting — energy without the noise     |

## Naming + where they go

Record **5 clips per voice** (`CLIPS_PER_VOICE`), named `<voiceId>-NN.caf`:

```
aurora-01.caf  aurora-02.caf  aurora-03.caf  aurora-04.caf  aurora-05.caf
theo-01.caf    theo-02.caf    …
```

Drop them all in **`assets/audio/`** (create it at the repo root next to `assets/`).
Change the count by editing `CLIPS_PER_VOICE`; add/rename voices by editing the
`VOICES` list — the daily rotation adapts automatically.

## ⚠️ MP3 won't work — convert to .caf

AlarmKit only accepts `.caf` / `.wav` / `.aiff` (NOT `.mp3`/`.m4a`). If you have
mp3s, convert each with macOS's built-in tool:

```sh
afconvert -f caff -d LEI16 aurora-01.mp3 aurora-01.caf
```

Batch a folder of mp3s:

```sh
for f in *.mp3; do afconvert -f caff -d LEI16 "$f" "${f%.mp3}.caf"; done
```
