import assert from "node:assert/strict";
import { test } from "node:test";
import { readProject, readProjects, readSamplePage } from "../src/annotationData.js";
import { api } from "../src/api.js";

const project = { _id: "project", name: "空项目", type: "text", ownerId: "owner", members: [], labels: ["正向"], revision: 0, storageVersion: 2, total: 0, approved: 0, pending: 0 };
const sample = { id: "sample", content: "文本", dataset: "数据集", assignee: "", status: "todo", revision: 0, annotation: { labels: [] } };

test("项目详情不带 samples 时可正常读取；不依赖旧版嵌入数组", () => {
  assert.deepEqual(readProject(project).samples, []);
  assert.deepEqual(readProject({ ...project, samples: null }).samples, []);
  assert.deepEqual(readProjects([]), []);
  assert.equal(readProject({ ...project, storageVersion: undefined }).storageVersion, 1);
});

test("必需字段损坏不能伪装成空项目", () => {
  for (const data of [null, [], {}, { ...project, labels: null }, { ...project, members: {} }, { ...project, total: undefined }, { ...project, datasets: [null] }, { ...project, storageVersion: 99 }]) {
    assert.throws(() => readProject(data), /数据加载不完整/);
  }
  assert.throws(() => readProjects(null));
  assert.throws(() => readProjects([null]));
});

test("样本页区分真正的空列表与异常数据", () => {
  assert.deepEqual(readSamplePage({ items: [], total: 0 }, "text").items, []);
  assert.equal(readSamplePage({ items: [sample], total: 1 }, "text").items.length, 1);
  for (const data of [null, {}, { items: null, total: 0 }, { items: {}, total: 0 }, { items: [null], total: 1 }, { items: [sample], total: 0 }, { items: [{ ...sample, annotation: null }], total: 1 }, { items: [{ ...sample, content: {} }], total: 1 }]) {
    assert.throws(() => readSamplePage(data, "text"), /数据加载不完整/);
  }
});

test("三种标注形状都校验，避免编辑器收到畸形结果", () => {
  for (const [type, annotation] of [["image", { boxes: [] }], ["ner", { entities: [] }]]) {
    assert.equal(readSamplePage({ items: [{ ...sample, annotation }], total: 1 }, type).total, 1);
    assert.throws(() => readSamplePage({ items: [{ ...sample, annotation: { boxes: [null], entities: [null] } }], total: 1 }, type));
  }
});

test("网络、非 JSON、空响应及服务异常返回可操作提示", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("internal-url"); });
  globalThis.localStorage = { getItem: () => "" };
  t.after(() => { delete globalThis.localStorage; });
  await assert.rejects(api("test"), /暂时无法连接服务/);
  for (const [body, status, message] of [["<html>error</html>", 502, /服务返回异常/], ["null", 200, /服务返回异常/], [JSON.stringify({ code: 500, msg: "private-stack" }), 500, /服务暂时不可用/]]) {
    globalThis.fetch = async () => new Response(body, { status });
    await assert.rejects(api("test"), message);
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 409, msg: "版本冲突" }), { status: 409 });
  await assert.rejects(api("test"), error => error.status === 409 && error.message === "版本冲突");
});
