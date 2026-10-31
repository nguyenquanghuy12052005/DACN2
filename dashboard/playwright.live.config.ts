import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { X509Certificate, createHash } from 'node:crypto';
const certificate = new X509Certificate(readFileSync('../gateway/cert.pem'));
const spki = createHash('sha256')
  .update(certificate.publicKey.export({ type: 'spki', format: 'der' }))
  .digest('base64');
export default defineConfig({
  testDir: './e2e-live',
  workers: 1,
  reporter: 'list',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
    headless: true,
    launchOptions: { args: [`--ignore-certificate-errors-spki-list=${spki}`] },
    viewport: { width: 1366, height: 768 },
  },
});
