# Changelog

All notable changes to MSP Tycoon are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
There are no version numbers yet: the game ships as one file, whenever it is
copied to rootlabs.us, so entries are dated instead. Balance figures quoted
here come out of `tools/sim.html` and can be reproduced by running it.

## [Unreleased]

### Fixed

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

- **A simulator, in `tools/`.** `harness.js` fetches `index.html`, extracts
  its one `<script>`, and runs it against a stub DOM on a virtual clock;
  `bot.js` plays by calling the same functions the buttons do; `sim.html` is
  the runner. It holds no copy of the economy, so it cannot fall out of date
  with the game. Every system is switchable, because the useful number is
  never one run — it is the difference between two.
- **An invariant suite, `tools/checks.js`**, run from the same page. Fifteen
  checks against the real game, most of them written for a bug that had
  already shipped: the reputation-squared click, the market farm, the
  tooltip overstatement, what an exit keeps, that a save survives a round
  trip and that junk in one does not, and that the formatters never render
  `NaN`, `Infinity` or scientific notation whatever the economy does.

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
