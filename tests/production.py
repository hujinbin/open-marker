"""检查生产构建没有演示账号入口和探测请求，需先启动 5190 预览服务。"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

bundle = "".join(file.read_text(encoding="utf-8") for file in Path("dist/assets").glob("*.js"))
for forbidden in ["MarkerDemo123!", "annotation/demo-info", "一键进入体验"]:
    assert forbidden not in bundle, forbidden
with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page()
    requests = []
    page.on("request", lambda request: requests.append(request.url))
    page.goto("http://127.0.0.1:5190")
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("button", name="登录工作区")).to_be_visible()
    expect(page.get_by_role("region", name="本地体验账号")).to_have_count(0)
    assert not any("demo-info" in url for url in requests)
    browser.close()
print("PASS: 生产包无演示密码、入口或接口探测，正常登录界面可用")
