# Changelog

All notable changes to MSP Tycoon are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
There are no version numbers yet: the game ships as one file, whenever it is
copied to rootlabs.us, so entries are dated instead. Balance figures quoted
here come out of `tools/sim.html` and can be reproduced by running it.

## [Unreleased]

### Fixed
- **The store quoted the wrong output for half the roster.** Both the hover
  tooltip and the phone row computed a tier's per-copy rate as
  `d.rate * repMult()`, which ignores the upgrade that doubles that line and
  any training levels on it. A Help Desk Tech with Knowledge Base bought was
  advertised at half what it earns, and "pays for itself in" — the number
  the tooltip exists to provide, and the one that actually decides a
  purchase — was overstated by the same factor on every tier with a doubler.
  Both now measure the real marginal hire.
- **"Share of payroll" was divided by the wrong number.** The numerator is a
  `rateOf()`, which carries upgrades, training and reputation; the
  denominator was `totalRate()`, which also carries escalation buffs,
  technical debt and incident mode. During a x7 All Hands every share in the
  game read as a seventh of itself and the tiers stopped summing to
  anything. Both the tooltip and the company sheet now divide by
  `baseRate()`.
- **The reputation bonus was hardcoded at 2%.** The sell card and the staff
  tooltip both printed `S.reputation * 2`, so The Rolodex — whose entire
  effect is making a point worth 3% instead of 2% — changed the income and
  not the number describing it.
- **Space could not activate any button.** The hold-to-work handler called
  `preventDefault()` on every Space keypress outside a text field, so a
  keyboard player tabbing to "Skip the tour", a store row or a tab pressed
  space and closed a ticket instead. The ticket, which is driven by pointer
  events and has no click of its own, stays exempt.
- **Double-tapping a store row dropped every second purchase on a phone.**
  The double-tap-to-zoom backstop called `preventDefault()` on any second
  `touchend` within 350ms, document-wide — and preventing the default on
  touchend also cancels the click the browser would have synthesised.
  Hiring twice in quick succession is ordinary; the second hire simply did
  not happen. The suppressor now leaves controls alone and still covers the
  ticket, where the gesture actually is.
- A locked staff tooltip read `STAFF[i-1].name` with no guard. Unreachable
  today, since the first tier is never locked, but it would have thrown
  rather than degraded.
- **A corrupt or edited save could poison the economy for good.** Options
  has a paste-a-save box, so the loader is reachable with anything that
  parses as JSON, and two classes of field went through it unchecked. Staff
  counts and training levels are the only saved maps whose values are
  numbers rather than flags, and they were taken at face value:
  `staff.helpdesk = "many"` made `rateOf()` return `NaN` and spread it
  through cash, income and every achievement threshold within one tick,
  unrecoverably, while `levels.helpdesk = 999` bought a 100x multiplier on
  a tier the store will only ever sell ten levels of. Both are now rebuilt
  from static config as whole numbers in range.
- **A negative number in a save made the game pay out negative money.**
  Every scalar was guarded with `+d.x || 0`, which catches `NaN` but passes
  a negative straight through. `reputation: -1e9` made `repMult()` negative,
  which made every staff rate negative, which drained the balance on the
  next tick. Balances and counts are now floored at zero, and counts
  rounded.
- **The economy no longer runs away.** `clickValue()` multiplied its whole
  result by `repMult()`, but the `totalRate() * 0.05` share it adds already
  carried `repMult()` from `rateOf()` — so a click was worth reputation
  *squared*. Since reputation is drawn from the square root of lifetime
  revenue, and lifetime revenue was growing as reputation squared, the loop
  fed itself: a bot playing perfectly reached `1.57e114` lifetime revenue by
  hour 8, with `fmt()` degrading to `1.5691646194236409e+81Dc`. Reputation
  now multiplies the flat part of a click only. The same run finishes 55
  hours on `$728Qi`, inside the units table, decelerating.
- **Closed an unbounded reputation farm in the contracts market.**
  `mktSell()` paid the entire position through `earn()`, which credits
  lifetime revenue, while `mktBuy()` never debited it. Buying and
  immediately selling at an unchanged price returned cash to exactly where
  it started while adding 10% of the balance to lifetime revenue, with no
  cooldown on either button — free reputation, and free progress on every
  lifetime-revenue achievement, for mashing two buttons. A sale now returns
  the stake as cash and books only the profit as revenue.
