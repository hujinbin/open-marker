import { test, expect, button, nav, label, login } from './workspace.js';

test('协作：分页、批量分配、抽检返工、成员与项目设置', async ({ page }) => {
  await login(page);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  async function api(path, data) {
    const r = await page.request.fetch('/api/annotation/projects' + path, {
      method: data ? 'POST' : 'GET', data, headers: { token },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.code).toBe(200);
    return body.data;
  }
  const project = await api('', { name: '协作验收-' + Date.now(), type: 'text', labels: ['正向'] });
  const root = '/' + project._id;
  await api(root + '/import', { dataset: '分页集', items: Array.from({ length: 25 }, (_, i) => '协作文本' + i) });
  const sample = (await api(root + '/samples')).items[0];
  const path = root + '/samples/' + sample.id;
  const submitted = await api(path, { action: 'submit', revision: sample.revision, annotation: { labels: ['正向'] } });
  await api(path, { action: 'approve', revision: submitted.revision });
  await page.goto('/#tasks/' + project._id);
  await expect(page.locator('.task-row')).toHaveCount(20);
  await button(page, '下一页', true).click();
  await expect(page.locator('.task-row')).toHaveCount(5);
  await label(page, '选择本页').check();
  await label(page, '批量分配人员').selectOption(project.ownerId);
  await button(page, '批量分配 / 回收', true).click();
  await expect(page.getByRole('status').filter({ hasText: '成功 5 条' })).toBeVisible();
  await button(page, '关闭', true).click();
  await nav(page, '审核质检');
  await button(page, '随机抽检已通过数据（20 条）', true).click();
  await button(page, sample.content).click();
  await label(page, '抽检问题').fill('边界不符合规范，请返工');
  await button(page, '抽检不通过，退回返工').click();
  await expect(page.locator('.task-detail .status')).toHaveText('已驳回');
  await nav(page, '项目成员');
  await label(page, '已注册手机号').fill('13900001235');
  await button(page, '保存成员', true).click();
  await expect(page.getByText('测试标注员', { exact: true })).toBeVisible();
  page.once('dialog', d => d.accept());
  await button(page, '移除成员', true).click();
  await expect(page.getByText('测试标注员', { exact: true })).toHaveCount(0);
  await nav(page, '项目设置');
  await label(page, '标注规范').fill('浏览器规范验证');
  await label(page, '禁止标注者审核自己的结果').check();
  const saved = page.waitForResponse(r => r.url().endsWith('/projects' + root) && r.request().method() === 'POST');
  await button(page, '保存项目设置', true).click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole('textbox', { name: '标注规范', exact: true })).toHaveValue('浏览器规范验证');
  await expect(label(page, '禁止标注者审核自己的结果')).toBeChecked();
  await nav(page, '数据导出');
  await expect(page.getByRole('heading', { name: '操作记录' })).toBeVisible();
});
