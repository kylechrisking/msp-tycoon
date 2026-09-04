/* A fuzzer that plays badly on purpose.
 *
 * bot.js plays well: it buys on payback, prestiges on a trigger, catches
 * every escalation. That is the right tool for asking what a system is
 * worth, and the wrong one for finding bugs, because a sensible player
 * never does the thing that breaks a game. This does the opposite --
 * every legal action, in any order, at any moment, including the ones no
 * one would choose: selling the company with nothing in it, remediating
 * debt that does not exist, buying a market position and dumping it a
 * tick later, standing down an incident that was never declared,
 * spending a training credit on a tier with no staff, closing a ticket
 * during a breach.
 *
 * After every single action it asserts the things that must never stop
 * being true. The point is not that the fuzzer finishes; it is where it
 * stops.
 */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Things that are true of any reachable game state, whatever was done to
 * get there. Each returns a string when violated. */
const INVARIANTS = [
  g => !Number.isFinite(g.S.cash) && `cash is ${g.S.cash}`,
  g => g.S.cash < 0 && `cash is negative (${g.S.cash})`,
  g => !Number.isFinite(g.S.lifetime) && `lifetime is ${g.S.lifetime}`,
  g => g.S.lifetime < 0 && `lifetime is negative (${g.S.lifetime})`,
  g => !Number.isFinite(g.totalRate()) && `rate is ${g.totalRate()}`,
  g => g.totalRate() < 0 && `rate is negative (${g.totalRate()})`,
  g => !Number.isFinite(g.clickValue()) && `click value is ${g.clickValue()}`,
  g => g.clickValue() < 0 && `click value is negative (${g.clickValue()})`,
  g => !Number.isFinite(g.S.reputation) && `reputation is ${g.S.reputation}`,
  g => g.S.reputation < 0 && `reputation is negative (${g.S.reputation})`,
  g => g.S.repEarned < g.S.reputation - 1e-6 &&
       `reputation held (${g.S.reputation}) exceeds reputation ever earned (${g.S.repEarned})`,
  g => !Number.isFinite(g.pendingRep()) && `pendingRep is ${g.pendingRep()}`,
  g => g.pendingRep() < 0 && `pendingRep is negative (${g.pendingRep()})`,
  g => g.S.staffTotal < 0 && `staffTotal is negative (${g.S.staffTotal})`,
  g => g.S.staffTotal !== g.STAFF.reduce((n, d) => n + g.c(d.id), 0) &&
       `staffTotal (${g.S.staffTotal}) disagrees with the roster ` +
       `(${g.STAFF.reduce((n, d) => n + g.c(d.id), 0)})`,
  g => g.STAFF.some(d => g.c(d.id) < 0) && `a staff tier has a negative count`,
  g => g.STAFF.some(d => g.levelOf(d.id) > g.LEVEL_MAX) && `a training level exceeded its cap`,
  g => g.S.lumps < 0 && `training credits went negative (${g.S.lumps})`,
  g => g.S.lumps > g.LUMP_CAP && `training credits exceeded the cap (${g.S.lumps})`,
  g => g.debtCount() > g.DEBT_MAX && `debt exceeded its ceiling`,
  g => g.debtMult() <= 0 && `debt multiplier is ${g.debtMult()} -- income fully strangled`,
  g => g.incidentStage() > g.INCIDENT_MAX && `incident stage exceeded its ceiling`,
  g => g.S.debtBank < 0 && `debt bank is negative (${g.S.debtBank})`,
  g => g.MARKET.some(m => g.mktInv(m.id) < 0) && `a market position is negative`,
  g => g.MARKET.some(m => !Number.isFinite(g.mktValue(m.id))) && `a market position is not a number`,
  g => g.MARKET.some(m => !(g.mktPrice(m.id) > 0)) && `a market price is not positive`,
  // Whatever the economy does, the display has to survive it.
  g => /NaN|Infinity|undefined|e\+/.test(
        g.money(g.S.cash) + g.fmt(g.S.lifetime) + g.rateStr(g.totalRate())
       ) && `a formatter rendered a non-number`
];

function checkInvariants(g) {
  for (const inv of INVARIANTS) {
    let msg;
    try { msg = inv(g); }
    catch (e) { return `invariant threw: ${e.message}`; }
    if (msg) return msg;
  }
  return null;
}

/* Every action a player can actually take. Weighted only enough that the
 * game progresses at all -- otherwise a run spends all its time buying
 * nothing with no money. */
function actions(g, rand) {
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  return [
    ["click",        () => g.closeTicket()],
    ["click",        () => g.closeTicket()],
    ["buy staff",    () => g.buyStaff(pick(g.STAFF))],
    ["buy staff",    () => g.buyStaff(pick(g.STAFF))],
    ["buy upgrade",  () => g.buyUpgrade(pick(g.UPGRADES))],
    ["buy client",   () => g.buyClient(pick(g.CLIENTS))],
    ["buy rep up",   () => g.buyRepUpgrade(pick(g.REP_UPGRADES))],
    ["prestige",     () => g.prestige()],
    ["market buy",   () => g.marketGate() && g.mktBuy(pick(g.MARKET))],
    ["market sell",  () => g.marketGate() && g.mktSell(pick(g.MARKET))],
    ["train",        () => g.trainStaff(pick(g.STAFF))],
    ["remediate",    () => g.remediate()],
    ["escalate",     () => g.escalateIncident()],
    ["stand down",   () => g.standDown()],
    ["claim esc",    () => g.claimEscalation(pick(g.ESCALATIONS))],
    ["save",         () => g.save()],
    ["load",         () => g.load()],
    ["tick",         () => { g.clock.advance(100); g.earn(g.totalRate() * 0.1); }],
    ["tick",         () => { g.clock.advance(1000); g.earn(g.totalRate() * 1); }],
    // A backgrounded tab, a laptop lid, a save opened tomorrow.
    ["big jump",     () => g.clock.advance(3600000 * (1 + Math.floor(rand() * 30)))],
    ["market tick",  () => g.marketTick()],
    ["lump tick",    () => g.lumpTick()],
    ["debt tick",    () => g.debtTick(1)],
    ["achievements", () => g.checkAchievements()]
  ];
}

