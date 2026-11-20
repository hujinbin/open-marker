import { test as base, expect } from '@playwright/test';

export { expect };
export const test = base.extend({
  errors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, '页面不应抛出未预期的异常').toEqual([]);
  }, { auto: true }],
});

export const button = (page, name, exact = false) => page.getByRole('button', { name, exact });
export const label = (page, name) => page.getByLabel(name, { exact: true });
export const nav = (page, name) => page.getByRole('link', { name }).click();
export const shot = (page, info, file) => page.screenshot({ path: info.outputPath(file), fullPage: true });
export async function signIn(page, password = 'MarkerTest123!') {
  await label(page, '手机号').fill('13900001234');
  await label(page, '密码').fill(password);
  await button(page, '登录工作区').click();
  await expect(button(page, '新建项目')).toBeVisible();
}
export async function login(page) {
  await page.goto('/');
  await signIn(page);
}
export async function createProject(page, prefix, labels, type = 'text') {
  const name = `${prefix}-${Date.now()}`;
  await button(page, '新建项目').click();
  await page.getByLabel('项目名称').fill(name);
  await page.getByLabel('标注类型').selectOption(type);
  await page.getByLabel('标签集').fill(labels);
  await button(page, '确认保存').click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  return name;
}
export async function importText(page, dataset, rows) {
  await button(page, '导入数据', true).click();
  await label(page, '数据集名称').fill(dataset);
  await label(page, '文本内容').fill(rows.join('\n'));
  page.once('dialog', dialog => dialog.accept());
  await button(page, '确认保存').click();
  await expect(page.getByRole('status')).toContainText(`成功导入 ${rows.length} 条`);
  await button(page, '关闭', true).click();
  await nav(page, '标注任务');
  await expect(page.locator('.task-row')).toHaveCount(rows.length);
}
