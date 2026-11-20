import { test, expect, button, signIn, shot } from './workspace.js';

test('演示：一键登录、三种角色、示例图片与普通登录', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: '本地体验账号' })).toBeVisible();
  await shot(page, info, 'demo-login.png');
  await button(page, '一键进入体验').click();
  for (const name of ['示例 · 用户反馈分类', '示例 · 中文实体识别', '示例 · 几何目标框选'])
    await expect(button(page, name)).toBeVisible();
  await shot(page, info, 'demo-workspace.png');
  await button(page, '示例 · 几何目标框选').click();
  await button(page, '几何目标.png').first().click();
  await expect(page.getByAltText('待标注样本')).toBeVisible();
  await expect(page.locator('.box-item')).toHaveCount(2);
  await shot(page, info, 'demo-image.png');
  await button(page, '退出登录', true).click();
  for (const account of ['13900001235', '13900001236']) {
    await page.getByLabel('体验角色').selectOption(account);
    await button(page, '一键进入体验').click();
    await expect(page.locator('.task-detail')).toBeVisible();
    await button(page, '退出登录', true).click();
  }
  await signIn(page, 'MarkerDemo123!');
});
