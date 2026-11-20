import { readFile } from 'node:fs/promises';
import { test, expect, button, label, login, signIn, nav, createProject, importText, shot } from './workspace.js';

test('空项目与异常恢复 → 导入 → 标注 → 审核 → 重复下载同一份 JSONL', async ({ page, errors }, info) => {
  await login(page);
  const name = await createProject(page, '空项目闭环', '正向,负向');
  await nav(page, '标注任务');
  const empty = page.getByRole('heading', { name: '项目还没有数据' });
  const links = page.locator('.sidebar nav a');
  const alert = page.getByRole('alert');
  await expect(empty).toBeVisible();
  await expect(links).toHaveCount(7);
  const tasks = page.url();
  const id = tasks.split('/').at(-1);
  const details = new RegExp('/api/annotation/projects/' + id + '(?:\\?.*)?$');
  const samples = new RegExp('/api/annotation/projects/' + id + '/samples(?:\\?.*)?$');
  const list = /\/api\/annotation\/projects(?:\?.*)?$/;
  const response = page.waitForResponse(details);
  await page.reload();
  const { data } = await (await response).json();
  expect(data.storageVersion).toBe(2);
  expect(data).not.toHaveProperty('samples');
  await expect(empty).toBeVisible();
  await shot(page, info, 'empty-project.png');

  await page.route(samples, r => r.fulfill({ json: { code: 200, data: { items: null, total: 0 } } }));
  await page.reload();
  await expect(page.getByRole('heading', { name: '任务加载失败' })).toBeVisible();
  await expect(empty).toHaveCount(0);
  await expect(links).toHaveCount(7);
  await shot(page, info, 'invalid-samples.png');
  await page.unroute(samples);
  await button(page, '重试加载任务').click();
  await expect(empty).toBeVisible();

  await page.route(details, async r => {
    const payload = await (await r.fetch()).json();
    payload.data.labels = null;
    await r.fulfill({ json: payload });
  });
  await page.reload();
  await expect(alert).toContainText('数据加载不完整');
  await expect(links).toHaveCount(7);
  await page.unroute(details);
  await button(page, '重新加载', true).click();
  await expect(empty).toBeVisible();

  await page.route(details, r => r.fulfill({ status: 502, contentType: 'text/html', body: '<h1>private-upstream-error</h1>' }));
  await page.reload();
  await expect(alert).toContainText('服务返回异常');
  await expect(page.getByText('private-upstream-error')).toHaveCount(0);
  await page.unroute(details);
  await button(page, '重新加载', true).click();
  await expect(empty).toBeVisible();

  await page.route(samples, r => r.abort('failed'));
  await page.reload();
  await expect(alert).toContainText('暂时无法连接服务');
  await page.unroute(samples);
  await button(page, '重试加载任务').click();
  await expect(empty).toBeVisible();
  await page.route(list, r => r.fulfill({ json: { code: 200, data: null } }));
  await page.goto('/#overview');
  await page.reload();
  await expect(alert).toContainText('数据加载不完整');
  await expect(page.locator('.metrics strong')).toHaveText(['—', '—', '—', '—']);
  await page.unroute(list);
  await button(page, '重新加载', true).click();
  await expect(button(page, name)).toBeVisible();
  await page.goto(tasks);
  await button(page, '前往导入数据').click();
  const content = '这款产品很好用。';
  await importText(page, '闭环验收数据', [content, '这条未审核，不应导出。']);
  const search = label(page, '搜索数据');
  await search.pressSequentially('这款产品', { delay: 100 });
  await expect(search).toHaveValue('这款产品');
  await expect(page.locator('.task-row')).toHaveCount(1);
  await search.fill('');
  await expect(page.locator('.task-row')).toHaveCount(2);
  await button(page, content).click();
  await label(page, '自动保存（1.5 秒）').uncheck();
  await label(page, '正向').check();
  await button(page, '保存草稿', true).click();
  await expect(page.locator('.save-state')).toHaveText('已保存');
  await page.reload();
  await button(page, content).click();
  await expect(label(page, '正向')).toBeChecked();
  await button(page, '提交审核').click();
  await nav(page, '审核质检');
  await button(page, content).click();
  await button(page, '审核通过', true).click();
  await expect(page.locator('.task-detail .status')).toHaveText('已通过');
  await nav(page, '数据导出');
  await button(page, '生成导出快照').click();
  await expect(button(page, '下载快照')).toHaveCount(1);
  async function download(filename) {
    const downloading = page.waitForEvent('download');
    await button(page, '下载快照').click();
    const output = info.outputPath(filename);
    await (await downloading).saveAs(output);
    return readFile(output, 'utf8');
  }
  const jsonl = await download('accepted-annotations.jsonl');
  const rows = jsonl.trim().split(/\r?\n/).map(line => JSON.parse(line));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ content, annotation: { labels: ['正向'] } });
  expect(await download('repeated.jsonl')).toBe(jsonl);
  await shot(page, info, 'accepted-export.png');

  if (info.project.name === 'workspace') {
    // 只替换开发服务器返回的组件，不改应用源码、数据库或生产构建。
    for (const component of ['Editor', 'App']) {
      const pattern = '**/src/' + component + '.jsx*';
      const message = '验收用' + component + '故障';
      await page.route(pattern, r => r.fulfill({ contentType: 'application/javascript', body: 'export default function Fault(){throw new Error(' + JSON.stringify(message) + ')}' }));
      if (component === 'Editor') await page.goto(tasks);
      await page.reload();
      if (component === 'Editor') await button(page, content).click();
      const heading = component === 'Editor' ? '此区域暂时无法显示' : '工作区暂时无法显示';
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await expect(page.getByText(message, { exact: true })).toHaveCount(0);
      await page.unroute(pattern);
      if (component === 'Editor') {
        await expect(links).toHaveCount(7);
        await shot(page, info, 'component-recovery.png');
        await nav(page, '项目成员');
        await expect(page.getByRole('heading', { name: '项目成员', exact: true })).toBeVisible();
      } else {
        await nav(page, '返回项目总览');
        await expect(page.getByRole('heading', { name: '项目总览', exact: true })).toBeVisible();
      }
      // 除这个明确注入的异常外，页面错误一律由测试夹具报告。
      for (let i = errors.length - 1; i >= 0; i--) if (errors[i] === message) errors.splice(i, 1);
    }
  }
  await page.route(samples, r => r.fulfill({ status: 401, json: { code: 401, msg: '请重新登录' } }));
  await page.goto(tasks);
  await page.reload();
  await expect(button(page, '登录工作区')).toBeVisible();
  await page.unroute(samples);
  await signIn(page);
  await expect(page.locator('.task-row')).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, info, 'recovered-mobile.png');
});
