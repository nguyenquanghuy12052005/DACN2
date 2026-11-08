const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawnSync } = require('node:child_process');

test('Windows PowerShell runs the real Live port preflight and distinguishes a free port from an occupied port',
  { skip: process.platform !== 'win32' }, async t => {
    const listener = net.createServer();
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
    const port = listener.address().port;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dacn2-preflight-'));
    t.after(() => { listener.close(); fs.rmSync(dir, { recursive: true, force: true }); });
    const source = fs.readFileSync(path.join(__dirname, '../team-live.ps1'), 'utf8');
    const begin = source.indexOf('# Refuse occupied UI ports;');
    const end = source.indexOf("foreach ($folder in @('backend', 'dashboard'))", begin);
    assert.ok(begin >= 0 && end > begin);
    const script = path.join(dir, 'check.ps1');
    fs.writeFileSync(script, source.slice(begin, end).replace('5173,13001,18444', String(port)));
    const run = () => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
      { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    const busy = run();
    assert.notEqual(busy.status, 0);
    assert.doesNotMatch(busy.stdout + busy.stderr, /SyntaxError/);
    await new Promise(resolve => listener.close(resolve));
    const free = run();
    assert.equal(free.status, 0, free.stdout + free.stderr);
  });
