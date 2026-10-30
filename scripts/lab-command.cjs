const path = require('node:path');
const { spawn } = require('node:child_process');

function labFailure(stdout, exitCode, redact) {
  const lines = stdout.trim().split(/\r?\n/);
  const evidenceIndex = lines.findLastIndex(line => line.startsWith('Evidence: '));
  const end = evidenceIndex < 0 ? lines.length : evidenceIndex;
  const failure = { exitCode };
  if (evidenceIndex >= 0) failure.evidencePath = redact(lines[evidenceIndex].slice('Evidence: '.length));
  for (let i = end - 1; i >= 0; i--) {
    if (!lines[i].startsWith('{')) continue;
    try {
      const report = JSON.parse(lines.slice(i, end).join('\n'));
      if (report.pass === false && typeof report.error === 'string') {
        failure.error = redact(report.error);
        if (typeof report.freeBeforeGiB === 'number' && Number.isFinite(report.freeBeforeGiB) && report.freeBeforeGiB >= 0) {
          failure.availableRamGiB = report.freeBeforeGiB;
        }
      }
      break;
    } catch { /* Missing/malformed report keeps the exit-status fallback. */ }
  }
  return failure;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, windowsHide: true });
    const label = options.label || path.basename(command);
    const redact = text => (options.secrets || []).filter(Boolean).reduce((value, secret) =>
      value.replaceAll(secret, '[REDACTED]').replaceAll(Buffer.from(secret).toString('base64'), '[REDACTED]'), text);
    const timeout = options.timeout || 30000;
    let stdout = '', timedOut = false;
    child.stdout.on('data', b => { stdout += b; });
    // Do not dump arbitrary stderr: it can contain command arguments or secrets.
    child.stderr.resume();
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.once('error', error => {
      clearTimeout(timer);
      reject(Error(redact(label + ' could not start: ' + error.code)));
    });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0 && !timedOut) { resolve(stdout.trim()); return; }
      const failure = options.labReport ? labFailure(stdout, code, redact) : null;
      let message = timedOut ? `${label} timed out after ${timeout}ms` :
        failure?.error ? `${label} failed: ${failure.error}` : `${label} exit=${code}`;
      if (failure?.availableRamGiB !== undefined) message += `; available RAM ${failure.availableRamGiB.toFixed(2)} GiB`;
      if (failure?.evidencePath) message += `; Evidence: ${failure.evidencePath}`;
      const error = Error(redact(message));
      if (failure) error.labFailure = failure;
      reject(error);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(options.input);
  });
}

module.exports = { runCommand };
