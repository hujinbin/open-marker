"""图片工作台真实接口验收，使用运行时生成的纯色 PNG。"""
import struct
import zlib
import time
import zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

def png():
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 400, 300, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress((b"\0" + bytes([180, 205, 150]) * 400) * 300)) + chunk(b"IEND", b"")

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1100})
    errors = []
    saves = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda request: saves.append(request.url) if request.method == "POST" and "/samples/" in request.url and request.post_data_json.get("action") == "save" else None)
    page.goto("http://127.0.0.1:5189")
    page.wait_for_load_state("networkidle")
    page.get_by_label("手机号").fill("13900001234")
    page.get_by_label("密码", exact=True).fill("MarkerTest123!")
    page.get_by_role("button", name="登录工作区").click()
    page.get_by_role("button", name="新建项目").click()
    page.get_by_label("项目名称").fill("图片浏览器-" + str(int(time.time())))
    page.get_by_label("标注类型").select_option("image")
    page.get_by_label("标签集").fill("目标")
    page.get_by_role("button", name="确认保存").click()
    page.get_by_label("选择图片").set_input_files({"name": "fixture.png", "mimeType": "image/png", "buffer": png()})
    page.get_by_role("button", name="上传图片 / 重试失败项").click()
    expect(page.get_by_text("fixture.png：上传成功")).to_be_visible()
    page.get_by_role("link", name="标注任务").click()
    page.get_by_role("button", name="fixture.png").click()
    page.wait_for_load_state("networkidle")
    print("图片工具:", page.locator(".canvas-tools").inner_text())
    stage = page.locator(".image-stage")
    expect(page.get_by_alt_text("待标注样本")).to_be_visible()
    box = stage.bounding_box()
    x, y, w, h = box["x"], box["y"], box["width"], box["height"]
    page.mouse.move(x+w*.15, y+h*.2)
    page.mouse.down()
    page.mouse.move(x+w*.5, y+h*.55, steps=8)
    page.mouse.up()
    expect(page.locator(".box-item")).to_have_count(1)
    expect(page.get_by_role("status")).to_have_text("已保存", timeout=10000)
    # 覆盖服务端调整框字段顺序后的脏状态回归：不能不断重复自动保存。
    page.wait_for_timeout(3500)
    expect(page.get_by_role("status")).to_have_text("已保存")
    assert len(saves) == 1, f"自动保存重复触发：{len(saves)} 次"
    page.get_by_role("button", name="选择 / 移动", exact=True).click()
    drawn = page.locator(".image-stage .box").bounding_box()
    page.mouse.move(drawn["x"]+drawn["width"]*.5, drawn["y"]+drawn["height"]*.5)
    page.mouse.down()
    page.mouse.move(drawn["x"]+drawn["width"]*.5+25, drawn["y"]+drawn["height"]*.5+20, steps=5)
    page.mouse.up()
    handle = page.locator(".resize-handle").bounding_box()
    page.mouse.move(handle["x"]+6, handle["y"]+6)
    page.mouse.down()
    page.mouse.move(handle["x"]+35, handle["y"]+30, steps=5)
    page.mouse.up()
    page.get_by_role("button", name="撤销", exact=True).click()
    page.get_by_role("button", name="重做", exact=True).click()
    page.get_by_role("button", name="放大图片").click()
    expect(page.get_by_text("125%", exact=True)).to_be_visible()
    page.get_by_role("button", name="适应画布").click()
    expect(page.get_by_role("status")).to_have_text("已保存", timeout=10000)
    before = page.locator(".image-stage .box").get_attribute("style")
    page.reload()
    page.get_by_role("button", name="fixture.png").click()
    expect(page.locator(".image-stage .box")).to_have_attribute("style", before)
    page.get_by_role("button", name="提交审核").click()
    expect(page.locator(".task-detail .status")).to_have_text("待审核", timeout=10000)
    page.get_by_role("button", name="审核通过", exact=True).click()
    expect(page.locator(".task-detail .status")).to_have_text("已通过")
    Path("test-results").mkdir(exist_ok=True)
    page.screenshot(path="test-results/image-workspace.png", full_page=True)
    page.get_by_role("link", name="数据导出").click()
    page.get_by_label("导出格式").select_option("coco")
    page.get_by_role("button", name="生成导出快照").click()
    with page.expect_download() as download:
        page.get_by_role("button", name="下载快照").first.click()
    download.value.save_as("test-results/coco.zip")
    with zipfile.ZipFile("test-results/coco.zip") as archive:
        assert "annotations.json" in archive.namelist()
        assert any(name.startswith("images/") and name.endswith(".png") for name in archive.namelist())
    assert not errors, errors
    browser.close()
    print("PASS: 上传、绘框、自动保存、移动、缩放、撤销重做、画布缩放、刷新回显、审核")
