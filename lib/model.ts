// Token Radar — the valuation model, the board builder and the farm planner.
//
// One sealed DefiLlama snapshot in, one ranked board out. Everything the model
// claims follows from the snapshot's own ten fields per protocol; no protocol
// name is ever special-cased and no number is ever hard-coded per protocol.
//
// THE MODEL (peer-anchored implied value)
// ---------------------------------------
// A pre-token protocol's token, if one is ever issued, would trade against the
// same market that already prices its tokenized peers. So the model anchors on
// the market instead of guessing a multiple:
//
//   peer multiple = median(mcap / TVL) of the tokenized protocols in the same
//                   category, shrunk toward the global median by sample size:
//                   (n * category_median + 4 * global_median) / (n + 4),
//                   clamped to [0.02, 2.5]. A category with no tokenized peer
//                   uses the global median (0.129 on this snapshot). Only peers
//                   with at least $25M of TVL anchor a multiple: a ratio off a
//                   tiny base is noise, not a market price.
//   base          = tvl_usd * peer multiple
//   growth        = 1 + clamp(change_7d, -50, +100) / 100 * 0.5
//   maturity      = 0.7 + min(age_days, 1095) / 1095 * 0.3   (unknown age: 365)
//   breadth       = 1 + 0.03 * min(chains - 1, 5)            (at most 1.15)
//   implied       = max(1, round(base * growth * maturity * breadth))
//
// Why each factor: the peer multiple is the market's own price for a dollar of
// TVL in this kind of protocol; growth rewards protocols whose TVL is moving
// toward a launch rather than away from it; maturity rewards a long record with
// no token (a launch, if it comes, prices years of work, not weeks); breadth
// rewards a protocol live on more than one chain, where more users can farm it.
//
// THE SIGNAL (airdrop-likelihood heuristic, 0-100)
// -------------------------------------------------
// A separate score from the same fields, labelled a heuristic everywhere it
// shows: TVL scale (0-30, log-scaled $5M-$1B), 7-day momentum (0-20), age with
// no token (0-25), the category's points culture (5-15), chain breadth (0-10).
// It never predicts a launch; it orders where a farmer's time goes first.
//
// THE BOARD
// ---------
// 200 rows: every slug on the snapshot's watchlist (the floor, never the
// ceiling) plus the 160 strongest pre-token protocols below the $50M floor by
// TVL. A row is rankable when the snapshot records no token for it (no market
// cap, no CoinGecko id, no symbol), its category is not CEX, and its name does
// not end in a version marker (a V2/V3 pool is another protocol's pool, not a
// launch of its own). Tokenized protocols are never ranked; the dashboard
// shows the strongest of them apart, at the market's own value, so the board
// never mixes a traded token with a token still to come.
//
// Rows whose TVL is escrowed, wrapped or bridged value (Bridge, Canonical
// Bridge, Liquid Staking, Liquid Restaking, Restaked BTC, or a name carrying
// wrapped/staked/staking) carry a `flag`: their launch, if any, would be their
// parent's, and the detail view says so plainly.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, stated in the dashboard's methodology panel. */
export interface ModelConstants {
  peer_shrinkage: number;
  peer_min_tvl: number;
  multiple_min: number;
  multiple_max: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max_bonus: number;
}

export const MODEL: ModelConstants = {
  peer_shrinkage: 4,
  peer_min_tvl: 25_000_000,
  multiple_min: 0.02,
  multiple_max: 2.5,
  growth_weight: 0.5,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.03,
  chain_max_bonus: 5,
};

export const MODEL_VERSION = 'radar-peer-1';

/** Rows on the board: the watchlist plus this many early rows below the floor. */
export const EARLY_ROWS = 160;
/** Live-token protocols shown apart from the board, by market cap. */
export const LIVE_ROWS = 24;

/** One row of board.json. Extra keys are allowed by the gate; the dashboard reads the same row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  token_status: 'pre-token';
  watchlist: boolean;
  flag: string | null;
  implied_value_usd: number;
  signal: number;
  signal_band: 'High' | 'Medium' | 'Low';
  model: {
    peer_multiple: number;
    peer_count: number;
    category_median: number | null;
    global_median: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
  };
  farm_steps: string[];
}

/** A tokenized protocol, shown apart at the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
  mcap_tvl: number;
}

/** One category's peer anchor, for the methodology panel. */
export interface PeerAnchor {
  category: string;
  peers: number;
  category_median: number | null;
  multiple: number;
}

