/* A bot that plays the real game.
 *
 * It calls the same functions the buttons do -- buyStaff(), buyUpgrade(),
 * prestige(), mktBuy(), trainStaff(), remediate(), claimEscalation() --
 * so anything it cannot do, a player cannot do either. What it is *not*
 * is a model of a person: it is at the keyboard for every second of the
 * run and it never misclicks. Treat its numbers as the ceiling a system
 * allows, not the experience anyone will have.
 *
 * Every system is switchable, which is the point. The client curve was
 * simulated on its own and the core loop paces as documented, but the
 * market, incident mode, training and debt have never been measured
 * against each other -- and four multipliers that are each fine alone can
 * still be a runaway together. Toggling one at a time is how that gets
 * answered rather than guessed.
 */

export const DEFAULTS = {
  hours: 55,
  stepSec: 1,          // one simulated second per step
  cps: 5,              // clicks per second while at the keyboard
  shopEvery: 5,        // steps between purchase rounds -- buying is the slow part
  // Systems. Off means the bot never touches the system, which is what a
  // player ignoring it looks like; debt is the exception, since it
  // accrues whether or not anyone engages with it.
  market: true,
  incident: true,
  training: true,
  debtPolicy: "cap",   // "cap" (let it fill, then pay), "eager" (pay at once), "ignore"
  catchRate: 1,        // share of escalated tickets claimed in time
  // Sell the company once the exit is worth this much relative to the
  // reputation already held. Small numbers prestige constantly.
  prestigeGain: 0.15,
  // Buy a reputation upgrade once its price is this multiple of held
  // reputation or less -- spending the balance costs the +2%/point it was
  // paying, so the bot does not empty itself the moment it can afford one.
  repBuyRatio: 0.5,
  marketBuyBelow: 85,
  marketSellAbove: 118,
  seed: 1
};

/* Deterministic RNG, so a run can be repeated and a surprising number can
 * be looked at twice. Installed over Math.random for the duration of the
 * run: the game leans on it heavily (market walk, escalation timing and
 * kind, hostility) and none of that is reachable any other way. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* What one more of a staff tier actually adds. Measured rather than
 * derived: rateOf() folds in upgrades, training levels and reputation,
 * and re-deriving that here is how a simulator ends up disagreeing with
 * the game it is meant to be measuring. */
function marginalStaff(g, d) {
  const before = g.rateOf(d);
  g.S.staff[d.id] = g.c(d.id) + 1;
  const after = g.rateOf(d);
  g.S.staff[d.id] = g.c(d.id) - 1;
  if (!g.S.staff[d.id]) delete g.S.staff[d.id];
  return after - before;
}

function marginalUpgrade(g, u, cps) {
  const before = effectiveRate(g, cps);
  g.S.upgrades[u.id] = true;
  const after = effectiveRate(g, cps);
  delete g.S.upgrades[u.id];
  return after - before;
}

// Income per second counting the clicking the bot is actually doing, so
// click upgrades are weighed on the same scale as a hire.
function effectiveRate(g, cps) {
  return g.totalRate() + g.clickValue() * cps;
}

/* One purchase round: buy the single best-value thing that is affordable,
 * repeatedly, until nothing is worth buying. "Best value" is seconds to
 * pay for itself, which is the same question the store tooltip answers
 * for the player. */
