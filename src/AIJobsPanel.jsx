import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
const states = { queued: "排队中", running: "运行中", done: "已完成", partial: "部分失败", failed: "失败" };
export default function AIJobsPanel({ project, sampleIds, onRefresh }) {
  const [data, setData] = useState({ jobs: [], configured: false }), [error, setError] = useState(""), [busy, setBusy] = useState(false), [threshold, setThreshold] = useState("0.5");
  const load = useCallback(() => api(`annotation/projects/${project._id}/jobs`).then(r => setData(r.data)).catch(e => setError(e.message)), [project._id]);
  useEffect(() => { load(); }, [load]);
  const active = data.jobs.some(j => ["queued", "running"].includes(j.state));
  useEffect(() => { if (!active) return; const timer = setInterval(load, 2500); return () => clearInterval(timer); }, [active, load]);
  async function start(ids) {
    if (!confirm(`将 ${ids.length} 条原始样本发送给管理员配置的模型服务，生成待人工确认的预测。确认继续？`)) return;
    setBusy(true); setError("");
    try { await api(`annotation/projects/${project._id}/jobs`, { sampleIds: ids, threshold: Number(threshold), consent: true }); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <details className="panel ai-panel"><summary>AI 辅助预标注 · {data.configured ? "服务已配置" : "尚未配置模型服务"}</summary>
    <p>预测单独保存，仅处理尚未开始人工标注的样本；采用后仍须人工提交和审核。</p>
    {!data.configured && <p>请在后端设置 ANNOTATION_MODEL_URL，可选 ANNOTATION_MODEL_KEY。前端不会接收凭据。</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <div className="toolbar"><label>最低置信度<input type="number" min="0" max="1" step="0.05" value={threshold} onChange={e => setThreshold(e.target.value)} /></label><button disabled={busy || !data.configured || !sampleIds.length} onClick={() => start(sampleIds)}>预标注选中任务（{sampleIds.length}）</button><button onClick={() => { load(); onRefresh(); }}>刷新预测和任务</button></div>
    {data.jobs.map(j => <div className="job" key={j._id}><b>{states[j.state]} · {j.results.length}/{j.sampleIds.length}</b><small> {new Date(j.createdAt).toLocaleString()}</small><p>成功 {j.results.filter(r => r.state === "predicted").length} · 低置信度 {j.results.filter(r => r.state === "filtered").length} · 跳过 {j.results.filter(r => r.state === "skipped").length} · 失败 {j.results.filter(r => r.state === "failed").length}</p>{j.results.filter(r => r.state === "failed").map(r => <p key={r.id}>{r.id.slice(0, 10)}：{r.message}</p>)}{["failed", "partial"].includes(j.state) && <button disabled={busy} onClick={() => start(j.results.filter(r => r.state === "failed").map(r => r.id))}>重试失败任务</button>}</div>)}
  </details>;
}