- **The guided tour was unreadable on a phone.** `placeCoach()` docked the
  panel's top to the stats strip, which on a 375-wide phone leaves a 56px
  slot for a step that needs 222 — every step rendered as its heading and
  nothing else, with the body text, the progress count and the skip link
  below a fold nobody would think to scroll. The panel now docks its bottom
  above the store and grows upward, and its footer is pinned so the skip
  button can never be the part that falls off.
- **The tour panel was styled as a desktop and positioned as a phone**
  between 821px and 900px wide. The stylesheet switched the panel at 820px
  while `mobileQuery` said 900px, so in that band it was docked against a
  bottom sheet using desktop styling and no overflow rule — a 56px box with
  its text spilling straight over the store. Both numbers are now 900, which
  is where the layout itself changes.
- **The tour panel could stretch after a resize.** The phone branch wrote
  `bottom` and `max-height` inline and the desktop branch never cleared
  them, so a window dragged from phone width up to desktop left a fixed
  panel with both a top and a bottom, stretching it between the two.
- **The store overstated two kinds of upgrade.** The tooltip multiplied the
  number on screen by the upgrade's `mult`. A click upgrade scales only the
  flat part of a click, not the share that comes from staff income, so "x2"
  on a $6.00 click was never $12.00 once there was a payroll; a global
  upgrade scales staff output but not the flat client contracts that
  `totalRate()` also carries. Both now ask the game what the purchase
  produces instead of guessing, on the one screen whose job is telling the
  truth about a price.

### Added

- **A fuzzer, `tools/fuzz.js`**, that plays badly on purpose. The bot plays
  well, which is the wrong instrument for finding bugs -- a sensible player
  never does the thing that breaks a game. This fires every legal action in
  any order, including the ones nobody would choose, and asserts after each
  one that the economy is still finite, non-negative and self-consistent. A
  second mode renders every panel after each action and reads back what the
  UI tried to write, which is how the store tooltip was caught throwing.
  750,000 random actions currently pass clean.
- **A simulator, in `tools/`.** `harness.js` fetches `index.html`, extracts
  its one `<script>`, and runs it against a stub DOM on a virtual clock;
  `bot.js` plays by calling the same functions the buttons do; `sim.html` is
  the runner. It holds no copy of the economy, so it cannot fall out of date
  with the game. Every system is switchable, because the useful number is
  never one run — it is the difference between two.
- **An invariant suite, `tools/checks.js`**, run from the same page. Nineteen
  checks against the real game, most of them written for a bug that had
  already shipped: the reputation-squared click, the market farm, the
  tooltip overstatement, what an exit keeps, that a save survives a round
  trip and that junk in one does not, and that the formatters never render
  `NaN`, `Infinity` or scientific notation whatever the economy does. Each one
  is verified by mutation: reintroducing the bug it covers in a copy of the
  source makes exactly that check fail, and no other.

### Changed

- The four newer systems have been measured against each other for the first
  time. At six hours on one seed, with the core loop as 1.0x: debt held to
  the cap then paid, 3.3x; debt remediated on sight, 3.0x; incident mode at
  stage 3, 8.7x; the contracts market, 1.0x; all of them together, 16,800x.
  The market is worth nothing to a bot that prestiges hard, because
  `marketGate()` wants five vCIOs and an exit wipes them — it is a mechanic
  for players who sit on a run.
- README rewritten around measurements rather than estimates, including
  where a perfect bot and a casual profile actually reach each milestone.

### Known

- **Fully Certified is not realistically reachable.** Training levels cost
  1, 2, 3… credits, so one tier at level 10 is 55 credits, and credits accrue
  one per six hours — 330 hours of wall clock, spending nothing on any other
  tier. It is the only achievement the bot never unlocks, and it is gated on
  the calendar rather than on play.
- **Incident mode may be too strong for how cheap it is to switch on.** 8.7x
  for a button press is the largest single lever in the game.
