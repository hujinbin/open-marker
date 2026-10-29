import { useCallback, useEffect, useRef, useState } from "react";
import ImageCanvas from "./ImageCanvas";
import TextEntities from "./TextEntities";
export default function Editor({ sample, project, editable, busy: externalBusy, onSave, onDirtyChange, userId }) {
  const [history, setHistory] = useState({ past: [], value: sample.annotation, future: [] });
  const { value } = history;
  const [label, setLabel] = useState(project.labels[0]), [dimensions, setDimensions] = useState(null);
  const [saved, setSaved] = useState(JSON.stringify(sample.annotation));
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(""), [auto, setAuto] = useState(true);
  const key = `marker:draft:${userId}:${project._id}:${sample.id}`;
  const [recovery, setRecovery] = useState(() => { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } });
  const inFlight = useRef(false), latest = useRef(null);
  const baseRevision = useRef(sample.revision);
  const busy = externalBusy || saving, dirty = JSON.stringify(value) !== saved;
  const onReady = useCallback(d => setDimensions(d), []);
  useEffect(() => { onDirtyChange(dirty || saving); }, [dirty, saving, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    try { sessionStorage.setItem(key, JSON.stringify({ value, revision: sample.revision })); } catch { /* 浏览器禁用存储时仍保留内存草稿和离开提醒。 */ }
  }, [key, value, dirty, sample.revision]);
  function change(next) { setHistory(h => ({ past: [...h.past, h.value].slice(-100), value: next, future: [] })); setSaveError(""); }
  function undo() { setHistory(h => h.past.length ? { past: h.past.slice(0, -1), value: h.past.at(-1), future: [h.value, ...h.future] } : h); }
  function redo() { setHistory(h => h.future.length ? { past: [...h.past, h.value], value: h.future[0], future: h.future.slice(1) } : h); }
  async function save(action) {
    if (inFlight.current || !editable || (project.type === "image" && !dimensions)) return;
    inFlight.current = true; setSaving(true); setSaveError("");
    try {
      const result = await onSave(action, value, { ...dimensions, revision: baseRevision.current });
      baseRevision.current = result.revision;
      const persisted = result.annotation || value;
      // 服务端会规范化字段顺序和标注内容，成功后同步当前值，避免误判脏状态并反复自动保存。
      setHistory(h => action === "adoptPrediction"
        ? { past: [], value: persisted, future: [] }
        : h.value === value ? { ...h, value: persisted } : h);
      setSaved(JSON.stringify(persisted));
      try { sessionStorage.removeItem(key); } catch { /* 不影响已确认的服务端保存结果。 */ }
      setRecovery(null);
    } catch (e) { setSaveError(e.message); }
    finally { inFlight.current = false; setSaving(false); }
  }
  latest.current = { save, undo, redo, busy, editable };
  useEffect(() => {
    const press = e => {
      const c = latest.current;
      if (!c.editable || c.busy || !(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "s") { e.preventDefault(); c.save("save"); }
      if (e.key.toLowerCase() === "z" && !["TEXTAREA", "INPUT"].includes(e.target.tagName)) { e.preventDefault(); if (e.shiftKey) c.redo(); else c.undo(); }
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, []);
  useEffect(() => {
    if (!auto || !dirty || !editable || busy || saveError || recovery || (project.type === "image" && !dimensions)) return;
    const timer = setTimeout(() => latest.current.save("save"), 1500);
    return () => clearTimeout(timer);
  }, [auto, dirty, editable, busy, saveError, recovery, dimensions, project.type, value]);
  return <div className="editor">
    <div className="editor-canvas">
      {project.instructions && <details className="instructions"><summary>查看标注规范</summary><p>{project.instructions}</p></details>}
      <div className="toolbar"><button disabled={!editable || busy || !history.past.length} onClick={undo}>撤销</button><button disabled={!editable || busy || !history.future.length} onClick={redo}>重做</button><small>Ctrl+S 保存 · Ctrl+Z 撤销</small></div>
      {project.type === "text" ? <article className="sample-text">{sample.content}</article> : project.type === "ner" ? <TextEntities content={sample.content} value={value} label={label} disabled={!editable || busy} onChange={change} /> : <ImageCanvas sample={sample} project={project} value={value} label={label} disabled={!editable || busy} onChange={change} onReady={onReady} />}
    </div>
    <aside className="label-panel"><h3>标注结果</h3>
      <p role="status" className={`save-state ${saveError ? "failed" : ""}`}>{saving ? "保存中…" : saveError ? "保存失败 · 修改已保留" : dirty ? "未保存" : "已保存"}</p>
      {saveError && <p role="alert" className="error">{saveError}。请重试；冲突时可复制当前草稿后重新加载。<button onClick={() => navigator.clipboard.writeText(JSON.stringify(value)).catch(() => setSaveError("剪贴板不可用，请使用下载草稿"))}>复制草稿</button><button onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `${sample.id}-draft.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>下载草稿</button></p>}
      {recovery && editable && <div className="feedback"><p>发现此账号在当前浏览器会话的未保存草稿{recovery.revision !== sample.revision ? "（服务端版本已变化，请核对后再保存）" : ""}。</p><button onClick={() => { change(recovery.value); setRecovery(null); }}>恢复草稿</button><button onClick={() => { sessionStorage.removeItem(key); setRecovery(null); }}>丢弃旧草稿</button></div>}
      {sample.prediction && !sample.annotator && <div className="feedback"><b>AI 预测 · {Math.round(sample.prediction.confidence * 100)}%</b><p>{sample.prediction.model} / {sample.prediction.version}</p><details><summary>查看预测内容</summary><pre>{JSON.stringify(sample.prediction.annotation, null, 2)}</pre></details><button disabled={!editable || busy || dirty || !!recovery} onClick={() => save("adoptPrediction")}>采用预测为草稿</button></div>}
      {editable && <label className="check"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />自动保存（1.5 秒）</label>}
      <fieldset disabled={!editable || busy}>
        {project.type === "text" ? project.labels.map(l => <label className="check" key={l}><input type="checkbox" checked={value.labels.includes(l)} onChange={e => change({ labels: e.target.checked ? [...value.labels, l] : value.labels.filter(x => x !== l) })} />{l}</label>) : <>
          <label>当前标签<select value={label} onChange={e => setLabel(e.target.value)}>{project.labels.map(l => <option key={l}>{l}</option>)}</select></label>
          {(project.type === "ner" ? value.entities : value.boxes).map((b, i) => <div className="box-item" key={i}><span>{i+1}. {b.label}{project.type === "ner" && <small> · {b.text} [{b.start}, {b.end})</small>}</span><button type="button" onClick={() => { const field = project.type === "ner" ? "entities" : "boxes"; change({ ...value, [field]: value[field].filter((_, j) => i !== j) }); }}>删除</button></div>)}
          <label className="check"><input type="checkbox" checked={!!value.empty} disabled={(value.entities || value.boxes).length > 0} onChange={e => change({ ...value, empty: e.target.checked })} />{project.type === "ner" ? "确认没有实体" : "确认没有目标"}</label>
        </>}
      </fieldset>
      {sample.feedback && <p className="feedback">修改意见：{sample.feedback}</p>}
      {editable && <div className="stack"><button disabled={busy || (project.type === "image" && !dimensions)} onClick={() => save("save")}>{saveError ? "重试保存" : "保存草稿"}</button><button className="primary" disabled={busy || (project.type === "image" && !dimensions)} onClick={() => save("submit")}>提交审核 →</button></div>}
      <small>提交后只读；驳回后可修改。草稿仅在本浏览器会话内恢复。</small>
    </aside>
  </div>;
}