/** Everything the dashboard renders. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_median: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  total_implied_usd: number;
  peers: PeerAnchor[];
  rows: BoardRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a non-empty list, else null. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The peer anchors: for every category, the median mcap/TVL of its tokenized
 * protocols, shrunk toward the global median by the shrinkage pseudo-count and
 * clamped to the model's band. Computed once from the snapshot, never per row.
 */
export function peerAnchors(protocols: SnapshotProtocol[], model: ModelConstants): { global: number; byCategory: Map<string, PeerAnchor> } {
  const ratios = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of protocols) {
    if (p.mcap_usd === null || p.tvl_usd < model.peer_min_tvl) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const key = p.category ?? 'Uncategorized';
    const list = ratios.get(key) ?? [];
    list.push(ratio);
    ratios.set(key, list);
  }
  const global = median(all) ?? 0.17;
  const byCategory = new Map<string, PeerAnchor>();
  for (const [category, list] of ratios) {
    const catMedian = median(list)!;
    const shrunk = (list.length * catMedian + model.peer_shrinkage * global) / (list.length + model.peer_shrinkage);
    byCategory.set(category, {
      category,
      peers: list.length,
      category_median: round4(catMedian),
      multiple: round4(Math.min(model.multiple_max, Math.max(model.multiple_min, shrunk))),
    });
  }
  return { global: round4(global), byCategory };
}

/** The peer multiple one protocol's category anchors on; the global median when its category has no peer. */
function peerMultiple(p: SnapshotProtocol, anchors: { global: number; byCategory: Map<string, PeerAnchor> }): { multiple: number; peers: number; categoryMedian: number | null } {
  const anchor = anchors.byCategory.get(p.category ?? 'Uncategorized');
  if (anchor === undefined) return { multiple: anchors.global, peers: 0, categoryMedian: null };
  return { multiple: anchor.multiple, peers: anchor.peers, categoryMedian: anchor.category_median };
}

