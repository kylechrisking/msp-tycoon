/* Loads the real game into a headless sandbox.
 *
 * The point of this file is that the simulator does not get its own copy
 * of the economy. index.html is fetched, its one <script> is pulled out
 * verbatim, and it runs against a stub DOM and a virtual clock -- so
 * every number the bot reports comes from the same rateOf(), costOf(),
 * pendingRep() and marketTick() that the game ships. A balance change
 * that is not reflected here is impossible: there is nothing here to
 * fall out of sync with.
 *
 * Two things are faked and nothing else:
 *
 *   The DOM. Every render path is called for real by buyStaff(),
 *   prestige() and friends, and every one of them writes into a stub that
 *   swallows it. That is deliberate -- calling the real action functions
 *   means the bot cannot drift from what a player can actually do, and it
 *   catches a render throwing on state the UI never expects.
 *
 *   The clock. Date.now() is virtual, so 55 hours of play run in a couple
 *   of seconds. Every mechanic in the game that matters over a long run --
 *   the market's ten-second steps, the six-hour training credit, the debt
 *   interval, escalation lifetimes -- reads Date.now(), so advancing it is
 *   the whole of "time passing".
 */

/* Where the UI's rendered text is collected, when anyone is listening.
 * Off by default: the bot renders a million times and has no use for it. */
let SINK = null;
export function recordRenders() { SINK = []; return SINK; }
export function stopRecording() { const s = SINK; SINK = null; return s || []; }

/* A stub node. Anything can be read off it, called on it, or assigned to
 * it; nothing throws and nothing is rendered. Reads return the stub
 * itself, which is truthy -- so `if(el)` guards take the branch a real
 * page would, and `el.querySelector(".x").style.transform = ...` chains
 * all the way through without special-casing a single one of them. */
function stubNode() {
  const store = {};
  const target = function () { return stubNode(); };
  return new Proxy(target, {
    get(_t, p) {
      if (p === Symbol.toPrimitive) return () => 0;
      if (p === Symbol.iterator) return function* () {};
      if (p === "toString") return () => "";
      if (p in store) return store[p];
      // Layout reads are the one place a stub has to answer with a
      // number: code that does arithmetic on them would otherwise
      // produce NaN and quietly poison whatever it is positioning.
      if (NUMERIC.has(p)) return 0;
      if (p === "length") return 0;
      return (store[p] = stubNode());
    },
    set(_t, p, v) {
      // Record what the UI writes. Nothing reads it back -- design rule 2 --
      // but the fuzzer scans it, because a formatter that renders "$NaN"
      // into a panel is a real bug the economy invariants cannot see.
      if (SINK && (p === "textContent" || p === "innerHTML" || p === "value")) {
        SINK.push(String(v));
      }
      store[p] = v;
      return true;
    },
    has() { return true; },
    apply() { return stubNode(); },
    construct() { return stubNode(); }
  });
}

const NUMERIC = new Set([
  "offsetWidth", "offsetHeight", "offsetTop", "offsetLeft",
  "clientWidth", "clientHeight", "clientTop", "clientLeft",
  "scrollTop", "scrollLeft", "scrollWidth", "scrollHeight",
  "top", "left", "right", "bottom", "width", "height", "x", "y"
]);

/* Stubs are pooled, not minted per lookup.
 *
 * This is a performance fix, and a large one: a 55-hour run calls
 * renderHead() a million times, and handing each call a fresh Proxy tree
 * buried the simulation in allocation -- the first version of this file
 * wedged the tab rather than finishing. Nothing ever reads a value back
 * out of the DOM (design rule 2 in the README), so one node per id, and
 * one shared node for everything created, is indistinguishable from the
 * real thing as far as the game is concerned. */
function stubDocument() {
  const doc = stubNode();
  const byId = new Map();
  const scratch = stubNode();
  doc.getElementById = id => {
    let n = byId.get(id);
    if (!n) byId.set(id, (n = stubNode()));
    return n;
  };
  doc.querySelector = () => scratch;
  doc.querySelectorAll = () => [];
  doc.createElement = () => scratch;
  doc.createTextNode = () => scratch;
  doc.addEventListener = () => {};
  doc.removeEventListener = () => {};
  doc.contains = () => true;
  doc.body = stubNode();
  doc.documentElement = stubNode();
  doc.head = stubNode();
  return doc;
}

/* localStorage, in memory. The game saves constantly (every purchase
 * calls save()); the sim wants that exercised -- a save that throws on
 * some state is a bug worth finding -- but never persisted. */
function stubStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear()
  };
}

/* The virtual clock. `Date` is passed into the sandbox as a parameter, so
 * it shadows the real global for the game's code only -- nothing outside
 * this file has its clock moved. */
