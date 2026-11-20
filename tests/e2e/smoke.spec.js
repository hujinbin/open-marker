import { test, expect, button, nav, label, login, createProject, importText, shot } from './workspace.js';

test('连续标注：离开保护、冲突后重试、回读与下一条', async ({ page }, info) => {
  await login(page);
  await createProject(page, '连续标注', '正向,负向');
  await importText(page, '验收数据', ['第一条文本', '第二条文本', '第三条文本']);
  // 连续标注跟随界面中的任务顺序；同批导入的行并不保证按粘贴顺序展示。
  const rows = page.locator('.task-row button b');
  const first = await rows.nth(0).innerText();
  const next = await rows.nth(1).innerText();
  await button(page, first).click();
  await label(page, '自动保存（1.5 秒）').uncheck();
  await label(page, '正向').check();
  const state = page.locator('.save-state');
  await expect(state).toHaveText('未保存');
  const taskURL = page.url();
  for (const leave of [() => button(page, '下一条', true).click(), () => nav(page, '数据集')]) {
    await Promise.all([page.waitForEvent('dialog').then(d => d.dismiss()), leave()]);
    await expect(page).toHaveURL(taskURL);
    await expect(label(page, '正向')).toBeChecked();
  }
  const path = '**/api/annotation/projects/*/samples/*';
  await page.route(path, r => r.fulfill({ status: 409, json: { code: 409, msg: '测试版本冲突' } }));
  await button(page, '保存草稿', true).click();
  await expect(state).toContainText('保存失败');
  await expect(label(page, '正向')).toBeChecked();
  await page.unroute(path);
  await button(page, '重试保存').click();
  await expect(state).toHaveText('已保存');
  await page.reload();
  await button(page, first).click();
  await expect(label(page, '正向')).toBeChecked();
  await button(page, '提交审核').click();
  await expect(page.locator('.sample-text')).toHaveText(next);
  expect(page.url()).toBe(taskURL);
  await shot(page, info, 'continuous-labeling.png');
});
