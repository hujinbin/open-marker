import { useState } from "react";
export default function Editor({ sample, project, editable, busy, onSave }) {
  const [value, setValue] = useState(sample.annotation),
    [label, setLabel] = useState(project.labels[0]);
  const [start, setStart] = useState(null),
    [draft, setDraft] = useState(null),
    [ready, setReady] = useState(false),
    [broken, setBroken] = useState(false);
  function point(e) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  }
  function rectangle(a, b) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x),
      height: Math.abs(a.y - b.y),
      label,
    };
  }
  return (
    <div className="editor">
      <div className="editor-canvas">
        {project.type === "text" ? (
          <article className="sample-text">{sample.content}</article>
        ) : (
          <>
            <p>选择标签，在图片上拖动绘制矩形框；坐标按图片比例保存。</p>
            {broken && (
              <p className="error">图片加载失败，请检查地址或访问权限。</p>
            )}
            <div
              className="image-stage"
              onPointerDown={(e) => {
                if (!editable || busy || !ready || broken) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                setStart(point(e));
              }}
              onPointerMove={(e) => {
                if (start) setDraft(rectangle(start, point(e)));
              }}
              onPointerCancel={() => {
                setStart(null);
                setDraft(null);
              }}
              onPointerUp={(e) => {
                if (!start) return;
                const box = rectangle(start, point(e));
                if (box.width > 0.005 && box.height > 0.005)
                  setValue({ boxes: [...value.boxes, box], empty: false });
                setStart(null);
                setDraft(null);
              }}
            >
              <img
                src={sample.content}
                alt="待标注样本"
                draggable={false}
                onLoad={() => setReady(true)}
                onError={() => setBroken(true)}
              />
              {[...value.boxes, ...(draft ? [draft] : [])].map((box, index) => (
                <div
                  className="box"
                  key={index}
                  style={{
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.width * 100}%`,
                    height: `${box.height * 100}%`,
                  }}
                >
                  <span>{box.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <aside className="label-panel">
        <h3>标注结果</h3>
        <fieldset disabled={!editable || busy}>
          {project.type === "text" ? (
            project.labels.map((l) => (
              <label className="check" key={l}>
                <input
                  type="checkbox"
                  checked={value.labels.includes(l)}
                  onChange={(e) =>
                    setValue({
                      labels: e.target.checked
                        ? [...value.labels, l]
                        : value.labels.filter((x) => x !== l),
                    })
                  }
                />
                {l}
              </label>
            ))
          ) : (
            <>
              <label>
                当前标签
                <select
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                >
                  {project.labels.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              {value.boxes.map((box, i) => (
                <div className="box-item" key={i}>
                  {i + 1}. {box.label}
                  <button
                    type="button"
                    onClick={() =>
                      setValue({
                        ...value,
                        boxes: value.boxes.filter((_, j) => i !== j),
                      })
                    }
                  >
                    删除
                  </button>
                </div>
              ))}
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!value.empty}
                  disabled={value.boxes.length > 0}
                  onChange={(e) =>
                    setValue({ ...value, empty: e.target.checked })
                  }
                />
                确认没有目标
              </label>
            </>
          )}
        </fieldset>
        {sample.feedback && (
          <p className="feedback">修改意见：{sample.feedback}</p>
        )}
        {editable && (
          <div className="stack">
            <button disabled={busy} onClick={() => onSave("save", value)}>
              保存草稿
            </button>
            <button
              className="primary"
              disabled={
                busy || (project.type === "image" && (!ready || broken))
              }
              onClick={() => onSave("submit", value)}
            >
              提交审核 →
            </button>
          </div>
        )}
        <small>提交审核后只读；驳回后可以修改。</small>
      </aside>
    </div>
  );
}
