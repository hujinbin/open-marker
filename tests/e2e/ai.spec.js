import { test, expect, button, label, login, createProject, importText } from './workspace.js';

test('模拟模型：预测须显式采用，不覆盖人工标注', async ({ page }) => {
  await login(page);
  await createProject(page, 'AI协议', '正向,负向');
  await importText(page, '测试集', ['AI-ok']);
  await label(page, '选择本页').check();
  await page.locator('.ai-panel summary').click();
  page.once('dialog', d => d.accept());
  await button(page, '预标注选中任务（1）').click();
  await expect(page.locator('.job b').first()).toContainText('已完成', { timeout: 15000 });
  await button(page, '刷新预测和任务').click();
  await button(page, 'AI-ok').click();
  await expect(label(page, '正向')).not.toBeChecked();
  await button(page, '采用预测为草稿', true).click();
  await expect(label(page, '正向')).toBeChecked();
  await expect(page.locator('.task-detail .status')).toHaveText('标注中');
  await expect(page.locator('.save-state')).toHaveText('已保存');
  await page.reload();
  await button(page, 'AI-ok').click();
  await expect(label(page, '正向')).toBeChecked();
});
