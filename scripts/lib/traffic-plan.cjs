'use strict';

const scenarios = {
  Normal: {},
  Flash_Crowd: {},
  Pure_L7_DDoS: {},
  Mixed_Traffic: {},
};
const GENERATOR_VERSION = 'traffic-behavior.v3';

function parseOptions(args) {
  const [scenario, ...flags] = args;
  if (!Object.hasOwn(scenarios, scenario)) throw Error('Choose Normal, Flash_Crowd, Pure_L7_DDoS or Mixed_Traffic');
  const options = { scenario, seconds: 20, seed: 1, engine: 'mixed' };
  const seen = new Set();
  for (const flag of flags) {
    if (flag.startsWith('--engine=')) {
      if(seen.has('engine') || !['chrome','node','mixed'].includes(flag.slice(9))) throw Error('Use --engine=chrome|node|mixed');
      seen.add('engine');options.engine=flag.slice(9);continue;
    }
    const match = /^--(seconds|rps|seed)=(\d+)$/.exec(flag);
    if (!match || seen.has(match[1])) throw Error('Use unique --seconds=N --rps=N --seed=N');
    seen.add(match[1]);
    options[match[1]] = Number(match[2]);
  }
  if (!Number.isSafeInteger(options.seconds) || options.seconds < 5 || options.seconds > 300) throw Error('Duration must be 5..300 seconds');
  if (options.rps !== undefined && (!Number.isSafeInteger(options.rps) || options.rps < 1 || options.rps > 20)) throw Error('RPS must be 1..20');
  if (!Number.isSafeInteger(options.seed) || options.seed < 1 || options.seed > 2147483647) throw Error('Seed must be 1..2147483647');
  const rng = seededRandom(options.seed);
  const population = 3 + Math.floor(rng() * 2);
  const bot = scenario === 'Pure_L7_DDoS' ? population : scenario === 'Mixed_Traffic' ? population - 2 : 0;
  // Both rate ranges overlap; crowd intent changes offered activity, not tool identity.
  const rps = Math.round((scenario === 'Normal' ? 2 : 4) + rng() * 8);
  return { ...options, rps: options.rps ?? rps, human: population - bot, bot };
}

function clientPlans(options) {
  const rng = seededRandom(options.seed);
  // Skip the population and rate draws already consumed in parseOptions.
  rng();
  rng();
  const profiles = [];
  const draw = (low, high) => low + rng() * (high - low);
  const population = options.human + options.bot;
  const nodeCount = 1;
  const humanNodes = options.human ? Math.min(Math.floor((options.human - 1) / 2), nodeCount) : 0;
  for (let index = 0; index < population; index++) {
    const role = index < options.human ? 'human' : 'bot';
    const node = index < humanNodes || index >= population - (nodeCount - humanNodes);
    profiles.push({
      role, engine: options.engine === 'mixed' ? (node ? 'node' : 'chrome') : options.engine,
      id: 'client-' + index,
      // Route/query/UA profiles are shared by both roles.
      style: ['browse', 'api', 'crawl'][Math.floor(rng() * 3)],
      static_probability: draw(.15, .65), query_probability: draw(.1, .8),
      cache_bust_probability: draw(.05, .65), ua_override_probability: draw(0, .3),
      pause_ms: role === 'human' ? draw(150, 2000) : draw(75, 1500),
      burst_probability: role === 'human' ? draw(.05, .55) : draw(.2, .8),
    });
  }
  return profiles;
}

function nextAction(client, courseIds, rng) {
  const detail = '/courses/' + courseIds[Math.floor(rng() * courseIds.length)];
  const assets = ['/lab/assets/app.css', '/lab/assets/app.js', '/lab/assets/icon.svg'];
  let route;
  if (client.last_route === '/lab/page' && rng() < .8) route = assets[Math.floor(rng() * assets.length)];
  else if (rng() < client.static_probability) route = assets[Math.floor(rng() * assets.length)];
  else if (rng() < (client.style === 'api' ? .1 : client.style === 'crawl' ? .65 : .4)) route = '/lab/page';
  else route = rng() < .5 ? '/courses' : detail;
  // Both roles can register and traverse the same endpoints.
  const registration = route === detail && rng() < .15;
  if (registration) route += '/registrations';
  else if (route.startsWith('/courses') && rng() < client.query_probability) {
    route += rng() < client.cache_bust_probability
      ? '?nonce=' + Math.floor(rng() * 1000000)
      : '?view=' + ['list', 'detail', 'available'][Math.floor(rng() * 3)];
  }
  client.last_route = route;
  return { route, registration, spoof: rng() < client.ua_override_probability };
}

function nextDelay(client, rng) {
  // Both legitimate bursts and paced automation occur; no role has zero-only IAT.
  const burst = rng() < client.burst_probability;
  return Math.round((burst ? 20 : client.pause_ms) * (.5 + rng()));
}

function scenarioOrder(seed) {
  const order = Object.keys(scenarios);
  const rng = seededRandom(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const other = Math.floor(rng() * (i + 1));
    [order[i], order[other]] = [order[other], order[i]];
  }
  return order;
}

function validateSession(lock, report, snapshot) {
  if (!/^\d+$/.test(lock.sessionId) || report.sessionId !== lock.sessionId ||
      snapshot.sessionId !== lock.sessionId || report.database !== 'dacn2_test' ||
      snapshot.database !== 'dacn2_test' || report.persistent !== false ||
      report.trafficLab !== true || report.cleanup === true || !report.readyAt) {
    throw Error('Start an active runner with --test-db --traffic-lab; main DB is refused');
  }
}

function seededRandom(seed) {
  let state = seed;
  // Mix nearby CLI seeds before sampling population/rates.
  for (let i = 0; i < 10; i++) state = state * 16807 % 2147483647;
  return () => {
    state = state * 16807 % 2147483647;
    return (state - 1) / 2147483646;
  };
}

module.exports = { scenarios, parseOptions, validateSession, seededRandom, clientPlans, nextAction, nextDelay, scenarioOrder, GENERATOR_VERSION };