function shop(g, o) {
  for (let guard = 0; guard < 60; guard++) {
    let best = null;

    for (const d of g.STAFF) {
      const cost = g.costOf(d);
      if (cost > g.S.cash) continue;
      const gain = marginalStaff(g, d);
      if (gain <= 0) continue;
      const payback = cost / gain;
      if (!best || payback < best.payback) best = { payback, buy: () => g.buyStaff(d) };
    }

    for (const u of g.UPGRADES) {
      if (g.S.upgrades[u.id] || u.cost > g.S.cash) continue;
      if (u.need && !u.need()) continue;
      const gain = marginalUpgrade(g, u, o.cps);
      // Hold upgrades do nothing for a bot that clicks at a fixed rate,
      // but they are cheap and gate later ones, so buy them on price.
      const payback = gain > 0 ? u.cost / gain : u.cost / Math.max(1e-9, effectiveRate(g, o.cps) * 0.01);
      if (!best || payback < best.payback) best = { payback, buy: () => g.buyUpgrade(u) };
    }

    // Clients never reset, so their payback is measured against a run
    // that ends -- but the bot has no way to price "forever" here, and
    // buying them on the same payback rule as everything else already
    // signs the whole roster in time.
    for (const cl of g.CLIENTS) {
      if (g.S.clients[cl.id] || !g.clientUnlocked(cl) || cl.cost > g.S.cash) continue;
      const payback = cl.cost / cl.rate;
      if (!best || payback < best.payback) best = { payback, buy: () => g.buyClient(cl) };
    }

    if (!best) return;
    best.buy();
  }
}

function spendReputation(g, o) {
  for (const u of g.REP_UPGRADES) {
    if (g.hasRep(u.id)) continue;
    // Only once the price is a fraction of what is held: reputation pays
    // +2% a point while it sits there, so buying the moment it is
    // affordable trades a live multiplier for a one-off.
    if (g.S.reputation >= u.cost / Math.max(o.repBuyRatio, 1e-9)) g.buyRepUpgrade(u);
  }
}

function spendTraining(g) {
  // Levels survive prestige, so they go on the tier that will still be
  // producing after the next exit -- in practice the highest-output tier
  // the run currently owns.
  let guard = 0;
  while (g.S.lumps > 0 && guard++ < 40) {
    const owned = g.STAFF
      .filter(d => g.c(d.id) > 0 && g.levelOf(d.id) < g.LEVEL_MAX)
      .sort((a, b) => g.rateOf(b) - g.rateOf(a));
    const pick = owned.find(d => g.levelCost(d.id) <= g.S.lumps);
    if (!pick) return;
    g.trainStaff(pick);
  }
}

function playMarket(g, o) {
  if (!g.marketGate()) return;
  for (const m of g.MARKET) {
    const p = g.mktPrice(m.id);
    if (g.mktInv(m.id) > 0) {
      if (p >= o.marketSellAbove) g.mktSell(m);
    } else if (p <= o.marketBuyBelow) {
      g.mktBuy(m);
    }
  }
}

function manageDebt(g, o) {
  if (o.debtPolicy === "ignore") return;
  if (o.debtPolicy === "eager" && (g.S.debt || 0) > 0) return g.remediate();
  if (o.debtPolicy === "cap" && g.debtCount() >= g.DEBT_MAX) g.remediate();
}

function manageIncident(g, o) {
  if (!o.incident || !g.incidentGate()) return;
  if (g.incidentStage() < g.INCIDENT_MAX) g.escalateIncident();
}

/* Escalated tickets, without the DOM. spawnEscalation() builds a button
 * and despawnEscalation() reads it back, so neither is usable headless --
 * but every number they depend on (the interval, the weighted pick, the
 * hostile roll, the breach penalty) is called here exactly as the game
 * calls it, and claiming goes through the real claimEscalation(). */
function escalationTick(g, o, rand) {
  if (!g.escGate()) return;
  const now = g.clock.now();
  if (!g.S.nextEsc) g.S.nextEsc = now + g.escInterval();

  if (g.esc) {
    const missed = now >= g.esc.until;
    const caught = !missed && now >= g.esc.claimAt;
    if (caught) {
      g.claimEscalation(g.esc.kind);
      g.esc = null;
      g.S.nextEsc = now + g.escInterval();
    } else if (missed) {
      if (g.esc.hostile) {
        const b = g.ESCALATIONS.find(e => e.id === "breach");
        g.S.buffs.breach = now + b.secs * 1000;
      }
      g.esc = null;
      g.S.nextEsc = now + g.escInterval();
    }
    return;
  }

  if (now >= g.S.nextEsc) {
    const kind = g.pickEscalation();
    const hostile = rand() < g.hostileChance();
    const willCatch = rand() < o.catchRate;
    g.esc = {
      kind, hostile,
      until: now + g.ESC_LIFETIME_MS,
      // Caught at some point inside the window rather than instantly:
      // the reaction time is what a hostile ticket is really testing.
      claimAt: willCatch ? now + rand() * g.ESC_LIFETIME_MS * 0.8 : Infinity
    };
  }
}

