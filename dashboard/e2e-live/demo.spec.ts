import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('actual Chrome → HTTPS Gateway HTTP2 → NestJS, fingerprint correlation and writes', async ({
  page,
}, testInfo) => {
  const network: { url: string; protocol: string; status: number }[] = [];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  cdp.on('Network.responseReceived', (event) => {
    if (event.response.url.startsWith('https://127.0.0.1:18444/'))
      network.push({
        url: event.response.url,
        protocol: event.response.protocol ?? 'unknown',
        status: event.response.status,
      });
  });
  const proxyCalls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes(':5173/api/live/courses'))
      proxyCalls.push(request.url());
  });
  await page.goto('/demo');
  // Never let this write test run against persistent demo data.
  const configuration = await (
    await page.request.get('/api/live/snapshot')
  ).json();
  expect(
    configuration.database,
    'Start runner with --test-db for write tests',
  ).toBe('dacn2_test');
  expect(configuration.persistent).toBe(false);
  await expect(
    page.getByText('TRỰC TIẾP · CHROME → GATEWAY', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Nhập môn lập trình/ }),
  ).toBeVisible();
  const code = 'UI_' + Date.now();
  await page.getByLabel('Mã người tham gia giả lập').fill(code);
  await page
    .getByRole('button', { name: 'Đăng ký qua Gateway', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('HTTP 201');
  await expect(page.getByRole('status')).toContainText('Mã yêu cầu:');
  await expect(page.getByRole('status')).toContainText('HTTP/2.0');
  await page.screenshot({
    path: testInfo.outputPath('live-registration.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Đăng ký qua Gateway', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('HTTP 409');
  await page.getByRole('button', { name: /Hệ cơ sở dữ liệu/ }).click();
  await page.getByLabel('Mã người tham gia giả lập').fill(code + 'A');
  await page
    .getByRole('button', { name: 'Đăng ký qua Gateway', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('HTTP 201');
  await page.getByLabel('Mã người tham gia giả lập').fill(code + 'B');
  await page
    .getByRole('button', { name: 'Đăng ký qua Gateway', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Môn học đã hết chỗ');
  await page.getByRole('link', { name: 'Tổng quan', exact: true }).click();
  await page.getByRole('tab', { name: 'Nhật ký yêu cầu' }).click();
  await expect(page.getByRole('table')).toContainText('201');
  await expect(page.getByRole('table')).toContainText('409');
  const snapshot = await (await page.request.get('/api/live/snapshot')).json();
  expect(snapshot.source).toBe('live');
  expect(snapshot.transport).toBe('direct-browser');
  const created = snapshot.events.find(
    (e: { status: number }) => e.status === 201,
  );
  expect(created.protocol).toBe('HTTP/2.0');
  const connection = snapshot.connections.find(
    (c: { connectionId: number }) => c.connectionId === created.connectionId,
  );
  expect(connection.ja4).toBeTruthy();
  expect(connection.h2.status).toBe('headers_observed');
  expect(
    snapshot.events.some((e: { status: number }) => e.status === 201),
  ).toBe(true);
  expect(snapshot.readyPods).toBeNull();
  expect(JSON.stringify(snapshot)).not.toContain(code);
  await page.getByRole('tab', { name: 'Dấu vân tay' }).click();
  await expect(page.getByRole('tabpanel')).toContainText(
    `Kết nối ${created.connectionId}`,
  );
  await expect(page.getByRole('tabpanel')).toContainText(connection.ja4);
  await expect(page.getByRole('tabpanel')).toContainText('headers_observed');
  await expect(page.getByRole('tabpanel')).toContainText('JA4_ro');
  await expect(page.getByRole('tabpanel')).toContainText('SETTINGS');
  expect(connection.ja4_r).toBeTruthy();
  expect(connection.ja4_o).toBeTruthy();
  expect(connection.ja4_ro).toBeTruthy();
  expect(connection.h2.settings.length).toBeGreaterThan(0);
  expect(connection.h2.text).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath('live-signals.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '12 feature dự kiến', exact: true })
    .click();
  await expect(page.locator('.feature-catalog > details')).toHaveCount(12);
  await page
    .locator('.feature-catalog summary')
    .filter({ hasText: 't_up' })
    .click();
  await expect(page.getByRole('tabpanel')).toContainText(
    'chưa có phép đo upstream riêng',
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.querySelector('.app-frame')!.scrollLeft === 0,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('live-fingerprints.png'),
    fullPage: true,
  });
  for (const width of [1920, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`features-${width}.png`),
      fullPage: true,
    });
  }
  const forbidden = await page.request.post(
    '/api/live/courses/999/registrations',
    { headers: { 'X-DACN2-UI': '1' }, data: { studentCode: 'NO' } },
  );
  expect(forbidden.status()).toBe(404);
  expect(proxyCalls).toEqual([]);
  expect(network.some((r) => r.status === 201 && r.protocol === 'h2')).toBe(
    true,
  );
  expect(
    network
      .filter((r) => !r.url.includes('health'))
      .every((r) => r.protocol === 'h2'),
  ).toBe(true);
  await testInfo.attach('direct-network-proof', {
    body: JSON.stringify({ network, created, connection }, null, 2),
    contentType: 'application/json',
  });
});
