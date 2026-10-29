# Open Marker

数据标注平台，基于 Vite + React 标准脚手架。前端在本仓库，后端在 `E:\gitee\jue`。

## 启动

使用 Node.js 22.12+ 或 24，运行 `npm ci`、`npm run dev`。构建运行 `npm run build`，检查运行 `npm run lint`。

## 直接体验（本机）

需要 Node.js 22.12+（本轮验证 v24.16.0）及本机 MongoDB（本轮验证 8.0.1）。演示地址固定为无账号密码的本机开发库连接，仅适用于隔离的本机环境；不要为体验而关闭生产数据库认证。首次检出需先安装两端依赖，两个终端分别执行：

```powershell
# 后端终端
cd E:\gitee\jue
npm ci --legacy-peer-deps
npm run annotation:demo
```

```powershell
# 前端终端
cd E:\github\open-marker
npm ci
npm run demo
```

打开 `http://127.0.0.1:5175`，点击“一键进入体验”。默认负责人账号 `13900001234`，密码 `MarkerDemo123!`；标注员 `13900001235`、审核员 `13900001236` 使用相同密码。角色下拉框可选择体验账号，也可在普通登录表单手动输入。

演示后端固定使用 `mongodb://127.0.0.1:27017/open_marker_demo`，监听 127.0.0.1:3110，图片与快照在后端 `var/annotation-demo`。首次初始化三个合成示例项目，重启保留修改，不重置已有密码，不写业务库。不提供公开访问或真实模型服务；不要上传敏感数据。生产环境禁止启动演示脚本，生产构建不包含体验入口。

### 连接普通后端

复制 `.env.example` 为 `.env.local`，设置 `API_PROXY_TARGET` 为本地 jue 后端地址（默认 `http://127.0.0.1:3000`）。后端按原项目方式启动，并保证 MongoDB 可用。生产部署时将 `/api` 反向代理到 jue，或构建前设置 `VITE_API_BASE`。路由使用 hash，刷新不需要额外的 history fallback 配置。

## 使用流程

1. 使用惊觉账号登录；新用户可以通过图形验证码注册。
2. 创建文本分类、图像检测或文本实体识别项目，设置标签集；在项目设置维护规范和禁止自审选项。
3. 在数据集页面粘贴内容，或导入 TXT / JSONL 文件。TXT 每行一条；JSONL 每行形如 `{"content":"待标注文本或图片地址"}`。支持预览、去重和逐行错误提示；图片项目可批量上传 PNG/JPEG。
4. 可按已注册手机号添加标注员、审核员，单条或批量分配/回收任务；标注员可领取未分配任务。
5. 文本支持多标签分类；图像支持矩形框移动/调整、画布缩放/平移；实体项目支持选区标记。支持自动保存、撤销重做、未保存离开保护和会话草稿恢复。
6. 审核员通过或填写修改意见驳回；驳回后标注员重新提交。
7. 项目负责人将已通过数据导出为 JSONL/CSV 或 COCO/YOLO ZIP，可按数据集筛选，并重复下载历史快照。图片框内部使用相对宽高的 0–1 比例，标准导出执行相应坐标转换。
8. 已通过样本可随机抽检并填写问题后返工；操作记录和人员工作量可查看。
9. 部署者配置可信模型后，负责人可生成预测，人工显式采用后再提交审核。演示环境不连接真实模型。

项目负责人可标注、审核、导出及归档恢复；标注员只能修改分配给自己的任务；审核员可审核当前项目。所有项目成员可查看项目数据。默认允许负责人自审，可在项目设置禁止。

## 当前范围

- v2 将项目、样本、数据集、审计、资源、导出和模型任务分开存储在 MongoDB；旧项目需要负责人显式迁移，原始数据保留。
- 文本/链接每批最多 500 条，而非每项目最多 500 条；每页默认 20 条，接口最多 100 条；项目列表最近 100 个。
- 单文本最多 20,000 字符；单张 PNG/JPEG 最多 5 MB、4000 万像素，图片存储目录必须持久化和备份。
- 样本独立版本控制；409 不覆盖服务端，保留草稿，可复制/下载后重新加载核对。浏览器草稿只保证当前会话内恢复。
- 导出最多 10000 条、16 MB 标注、64 MB 托管原图；外链图片不自动抓取。导出快照不是可回滚的数据集版本。
- NER 使用 UTF-16 半开区间，不支持重叠或嵌套实体。图片目前仅矩形框。
- AI 仅完成接口适配与本地协议验证。真实模型、音视频、3D、多边形/分割、多级审核、黄金题和主动学习不在本轮交付内。

## 验证

前端执行 `npm run build` 和 `npm run lint`。

后端在 jue 执行 `npm run test:annotation`，覆盖领域、导出格式和 HTTP 集成测试。后者强制使用本机 MongoDB 的临时 `annotation_test_*` 数据库，结束后仅清理自己的临时库和资源目录，不连接业务数据库。演示服务启动后可执行 `node scripts/test-annotation-demo.cjs` 验证账号、隔离和幂等初始化。

浏览器验收需要 Python 3.10+、Microsoft Edge 和 `tests/requirements.txt`。建议用独立环境：`python -m venv .venv`，然后 `.\.venv\Scripts\python.exe -m pip install -r tests/requirements.txt`。

1. 后端执行 `node scripts/test-annotation-api.cjs --serve`，完成 API 测试后在本机 3109 等待浏览器验收。
2. 前端另开终端执行 `$env:API_PROXY_TARGET='http://127.0.0.1:3109'; npm run dev -- --host 127.0.0.1 --port 5189 --strictPort`。
3. 前端执行 `.\.venv\Scripts\python.exe -X utf8 tests/run.py`，只需要临时测试服务 3109/5189。若同时启动了持久演示服务 3110/5175，可执行 `.\.venv\Scripts\python.exe -X utf8 tests/run.py --demo`，这是在完整临时套件前追加演示登录/只读展示测试，不是替代基础套件。截图写入忽略的 `test-results/`。
4. 验收结束调用 `Invoke-RestMethod -Method Post http://127.0.0.1:3109/api/test/shutdown`，让临时服务清理自己的数据库；再关闭 5189 的 Vite。此关闭接口仅存在于临时测试脚本。

生产隔离验收：构建后另开终端执行 `npm run preview -- --host 127.0.0.1 --port 5190 --strictPort`，再执行 `.\.venv\Scripts\python.exe -X utf8 tests/production.py`；验证无体验入口/密码/接口探测，完成后关闭预览进程。自动化账号只在专用演示库或临时测试库有效，不能在普通业务后端使用。

产品规格、API、验收清单和部署边界位于后端仓库的 `docs/data-annotation-platform/`，分别见 `product-features.md`、`api.md`、`implementation-checklist.md`、`operations.md`。
