/* Invariants, checked against the real game.
 *
 * Not unit tests of a model -- these run the same functions index.html
 * ships, loaded through the same harness the bot uses. Most of them
 * exist because the thing they check was broken at some point, and the
 * only reason anyone found out was a bot run that ended in scientific
 * notation.
 *
 * Every check gets a fresh game, so nothing here can be passing because
 * of what ran before it.
 */

const fmtNum = n =>
  Number.isFinite(n) ? (Math.abs(n) >= 1e6 ? n.toExponential(3) : String(+n.toFixed(6))) : String(n);

function near(a, b, tol = 1e-9) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

/* Each check is { name, why, run(g) }. run() throws to fail, and the
 * message it throws is what gets reported. */
export const CHECKS = [
  {
    name: "a fresh click is worth exactly $1.00",
    why: "The opening number a new player sees. Any stray multiplier lands here first.",
    run(g) {
      const v = g.clickValue();
      if (v !== 1) throw new Error(`clickValue() on a clean save is ${fmtNum(v)}, want 1`);
    }
  },
  {
    name: "a click is ten seconds of one tech's payroll",
    why: "The README's opening balance claim, and the reason clicking wins early.",
    run(g) {
      g.S.staff.helpdesk = 1; g.S.staffTotal = 1;
      const ratio = g.clickValue() / (g.totalRate() * 10);
      if (!near(ratio, 1, 1e-6)) throw new Error(`click is ${fmtNum(ratio)}x ten seconds of payroll, want 1`);
    }
  },
  {
    name: "payroll overtakes clicking just past $1.05/s",
    why: "The documented crossover. If it moves, the early game's shape moved with it.",
    run(g) {
      g.S.staff.helpdesk = 10; g.S.staffTotal = 10;
      if (g.totalRate() > g.clickValue()) throw new Error("staff already out-earn a click at 10 techs");
      g.S.staff.helpdesk = 11; g.S.staffTotal = 11;
      if (g.totalRate() <= g.clickValue()) throw new Error("staff still do not out-earn a click at 11 techs");
    }
  },
  {
    name: "reputation scales clicks and income by the same factor",
    why:
      "The runaway. clickValue() multiplied by repMult() while its income share " +
      "already carried it, making a click worth reputation squared -- and reputation " +
      "is drawn from the square root of lifetime revenue, so the loop fed itself.",
    run(g) {
      g.S.staff.helpdesk = 100; g.S.staffTotal = 100;
      const rate0 = g.totalRate(), click0 = g.clickValue();
      g.S.reputation = 100;
      const rateX = g.totalRate() / rate0, clickX = g.clickValue() / click0;
      if (!near(rateX, clickX, 1e-3)) {
        throw new Error(`100 reputation scales income ${fmtNum(rateX)}x but clicks ${fmtNum(clickX)}x`);
      }
    }
  },
  {
    name: "a market round trip at a flat price mints nothing",
    why:
      "mktSell() paid the whole position through earn(), which credits lifetime " +
      "revenue, while mktBuy() never debited it. Buy then sell, unchanged price: " +
      "cash back where it started, lifetime up 10% of the balance, no cooldown. " +
      "pendingRep() reads lifetime, so that was an unbounded reputation farm.",
    run(g) {
      g.S.staff.vcio = 5; g.S.staffTotal = 5;
      g.S.cash = 1e6; g.S.lifetime = 1e6;
      const m = g.MARKET[0];
      for (let i = 0; i < 25; i++) { g.mktBuy(m); g.mktSell(m); }
      if (g.S.lifetime > 1e6 + 1) {
        throw new Error(`25 round trips added ${fmtNum(g.S.lifetime - 1e6)} to lifetime revenue`);
      }
      if (g.S.cash > 1e6 + 1) throw new Error(`25 round trips added ${fmtNum(g.S.cash - 1e6)} cash`);
    }
  },
  {
    name: "a market sale books profit, not the stake",
    why: "The other half of the same fix: a real gain still has to count as revenue.",
    run(g) {
      g.S.staff.vcio = 5; g.S.staffTotal = 5;
      g.S.cash = 1000; g.S.lifetime = 1000;
      const m = g.MARKET[0];
      g.mktBuy(m);                       // 10% of cash, entry at the current price
      const stake = g.mktInv(m.id);
      g.S.mkt.price[m.id] = g.mktEntry(m.id) * 2;   // price doubles
      g.mktSell(m);
      const gained = g.S.lifetime - 1000;
      if (!near(gained, stake, 1e-6)) {
        throw new Error(`doubling a ${fmtNum(stake)} position booked ${fmtNum(gained)} revenue, want ${fmtNum(stake)}`);
      }
    }
  },
  {
    name: "the store prices an upgrade the way the purchase will",
    why:
      "The tooltip multiplied the number on screen by the upgrade's mult. A click " +
      "upgrade only scales the flat part of a click, and a global upgrade does not " +
      "touch flat client contracts, so both promised more than buying delivered.",
    run(g) {
      g.S.staff.helpdesk = 60; g.S.staffTotal = 60;
      g.S.clients.dental = true;             // a flat contract, immune to global upgrades
      g.S.cash = 1e9;
      for (const u of g.UPGRADES) {
        if (u.kind !== "click" && u.kind !== "global") continue;
        const before = u.kind === "click" ? g.clickValue() : g.totalRate();
        const promised = before * u.mult;
        g.buyUpgrade(u);
        const actual = u.kind === "click" ? g.clickValue() : g.totalRate();
        if (actual > promised + 1e-6) {
          throw new Error(`${u.name}: buying gave ${fmtNum(actual)}, naive mult said ${fmtNum(promised)}`);
        }
        // The naive figure is what the tooltip used to show. Assert it is
        // genuinely different, so this check cannot pass on a game where
        // the distinction has quietly stopped existing.
        if (near(actual, promised, 1e-6)) continue;
        return;
      }
      throw new Error("no click or global upgrade was purchasable to compare");
    }
  },
  {
    name: "the tooltip prints the value the purchase produces",
    why:
      "The check above proves the maths; this proves the store is using it. " +
      "The rendered '$6.00 -> $12.00 per click' has to be the number the " +
      "player will actually see after buying, not before * mult.",
    run(g) {
      g.S.staff.helpdesk = 60; g.S.staffTotal = 60;
      g.S.clients.dental = true;
      let checked = 0;
      for (const u of g.UPGRADES) {
        if (u.kind !== "click" && u.kind !== "global") continue;
        if (g.S.upgrades[u.id]) continue;
        const truth = u.kind === "click"
          ? g.money(g.withUpgrade(u, g.clickValue))
          : "$" + g.rateStr(g.withUpgrade(u, g.totalRate));
        const html = g.upgradeTip(u);
        if (!html.includes(truth)) {
          throw new Error(`${u.name}: tooltip does not contain the real post-purchase value ${truth}`);
        }
        checked++;
      }
      if (!checked) throw new Error("no click or global upgrade was available to render");
    }
  },
  {
    name: "the store quotes what a hire really earns",
    why:
      "Both the tooltip and the phone row computed a tier's per-copy output " +
      "as `d.rate * repMult()`, which ignores the upgrade that doubles that " +
      "line and any training levels on it. A tier with its doubler bought was " +
      "advertised at half what it earns, and 'pays for itself in' -- the " +
      "number the tooltip exists to provide -- was overstated to match.",
    run(g) {
      g.S.staff.helpdesk = 6; g.S.staffTotal = 6;
      g.S.upgrades.kb = true;          // Knowledge Base: Help Desk output x2
      g.S.levels.helpdesk = 4;         // +40%
      g.S.reputation = 25;
      g.S.cash = 1e6;
      const d = g.STAFF[0];
      // The truth: what the roster gains from one more of them.
      const before = g.totalRate();
      g.buyStaff(d);
      const truth = g.totalRate() - before;
      if (!(truth > 0)) throw new Error("the check failed to hire anyone");
      const quoted = "$" + g.rateStr(truth);
      const tip = g.staffTip(d, 0, true);
      if (!tip.includes(quoted + "/s")) {
        throw new Error(`tooltip does not quote the real per-hire rate ${quoted}/s`);
      }
      const payback = Math.ceil(g.costOf(d) / truth);
      if (!tip.includes(payback + "s")) {
        throw new Error(`tooltip does not quote the real payback of ${payback}s`);
      }
    }
  },
  {
    name: "payroll shares still add up during an escalation",
    why:
      "'Share of payroll' divided a rateOf() -- which carries upgrades, " +
      "training and reputation -- by totalRate(), which also carries " +
      "escalation buffs, debt and incident mode. During a x7 All Hands, " +
      "every share in the game read as a seventh of itself.",
    run(g) {
      g.S.cash = 1e9;
      g.S.staff.helpdesk = 20; g.S.staff.sysadmin = 5; g.S.staffTotal = 25;
      const sum = () => g.STAFF.reduce((s, d) => s + (g.c(d.id) ? g.pctOfIncome(g.rateOf(d)) : 0), 0);
      const quiet = sum();
      if (Math.abs(quiet - 100) > 2) throw new Error(`shares sum to ${quiet}% with nothing running`);
      // Now put a x7 on the board and an incident behind it.
      g.claimEscalation(g.ESCALATIONS.find(e => e.id === "allhands"));
      g.S.upgrades.siem = true;
      g.escalateIncident();
      if (g.buffMult("rateMult") === 1) throw new Error("the buff did not take");
      const loud = sum();
      if (Math.abs(loud - 100) > 2) {
        throw new Error(`shares sum to ${loud}% during a x${g.buffMult("rateMult")} buff`);
      }
    }
  },
  {
    name: "the reputation bonus is never hardcoded at 2%",
    why:
      "The sell card and the staff tooltip both printed `S.reputation * 2`, " +
      "so buying The Rolodex -- whose entire effect is making a point worth " +
      "3% instead of 2% -- changed the income and not the number claiming to " +
      "describe it.",
    run(g) {
      g.S.reputation = 50;
      g.S.staff.helpdesk = 3; g.S.staffTotal = 3;
      g.S.repUp.rolodex = true;
      const realPct = Math.round((g.repMult() - 1) * 1000) / 10;   // 150%
      if (Math.abs(realPct - 150) > 0.01) throw new Error(`Rolodex maths changed: ${realPct}%`);
      const tip = g.staffTip(g.STAFF[0], 0, true);
      if (tip.includes("+100%")) throw new Error("staff tooltip still quotes the 2% rate with Rolodex owned");
      if (!tip.includes("+" + realPct + "%")) throw new Error(`staff tooltip does not quote +${realPct}%`);
    }
  },
  {
    name: "an exit clears the run and keeps what is permanent",
    why: "Prestige is the one operation that deletes things. What it keeps is the game.",
    run(g) {
      g.S.lifetime = 1e9;
      g.S.cash = 5e5; g.S.staff.helpdesk = 40; g.S.staffTotal = 40;
      g.S.upgrades.macros = true;
      g.S.clients.dental = true;
      g.S.levels.helpdesk = 3;
      g.S.repUp.headstart = true;
      const before = g.pendingRep();
      if (before <= 0) throw new Error("nothing to prestige with at $1B lifetime");
      g.prestige();
      if (g.S.cash !== 10000) throw new Error(`Head Start should leave $10,000, left ${fmtNum(g.S.cash)}`);
      if (g.S.upgrades.macros) throw new Error("upgrades survived an exit");
      if (!g.S.clients.dental) throw new Error("a signed client did not survive an exit");
      if (g.S.levels.helpdesk !== 3) throw new Error("training levels did not survive an exit");
      if (!g.S.repUp.headstart) throw new Error("a reputation upgrade did not survive an exit");
      if (g.S.lifetime !== 1e9) throw new Error("lifetime revenue was reset by an exit");
      if (g.pendingRep() !== 0) throw new Error(`exit paid out but still offers ${g.pendingRep()}`);
    }
  },
  {
    name: "reputation cannot be earned twice for the same revenue",
    why:
      "Payouts settle against reputation ever claimed, not the balance still held. " +
      "Sharing one number made spending it free.",
    run(g) {
      g.S.lifetime = 1e10;
      g.prestige();
      const earned = g.S.repEarned;
      g.S.reputation = 0;                 // spend the lot
      if (g.pendingRep() !== 0) throw new Error("spending reputation made an exit pay out again");
      g.prestige();
      if (g.S.repEarned !== earned) throw new Error("a second exit paid for revenue already claimed");
    }
  },
  {
    name: "a save survives a round trip, and junk in it does not",
    why: "Design rule 3: config is never saved, and unknown ids are dropped on load.",
    run(g) {
      g.S.cash = 1234.5; g.S.lifetime = 9e6; g.S.clicks = 77;
      g.S.staff.helpdesk = 9; g.S.staffTotal = 9;
      g.S.upgrades.macros = true;
      g.S.staff.nonesuch = 5;             // an id that no longer exists
      g.S.upgrades.nonesuch = true;
      g.save();
      g.load();
      if (!near(g.S.cash, 1234.5)) throw new Error(`cash came back as ${fmtNum(g.S.cash)}`);
      if (g.S.clicks !== 77) throw new Error(`clicks came back as ${g.S.clicks}`);
      if (g.c("helpdesk") !== 9) throw new Error(`staff came back as ${g.c("helpdesk")}`);
      if (!g.S.upgrades.macros) throw new Error("a real upgrade was dropped on load");
      if (g.S.staff.nonesuch) throw new Error("an unknown staff id survived a load");
      if (g.S.upgrades.nonesuch) throw new Error("an unknown upgrade id survived a load");
    }
  },
  {
    name: "a hostile save cannot poison the economy",
    why:
      "Options offers a paste-in save box, so the loader is reachable with " +
      "anything that parses as JSON -- not just with saves this game wrote. " +
      "Every field is coerced on load; this is the check that it stays that way.",
    run(g) {
      const junk = {
        v: "x", cash: "lots", lifetime: null, clicks: -5, staff: { helpdesk: "many", ghost: 3 },
        staffTotal: NaN, upgrades: { macros: 1, ghost: true }, reputation: -1e9,
        repEarned: "0", exits: 1.7, ach: { ghost: true }, repUp: { ghost: true },
        mkt: null, mktProfit: "x", incident: 99, lumps: -3, levels: { helpdesk: 999 },
        debt: "x", debtBank: Infinity, buffs: { allhands: "soon" }, clients: { ghost: true },
        lastSeen: "yesterday", tut: null
      };
      g.sandbox.localStorage.setItem(g.SAVE_KEY, JSON.stringify(junk));
      g.load();
      // Then run the game: a value that is merely wrong is survivable, one
      // that is NaN spreads to everything it touches within a tick.
      for (let i = 0; i < 5; i++) {
        g.clock.advance(1000);
        g.earn(g.totalRate() * 1);
        g.closeTicket();
        g.marketTick(); g.lumpTick(); g.debtTick(1);
      }
      for (const [name, v] of [["cash", g.S.cash], ["lifetime", g.S.lifetime],
                               ["rate", g.totalRate()], ["click", g.clickValue()],
                               ["staffTotal", g.S.staffTotal], ["pendingRep", g.pendingRep()]]) {
        if (!Number.isFinite(v)) throw new Error(`${name} is ${String(v)} after loading junk`);
      }
      if (g.S.cash < 0) throw new Error(`cash went negative (${fmtNum(g.S.cash)}) on a hostile save`);
      if (g.levelOf("helpdesk") > g.LEVEL_MAX) {
        throw new Error(`training level ${g.levelOf("helpdesk")} exceeds the cap of ${g.LEVEL_MAX}`);
      }
      if (g.incidentStage() > g.INCIDENT_MAX) throw new Error("incident stage exceeded its ceiling");
    }
  },
  {
    name: "debt drags but never strangles",
    why: "DEBT_MAX exists so income cannot be driven to zero by walking away.",
    run(g) {
      g.S.debt = 9999;
      if (g.debtCount() !== g.DEBT_MAX) throw new Error(`debt counted as ${g.debtCount()}, cap is ${g.DEBT_MAX}`);
      const m = g.debtMult();
      if (!(m > 0)) throw new Error(`debt multiplier is ${fmtNum(m)}`);
    }
  },
  {
    name: "incident mode stops at its ceiling",
    why: "The stage is player-chosen and clamped; the multiplier is derived from the clamp.",
    run(g) {
      g.S.upgrades.siem = true;
      for (let i = 0; i < 10; i++) g.escalateIncident();
      if (g.incidentStage() !== g.INCIDENT_MAX) throw new Error(`stage reached ${g.incidentStage()}`);
      const want = 1 + g.INCIDENT_GAIN * g.INCIDENT_MAX;
      if (!near(g.incidentMult(), want)) throw new Error(`multiplier ${fmtNum(g.incidentMult())}, want ${fmtNum(want)}`);
      g.standDown();
      if (g.incidentStage() !== 0) throw new Error("standing down did not clear the stage");
    }
  },
  {
    name: "morale pays nothing until a benefit is bought",
    why:
      "The bargain milk strikes with kittens: the number is real from the " +
      "first achievement, and worth exactly zero until you buy something " +
      "that spends it. If morale ever moved income on its own, every " +
      "existing save would silently change value on load.",
    run(g) {
      g.S.staff.helpdesk = 10; g.S.staffTotal = 10;
      const flat = g.totalRate();
      g.ACHIEVEMENTS.forEach(a => { g.S.ach[a.id] = true; });
      if (g.morale() < 0.99) throw new Error(`every achievement gives only ${g.morale()} morale`);
      if (g.totalRate() !== flat) throw new Error("full morale changed income with no benefit owned");
      if (g.moraleMult() !== 1) throw new Error(`moraleMult is ${g.moraleMult()} with nothing bought`);
      g.S.cash = 1e12;
      g.buyUpgrade(g.UPGRADES.find(u => u.id === "lunch"));
      if (!(g.totalRate() > flat)) throw new Error("buying a benefit did not pay out morale");
    }
  },
  {
    name: "burnout makes an incident cost something",
    why:
      "The point of morale going down as well as up. Incident mode is the " +
      "strongest lever in the game and had no cost a player could feel; " +
      "running it should now visibly cut what the benefits line is worth.",
    run(g) {
      g.S.staff.helpdesk = 10; g.S.staffTotal = 10;
      g.ACHIEVEMENTS.forEach(a => { g.S.ach[a.id] = true; });
      g.S.cash = 1e12;
      g.buyUpgrade(g.UPGRADES.find(u => u.id === "lunch"));
      const calm = g.moraleMult();
      g.S.upgrades.siem = true;
      g.escalateIncident(); g.escalateIncident(); g.escalateIncident();
      const loud = g.moraleMult();
      if (!(loud < calm)) throw new Error(`a stage-3 incident did not reduce morale (${calm} -> ${loud})`);
      g.standDown();
      if (Math.abs(g.moraleMult() - calm) > 1e-9) {
        throw new Error("standing down did not restore morale");
      }
      // And debt has to bite too, or half the mechanic is decoration.
      g.S.debt = g.DEBT_MAX;
      if (!(g.moraleMult() < calm)) throw new Error("maximum technical debt did not reduce morale");
    }
  },
  {
    name: "the wire always has something to say",
    why:
      "Every line is behind a predicate, so a state where every pool is " +
      "closed would leave the ticker blank forever. The always-on pool " +
      "exists to make that impossible; this is the check that it stayed.",
    run(g) {
      const pools = g.NEWS.filter(p => p.when());
      if (!pools.length) throw new Error("no news pool is open on a clean save");
      const lines = pools.reduce((n, p) => n + p.lines.length, 0);
      if (lines < 10) throw new Error(`only ${lines} lines available on a clean save`);
      // And nothing in any pool should be blank or a duplicate.
      const all = g.NEWS.flatMap(p => p.lines);
      if (all.some(l => !l || !l.trim())) throw new Error("a news line is empty");
      if (new Set(all).size !== all.length) throw new Error("a news line is duplicated");
    }
  },
  {
    name: "the number formatters never render a non-number",
    why:
      "fmt() degrading to '1.56e+81Dc' is how the old runaway announced itself. " +
      "Whatever the economy does, the display has to stay readable.",
    run(g) {
      const nasty = [0, -1, 0.004, 999.999, 1e3, 1e33, 1e309, Infinity, -Infinity, NaN];
      for (const n of nasty) {
        for (const [name, f] of [["fmt", g.fmt], ["money", g.money], ["rateStr", g.rateStr]]) {
          const s = String(f(n));
          if (/NaN|Infinity|undefined|e\+|e-/.test(s)) {
            throw new Error(`${name}(${n}) rendered "${s}"`);
          }
        }
      }
    }
  },
  {
    name: "staff prices follow the 1.15 curve",
    why: "Design rule 3 again: pricing is derived from static config, never from a save.",
    run(g) {
      const d = g.STAFF[0];
      for (const n of [0, 1, 5, 25]) {
        g.S.staff[d.id] = n;
        const want = Math.ceil(d.cost * Math.pow(1.15, n));
        if (g.costOf(d) !== want) throw new Error(`copy ${n + 1} costs ${g.costOf(d)}, want ${want}`);
      }
    }
  }
];

export function runChecks(loadGame, html) {
  return CHECKS.map(check => {
    let game;
    try {
      game = loadGame(html);
      check.run(game);
      return { name: check.name, why: check.why, ok: true };
    } catch (e) {
      return { name: check.name, why: check.why, ok: false, error: e.message };
    }
  });
}