export function fuzz(loadGame, html, opts = {}) {
  const steps = opts.steps ?? 20000;
  const seed = opts.seed ?? 1;
  const rand = mulberry32(seed);
  const realRandom = Math.random;
  Math.random = rand;

  const g = loadGame(html);
  const history = [];
  try {
    const acts = actions(g, rand);
    for (let i = 0; i < steps; i++) {
      const [name, fn] = acts[Math.floor(rand() * acts.length)];
      history.push(name);
      if (history.length > 25) history.shift();
      try {
        fn();
      } catch (e) {
        return { seed, ok: false, step: i, action: name, error: `threw: ${e.message}`,
                 history: [...history], state: snap(g) };
      }
      const bad = checkInvariants(g);
      if (bad) {
        return { seed, ok: false, step: i, action: name, error: bad,
                 history: [...history], state: snap(g) };
      }
    }
  } finally {
    Math.random = realRandom;
  }
  return { seed, ok: true, steps, state: snap(g) };
}

function snap(g) {
  return {
    cash: g.S.cash, lifetime: g.S.lifetime, rate: g.totalRate(), click: g.clickValue(),
    reputation: g.S.reputation, repEarned: g.S.repEarned, exits: g.S.exits,
    staffTotal: g.S.staffTotal, debt: g.S.debt, debtBank: g.S.debtBank,
    incident: g.S.incident, lumps: g.S.lumps, clicks: g.S.clicks
  };
}

/* The same idea aimed at the screen instead of the economy.
 *
 * The invariants above prove the numbers are sane. They cannot see a
 * panel that prints "$NaN", "undefined/s" or "Infinity seconds to pay for
 * itself", because that text is built during rendering and thrown at a
 * DOM node. So: fuzz the state, render every panel the game has, and read
 * back everything the UI tried to write.
 */
const RENDERS = [
  ["head",     g => g.renderHead()],
  ["store",    g => g.renderList(true)],
  ["sheet",    g => g.renderSheet(true)],
  ["buffs",    g => g.renderBuffs()],
  ["profile",  g => g.renderProfile()],
  ["ach list", g => g.renderProfileAch()],
  ["tour",     g => g.coachSync()],
  ["staff tips",   g => g.STAFF.forEach((d, i) => { g.staffTip(d, i, true); g.staffTip(d, i, false); })],
  ["upgrade tips", g => g.UPGRADES.forEach(u => g.upgradeTip(u))],
  ["client tips",  g => g.CLIENTS.forEach(cl => { g.clientTip(cl, true); g.clientTip(cl, false); })]
];

const JUNK = /NaN|Infinity|undefined|\be\+\d|\[object Object\]/;

export function fuzzRenders(loadGame, recordRenders, stopRecording, html, opts = {}) {
  const steps = opts.steps ?? 4000;
  const seed = opts.seed ?? 1;
  const rand = mulberry32(seed);
  const realRandom = Math.random;
  Math.random = rand;

  const g = loadGame(html);
  const history = [];
  try {
    const acts = actions(g, rand);
    for (let i = 0; i < steps; i++) {
      const [name, fn] = acts[Math.floor(rand() * acts.length)];
      history.push(name);
      if (history.length > 25) history.shift();
      try { fn(); } catch (e) {
        return { seed, ok: false, step: i, where: name, error: `action threw: ${e.message}`,
                 history: [...history] };
      }

      for (const [where, render] of RENDERS) {
        const sink = recordRenders();
        try { render(g); }
        catch (e) {
          stopRecording();
          return { seed, ok: false, step: i, where, error: `render threw: ${e.message}`,
                   after: name, history: [...history], state: snap(g) };
        }
        const written = stopRecording();
        const bad = written.find(s => JUNK.test(s));
        if (bad) {
          return { seed, ok: false, step: i, where, after: name,
                   error: `rendered: ${trim(bad)}`, history: [...history], state: snap(g) };
        }
      }
    }
  } finally {
    Math.random = realRandom;
    stopRecording();
  }
  return { seed, ok: true, steps };
}

// Just enough of the offending string to see what produced it.
function trim(s) {
  const m = s.match(/.{0,90}(NaN|Infinity|undefined|e\+\d|\[object Object\]).{0,60}/);
  return (m ? m[0] : s.slice(0, 150)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function fuzzRendersMany(loadGame, recordRenders, stopRecording, html, seeds = 6, steps = 3000) {
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const r = fuzzRenders(loadGame, recordRenders, stopRecording, html, { seed: s, steps });
    if (!r.ok) out.push(r);
  }
  return out;
}

export function fuzzMany(loadGame, html, seeds = 25, steps = 20000) {
  const out = [];
  for (let s = 1; s <= seeds; s++) {
    const r = fuzz(loadGame, html, { seed: s, steps });
    if (!r.ok) out.push(r);
  }
  return out;
}
