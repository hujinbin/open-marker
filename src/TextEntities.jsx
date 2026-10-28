import { useRef, useState } from "react";
export default function TextEntities({ content, value, label, disabled, onChange }) {
  const root = useRef(null), [selection, setSelection] = useState(null), [error, setError] = useState("");
  const entities = [...value.entities].sort((a, b) => a.start - b.start), pieces = [];
  let offset = 0;
  for (const [i, e] of entities.entries()) {
    pieces.push(content.slice(offset, e.start));
    pieces.push(<mark key={i} title={`${e.label} [${e.start}, ${e.end})`} data-label={e.label}>{content.slice(e.start, e.end)}</mark>);
    offset = e.end;
  }
  pieces.push(content.slice(offset));
  return <><p>选中文字后点击“标记所选文本”。位置使用 UTF-16 起止下标，不支持重叠实体。</p><article className="sample-text entity-text" ref={root} onMouseUp={() => {
    if (disabled) return;
    const selected = window.getSelection();
    if (!selected?.rangeCount || selected.isCollapsed) return;
    const range = selected.getRangeAt(0);
    if (!root.current.contains(range.startContainer) || !root.current.contains(range.endContainer)) return;
    const before = range.cloneRange(); before.selectNodeContents(root.current); before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length, text = range.toString();
    setSelection({ start, end: start + text.length, text }); setError("");
  }}>{pieces}</article>
    {selection && <div className="selection-preview"><p>已选：{selection.text} → {label}</p><button disabled={disabled} onClick={() => {
      if (!selection.text.trim()) { setError("不能只标记空白字符"); return; }
      if (entities.some(e => selection.start < e.end && selection.end > e.start)) { setError("所选文本与已有实体重叠"); return; }
      onChange({ entities: [...entities, { ...selection, label }].sort((a, b) => a.start - b.start), empty: false }); setSelection(null); window.getSelection()?.removeAllRanges();
    }}>标记所选文本</button></div>}{error && <p role="alert" className="error">{error}</p>}
  </>;
}
