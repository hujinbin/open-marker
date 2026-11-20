const invalid = () => { throw new Error("数据加载不完整，请重新加载；若仍失败，请联系管理员检查服务版本。"); };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const string = value => typeof value === "string";
const count = value => Number.isSafeInteger(value) && value >= 0;
const list = (value, check) => {
  if (!Array.isArray(value) || !value.every(check)) invalid();
  return value;
};

// 只为协议允许缺省的集合提供默认值；必需数据损坏时明确报错，不能伪装成空项目。
export function readProject(value) {
  const storageVersion = value?.storageVersion === undefined ? 1 : value.storageVersion;
  if (!object(value) || !string(value._id) || !value._id || !string(value.name)
    || !string(value.ownerId) || !["text", "image", "ner"].includes(value.type)
    || !count(value.revision) || ![1, 2].includes(storageVersion)
    || ![value.total, value.approved, value.pending].every(count)) invalid();
  list(value.labels, string);
  if (!value.labels.length) invalid();
  list(value.members, m => object(m) && string(m.userId) && string(m.name) && ["annotator", "reviewer"].includes(m.role));
  const datasets = value.datasets === undefined ? [] : list(value.datasets, d => object(d) && string(d._id) && string(d.name) && count(d.total));
  if (value.labelDefinitions !== undefined) list(value.labelDefinitions, l => object(l) && count(l.id) && string(l.name));
  if (value.instructions !== undefined && !string(value.instructions)) invalid();
  return { ...value, storageVersion, datasets, samples: [] };
}

export function readProjects(value) {
  return list(value, object).map(readProject);
}

export function readAnnotation(value, type) {
  if (!object(value)) invalid();
  if (type === "text") list(value.labels, string);
  else if (type === "image") list(value.boxes, b => object(b) && string(b.label) && [b.x, b.y, b.width, b.height].every(Number.isFinite));
  else if (type === "ner") list(value.entities, e => object(e) && string(e.label) && string(e.text) && count(e.start) && count(e.end));
  else invalid();
  return value;
}

export function readSample(value, type) {
  if (!object(value) || !string(value.id) || !value.id || !string(value.content)
    || !string(value.dataset) || !string(value.assignee) || !count(value.revision)
    || !["todo", "labeling", "review", "approved", "rejected"].includes(value.status)) invalid();
  readAnnotation(value.annotation, type);
  if (value.feedback !== undefined && !string(value.feedback)) invalid();
  if (value.prediction != null && (!object(value.prediction) || !Number.isFinite(value.prediction.confidence)
    || !string(value.prediction.model) || !string(value.prediction.version))) invalid();
  return value;
}

export function readSamplePage(value, type) {
  if (!object(value) || !count(value.total)) invalid();
  const items = list(value.items, object).map(s => readSample(s, type));
  if (value.total < items.length) invalid();
  return { ...value, items };
}
