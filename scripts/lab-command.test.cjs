const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runCommand } = require('./lab-command.cjs');

const evidence = 'D:\\DACN2\\.local-backups\\m105g\\fake-low-ram';
const options = { label: 'Backend lab start', labReport: true, timeout: 5000 };
function failedReport(report, extra = '') {
  return ['-e', `console.log('Checking owned lab');console.log(JSON.stringify(${JSON.stringify(report)},null,2));console.log(${JSON.stringify('Evidence: ' + evidence)});${extra};process.exitCode=1;`];
}

test('backend refusal retains cause, measured RAM and evidence path', async () => {
  await assert.rejects(runCommand(process.execPath, failedReport({
    task: 'M1-05g', pass: false, freeBeforeGiB: 4.524677276611328,
    error: 'Fresh RAM below5GiB; cluster not started'
  }), options), error => {
    assert.match(error.message, /Fresh RAM below5GiB; cluster not started/);
    assert.match(error.message, /4\.52 GiB/);
    assert.ok(error.message.includes(evidence));
    assert.equal(error.labFailure.availableRamGiB, 4.524677276611328);
    assert.equal(error.labFailure.evidencePath, evidence);
    assert.equal(error.labFailure.exitCode, 1);
    return true;
  });
});

test('structured errors redact plaintext and base64 secrets without dumping stderr', async () => {
  const secret = 'synthetic-private-password';
  const encoded = Buffer.from(secret).toString('base64');
  await assert.rejects(runCommand(process.execPath, failedReport({
    pass: false, error: `Authentication failed ${secret} ${encoded}`
  }, `console.error('PRIVATE_STDERR_SHOULD_NOT_BE_FORWARDED')`), { ...options, secrets: [secret] }), error => {
    const output = error.message + JSON.stringify(error.labFailure);
    assert.match(output, /Authentication failed/);
    assert.match(output, /\[REDACTED\]/);
    assert.ok(!output.includes(secret) && !output.includes(encoded));
    assert.ok(!output.includes('PRIVATE_STDERR_SHOULD_NOT_BE_FORWARDED'));
    return true;
  });
});

test('a successful command preserves stdout and stdin', async () => {
  const output = await runCommand(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { timeout: 5000, input: 'ready\n' });
  assert.equal(output, 'ready');
});

test('unstructured failure keeps exit status without leaking raw child output', async () => {
  await assert.rejects(runCommand(process.execPath, ['-e', 'console.log("PRIVATE_RAW_OUTPUT");process.exitCode=3'], options), error => {
    assert.match(error.message, /exit=3/);
    assert.ok(!error.message.includes('PRIVATE_RAW_OUTPUT'));
    return true;
  });
});

test('timeout terminates the child and reports the deadline', async () => {
  await assert.rejects(runCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { ...options, timeout: 100 }), /timed out after 100ms/);
});

test('spawn failure reports its code and clears the deadline timer', async () => {
  await assert.rejects(runCommand('__dacn2_missing_test_command__', [], options), /could not start: ENOENT/);
});
