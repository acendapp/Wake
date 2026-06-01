// The Learn feed's editorial content. Real, shippable pieces — written tight, in
// the brand voice (premium but plain-spoken, light-hearted, human). Read times
// are computed from actual word count (200 wpm, rounded up), so the promise in
// the meta line is always honest.
//
// This is authored content, not placeholder. Editing or adding pieces is just
// editing this file; the Library renders whatever is here.

/** The editorial byline shown on every piece. One place to change it. */
export const BYLINE = 'The Morning Desk'

export type ArticleBlock = { type: 'p' | 'h'; text: string }

export type Article = {
  slug: string
  tag: string
  title: string
  featured?: boolean
  body: ArticleBlock[]
}

/** Honest read time: total words at ~200 wpm, rounded up, never under a minute. */
export function readMinutes(article: Article): number {
  const words = article.body.reduce((n, b) => n + b.text.split(/\s+/).length, 0)
  return Math.max(1, Math.ceil(words / 200))
}

export const ARTICLES: Article[] = [
  {
    slug: 'first-ten-minutes',
    tag: 'The science',
    title: 'The first 10 minutes: why your morning sets the next 16 hours',
    featured: true,
    body: [
      {
        type: 'p',
        text: 'Here’s a strange fact about your brain: it doesn’t wake up when you do.',
      },
      {
        type: 'p',
        text: 'For several minutes after you open your eyes, the part of you that plans, decides, and resists the snooze button is still mostly offline. Scientists call this sleep inertia. Your reaction time during it is worse than if you’d had a couple of drinks, and your working memory is running at a fraction of its daytime self.',
      },
      {
        type: 'p',
        text: 'That sounds like bad news. It’s actually the biggest opportunity in your day.',
      },
      { type: 'h', text: 'Your body is waiting for instructions' },
      {
        type: 'p',
        text: 'In those first foggy minutes, your brain is doing something specific: listening. It wants to know what kind of day this is going to be, and it takes its cues from whatever you give it first.',
      },
      {
        type: 'p',
        text: 'Light says the day has started. Movement says the body will be needed. A glass of water says supplies are on the way. Each of those signals kicks off a cascade — your core temperature rises, your cortisol pulses (the good kind — see “Cortisol has a PR problem”), and the fog burns off on schedule.',
      },
      {
        type: 'p',
        text: 'A snoozed alarm, a dark room, and twenty minutes of scrolling send a different set of signals: stay down, stay braced, stay reactive. The fog lingers. The day starts without you in it.',
      },
      { type: 'h', text: 'Small hinge, big door' },
      {
        type: 'p',
        text: 'Here’s the part that matters: those signals don’t just shape the first ten minutes. They set the slope of the next sixteen hours.',
      },
      {
        type: 'p',
        text: 'Your energy through a day isn’t a flat line you either have or don’t. It’s a curve — it climbs, peaks, dips, and recovers. And the shape of that curve is heavily decided by how it starts. A strong start means a higher peak, a later dip, and more left in the tank at 4pm. A muddy start means spending the whole day playing catch-up with caffeine and willpower.',
      },
      {
        type: 'p',
        text: 'The lever is smaller than people think. Not a 90-minute routine. Not ice baths. One deliberate action — light, movement, water — done on purpose, before the world starts asking for things.',
      },
      { type: 'h', text: 'Why one move is enough' },
      {
        type: 'p',
        text: 'Mornings have momentum. A morning that starts with one deliberate move tends to roll forward on its own — the second good choice is easier than the first, and the third is easier than that. A morning that starts reactive tends to stay reactive, for the same compounding reason.',
      },
      {
        type: 'p',
        text: 'So you don’t need a perfect morning, and you definitely don’t need a long one. You need a deliberate first move. The first ten minutes are a hinge, and hinges don’t need to be big to swing a heavy door.',
      },
      {
        type: 'p',
        text: 'That’s the entire idea behind Wake: get the hinge right, and let the door do the work.',
      },
    ],
  },
  {
    slug: 'light-beats-coffee',
    tag: 'Light',
    title: 'Morning light beats coffee — and it’s not close',
    body: [
      {
        type: 'p',
        text: 'If you could only keep one — your morning coffee or two minutes of morning light — science says keep the light. (We know. We’re sorry. The coffee can stay too.)',
      },
      {
        type: 'p',
        text: 'Inside your brain there’s a cluster of about twenty thousand neurons that acts as the master clock of your body. Every organ, every hormone, every wave of sleepiness and alertness answers to it. And it sets itself by one thing above all: light hitting the back of your eyes.',
      },
      { type: 'h', text: 'What light actually does' },
      {
        type: 'p',
        text: 'When bright light reaches your eyes in the first hour after waking, three things happen. Your brain shuts down leftover melatonin — the hormone that was keeping you sleepy. It triggers a clean pulse of cortisol — your body’s natural ignition. And it starts a roughly fourteen-hour countdown to when you’ll feel sleepy again tonight.',
      },
      {
        type: 'p',
        text: 'That last one is the quiet superpower. Morning light doesn’t just wake you up today — it’s how you fall asleep tonight. People who get bright light in the morning fall asleep faster and sleep deeper than people who don’t. The morning and the night are the same loop.',
      },
      { type: 'h', text: 'Coffee, by comparison' },
      {
        type: 'p',
        text: 'Caffeine doesn’t create energy. It blocks the signal that you’re tired — a molecule called adenosine — while the tiredness keeps piling up behind the dam. Useful? Absolutely. But it’s a loan. Light is income.',
      },
      { type: 'h', text: 'The practical part' },
      {
        type: 'p',
        text: 'You don’t need a sunny day. An overcast morning outdoors is still ten to twenty times brighter than your kitchen — your eyes just compress the difference so you never notice. A few minutes outside, or at a wide-open window, is enough. Through glass works at maybe half strength. Sunglasses mostly defeat the point.',
      },
      {
        type: 'p',
        text: 'So: light first, then coffee. Not instead of — just first. The coffee works better when the clock is set.',
      },
    ],
  },
  {
    slug: 'ninety-seconds-of-motion',
    tag: 'Movement',
    title: 'You don’t need a workout. You need ninety seconds of motion.',
    body: [
      {
        type: 'p',
        text: 'Somewhere along the way, “morning movement” got tangled up with “morning workout,” and a lot of people quietly gave up on both. Let’s untangle it.',
      },
      {
        type: 'p',
        text: 'A workout is for your fitness. Morning movement is for your wake-up. They’re different tools for different jobs, and confusing them is why your running shoes are still by the door.',
      },
      { type: 'h', text: 'What movement is actually for' },
      {
        type: 'p',
        text: 'When you move within the first half hour of waking — and we mean any movement: stretching toward the ceiling, a slow walk to the corner, ten squats while the kettle heats — your core temperature rises, blood flow picks up, and your brain gets the clearest signal it can receive that the day has started and the body is in it.',
      },
      {
        type: 'p',
        text: 'That’s the whole job. Temperature, circulation, signal. Done.',
      },
      {
        type: 'p',
        text: 'The research on this is almost funny: the wake-up benefits of morning movement show up at durations so short they embarrass the fitness industry. Ninety seconds of light movement measurably speeds up the clearing of sleep inertia. You cannot get this wrong by doing too little.',
      },
      { type: 'h', text: 'The psychology is the real trick' },
      {
        type: 'p',
        text: 'Here’s the part we care about most: a move that takes ninety seconds is a move you’ll actually do. And doing it does something sneaky — it makes you a person who has already won once today, before 8am. People who’ve already won once tend to keep going.',
      },
      {
        type: 'p',
        text: 'Some mornings, those ten squats will turn into a real workout. Great — that’s a bonus, never the assignment. The assignment is just: move, briefly, on purpose. Your body keeps the receipt either way.',
      },
    ],
  },
  {
    slug: 'cortisol-pr-problem',
    tag: 'The science',
    title: 'Cortisol has a PR problem',
    body: [
      {
        type: 'p',
        text: 'Cortisol might be the most misunderstood molecule in your body. We’ve spent two decades calling it “the stress hormone,” and now everyone wants less of it, all the time — like it’s cholesterol, or email.',
      },
      {
        type: 'p',
        text: 'Here’s the thing: for the first forty-five minutes of your morning, cortisol isn’t your enemy. It’s your engine.',
      },
      { type: 'h', text: 'The morning surge is supposed to happen' },
      {
        type: 'p',
        text: 'Within about thirty minutes of waking, your cortisol is designed to spike — roughly fifty percent above its baseline. Researchers call this the cortisol awakening response, and it’s one of the most reliable signs of a healthy, well-run body clock.',
      },
      {
        type: 'p',
        text: 'That surge is what burns off mental fog, mobilizes energy, and sharpens attention. People with a strong, punctual morning surge report better focus and better mood through the whole day. People with a flat, sluggish one report the opposite — and a chronically flattened morning surge shows up again and again in research on burnout.',
      },
      {
        type: 'p',
        text: 'Less cortisol in the evening? Yes please. Less in the morning? That’s not calm. That’s a dead battery.',
      },
      { type: 'h', text: 'How to get the good spike' },
      {
        type: 'p',
        text: 'The morning surge responds to simple inputs. Bright light within the first hour strengthens it. Waking at a consistent time strengthens it. Movement strengthens it. Hydration supports it.',
      },
      {
        type: 'p',
        text: 'And the things that blunt it are exactly what you’d guess: snoozing (your body genuinely can’t tell whether it’s supposed to be starting or not), staying in the dark, and marinating in your phone while still horizontal.',
      },
      {
        type: 'p',
        text: 'You don’t need to think about any of this in the moment. Do the simple things — light, movement, water, consistency — and the chemistry takes care of itself. That’s the deal your body has been offering all along.',
      },
    ],
  },
  {
    slug: 'phone-can-wait',
    tag: 'Digital',
    title: 'Your phone can wait twenty minutes',
    body: [
      {
        type: 'p',
        text: 'You wake up. Before your feet have touched the floor, you’ve already been to four places: a group chat, a news alert, your inbox, and somebody’s vacation photos. Your body is in bed. Your attention is scattered across three time zones.',
      },
      {
        type: 'p',
        text: 'We’re not going to tell you to put your phone in another room. (You won’t. We won’t either.) We’re going to tell you something more useful: the cost isn’t the phone. It’s the timing.',
      },
      { type: 'h', text: 'The first input wins' },
      {
        type: 'p',
        text: 'Your brain in the first minutes after waking is unusually impressionable — it’s deciding, chemically, whether this day starts proactive or reactive. Whatever you hand it first gets outsized weight.',
      },
      {
        type: 'p',
        text: 'Hand it a task you chose — making the bed, filling a glass of water, stepping outside — and the day starts with you driving. Hand it forty other people’s needs, headlines, and a slot machine of notifications, and the day starts with you responding. Researchers call the leftover scatter “attention residue”: pieces of your focus stay stuck to everything you touched, for up to half an hour after you put it down.',
      },
      {
        type: 'p',
        text: 'The same phone, the same content, twenty minutes later? Dramatically smaller cost. By then your brain has already decided what kind of day this is. You got there first.',
      },
      { type: 'h', text: 'The ask is small' },
      {
        type: 'p',
        text: 'Twenty minutes. That’s it. Not a digital detox, not a dumb phone, not a lecture. And the notifications will all still be there — that’s the one thing in life you can truly count on.',
      },
    ],
  },
  {
    slug: 'coffee-rule-myth',
    tag: 'Caffeine',
    title: 'The 90-minute coffee rule: myth, mostly',
    body: [
      {
        type: 'p',
        text: 'You’ve probably heard the rule: wait ninety minutes after waking before your first coffee, or pay for it with an afternoon crash. It’s one of the most repeated pieces of morning advice on the internet. It’s also — let’s be honest, because honesty is the brand — mostly a myth.',
      },
      { type: 'h', text: 'The theory' },
      {
        type: 'p',
        text: 'The idea goes like this: when you wake up, leftover adenosine (the sleepiness molecule) is still being cleared out. Drink coffee too early and the caffeine blocks adenosine’s parking spots before the clearing finishes — so when the caffeine wears off in the afternoon, the leftovers flood back in and you crash.',
      },
      {
        type: 'p',
        text: 'It’s a tidy story. The problem is that the evidence for it is thin. The famous recommendation came from a podcast, not a study, and the research that does exist doesn’t show much difference between immediate coffee and delayed coffee for most people.',
      },
      { type: 'h', text: 'What actually causes the crash' },
      {
        type: 'p',
        text: 'Your afternoon slump is far more likely caused by the boring suspects: not enough sleep, no morning light, a heavy lunch — and drinking coffee too late in the day. Caffeine has a six-hour half-life. The 3pm cup is still twenty-five percent in your system at 3am, quietly wrecking the sleep that causes tomorrow’s slump. The afternoon coffee, not the morning one, is the problem child.',
      },
      { type: 'h', text: 'Our honest take' },
      {
        type: 'p',
        text: 'If delaying your coffee makes your mornings feel better, keep doing it — there’s no harm in it. If your 6:45am coffee is a small, perfect joy, keep that instead. We’d rather you spend your willpower on light and movement, where the evidence is overwhelming.',
      },
      {
        type: 'p',
        text: 'One thing first, though: a glass of water before the coffee. You’ve been fasting from fluids for eight hours, and coffee on a hydrated body just lands better. That one’s not a myth.',
      },
    ],
  },
  {
    slug: 'fewer-decisions',
    tag: 'Routine',
    title: 'Top performers don’t have better discipline. They have fewer decisions.',
    body: [
      {
        type: 'p',
        text: 'When researchers and journalists dig into how elite performers — athletes, founders, surgeons — actually spend their mornings, they keep expecting to find discipline. Cold showers. 4:45 alarms. Iron will.',
      },
      {
        type: 'p',
        text: 'What they find instead is something less cinematic and far more copyable: design.',
      },
      { type: 'h', text: 'The pattern' },
      {
        type: 'p',
        text: 'The mornings of high performers are not impressive. They are repetitive. The same wake time, give or take. The same first move — and the first move is always embarrassingly simple: water, light, a short walk, or coffee made the same way in the same mug.',
      },
      {
        type: 'p',
        text: 'What’s missing from their mornings is the thing that fills most of ours: deciding. Deciding whether to get up or snooze. Deciding whether to work out. Deciding what to do first. Every one of those choices burns a little fuel — and they’re being made at the exact hour when the deciding part of the brain is at its weakest.',
      },
      { type: 'h', text: 'Decide once, repeat forever' },
      {
        type: 'p',
        text: 'The trick they’ve all converged on — knowingly or not — is moving the decisions out of the morning entirely. The decision was made once, long ago: this is what I do when I wake up. Now it isn’t a decision anymore. It’s just what happens.',
      },
      {
        type: 'p',
        text: 'That’s the actual difference. Not discipline at 6am — design at 9pm the night before. Anyone can copy it, starting tomorrow.',
      },
      {
        type: 'p',
        text: 'That’s also, not coincidentally, exactly what Wake does each evening: tomorrow morning gets decided tonight, so that when you wake up there’s nothing left to decide. We didn’t invent the trick. We just automated it.',
      },
    ],
  },
]