function snapshot(g, t) {
  const rate = g.totalRate();
  return {
    hours: t / 3600,
    cash: g.S.cash,
    lifetime: g.S.lifetime,
    rate,
    rateText: g.rateStr(rate),
    lifetimeText: g.money(g.S.lifetime),
    clicks: g.S.clicks,
    exits: g.S.exits,
    reputation: g.S.reputation,
    repEarned: g.S.repEarned,
    staffTotal: g.S.staffTotal,
    upgrades: Object.keys(g.S.upgrades).length,
    clients: Object.keys(g.S.clients).length,
    repUps: Object.keys(g.S.repUp).length,
    levels: g.STAFF.reduce((s, d) => s + g.levelOf(d.id), 0),
    debt: g.debtCount(),
    incident: g.incidentStage(),
    mktProfit: g.S.mktProfit || 0,
    escCaught: g.S.escCaught || 0,
    ach: Object.keys(g.S.ach).length
  };
}

export function runSim(game, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const g = game;
  const rand = mulberry32(o.seed);
  const realRandom = Math.random;
  Math.random = rand;

  const samples = [];
  const problems = [];
  // When each upgrade and achievement first landed. The tails of both
  // lists were extended by eye rather than measured, and "reachable" is
  // not a yes/no question -- it is a number of hours, which is this.
  const firsts = { upgrades: {}, ach: {}, clients: {}, repUp: {} };
  const noteFirsts = t => {
    for (const [key, obj] of [["upgrades", g.S.upgrades], ["ach", g.S.ach],
                              ["clients", g.S.clients], ["repUp", g.S.repUp]]) {
      for (const id in obj) {
        if (obj[id] && firsts[key][id] === undefined) firsts[key][id] = t / 3600;
      }
    }
  };
  const steps = Math.round((o.hours * 3600) / o.stepSec);
  const perHour = Math.round(3600 / o.stepSec);
  const dt = o.stepSec;
  let nextSample = 0;

  try {
    for (let i = 0; i < steps; i++) {
      const t = i * o.stepSec;
      g.clock.advance(o.stepSec * 1000);

      g.earn(g.totalRate() * dt);
      for (let k = 0; k < o.cps * o.stepSec; k++) g.closeTicket();

      g.marketTick();
      if (o.training) g.lumpTick();
      g.debtTick(dt);
      escalationTick(g, o, rand);

      if (i % o.shopEvery === 0) {
        shop(g, o);
        manageDebt(g, o);
        manageIncident(g, o);
        if (o.market) playMarket(g, o);
        if (o.training) spendTraining(g);
        spendReputation(g, o);
        g.checkAchievements();
        noteFirsts(t);

        const pending = g.pendingRep();
        if (pending > 0 && pending >= Math.max(1, g.S.reputation * o.prestigeGain)) {
          g.prestige();
        }
      }

      // The failure this is looking for is the one the README already
      // suspects: an economy with no soft cap eventually leaves the range
      // where a number means anything. Record where that happens rather
      // than only that it did.
      if (!problems.length && !Number.isFinite(g.S.lifetime + g.S.cash + g.totalRate())) {
        problems.push({ hours: t / 3600, what: "non-finite economy", sample: snapshot(g, t) });
      }

      if (i >= nextSample) {
        samples.push(snapshot(g, t));
        nextSample += perHour;
      }
    }
  } finally {
    Math.random = realRandom;
  }

  const final = snapshot(g, o.hours * 3600);
  return { options: o, samples, final, problems, firsts };
}
