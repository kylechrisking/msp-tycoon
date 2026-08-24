# MSP Tycoon

An idle game about running a managed service provider. Close tickets,
hire staff, buy the tools of the trade, then sell the company and do it
all again with a better reputation.

Formerly *IT Empire Idle*.

## Running it

No build step, no dependencies. Open:

```
index.html
```

That is the whole game — one self-contained HTML file.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | **MSP Tycoon.** The current game. |
| `legacy/` | The previous build, kept for reference. |

They are independent and use separate save keys, so running one will not
disturb the other's progress.

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

First exit lands around 90 minutes of active play.

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
- Untested on mobile.

## A note on the old issue list

Earlier versions of this file carried a long "Known Issues" list
describing the previous build as fundamentally broken — tasks not
starting, upgrades doing nothing, saves not persisting. That list was
written mid-development and never updated, and an audit of every call
site found it substantially inaccurate. It has been removed rather than
left to mislead. The bugs that were real are described under Design
rules above.
