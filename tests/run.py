"""按模块顺序执行浏览器验收；调用方须先启动隔离测试后端和前端。"""
import argparse
import subprocess
import sys
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--demo", action="store_true", help="额外验收已启动的本机演示环境")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
modules = (["demo"] if args.demo else []) + ["smoke", "image", "collaboration", "ner", "ai"]
for module in modules:
    print(f"验收模块：{module}", flush=True)
    result = subprocess.run([sys.executable, "-X", "utf8", str(root / "tests" / f"{module}.py")], cwd=root)
    if result.returncode:
        sys.exit(result.returncode)
print("PASS: 所选浏览器验收模块全部通过")
