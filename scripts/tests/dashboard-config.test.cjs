const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadLiveConfig } = require('../lib/dashboard-config.cjs');
const parse = require('../../backend/node_modules/dotenv').parse;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dacn2-config-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'backend'));
  fs.mkdirSync(path.join(root, 'gateway/.team-tls'), { recursive: true });
  for (const dir of ['gateway', 'gateway/.team-tls'])
    for (const name of ['cert.pem', 'key.pem']) fs.writeFileSync(path.join(root, dir, name), 'fixture');
  fs.writeFileSync(path.join(root, 'backend/.env'), 'DB_HOST=127.0.0.1\nDB_PORT=5432\nDB_USER=dacn2_app\nDB_PASSWORD=native-test-password\n');
  fs.writeFileSync(path.join(root, '.env.team'), 'TEAM_APP_PASSWORD=team-test-password\nTEAM_TLS_DIR=./gateway/.team-tls\n');
  return root;
}

test('new checkout uses team DB/cert without needing or changing backend env', t => {
  const root = fixture(t);
  fs.unlinkSync(path.join(root, 'backend/.env'));
  const { env, tlsDir } = loadLiveConfig(root, true, parse);
  assert.equal(env.DB_PORT, '15433');
  assert.equal(env.DB_HOST, '127.0.0.1');
  assert.equal(env.DB_PASSWORD, 'team-test-password');
  assert.equal(tlsDir, path.join(root, 'gateway/.team-tls'));
  assert.equal(fs.existsSync(path.join(root, 'backend/.env')), false);
});

test('native config stays on native DB/certificate even if team env exists', t => {
  const { env, tlsDir } = loadLiveConfig(fixture(t), false, parse);
  assert.equal(env.DB_PORT, '5432');
  assert.equal(env.DB_PASSWORD, 'native-test-password');
  assert.equal(path.basename(tlsDir), 'gateway');
});

test('native rejects remote host or team port rather than silently switching DB', t => {
  const root = fixture(t);
  for (const text of ['DB_HOST=remote\nDB_PORT=5432', 'DB_HOST=127.0.0.1\nDB_PORT=15433']) {
    fs.writeFileSync(path.join(root, 'backend/.env'), `${text}\nDB_USER=dacn2_app\nDB_PASSWORD=fixture-password`);
    assert.throws(() => loadLiveConfig(root, false, parse), /mode-specific port/);
  }
});

test('missing env, placeholder password and partial cert pair fail clearly without leaking password', t => {
  const root = fixture(t);
  const file = path.join(root, '.env.team');
  fs.unlinkSync(file);
  assert.throws(() => loadLiveConfig(root, true, parse), /Missing .env.team/);
  fs.writeFileSync(file, 'TEAM_APP_PASSWORD=CHANGE_ME_APP');
  assert.throws(() => loadLiveConfig(root, true, parse), /password/);
  fs.writeFileSync(file, 'TEAM_APP_PASSWORD=team-test-password\nTEAM_TLS_DIR=./gateway/.team-tls');
  fs.unlinkSync(path.join(root, 'gateway/.team-tls/key.pem'));
  assert.throws(() => loadLiveConfig(root, true, parse), /Missing lab key.pem/);
});

test('legacy team setup keeps the existing gateway pair and rejects arbitrary TLS paths', t => {
  const root = fixture(t);
  const file = path.join(root, '.env.team');
  fs.writeFileSync(file, 'TEAM_APP_PASSWORD=team-test-password');
  assert.equal(loadLiveConfig(root, true, parse).tlsDir, path.join(root, 'gateway'));
  fs.writeFileSync(file, 'TEAM_APP_PASSWORD=team-test-password\nTEAM_TLS_DIR=../../other');
  assert.throws(() => loadLiveConfig(root, true, parse), /Unsupported TEAM_TLS_DIR/);
});
