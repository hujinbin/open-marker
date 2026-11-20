import { readdir, readFile } from 'node:fs/promises';
import { test, expect, button } from './workspace.js';

test('生产包不包含演示密码、入口或接口探测', async ({ page }) => {
  const dir = 'test-results/e2e-dist/assets';
  const files = (await readdir(dir)).filter(f => f.endsWith('.js'));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const js = await readFile(dir + '/' + file, 'utf8');
    for (const marker of ['MarkerDemo123!', 'annotation/demo-info', '一键进入体验'])
      expect(js.includes(marker), file + ' 不应含 ' + marker).toBe(false);
  }
  const demoRequests = [];
  page.on('request', r => { if (r.url().includes('demo-info')) demoRequests.push(r.url()); });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(button(page, '登录工作区')).toBeVisible();
  await expect(page.getByRole('region', { name: '本地体验账号' })).toHaveCount(0);
  expect(demoRequests).toEqual([]);
});
