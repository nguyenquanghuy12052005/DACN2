'use strict';

const scenarios = {
  Normal: { human: 1, bot: 0, rps: 2 },
  Flash_Crowd: { human: 4, bot: 0, rps: 8 },
  Pure_L7_DDoS: { human: 0, bot: 4, rps: 8 },
  Mixed_Traffic: { human: 2, bot: 2, rps: 8 },
};

function parseOptions(args) {
  const [scenario, ...flags] = args;
  if (!Object.hasOwn(scenarios, scenario)) throw Error('Choose Normal, Flash_Crowd, Pure_L7_DDoS or Mixed_Traffic');
  const options = { scenario, seconds: 20, seed: 1, ...scenarios[scenario] };
  const seen = new Set();
  for (const flag of flags) {
    const match = /^--(seconds|rps|seed)=(\d+)$/.exec(flag);
    if (!match || seen.has(match[1])) throw Error('Use unique --seconds=N --rps=N --seed=N');
    seen.add(match[1]);
    options[match[1]] = Number(match[2]);
  }
  if (!Number.isSafeInteger(options.seconds) || options.seconds < 5 || options.seconds > 300) throw Error('Duration must be 5..300 seconds');
  if (!Number.isSafeInteger(options.rps) || options.rps < 1 || options.rps > 20) throw Error('RPS must be 1..20');
  if (!Number.isSafeInteger(options.seed) || options.seed < 1 || options.seed > 2147483647) throw Error('Seed must be 1..2147483647');
  return options;
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
  return () => {
    state = state * 16807 % 2147483647;
    return (state - 1) / 2147483646;
  };
}

module.exports = { scenarios, parseOptions, validateSession, seededRandom };
