import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`three routes accessible at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const apiCalls: string[] = [];
    page.on('request', (req) => {
      if (
        /\/(courses|health|gateway\/health)(?:[/?]|$)/.test(
          new URL(req.url()).pathname,
        )
      )
        apiCalls.push(req.url());
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of ['/dashboard', '/demo', '/dashboard/simulation']) {
      await page.goto(route);
      await expect(
        page.getByText('DỮ LIỆU MẪU', { exact: true }),
      ).toBeVisible();
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
      const layout = await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        viewport: window.innerHeight,
      }));
      console.log(
        `${viewport.width} ${route}: page ${layout.height}px / viewport ${layout.viewport}px`,
      );
      if (viewport.width >= 1280)
        expect(layout.height).toBeLessThanOrEqual(viewport.height * 1.25);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(scan.violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(
          `${route.split('/').filter(Boolean).join('-')}.png`,
        ),
        fullPage: true,
      });
    }
    expect(apiCalls).toEqual([]);
    expect(errors).toEqual([]);
  });
}
test('navigation, keyboard, themes, motion and Live never invent data', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dashboard');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Đến nội dung chính' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Dùng giao diện tối' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByLabel('Cài đặt hiển thị').click();
  await page.getByLabel('Giảm chuyển động', { exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.getByLabel('Cài đặt hiển thị').click();
  await page.getByLabel('Nguồn dữ liệu').selectOption('live');
  await expect(page.getByText('4.37', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('TRỰC TIẾP · CHƯA KẾT NỐI', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Trang đăng ký', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Đăng ký qua Gateway', exact: true }),
  ).toBeDisabled();
  await page.getByRole('link', { name: 'Phòng mô phỏng', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Bắt đầu kịch bản' }),
  ).toBeDisabled();
});