function virtualClock(start) {
  let now = start;
  const D = new Proxy(Date, {
    get(t, p) {
      if (p === "now") return () => now;
      return Reflect.get(t, p);
    },
    construct(t, args) {
      return args.length ? new t(...args) : new t(now);
    }
  });
  return {
    Date: D,
    now: () => now,
    advance: ms => { now += ms; },
    set: ms => { now = ms; }
  };
}

/* Everything the sim reaches for. Listed rather than scraped: if the game
 * renames one of these, this throws a ReferenceError on load instead of
 * silently simulating a game with a hole in it. */
const EXPORTS = `{
  get S(){ return S }, set S(v){ S = v },
  STAFF, UPGRADES, ACHIEVEMENTS, CLIENTS, MARKET, ESCALATIONS, REP_UPGRADES,
  freshState, c, costOf, repMult, rateOf, baseRate, totalRate, clickValue,
  pendingRep, earn, closeTicket, buyStaff, buyUpgrade, buyClient,
  buyRepUpgrade, prestige, save, load, checkAchievements,
  clientBonusRate, clientUnlocked, hasRep, applyRunStart,
  incidentGate, incidentStage, incidentMult, hostileChance,
  escalateIncident, standDown,
  marketGate, mktPrice, mktInv, mktEntry, mktValue, marketTick, mktBuy, mktSell,
  lumpGate, lumpTick, levelOf, levelMult, levelCost, trainStaff,
  debtGate, debtCount, debtMult, debtTick, remediate,
  escGate, escInterval, pickEscalation, buffActive, buffMult,
  invoiceValue, claimEscalation,
  fmt, money, rateStr, scale, upgradeTip, withUpgrade, pctOfIncome, marginalStaff, repBonusPct,
  renderHead, renderList, renderSheet, renderBuffs, renderProfile, renderProfileAch,
  syncProfileDot, staffTip, clientTip, coachSync,
  PRESTIGE_MIN, LEVEL_MAX, LEVEL_STEP, DEBT_MAX, DEBT_DRAG, DEBT_YIELD,
  DEBT_EVERY, INCIDENT_MAX, INCIDENT_GAIN, BREACH_SECS, BREACH_MULT,
  ESC_LIFETIME_MS, ESC_MIN_MS, ESC_MAX_MS, MKT_MS, MKT_BASE,
  LUMP_MS, LUMP_CAP, UNITS, SAVE_KEY
}`;

/* Pull the game's script out of its page. One <script> block, by design
 * -- if that ever stops being true this throws rather than quietly
 * simulating half a game. */
export function extractScript(html) {
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  if (blocks.length !== 1) {
    throw new Error(
      `expected exactly one inline <script> in index.html, found ${blocks.length}`
    );
  }
  return blocks[0][1];
}

/* Build a fresh, isolated instance of the game.
 *
 * Every call gets its own state, its own clock and its own module scope,
 * so two runs in the same page cannot contaminate each other -- which
 * matters, because the A/B comparisons run exactly that way.
 */
export function loadGame(html, opts = {}) {
  const clock = virtualClock(opts.startTime ?? Date.UTC(2026, 0, 1, 12, 0, 0));
  const source = extractScript(html);

  const sandbox = {
    document: stubDocument(),
    localStorage: stubStorage(),
    // The game registers timers for its own loop and for removing toasts.
    // Nothing here should ever run on a real schedule: the sim drives
    // every tick by hand so it can control how much time each one covers.
    setInterval: () => 0,
    setTimeout: () => 0,
    clearInterval: () => {},
    clearTimeout: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    // prestige() asks before selling. The bot has already decided.
    confirm: () => true,
    prompt: () => null,
    alert: () => {},
    // The cloud-save endpoint does not exist here, which is exactly the
    // "playing signed out" path the game is built to tolerate. A promise
    // that never settles is the honest stand-in: no response, no error.
    fetch: () => new Promise(() => {}),
    navigator: { serviceWorker: undefined, userAgent: "msp-tycoon-sim" },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    innerWidth: 1280,
    innerHeight: 800,
    screen: { width: 1280, height: 800 },
    console: opts.quiet === false ? console : { log() {}, warn() {}, error() {} },
    Date: clock.Date
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;

  const names = Object.keys(sandbox);
  const body = `"use strict";\n${source}\n;return ${EXPORTS};`;
  let game;
  try {
    game = new Function(...names, body)(...names.map(n => sandbox[n]));
  } catch (e) {
    throw new Error(`game script failed to load in the sandbox: ${e.message}`, { cause: e });
  }

  game.clock = clock;
  game.sandbox = sandbox;
  // Start from a clean save every time. The game called load() on the way
  // through, which found the empty stub storage and left the fresh state
  // alone -- this is belt and braces, and it re-seeds lastSeen against the
  // virtual clock rather than whatever the previous run left behind.
  game.S = game.freshState();
  return game;
}
