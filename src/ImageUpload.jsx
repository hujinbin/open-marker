import { useState } from "react";
import { api } from "./api";
export default function ImageUpload({ project, onComplete }) {
  const [files, setFiles] = useState([]), [results, setResults] = useState([]), [busy, setBusy] = useState(false);
  async function upload(e) {
    e.preventDefault();
    const dataset = new FormData(e.currentTarget).get("dataset");
    setBusy(true); setResults([]);
    const rows = [];
    for (const file of files) {
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error("超过 5 MB");
        const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(",")[1]); reader.onerror = () => reject(new Error("读取失败")); reader.readAsDataURL(file); });
        const r = await api(`annotation/projects/${project._id}/assets`, { name: file.name, dataset, data });
        rows.push({ name: file.name, ok: true, message: r.data.duplicate ? "重复，已跳过" : "上传成功" });
      } catch (error) { rows.push({ name: file.name, ok: false, message: error.message }); }
      setResults([...rows]);
    }
    setFiles(files.filter((_, i) => !rows[i].ok));
    setBusy(false); onComplete();
  }
  return <section className="panel upload-panel"><h3>批量上传图片</h3><p>PNG / JPEG · 每张 ≤ 5 MB · 每批 ≤ 100 张。失败文件保留，可再次上传。</p><form onSubmit={upload}><fieldset disabled={busy}>
    <label>图片数据集名称<input name="dataset" required maxLength={80} defaultValue="图片数据集" /></label>
    <label>选择图片<input type="file" multiple accept="image/png,image/jpeg" onChange={e => { setFiles([...e.target.files].slice(0, 100)); setResults([]); }} /></label>
    <p>{files.length} 张待上传：{files.slice(0, 5).map(f => f.name).join("、")}</p>
    <button disabled={!files.length} className="primary">{busy ? "上传中…" : "上传图片 / 重试失败项"}</button>
  </fieldset></form>{results.map((r, i) => <p key={i} className={r.ok ? "" : "error"}>{r.name}：{r.message}</p>)}</section>;
}
