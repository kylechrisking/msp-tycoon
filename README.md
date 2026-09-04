# MSP Tycoon

An idle game about running a managed service provider. Close tickets,
hire staff, buy the tools of the trade, then sell the company and do it
all again with a better reputation.

## Play it

**[rootlabs.us/games/MSPtycoon](https://rootlabs.us/games/MSPtycoon)**

Listed on /games, but that page is noindex and the entry is marked in
development, so it is reachable rather than findable. Making it findable
is a deliberate step, not a default.

## Running it

No build step, no dependencies. Open:

```
index.html
```

That is the whole game — one self-contained HTML file. `tools/` is
development scaffolding (see Simulating it) and `CHANGELOG.md` records what
has changed; neither ships with the game.

Accounts and cloud saves are optional and live entirely on the host. The
game calls `./api.php` for them and falls back to "playing signed out"
whenever that call fails, which is exactly what happens when you open
this file directly. That endpoint is not in this repo and is not needed
to run, develop, or play the game; on rootlabs.us it rides the site's
existing WordPress login.

## How it plays

One currency, one verb. Closing a ticket earns revenue; revenue buys
staff; staff close tickets while you are away.

- **Eight staff tiers**, Help Desk Tech up to a second branch office.
  Each copy costs 15% more than the last, so every tier eventually gives
  way to the next.
- **Nineteen upgrades**, real tools of the trade — RMM, PSA, SIEM, SOC 2,
  AI triage, managed XDR — that either double one staff line or lift
  everything. Every staff tier now has exactly one doubler of its own;
  the top three used to have none, so a late run had nothing left to buy
  for its most expensive hires.
- **Holding is earned.** Queue Runner unlocks hold-to-work at one ticket
  a second; two later upgrades take it to five. Deliberately slower than
  clicking by hand, so holding is the lazy option rather than the optimal
  one.
- **Selling the company** is the prestige reset. Cash, staff and upgrades
  go; reputation is permanent and worth +2% each, forever.
- **Eight reputation upgrades**, under the sell card, are the only thing
  reputation is ever spent on. Each changes the terms of the *next* run
  rather than the current one — cash and staff to start with, louder
  pagers, a 24-hour away window, a bigger exit — so selling the company
  unlocks how the game is played instead of only bumping a multiplier.
- **A client roster survives every exit.** Twelve named clients, each
  adding a flat, permanent $/s that staff and upgrades resetting can't
  touch — from a two-chair dental office up to a defence contractor that
  will ask about your CMMC level. Cash buys them and exits unlock them.
  Working the whole roster is worth about 1.6x the lifetime revenue of
  ignoring it, simulated over 55 hours.
- **Escalated tickets** surface at random every 90–210 seconds and sit
  for 13: income x7 for 77s, clicks x777 for 13s, or an invoice paid on
  the spot. The one thing in the game that rewards being at the keyboard
  at a moment you didn't choose.
- **Technical debt** accrues on its own past 25 staff, costs 3% of income
  per item up to twelve, and hands back everything it suppressed at 1.25x
  when paid off. Clearing it early protects throughput; letting it pile
  up earns more in total. Neither extreme is right.
- **A training budget** grows on a wall clock — one credit every six
  hours whether or not the tab is open — and buys permanent levels on a
  staff tier that survive prestige.
- **A contracts market**, unlocked by the vCIO, on a mean-reverting
  random walk. Positions are stored as cash invested and the price it
  went in at, never as units, so the market is as relevant at $10M/s as
  at $10/s. Selling returns the stake as cash but books only the profit
  as revenue: crediting the whole position through `earn()`, as it first
  did, meant buying and immediately selling at an unchanged price left
  cash where it started while adding 10% of the balance to lifetime
  revenue — an unbounded reputation farm for mashing two buttons.
- **Incident mode** is opt-in risk: three stages, each paying 35% more
  while piling up debt faster and turning escalated tickets hostile. A
  hostile one still pays if you catch it and halves your income for a
  minute if you don't.
- **Thirty-four achievements**, in the profile panel, from closing your
  first ticket up through ten exits and 500 reputation. Each one is checked
  against state that's already saved, so a returning player's old save
  gets retroactively credited for whatever it already qualifies for
  rather than making them earn it twice.
- **Clicking wins early on, on purpose.** A click is worth roughly ten
  seconds of a single Help Desk Tech's payroll, and the UI says so
  outright rather than leaving it to be inferred — a rate readout of
  "$0.1/s from staff" next to a "+$1" click otherwise reads as broken,
  not as an idle game finding its feet. The crossover to staff-dominant
  income happens once total payroll passes about $1.05/s.

First exit lands around 90 minutes of active play.

## Learning it

A five-step guided tour runs on a clean save, each step clearing when
the player actually does the thing rather than on a timer — close some
tickets, hire someone, watch the rate, buy an upgrade, sell the company.
It waits for the game to be ready for a step (no upgrade prompt before
one exists) and can be skipped; the skip sticks. Every store row also
carries a hover tooltip with the numbers that actually justify a
purchase — output, share of payroll, seconds to pay for itself — and on
a phone, where there's no hover, that same information is printed
directly on the row.

## Accounts

The profile button reuses the same icon the rest of rootlabs.us uses for
its site menu, and the panel behind it holds the account controls and the
achievement list.

There is no account system in this game and there must never be one. On
rootlabs.us the endpoint asks WordPress who the visitor is; no password
is ever read, written or seen. localStorage stays the source of truth and
the cloud copy is pushed and pulled by hand, never on a timer -- partly
so a lapsed session cannot quietly clobber a good local save, and partly
because bootstrapping WordPress on every autosave would flatten a small
server.

## Design rules

Five constraints, each one a bug that actually shipped:

1. **One interval owns the simulation.** The old build ran two, and the
   second corrupted the score every tick — it read `this.totalPassiveProd`
   from a top-level arrow function where `this` is `window`, so the value
   was `undefined` and the counter became `NaN`.
2. **State is never read back out of the DOM.** That same timer parsed the
   score out of display text and wrote it back, fighting the real loop
   over the same element.
3. **Config is never saved.** `STAFF`, `UPGRADES`, `CLIENTS` and every
   list added since are static. The save holds only counts, flags and
   totals, merged field by field with unknown ids dropped. The old save
   embedded balance numbers, which pinned the economy to whatever it was
   when the file was written.
4. **A spendable currency needs two numbers.** Reputation earned and
   reputation held are separate fields. Sharing one made spending free:
   `pendingRep()` paid out `floor(sqrt(lifetime / 1e6)) - reputation`, so
   signing a client lowered the subtrahend and the next exit returned the
   same points at no extra revenue. Payouts settle against what has been
   claimed; only the held balance moves when you spend.
5. **A multiplier is applied exactly once.** `clickValue()` multiplied its
   whole result by `repMult()`, but its income share is `totalRate()`,
   which `rateOf()` has already multiplied by `repMult()`. A click was
   therefore worth reputation *squared* — at 30,000 reputation, one click
   paid for four minutes of the entire company. Since reputation is drawn
   from the square root of lifetime revenue, and lifetime revenue was
   growing as reputation squared, the loop fed itself: the economy was
   exponential rather than polynomial, and that, not a missing cap, was
   the runaway. Reputation now multiplies the flat part only.

The practical upshot of (3): staff, upgrades and pricing can be changed
freely without invalidating anyone's save. Saves from before (4) carry no
`repEarned` and don't need one — signing a client is the only thing that
has ever spent reputation, so the career total is rebuilt on load as the
held balance plus the price of every client already signed, read out of
static config. A save that milked the old refund can end up owed less
than nothing; the payout floors at zero, so it earns none until lifetime
revenue catches up rather than having anything clawed back.

## Simulating it

`tools/sim.html`, served over http from the repo root, plays the game
with a bot and prints the tables the balance claims above come out of.
It has no copy of the economy: `tools/harness.js` fetches `index.html`,
pulls out its one `<script>`, and runs it against a stub DOM on a virtual
clock, so every number comes from the same `rateOf()`, `costOf()` and
`pendingRep()` the page ships. `tools/bot.js` then presses the same
functions the buttons do. A balance change that is not reflected in the
simulator is impossible, because there is nothing there to fall out of
sync with.

```
py -m http.server 8765          # from the repo root
                                # then open /tools/sim.html
```

Every system is switchable, which is the point — the interesting number
is never one run, it is the difference between two. The bot is not a
model of a person: it is at the keyboard for every second and it never
misses. Read it as the ceiling a system allows.

## Status

Playable, and now measured rather than guessed. A bot plays full runs
against the real game functions, and every number quoted here comes out
of it.

Where a perfect bot (five clicks a second, catches everything, exits on a
tight trigger) gets to, by hour, with all systems engaged:

| hour | lifetime | milestone |
|-----:|---------:|-----------|
| 0.16 | $1M      | first exit |
| 2.4  | $1B-ish  | AI Triage |
| 4.0  | —        | every client signed |
| 6.0  | $10T     | every upgrade bought, 33 of 34 achievements |
| 55   | $728Qi   | 115 exits, still a legible number |

A casual profile — one click a second, catching about a third of
escalations, patient about exits, market and incident mode left alone —
takes 38 minutes to the first exit, 19 hours to the last upgrade and the
full client roster, and finishes a day with 30 of 34 achievements. The
core loop on its own, with debt, training, market and incident all
ignored, is $2.9B and 10 of 19 upgrades in that same day, which is the
gap those systems are there to fill.

What the four newer systems are actually worth, measured against the same
seed at six hours with the core loop as 1.0x:

| system | lifetime |
|--------|---------:|
| debt, held to the cap then paid | 3.3x |
| debt, remediated on sight       | 3.0x |
| incident mode at stage 3        | 8.7x |
| the contracts market            | 1.0x |
| all of them together            | 16,800x |

Three things that reads out:

- **Debt is a genuinely close call**, which is what it was designed to
  be. Holding to the cap beats paying on sight by 11% — the bank returns
  1.25x what the drag took, but the income you did not have while it sat
  there is income you did not compound. Never paying it down at all is
  1.0x, so the mechanic is not free money in either direction.
- **Incident mode is the strongest system in the game** and stronger than
  its own description: +35% a stage reads as a third, but three stages
  compounding through a prestige loop is nearly 9x over six hours.
  Whether that is too strong for something this cheap to switch on is the
  open balance question.
- **The market is worth nothing to a bot that prestiges hard**, because
  `marketGate()` wants five vCIOs and an exit wipes them. It is a
  mechanic for players who sit on a run, not for players who cycle it.

Known gaps:

- **Fully Certified is not realistically reachable.** Training levels
  cost 1, 2, 3… credits, so a single tier at level 10 is 55 credits, and
  credits accrue one per six hours — 330 hours of wall clock, spending
  nothing on any other tier. It is the only achievement the bot never
  unlocks, and it is gated on the calendar rather than on play.
- **The bot plays one shape of game.** It clicks at a fixed rate and buys
  on payback, so it says what the systems allow, not what they feel like.
  Hold-to-work, in particular, is invisible to it.
- The upgrade tail is now measured rather than eyeballed, but it is
  measured against a bot: Tuck-In Acquisition at $60B lands at hour 6 for
  a bot and hour 19 for a casual profile, and whether hour 19 is a good
  place for the last thing in the game to arrive is a judgement call, not
  a number.
