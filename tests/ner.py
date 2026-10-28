"""实体选择与中文 emoji 下标的浏览器验收。"""
import time
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1500, "height": 1000})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://127.0.0.1:5189")
    page.wait_for_load_state("networkidle")
    page.get_by_label("手机号").fill("13900001234")
    page.get_by_label("密码", exact=True).fill("MarkerTest123!")
    page.get_by_role("button", name="登录工作区").click()
    page.get_by_role("button", name="新建项目").click()
    page.get_by_label("项目名称").fill("实体浏览器-" + str(int(time.time())))
    page.get_by_label("标注类型").select_option("ner")
    page.get_by_label("标签集").fill("地点,符号")
    page.get_by_role("button", name="确认保存").click()
    page.get_by_role("button", name="导入数据", exact=True).click()
    page.get_by_label("数据集名称").fill("中文样本")
    page.get_by_label("文本内容", exact=True).fill("我在北京😀")
    page.once("dialog", lambda d: d.accept())
    page.get_by_role("button", name="确认保存").click()
    page.get_by_role("button", name="关闭", exact=True).click()
    page.get_by_role("link", name="标注任务").click()
    page.get_by_role("button", name="我在北京").click()
    page.get_by_label("自动保存（1.5 秒）").uncheck()
    def select(start, end):
        page.locator(".entity-text").evaluate("""(el, [start,end]) => {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          const range = document.createRange(); let n, offset = 0, begun = false;
          while ((n = walker.nextNode())) {
            if (!begun && start <= offset + n.length) { range.setStart(n, start-offset); begun=true; }
            if (begun && end <= offset+n.length) { range.setEnd(n, end-offset); break; }
            offset += n.length;
          }
          const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        }""", [start, end])
        page.locator(".entity-text").dispatch_event("mouseup")
    select(2, 4)
    page.get_by_role("button", name="标记所选文本", exact=True).click()
    expect(page.locator(".entity-text mark")).to_have_text("北京")
    page.get_by_label("当前标签").select_option("符号")
    select(4, 6)
    page.get_by_role("button", name="标记所选文本", exact=True).click()
    expect(page.locator(".entity-text mark")).to_have_count(2)
    page.get_by_role("button", name="保存草稿", exact=True).click()
    expect(page.get_by_role("status")).to_have_text("已保存")
    page.reload()
    page.get_by_role("button", name="我在北京").click()
    expect(page.locator(".entity-text mark")).to_have_count(2)
    expect(page.locator(".box-item").nth(1)).to_contain_text("[4, 6)")
    page.get_by_role("button", name="提交审核").click()
    page.get_by_role("button", name="审核通过", exact=True).click()
    expect(page.locator(".task-detail .status")).to_have_text("已通过")
    assert not errors, errors
    browser.close()
    print("PASS: NER 选区、中文/emoji 高亮、UTF-16 下标、保存回显、审核")
