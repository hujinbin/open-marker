import { test, expect, button, label, login, createProject, importText } from './workspace.js';

async function selectSpan(page, start, end) {
  const text = page.locator('.entity-text');
  await text.evaluate((el, [from, to]) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let offset = 0, begun = false, node;
    while ((node = walker.nextNode())) {
      if (!begun && from <= offset + node.length) { range.setStart(node, from - offset); begun = true; }
      if (begun && to <= offset + node.length) { range.setEnd(node, to - offset); break; }
      offset += node.length;
    }
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, [start, end]);
  await text.dispatchEvent('mouseup');
  await button(page, '标记所选文本', true).click();
}

test('实体：中文与 emoji 的 UTF-16 范围保存、回读和审核', async ({ page }) => {
  await login(page);
  await createProject(page, '实体验收', '地点,符号', 'ner');
  await importText(page, '中文样本', ['我在北京😀']);
  await button(page, '我在北京').click();
  await label(page, '自动保存（1.5 秒）').uncheck();
  await selectSpan(page, 2, 4);
  await expect(page.locator('.entity-text mark')).toHaveText('北京');
  await page.getByLabel('当前标签').selectOption('符号');
  await selectSpan(page, 4, 6);
  await expect(page.locator('.entity-text mark')).toHaveText(['北京', '😀']);
  await button(page, '保存草稿', true).click();
  await expect(page.locator('.save-state')).toHaveText('已保存');
  await page.reload();
  await button(page, '我在北京').click();
  await expect(page.locator('.entity-text mark')).toHaveText(['北京', '😀']);
  await expect(page.locator('.box-item').nth(1)).toContainText('[4, 6)');
  await button(page, '提交审核').click();
  await button(page, '审核通过', true).click();
  await expect(page.locator('.task-detail .status')).toHaveText('已通过');
});
