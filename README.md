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
- **Upgrades** are real tools of the trade — RMM, PSA, SIEM, SOC 2, AI
  triage — that either double one staff line or lift everything.
- **Holding is earned.** Queue Runner unlocks hold-to-work at one ticket
  a second; two later upgrades take it to five. Deliberately slower than
  clicking by hand, so holding is the lazy option rather than the optimal
  one.
- **Selling the company** is the prestige reset. Cash, staff and upgrades
  go; reputation is permanent and worth +2% each, forever.
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

Three constraints, each one a bug the previous build actually shipped:

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

The practical upshot of (3): staff, upgrades and pricing can be changed
freely without invalidating anyone's save.

## Status

Playable, being tuned. Balance numbers are provisional.

Known gaps:

- Content is deliberately thin — eight staff, thirteen upgrades — enough
  to prove the loop before a client roster gets built on top.
- No achievements yet.
- The brand mark in the sidebar is still a placeholder "M".
- Balance and pacing across a full run haven't been tuned end to end —
  the early game has had the most attention so far.