/** The implied value and its breakdown for one protocol under the model. */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  anchors: { global: number; byCategory: Map<string, PeerAnchor> },
  model: ModelConstants,
): { implied: number; age: number | null; peer: { multiple: number; peers: number; categoryMedian: number | null }; growthPct: number; growthMult: number; maturityMult: number; chainMult: number } {
  const peer = peerMultiple(p, anchors);
  const age = ageDays(asOf, p.listed_at);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(p.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainMult = 1 + model.chain_step * Math.min(Math.max(p.chains.length - 1, 0), model.chain_max_bonus);
  const implied = Math.max(1, Math.round(p.tvl_usd * peer.multiple * growthMult * maturityMult * chainMult));
  return { implied, age, peer, growthPct, growthMult, maturityMult, chainMult };
}

/** Points-culture scores by category: where points, quests and seasons are the norm, farmers go first. */
const CATEGORY_POINTS: Record<string, number> = {
  'Risk Curators': 15,
  Yield: 15,
  Lending: 15,
  Dexs: 15,
  'Onchain Capital Allocator': 15,
  'Basis Trading': 15,
  Restaking: 12,
  CDP: 12,
  Derivatives: 12,
  'Yield Aggregator': 12,
  'Leveraged Farming': 12,
  'Staking Pool': 10,
  RWA: 10,
  Chain: 10,
  'Liquid Restaking': 10,
  'Prediction Market': 10,
  'Liquidity Manager': 10,
  'Interest Rate Derivatives': 10,
};

/**
 * The airdrop-likelihood signal, 0-100: TVL scale (30), momentum (20), age with
 * no token (25), category points culture (5-15), chain breadth (10). A
 * heuristic from the snapshot's own fields, never a prediction of a launch.
 */
export function signalScore(p: SnapshotProtocol, age: number | null): number {
  const tvlPts = 30 * Math.min(1, Math.max(0, (Math.log10(Math.max(p.tvl_usd, 1)) - Math.log10(5_000_000)) / (Math.log10(1_000_000_000) - Math.log10(5_000_000))));
  const momPts = p.change_7d === null ? 10 : 20 * Math.min(1, Math.max(0, (p.change_7d + 20) / 70));
  const agePts = age === null ? 12 : 25 * Math.min(age, 1095) / 1095;
  const catPts = CATEGORY_POINTS[p.category ?? ''] ?? 5;
  const chainPts = 2 * Math.min(p.chains.length, 5);
  return Math.max(0, Math.min(100, Math.round(tvlPts + momPts + agePts + catPts + chainPts)));
}

export function signalBand(score: number): 'High' | 'Medium' | 'Low' {
  return score >= 55 ? 'High' : score >= 40 ? 'Medium' : 'Low';
}

/** Whether the snapshot records no token for a protocol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word wrapped, staked or staking in the name. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** Categories whose TVL is escrowed, wrapped or bridged value rather than a protocol of its own. */
const ESCROWED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The caveat a row carries when its TVL is escrowed, wrapped or bridged value, else null. */
export function rowFlag(p: SnapshotProtocol): string | null {
  if (p.category !== null && ESCROWED_CATEGORIES.has(p.category)) {
    return `Escrowed value: this ${p.category.toLowerCase()} protocol's TVL is assets held or bridged for others, so a launch, if any, would most likely be its parent's token, not a new one of its own.`;
  }
  if (WRAPPED_WORD.test(p.name)) {
    return 'Wrapped or staked product: its value tracks an asset that already trades, so a launch, if any, would most likely be its parent\'s token, not a new one of its own.';
  }
  return null;
}

// ---------------------------------------------------------------- farm plans

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A second chain when the protocol runs on more than one, else null. */
function secondChain(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 25_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 90;
  if (age < 365) return 60;
  return 30;
}

/** A gas note for one chain, in the words a farmer budgets by. */
function gasFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'solana') return 'under $0.10 of gas';
  if (c === 'ethereum') return 'about $8 of gas';
  if (c === 'bsc' || c === 'bnb chain') return 'about $0.30 of gas';
  if (c === 'polygon') return 'about $0.10 of gas';
  if (c === 'base' || c === 'arbitrum' || c === 'optimism' || c === 'linea' || c === 'scroll' || c === 'zksync era' || c === 'blast') return 'about $0.50 of gas';
  if (c === 'avalanche') return 'about $0.50 of gas';
  if (c === 'sui' || c === 'aptos' || c === 'sei' || c === 'near') return 'under $0.10 of gas';
  return 'a few dollars of gas';
}

/** The weekly cadence line, rotated by the protocol's slug so no two rows read identically. */
function cadenceFor(p: SnapshotProtocol): string {
  const variants = [
    `Make one qualifying action each week on ${p.name}, such as a deposit, a borrow, a swap or a vote, so your wallet shows up in weekly activity snapshots.`,
    `Return once a week and do one real action on ${p.name}, a deposit, a trade or a vote, so your address builds a steady activity trail.`,
    `Do one genuine action a week on ${p.name}, topping up, rebalancing or voting, so the protocol's snapshots keep seeing your wallet.`,
  ];
  let h = 0;
  for (const ch of p.slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return variants[h % variants.length]!;
}

/** The category's core farming action, in the words a farmer can follow. */
function coreAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} of USDC to ${n} on ${chain}, then borrow a small amount against it and repay it once, so the position shows both sides of the market.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return `Deposit $${capital} of USDC as margin on ${n} on ${chain}, open one small hedged trade, and close it after a day.`;
  }
  if (c.includes('dex') || c.includes('liquidity manager')) {
    return `Provide $${capital} of liquidity to ${n}'s deepest pool on ${chain} and route one swap through it each week.`;
  }
  if (c.includes('basis')) {
    return `Deposit $${capital} into ${n}'s basis vault on ${chain} and hold the receipt token, keeping the delta-neutral position open.`;
  }
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator')) {
    return `Deposit $${capital} into a ${n} vault on ${chain} and keep the vault shares, letting the curator allocate them.`;
  }
  if (c.includes('bridge')) {
    return `Bridge $${capital} of USDC to ${chain} through ${n}, then use the bridged funds in an app on the destination chain.`;
  }
  if (c.includes('staking') || c.includes('restak')) {
    return `Stake $${capital} of the chain's staking asset through ${n} on ${chain} and keep the receipt token in the same wallet.`;
  }
  if (c.includes('rwa')) {
    return `Mint $${capital} of ${n}'s yield-bearing asset on ${chain} and hold it so the yield accrues to your wallet.`;
  }
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) {
    return `Deposit $${capital} of USDC into ${n}'s highest-TVL vault on ${chain} and leave it compounding.`;
  }
  if (c.includes('prediction')) {
    return `Fund $${capital} on ${n} and take one small position in an active market, then settle it when the market resolves.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${n} on ${chain} and keep the policy active through its term.`;
  }
  if (c.includes('stable')) {
    return `Mint or deposit $${capital} of the stable asset through ${n} on ${chain} and hold it in the protocol's vault.`;
  }
  if (c.includes('chain')) {
    return `Bridge $${capital} onto ${n}'s chain and use two of its native apps, a swap and a deposit, in the same week.`;
  }
  if (c.includes('payment') || c.includes('card')) {
    return `Fund $${capital} through ${n} on ${chain} and make one real payment with it, keeping the receipt.`;
  }
  if (c.includes('indexes') || c.includes('index')) {
    return `Buy $${capital} of ${n}'s index token on ${chain} and hold it through one rebalance.`;
  }
  if (c.includes('privacy')) {
    return `Deposit $${capital} through ${n} on ${chain} and complete one private transfer, keeping the proof.`;
  }
  return `Deposit $${capital} of USDC into ${n} on ${chain} and keep the position open.`;
}

