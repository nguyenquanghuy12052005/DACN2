const fs = require('node:fs');
const path = require('node:path');

// Only the explicit team mode may use the checkout's Compose database.
function loadLiveConfig(root, teamMode, parse) {
  const file = path.join(root, teamMode ? '.env.team' : 'backend/.env');
  if (!fs.existsSync(file))
    throw Error(teamMode
      ? 'Missing .env.team; run scripts/team-live.ps1 first.'
      : 'Missing backend/.env. On a new Windows machine run scripts/team-live.ps1.');
  const values = parse(fs.readFileSync(file));
  const env = teamMode ? {
    DB_HOST: '127.0.0.1', DB_PORT: '15433', DB_USER: 'dacn2_app',
    DB_NAME: 'dacn2', DB_PASSWORD: values.TEAM_APP_PASSWORD,
  } : values;
  if (env.DB_HOST !== '127.0.0.1' || env.DB_USER !== 'dacn2_app' ||
      env.DB_PORT !== (teamMode ? '15433' : '5432'))
    throw Error('Live DB must use dacn2_app on 127.0.0.1 and the mode-specific port (native 5432 / team 15433).');
  if (!env.DB_PASSWORD || env.DB_PASSWORD === 'CHANGE_ME' || env.DB_PASSWORD.startsWith('CHANGE_ME_'))
    throw Error('Missing local database password; do not use the example placeholder.');
  if (teamMode && values.TEAM_TLS_DIR && values.TEAM_TLS_DIR !== './gateway/.team-tls')
    throw Error('Unsupported TEAM_TLS_DIR; expected ./gateway/.team-tls or omitted for the legacy gateway pair.');
  const tlsDir = path.join(root, teamMode && values.TEAM_TLS_DIR ? 'gateway/.team-tls' : 'gateway');
  for (const name of ['cert.pem', 'key.pem']) {
    if (!fs.existsSync(path.join(tlsDir, name)))
      throw Error(`Missing lab ${name}; ${teamMode ? 'run scripts/team-live.ps1' : 'provision the native lab certificate'} first.`);
  }
  return { env, tlsDir };
}

module.exports = { loadLiveConfig };
