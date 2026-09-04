# Publishing MSP Tycoon

What it costs to put this in front of people, and what it could plausibly
earn. Written to be argued with rather than followed.

Build the upload with:

```
powershell -ExecutionPolicy Bypass -File tools/package.ps1
```

That produces `dist/msp-tycoon-web.zip` — currently **55 KB**, containing
`index.html` and `sw.js` and nothing else. `api.php` is deliberately left
out: it belongs to rootlabs.us, and every copy elsewhere should be in the
"playing signed out" state the game already handles.

## Steam is not the free option

Steam Direct charges **$100 per title**, recoupable against your first
$1,000 of revenue. That is the whole barrier, and it is per-game rather
than per-account, so it does not get cheaper if this goes well.

It would also need real work beyond the fee: a desktop wrapper (Electron,
Tauri or NW.js), a store page with capsule art in five sizes, and Steam
achievements wired to `S.ach` for it not to look lazy next to the free
browser version. Steam users expect a launcher, not a page.

Worth revisiting **only** if the browser version finds an audience first.
The $100 is a bet on distribution you have not tested yet.

## The free routes, in the order I would do them

### 1. Your own site, with the ad slot you already have

`ads.txt` at the root of rootlabs.us already declares
`pub-6294851689361160`, so the AdSense relationship exists. The game is on
`/games/MSPtycoon/` and `/games/` is a storefront page you control.

This is the only channel where **you keep everything** — no platform cut,
no revenue share, no approval process. It is also the only one where the
traffic problem is entirely yours to solve.

The honest constraint: an idle game is a long-session, low-pageview
format. One ad impression per visit, on a page someone leaves open for an
hour, is close to the worst possible shape for display advertising. Do not
put an ad unit inside the game itself — it will earn very little and it
will cost the thing its feel.

If you do this, put it on `/games/` (the storefront, which people bounce
through) rather than in the game.

### 2. itch.io — the page already exists

`rootlabsus.itch.io/msp-tycoon`. Free to upload, no approval, no cut
unless you choose one — itch lets *you* set their share, default 10%, and
zero is allowed.

Upload `dist/msp-tycoon-web.zip` as an HTML project, tick "This file will
be played in the browser", set the viewport to 1280×720 and tick "Mobile
friendly" (the layout has a real phone mode).

Money: set it to **pay-what-you-want with a $0 minimum**. A paid idle
browser game sells almost nothing; a free one with a suggested price and a
good page earns tips from a small fraction of players and costs you
nothing in reach. Payouts go through your own Stripe or PayPal, which you
would need to connect — I have not touched that and cannot.

Expect this to be small. itch is where the game becomes *findable*, not
where it becomes profitable.

### 3. The ad-revenue-share portals — the actual money, if any

**CrazyGames**, **Poki**, and **GameDistribution** pay a share of ad
revenue on games they host, and they have the traffic that neither of the
above do. This is where a browser idle game realistically earns something
rather than nothing.

The tradeoffs are real:

- They require an application and review. Poki is the most selective;
  CrazyGames is the most approachable for a first title.
- They require their SDK, which means ad breaks at points you choose.
  For an idle game the natural spot is a rewarded ad — "double income
  for four minutes" — which sits *very* comfortably next to the
  escalated-ticket mechanic that already exists.
- Some ask for a period of exclusivity on the web build. Read that
  clause before uploading anywhere else you care about.

I would apply to CrazyGames once the game has had a week of play on
rootlabs.us and you are confident the balance is right. A rewarded-ad
buff is the single change most likely to turn this into actual revenue,
and it is a small change: it is the same shape as `claimEscalation()`.

### 4. Newgrounds

Free, no approval, and it has an ad revenue share for hosted games. The
audience skews away from idle management sims and the money is small, but
it costs one upload and it is another place the game exists.

## What I would not do

- **A paid mobile app.** Google Play is a one-off $25, Apple is $99/year,
  and both need a wrapper, store listings and review. The game is not
  worth that yet and the browser version competes with itself.
- **In-app purchases or an energy meter.** It would earn more and it would
  make it a different, worse game. The whole design so far has been about
  a loop that respects the player's time.
- **Ads inside the game itself**, other than an opt-in rewarded buff. See
  above.

## Realistic expectations

An unlisted browser idle game with no marketing earns approximately
nothing. That is not pessimism about this one — it is the base rate for
the format. The order above is deliberately: keep everything on your own
site, be findable on itch, and only then trade a share for traffic on a
portal, once there is something worth putting in front of that traffic.

The thing most likely to change the outcome is not the platform. It is
that the game is *good and finishable*, that the first ten minutes are
clear, and that someone who plays for an hour has a reason to come back
tomorrow — which the training budget and the morale system are both
already doing.