/** The second action: a second chain when the protocol runs on one, else a points check. */
function secondAction(p: SnapshotProtocol, capital: number, chain2: string | null): string {
  if (chain2 !== null) {
    return `Repeat the core position on ${chain2} with half the capital, so your wallet is active on two of ${p.name}'s chains.`;
  }
  return `Check ${p.name}'s own points or rewards page and confirm your wallet's activity is being counted before the next snapshot.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time,
 * derived from the protocol's own record (category, chains, TVL, age), never
 * from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const chain2 = secondChain(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm with ${p.name} on ${chain}, and keep its seed phrase offline.`,
      cost: `${gas} for the first transaction`,
      time: '5 minutes',
    },
    {
      text: coreAction(p, capital, chain),
      cost: `$${capital} of capital and ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: secondAction(p, capital, chain2),
      cost: chain2 !== null ? `about $${Math.round(capital / 2)} of capital and ${gasFor(chain2)}` : 'no fee to check',
      time: chain2 !== null ? '10 minutes' : '5 minutes',
    },
    {
      text: cadenceFor(p),
      cost: `about ${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the ${p.name} position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page and claim only from the link it publishes; write the wallet, the dates and every transaction in a farm log.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
  ];
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

// ---------------------------------------------------------------- board

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const anchors = peerAnchors(snapshot.protocols, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: the strongest pre-token protocols below the floor by TVL.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, anchors, model);
    const signal = signalScore(p, v.age);
    return { p, v, signal };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    listed_at: s.p.listed_at,
    age_days: s.v.age,
    token_status: 'pre-token',
    watchlist: snapshot.watchlist.includes(s.p.slug),
    flag: rowFlag(s.p),
    implied_value_usd: s.v.implied,
    signal: s.signal,
    signal_band: signalBand(s.signal),
    model: {
      peer_multiple: s.v.peer.multiple,
      peer_count: s.v.peer.peers,
      category_median: s.v.peer.categoryMedian,
      global_median: anchors.global,
      growth_pct: round4(s.v.growthPct),
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      chain_multiplier: round4(s.v.chainMult),
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's separate Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      change_7d: p.change_7d,
      mcap_tvl: round4(p.tvl_usd > 0 ? p.mcap_usd! / p.tvl_usd : 0),
    }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const anchors = peerAnchors(snapshot.protocols, model);
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const peers = [...anchors.byCategory.values()].sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_median: anchors.global,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !r.watchlist).length,
    live_size: live.length,
    total_implied_usd: board.reduce((n, r) => n + r.implied_value_usd, 0),
    peers,
    rows: board,
    live,
  };
  return { board, radar };
}

// ---------------------------------------------------------------- input

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

// ---------------------------------------------------------------- gate

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'the board repeats a slug';
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (typeof r.name !== 'string' || r.name.length === 0) return `${r.slug} has no name`;
    if (typeof r.slug !== 'string' || r.slug.length === 0 || r.slug.length > 128 || /\s/.test(r.slug)) return `bad slug ${JSON.stringify(r.slug)}`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
