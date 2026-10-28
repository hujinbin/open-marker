import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
export default function ExportPanel({ project, owner }) {
  const [records, setRecords] = useState([]), [format, setFormat] = useState("jsonl"), [dataset, setDataset] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useCallback(() => api(`annotation/projects/${project._id}/exports`).then(r => setRecords(r.data)).catch(e => setError(e.message)), [project._id]);
  useEffect(() => { if (owner) load(); }, [load, owner]);
  async function download(record) {
    setBusy(true); setError("");
    try {
      const r = await fetch(`${import.meta.env.VITE_API_BASE || ""}/api/annotation/projects/${project._id}/exports/${record._id}`, { headers: { token: localStorage.getItem("token") || "" }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error((await r.json()).msg || "下载失败");
      const url = URL.createObjectURL(await r.blob()), a = document.createElement("a");
      a.href = url; a.download = `${project.name}-${record.format}-${record._id}.${record.extension}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <><span className="eyebrow">VERSIONED DELIVERY</span><h2>交付已审核的数据</h2><p>生成独立快照，可重复下载同一版本。COCO / YOLO 包含托管原图；外链图片请按清单自行准备。最多 10000 条、16 MB 标注及 64 MB 原图。</p>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="toolbar"><select aria-label="导出格式" value={format} onChange={e => setFormat(e.target.value)}><option value="jsonl">JSONL</option>{project.type === "image" ? <><option value="coco">COCO（ZIP）</option><option value="yolo">YOLO（ZIP）</option></> : <option value="csv">CSV</option>}</select>
      <select aria-label="导出数据集" value={dataset} onChange={e => setDataset(e.target.value)}><option value="">全部数据集</option>{project.datasets?.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select>
      <button className="primary" disabled={!owner || busy} onClick={async () => { setBusy(true); setError(""); try { await api(`annotation/projects/${project._id}/exports`, { format, datasetId: dataset }); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}>{busy ? "处理中…" : "生成导出快照"}</button>
    </div>{!owner && <p>仅项目负责人可以导出。</p>}
    {records.map(r => <div className="member" key={r._id}><span>{r.format.toUpperCase()} · {r.count} 条 · {Math.ceil(r.bytes / 1024)} KB<br /><small>{new Date(r.createdAt).toLocaleString()} · SHA256 {r.digest?.slice(0, 12)}</small></span><button disabled={busy} onClick={() => download(r)}>下载快照</button></div>)}
  </>;
}
