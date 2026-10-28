import { useEffect, useRef, useState } from "react";
import { assetUrl } from "./api";
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export default function ImageCanvas({ sample, project, value, label, disabled, onChange, onReady }) {
  const [url, setUrl] = useState(sample.assetId ? "" : sample.content), [error, setError] = useState("");
  const [zoom, setZoom] = useState(1), [tool, setTool] = useState("draw"), [selected, setSelected] = useState(-1), [preview, setPreview] = useState(null);
  const gesture = useRef(null), viewport = useRef(null), ready = useRef(false);
  useEffect(() => {
    if (!sample.assetId) return;
    let active = true, blob;
    assetUrl(project._id, sample.assetId).then(u => { blob = u; if (active) setUrl(u); else URL.revokeObjectURL(u); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; if (blob) URL.revokeObjectURL(blob); };
  }, [sample.assetId, project._id]);
  const point = e => { const r = e.currentTarget.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) }; };
  function candidate(e) {
    const g = gesture.current, b = point(e);
    if (g.mode === "draw") return { x: Math.min(g.point.x, b.x), y: Math.min(g.point.y, b.y), width: Math.abs(g.point.x - b.x), height: Math.abs(g.point.y - b.y), label };
    if (g.mode === "resize") return { ...g.box, width: clamp(b.x - g.box.x, 0.005, 1 - g.box.x), height: clamp(b.y - g.box.y, 0.005, 1 - g.box.y) };
    return { ...g.box, x: clamp(g.box.x + b.x - g.point.x, 0, 1 - g.box.width), y: clamp(g.box.y + b.y - g.point.y, 0, 1 - g.box.height) };
  }
  const boxes = value.boxes || [];
  return <><div className="canvas-tools">
    {[['draw','绘框'],['select','选择 / 移动'],['pan','平移']].map(([k, title]) => <button type="button" key={k} className={tool === k ? "primary" : ""} onClick={() => setTool(k)}>{title}</button>)}
    <button type="button" aria-label="缩小图片" onClick={() => setZoom(z => Math.max(1, z - 0.25))}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="放大图片" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>＋</button>
    <button type="button" onClick={() => { setZoom(1); viewport.current.scrollTo(0, 0); }}>适应画布</button>
  </div><p>绘框：拖动新建；选择：拖动已有框，右下角调整尺寸；平移：拖动画布。</p>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="image-viewport" ref={viewport}><div className={`image-stage tool-${tool}`} style={{ width: `${zoom * 100}%` }}
      onPointerDown={e => {
        if (e.button !== 0 || !ready.current) return;
        if (tool === "pan") gesture.current = { mode: "pan", x: e.clientX, y: e.clientY, left: viewport.current.scrollLeft, top: viewport.current.scrollTop };
        else {
          if (disabled) return;
          const target = e.target.closest("[data-box]");
          if (tool === "select" && !target) { setSelected(-1); return; }
          const i = target ? Number(target.dataset.box) : -1;
          setSelected(i);
          gesture.current = { mode: tool === "draw" ? "draw" : e.target.classList.contains("resize-handle") ? "resize" : "move", point: point(e), index: i, box: boxes[i] };
        }
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        const g = gesture.current;
        if (!g) return;
        if (g.mode === "pan") viewport.current.scrollTo(g.left - e.clientX + g.x, g.top - e.clientY + g.y);
        else setPreview({ index: g.mode === "draw" ? -1 : g.index, box: candidate(e) });
      }}
      onPointerUp={e => {
        const g = gesture.current;
        if (g && g.mode !== "pan" && !disabled) {
          const box = candidate(e);
          if (box.width >= 0.005 && box.height >= 0.005) onChange({ ...value, empty: false, boxes: g.mode === "draw" ? [...boxes, box] : boxes.map((b, i) => i === g.index ? box : b) });
        }
        gesture.current = null; setPreview(null);
      }} onPointerCancel={() => { gesture.current = null; setPreview(null); }}>
      {url && <img src={url} alt="待标注样本" draggable={false} onLoad={e => { ready.current = true; setError(""); onReady({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight }); }} onError={() => { ready.current = false; onReady(null); setError("图片无法加载，请检查资源或链接"); }} />}
      {[...boxes, ...(preview?.index === -1 ? [preview.box] : [])].map((original, i) => {
        const box = preview?.index === i ? preview.box : original;
        return <div className={`box ${selected === i ? "box-selected" : ""}`} data-box={i} key={i} style={{ left: `${box.x*100}%`, top: `${box.y*100}%`, width: `${box.width*100}%`, height: `${box.height*100}%` }}><span>{i+1} · {box.label}</span>{selected === i && tool === "select" && <i className="resize-handle" />}</div>;
      })}
    </div></div></>;
}
