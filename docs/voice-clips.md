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
- **Levels:** record clean, avoid clipping. Don't worry about matching volume between
  voices by ear — every clip is **loudness-normalized in processing** (see below) so all
  voices ring at the same volume regardless of how loud each actor recorded.
- **Sample rate:** 44.1kHz, 16-bit is plenty. Mono is fine (we downmix anyway).
- **Quiet room**, pop filter if you have one. A phone in a closet works in a pinch.

## ⚠️ Processing — normalize EVERY clip to the shared loudness target

So all voices (Maria, Rowan, and every future actor) are the **same perceived volume**,
each clip is normalized to **−16 LUFS integrated, −1.5 dBTP** with a two-pass loudnorm,
then written as mono PCM `.caf`. Do this for every new clip — never drop a raw recording
straight into `assets/audio/`. From any source (`.mov`/`.mp3`/`.wav`):

```sh
# pass 1: measure
ffmpeg -i in.mov -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -
# pass 2: apply the measured values (linear=true keeps the natural dynamics)
ffmpeg -y -i in.mov -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=…:measured_TP=…:measured_LRA=…:measured_thresh=…:offset=…:linear=true" \
  -ar 44100 -ac 1 -c:a pcm_s16le assets/audio/<voiceId>-NN.caf
```

(In practice the two-pass limiter often lands clips around −19 LUFS to stay under the
peak ceiling — that's fine; what matters is that they all land at the **same** level.)

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
