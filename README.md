# MSP Tycoon

An idle game about running a managed service provider. Close tickets,
hire staff, buy the tools of the trade, then sell the company and do it
all again with a better reputation.

## Play it

**[rootlabs.us/games/MSPtycoon](https://rootlabs.us/games/MSPtycoon)**

Unlisted while it's still being tuned — reachable by direct link, not
linked from the site yet.

## Running it

No build step, no dependencies. Open:

```
index.html
```

That is the whole game — one self-contained HTML file.

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
- **A client roster survives every exit.** Twelve named clients, signed
  once with reputation, each adding a flat, permanent $/s that staff and
  upgrades resetting can't touch — from a two-chair dental office up to a
  defence contractor that will ask about your CMMC level. Reputation
  spent signing one is spent for good: it stops counting toward the
  passive +2%-per-point bonus and no exit pays it back, so the roster is
  a real tradeoff rather than a second currency.
- **Twenty-five achievements**, on their own tab, from closing your first
  ticket up through ten exits and 500 reputation. Each one is checked
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

## Design rules

Four constraints, each one a bug that actually shipped:

1. **One interval owns the simulation.** The old build ran two, and the
   second corrupted the score every tick — it read `this.totalPassiveProd`
   from a top-level arrow function where `this` is `window`, so the value
   was `undefined` and the counter became `NaN`.
2. **State is never read back out of the DOM.** That same timer parsed the
   score out of display text and wrote it back, fighting the real loop
   over the same element.
3. **Config is never saved.** `STAFF` and `UPGRADES` are static. The save
   holds only counts, flags and totals, merged field by field with unknown
   ids dropped. The old save embedded balance numbers, which pinned the
   economy to whatever it was when the file was written.

4. **A spendable currency needs two numbers.** Reputation earned and
   reputation held are separate fields. Sharing one made spending free:
   `pendingRep()` paid out `floor(sqrt(lifetime / 1e6)) - reputation`, so
   signing a client lowered the subtrahend and the next exit returned the
   same points at no extra revenue. Payouts settle against what has been
   claimed; only the held balance moves when you spend.

The practical upshot of (3): staff, upgrades and pricing can be changed
freely without invalidating anyone's save. Saves from before (4) carry no
`repEarned` and don't need one — signing a client is the only thing that
has ever spent reputation, so the career total is rebuilt on load as the
held balance plus the price of every client already signed, read out of
static config. A save that milked the old refund can end up owed less
than nothing; the payout floors at zero, so it earns none until lifetime
revenue catches up rather than having anything clawed back.

## Status

Playable, being tuned. Balance numbers are provisional.

Known gaps:

- **Client prices were set when spending was free, and now it isn't.**
  Under the refund bug every client was pure upside, so the roster was
  priced as a sequence of unlocks rather than as a real cost. Now that
  reputation spent is gone, the top of the roster looks like a bad buy: a
  flat rate can't keep up with a multiplier the way the prices assume.
  Meridian Aerospace wants 4,000 reputation for +$160K/s, but holding
  those 4,000 points instead is +8,000% on everything you own — worth far
  more than $160K/s by the time you can afford either. The early roster
  is fine, where a few points of bonus are worth nothing and a flat $5/s
  is transformative. Somewhere in the middle it inverts. Finding where
  needs the full-loop simulation run again, not a guess at new numbers.
- Selling the company unlocks nothing. `S.exits` gates two achievements
  and nothing else, so exit #2 is the same run as exit #1 with a better
  multiplier. The prestige loop has no new content to pull a player
  through it.
- The brand mark in the sidebar is still a placeholder "M".
- Balance and pacing across a full run haven't been tuned end to end —
  the early game has had the most attention so far. The original client
  roster's costs were sanity-checked against a full-loop simulation
  (real click/buy/exit behavior, run against the actual game functions)
  rather than guessed, but "reachable" isn't the same as "tuned." The
  content added since — upgrades past AI Triage, the four clients past
  Continental Freight, and the achievements above $1B lifetime — extends
  the existing curves by shape and has *not* had that simulation run
  against it. The tail is unverified.
