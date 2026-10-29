"""本地演示入口验收：只读取示例项目，不改动体验样本。"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1100})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://127.0.0.1:5175")
    page.wait_for_load_state("networkidle")
    print("体验页按钮:", page.get_by_role("button").all_text_contents())
    expect(page.get_by_role("region", name="本地体验账号")).to_be_visible()
    Path("test-results").mkdir(exist_ok=True)
    page.screenshot(path="test-results/demo-login.png", full_page=True)
    page.get_by_role("button", name="一键进入体验").click()
    expect(page.locator(".project-card")).to_have_count(3)
    page.screenshot(path="test-results/demo-workspace.png", full_page=True)
    page.get_by_role("button", name="示例 · 几何目标框选").click()
    page.get_by_role("button", name="几何目标.png").first.click()
    expect(page.get_by_alt_text("待标注样本")).to_be_visible()
    expect(page.locator(".box-item")).to_have_count(2)
    page.screenshot(path="test-results/demo-image.png", full_page=True)
    page.get_by_role("button", name="退出登录", exact=True).click()
    for mobile in ["13900001235", "13900001236"]:
        page.get_by_label("体验角色").select_option(mobile)
        page.get_by_role("button", name="一键进入体验").click()
        expect(page.locator(".task-detail")).to_be_visible()
        page.get_by_role("button", name="退出登录", exact=True).click()
    page.get_by_label("手机号").fill("13900001234")
    page.get_by_label("密码", exact=True).fill("MarkerDemo123!")
    page.get_by_role("button", name="登录工作区").click()
    expect(page.get_by_role("button", name="退出登录")).to_be_visible()
    assert not errors, errors
    browser.close()
    print("PASS: 一键体验、三角色登录、普通密码登录、三类示例、托管图片和框回显")
