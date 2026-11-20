import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { unzipSync } from 'fflate';
import { test, expect, button, label, login, createProject, nav, shot } from './workspace.js';

async function drag(page, x, y, toX, toY) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 8 });
  await page.mouse.up();
}

test('图片：真实上传、绘框与编辑、自动保存一次、审核和 COCO 交付', async ({ page }, info) => {
  const saves = [];
  page.on('request', r => {
    if (r.method() === 'POST' && r.url().includes('/samples/') && r.postDataJSON()?.action === 'save') saves.push(r.url());
  });
  await login(page);
  await createProject(page, '图片工作台', '目标', 'image');
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#b4cd96'; ctx.fillRect(0, 0, 400, 300);
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  await label(page, '选择图片').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: png });
  await button(page, '上传图片 / 重试失败项').click();
  await expect(page.getByText('fixture.png：上传成功')).toBeVisible();
  await nav(page, '标注任务');
  await button(page, 'fixture.png').click();
  await expect(page.getByAltText('待标注样本')).toBeVisible();
  const { x, y, width: w, height: h } = await page.locator('.image-stage').boundingBox();
  await drag(page, x + w * .15, y + h * .2, x + w * .5, y + h * .55);
  await expect(page.locator('.box-item')).toHaveCount(1);
  const state = page.locator('.save-state');
  await expect(state).toHaveText('已保存', { timeout: 10000 });
  // 等待超过两个自动保存周期，排除字段顺序变化导致的重复写入。
  await delay(3500);
  await expect(state).toHaveText('已保存');
  expect(saves).toHaveLength(1);
  await button(page, '选择 / 移动', true).click();
  const box = page.locator('.image-stage .box');
  const original = await box.getAttribute('style');
  const bounds = await box.boundingBox();
  const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
  await drag(page, cx, cy, cx + 25, cy + 20);
  await expect(box).not.toHaveAttribute('style', original);
  const moved = await box.getAttribute('style');
  const handle = await page.locator('.resize-handle').boundingBox();
  await drag(page, handle.x + 6, handle.y + 6, handle.x + 35, handle.y + 30);
  await expect(box).not.toHaveAttribute('style', moved);
  const resized = await box.getAttribute('style');
  await button(page, '撤销', true).click();
  await expect(box).toHaveAttribute('style', moved);
  await button(page, '重做', true).click();
  await expect(box).toHaveAttribute('style', resized);
  await button(page, '放大图片').click();
  await expect(page.getByText('125%', { exact: true })).toBeVisible();
  await button(page, '适应画布').click();
  await expect(state).toHaveText('已保存', { timeout: 10000 });
  await page.reload();
  await button(page, 'fixture.png').click();
  await expect(box).toHaveAttribute('style', resized);
  await button(page, '提交审核').click();
  await expect(page.locator('.task-detail .status')).toHaveText('待审核');
  await button(page, '审核通过', true).click();
  await expect(page.locator('.task-detail .status')).toHaveText('已通过');
  await shot(page, info, 'image-workspace.png');
  await nav(page, '数据导出');
  await label(page, '导出格式').selectOption('coco');
  await button(page, '生成导出快照').click();
  const downloading = page.waitForEvent('download');
  await button(page, '下载快照').first().click();
  const archive = info.outputPath('coco.zip');
  await (await downloading).saveAs(archive);
  const zip = unzipSync(await readFile(archive));
  const coco = JSON.parse(Buffer.from(zip['annotations.json']).toString('utf8'));
  expect(coco.images[0]).toMatchObject({ width: 400, height: 300 });
  expect(coco.annotations).toHaveLength(1);
  expect(coco.images[0].file_name).toMatch(/^images\/.+\.png$/);
  expect(Buffer.from(zip[coco.images[0].file_name]).equals(png)).toBe(true);
});
