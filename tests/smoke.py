"""在独立测试后端上验收前端；不访问业务数据库。"""
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get("MARKER_TEST_URL", "http://127.0.0.1:5189")
with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base)
    page.wait_for_load_state("networkidle")
    print("登录页按钮:", page.get_by_role("button").all_text_contents())
    page.get_by_label("手机号").fill("13900001234")
    page.get_by_label("密码", exact=True).fill("MarkerTest123!")
    page.get_by_role("button", name="登录工作区").click()
    expect(page.get_by_role("button", name="新建项目")).to_be_visible()
    page.get_by_role("button", name="新建项目").click()
    page.get_by_label("项目名称").fill("浏览器验收-" + str(int(time.time())))
    page.get_by_label("标签集").fill("正向,负向")
    page.get_by_role("button", name="确认保存").click()
    page.get_by_role("button", name="导入数据", exact=True).click()
    page.get_by_label("数据集名称").fill("验收数据")
    page.get_by_label("文本内容", exact=True).fill("第一条文本\n第二条文本\n第三条文本")
    page.once("dialog", lambda d: d.accept())
    page.get_by_role("button", name="确认保存").click()
    page.get_by_role("button", name="关闭", exact=True).click()
    page.get_by_role("link", name="标注任务").click()
    page.wait_for_load_state("networkidle")
    print("任务页按钮:", page.get_by_role("button").all_text_contents())
    page.get_by_role("button", name="第一条文本").click()
    page.get_by_label("自动保存（1.5 秒）").uncheck()
    page.get_by_label("正向", exact=True).check()
    expect(page.get_by_role("status")).to_have_text("未保存")
    page.once("dialog", lambda d: d.dismiss())
    page.get_by_role("button", name="下一条", exact=True).click()
    expect(page.get_by_label("正向", exact=True)).to_be_checked()
    page.once("dialog", lambda d: d.dismiss())
    page.get_by_role("link", name="数据集", exact=False).click()
    expect(page.get_by_label("正向", exact=True)).to_be_checked()
    project_url = page.url
    pattern = "**/api/annotation/projects/**"
    def fail_save(route):
        if route.request.method == "POST":
            route.fulfill(status=409, json={"code": 409, "msg": "测试版本冲突"})
        else:
            route.continue_()
    page.route(pattern, fail_save)
    page.get_by_role("button", name="保存草稿", exact=True).click()
    expect(page.get_by_role("status")).to_contain_text("保存失败")
    expect(page.get_by_label("正向", exact=True)).to_be_checked()
    page.unroute(pattern, fail_save)
    page.get_by_role("button", name="重试保存").click()
    expect(page.get_by_role("status")).to_have_text("已保存")
    page.reload()
    page.get_by_role("button", name="第一条文本").click()
    expect(page.get_by_label("正向", exact=True)).to_be_checked()
    page.get_by_role("button", name="提交审核").click()
    expect(page.locator(".sample-text")).to_have_text("第二条文本")
    assert page.url == project_url
    Path("test-results").mkdir(exist_ok=True)
    page.screenshot(path="test-results/continuous-labeling.png", full_page=True)
    assert not errors, errors
    browser.close()
    print("PASS: 登录、创建、导入、离开保护、409 保留、重试、回读、连续标注")
