export default function ProjectSettings({ project, owner, busy, onSave, onRestore }) {
  return <section className="panel"><h2>项目设置与标注规范</h2>
    {project.archived ? <><p>项目已归档，恢复后可继续工作。</p><button disabled={!owner || busy} onClick={onRestore}>恢复项目</button></> :
    <form key={project.revision} onSubmit={e => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.currentTarget)); onSave({ action: "settings", ...b, labels: b.labels.split(/[,，\n]/).map(s => s.trim()).filter(Boolean), preventSelfReview: b.preventSelfReview === "on" }); }}>
      <fieldset disabled={!owner || busy}>
        <label>项目名称<input name="name" required maxLength={80} defaultValue={project.name} /></label>
        <label>标签集（仅末尾追加，编号保持不变）<textarea name="labels" required defaultValue={project.labels.join("\n")} /></label>
        <label>标注规范<textarea name="instructions" rows={8} maxLength={10000} defaultValue={project.instructions} placeholder="填写标注边界、正反例及审核标准" /></label>
        <label className="check"><input type="checkbox" name="preventSelfReview" defaultChecked={project.preventSelfReview} />禁止标注者审核自己的结果</label>
        <button className="primary">保存项目设置</button>
      </fieldset>
    </form>}
    <h3>标签编号</h3>{(project.labelDefinitions || []).map(l => <div className="member" key={l.id}><span>{l.id}</span><b>{l.name}</b></div>)}
  </section>;
}
