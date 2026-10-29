import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import Auth from "./Auth";
import Editor from "./Editor";
import ProjectSettings from "./ProjectSettings";
import ImageUpload from "./ImageUpload";
import ExportPanel from "./ExportPanel";
import { AuditPanel, StatsPanel } from "./ActivityPanel";
import AIJobsPanel from "./AIJobsPanel";
import "./App.css";

const tabs = {
  overview: "项目总览",
  datasets: "数据集",
  tasks: "标注任务",
  quality: "审核质检",
  team: "项目成员",
  exports: "数据导出",
  settings: "项目设置",
};
const localDemo = import.meta.env.DEV && import.meta.env.VITE_DEMO_LOGIN === "true";
const statuses = {
  todo: "待标注",
  labeling: "标注中",
  review: "待审核",
  approved: "已通过",
  rejected: "已驳回",
};
const route = () => {
  const [tab, id] = location.hash.slice(1).split("/");
  return { tab: tabs[tab] ? tab : "overview", id: id || "" };
};
export default function App() {
  const dirty = useRef(false);
  const lastHash = useRef(location.hash);
  const canLeave = () => !dirty.current || confirm("当前标注尚未保存，确认放弃修改并离开？");
  const markDirty = useCallback((value) => { dirty.current = value; }, []);
  const [user, setUser] = useState(null),
    [checking, setChecking] = useState(true);
  const [view, setView] = useState(route),
    [projects, setProjects] = useState([]),
    [project, setProject] = useState(null);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [dataset, setDataset] = useState(""), [assignee, setAssignee] = useState("");
  const [version, setVersion] = useState(0), [archived, setArchived] = useState(false), [notice, setNotice] = useState("");
  const [checked, setChecked] = useState([]), [bulkAssignee, setBulkAssignee] = useState(""), [qc, setQc] = useState(false);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [modal, setModal] = useState(""),
    [selected, setSelected] = useState(""),
    [filter, setFilter] = useState(""),
    [search, setSearch] = useState(""),
    [feedback, setFeedback] = useState("");
  const login = useCallback(async () => {
    const r = await api("user/getUserInfo");
    setUser(r.data);
  }, []);
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setProjects([]);
      setProject(null);
    };
    window.addEventListener("auth-expired", expired);
    if (localStorage.getItem("token"))
      login()
        .catch((e) => setError(e.message))
        .finally(() => setChecking(false));
    else setChecking(false);
    return () => window.removeEventListener("auth-expired", expired);
  }, [login]);
  useEffect(() => {
    const change = () => {
      if (!canLeave()) {
        history.replaceState(null, "", lastHash.current || "#overview");
        return;
      }
      dirty.current = false;
      lastHash.current = location.hash;
      setView(route());
      setSelected("");
      setError("");
      setFilter("");
      setPage(1);
      setDataset("");
      setChecked([]);
    };
    window.addEventListener("hashchange", change);
    const unload = (event) => {
      if (dirty.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  const refresh = useCallback(async () => {
    const r = await api(`annotation/projects?archived=${archived}`);
    setProjects(r.data);
  }, [archived]);
  useEffect(() => {
    if (user) refresh().catch((e) => setError(e.message));
  }, [user, refresh]);
  useEffect(() => {
    let active = true;
    setProject(null);
    setSelected("");
    setLoading(false);
    if (!user || !view.id) return;
    setLoading(true);
    api(`annotation/projects/${view.id}?archived=${archived}`)
      .then((r) => {
        if (active) setProject({ ...r.data, samples: [] });
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view.id, user, archived]);
  useEffect(() => {
    if (!user || !view.id || project?.storageVersion !== 2 || archived) return;
    let active = true;
    const q = new URLSearchParams({ page, status: view.tab === "quality" ? qc ? "approved" : "review" : filter, random: String(view.tab === "quality" && qc), search, dataset, assignee });
    api(`annotation/projects/${view.id}/samples?${q}`).then(r => {
      if (!active) return;
      setTotal(r.data.total);
      setProject(p => p && p._id === view.id ? { ...p, samples: r.data.items } : p);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [user, view.id, view.tab, project?.storageVersion, page, filter, search, dataset, assignee, version, archived, qc]);
  function go(tab, id = view.id) {
    location.hash = `${tab}${id ? "/" + id : ""}`;
  }
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function update(body) {
    const current = project.samples.find(s => s.id === body.sampleId);
    const path = `annotation/projects/${project._id}${body.sampleId ? `/samples/${body.sampleId}` : ""}`;
    const r = await api(path, {
      ...body,
      revision: body.revision ?? (current ? current.revision : project.revision),
    });
    if (route().id === project._id) {
      if (body.sampleId) setProject(p => ({ ...p, samples: p.samples.map(s => s.id === r.data.id ? r.data : s) }));
      else setProject(p => ({ ...r.data, samples: p.samples }));
    }
    api(`annotation/projects/${project._id}`).then(r => setProject(p => p?._id === r.data._id ? { ...r.data, samples: p.samples } : p)).catch(() => {});
    refresh().catch((e) => setError(`保存成功，但列表刷新失败：${e.message}`));
    return r.data;
  }
  function changeFilter(setter, value) {
    if (!canLeave()) return;
    dirty.current = false;
    setSelected("");
    setter(value);
    setPage(1);
    setChecked([]);
  }
  function choose(id) {
    if (id === selected || !canLeave()) return;
    dirty.current = false;
    setSelected(id);
    setFeedback("");
  }
  const owner = project && project.ownerId === user?._id;
  const reviewer =
    owner ||
    project?.members.some(
      (m) => m.userId === user?._id && m.role === "reviewer"
    );
  const sample = project?.samples.find((s) => s.id === selected);
  const editable =
    sample &&
    ["todo", "labeling", "rejected"].includes(sample.status) &&
    (owner ||
      (sample.assignee === user?._id &&
        project.members.some(
          (m) => m.userId === user._id && m.role === "annotator"
        )));
  if (checking) return <div className="empty">正在验证登录状态…</div>;
  if (!user) return <Auth onLogin={login} />;
  const counts = project
    ? {
        total: project.total,
        approved: project.approved,
        pending: project.pending,
      }
    : projects.reduce(
        (a, p) => ({
          total: a.total + p.total,
          approved: a.approved + p.approved,
          pending: a.pending + p.pending,
        }),
        { total: 0, approved: 0, pending: 0 }
      );
  const visible = project?.samples || [];
  return (
    <div className="workspace">
      <aside className="sidebar">
        <a href="#overview" className="brand">
          ✳ OPEN MARKER
        </a>
        <p className="sidebar-caption">{localDemo ? "本地演示 · 数据与业务环境隔离" : "数据标注工作区"}</p>
        <label>
          当前项目
          <select
            value={view.id}
            onChange={(e) => go(view.tab, e.target.value)}
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option value={p._id} key={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <nav>
          {Object.entries(tabs).map(([key, title], i) => (
            <a
              key={key}
              href={`#${key}${view.id ? "/" + view.id : ""}`}
              className={view.tab === key ? "active" : ""}
            >
              <span>0{i + 1}</span>
              {title}
            </a>
          ))}
        </nav>
        <div className="account">
          <b>{user.nickname}</b>
          <small>{localDemo ? "本地体验账号 · 已登录" : "惊觉账号 · 已登录"}</small>
          <button
            onClick={() => {
              if (!canLeave()) return;
              dirty.current = false;
              localStorage.removeItem("token");
              setUser(null);
              setProject(null);
              setProjects([]);
            }}
          >
            退出登录
          </button>
        </div>
      </aside>
      <main className="main">
        <header>
          <div>
            <span className="eyebrow">
              WORKSPACE / {view.tab.toUpperCase()}
            </span>
            <h1>{project?.name || tabs[view.tab]}</h1>
          </div>
          <button
            disabled={busy}
            className="primary"
            onClick={() => setModal("create")}
          >
            ＋ 新建项目
          </button>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
            <button
              onClick={() =>
                run(async () => {
                  if (!canLeave()) return;
                  dirty.current = false;
                  setSelected("");
                  await refresh();
                  if (view.id)
                    setProject(
                      { ...(await api(`annotation/projects/${view.id}`)).data, samples: [] }
                    );
                  setVersion(v => v + 1);
                })
              }
            >
              重新加载
            </button>
          </div>
        )}
        {notice && <p role="status" className="feedback">{notice}<button onClick={() => setNotice("")}>关闭</button></p>}
        {project && project.storageVersion !== 2 && <section className="panel"><h2>旧项目需要迁移</h2><p>保留原始样本副本，迁移到可分页、按样本保存的新结构。迁移可安全重试。</p><button disabled={!owner || busy} onClick={() => run(async () => { await update({ action: "migrate" }); setVersion(v => v + 1); })}>迁移数据</button></section>}
        {loading ? (
          <div className="empty">加载项目中…</div>
        ) : (
          <>
            {view.tab === "overview" && (
              <>
                <section className="hero">
                  <span className="eyebrow">从数据开始，让判断产生价值</span>
                  <h2>
                    每一条标注，<em>都是下一步的起点。</em>
                  </h2>
                  <p>导入数据 → 分配任务 → 标注 → 审核 → 导出</p>
                </section>
                <section className="metrics">
                  {[
                    ["项目数量", projects.length],
                    ["数据总量", counts.total],
                    ["待审核", counts.pending],
                    ["已通过", counts.approved],
                  ].map(([k, n]) => (
                    <article key={k}>
                      <span>{k}</span>
                      <strong>{n}</strong>
                    </article>
                  ))}
                </section>
                <h2>
                  项目空间 <small>{projects.length} 个项目</small>
                </h2>
                <label className="check"><input type="checkbox" checked={archived} onChange={e => { setArchived(e.target.checked); go("overview", ""); }} />查看已归档项目</label>
                <div className="project-grid">
                  {projects.map((p) => (
                    <button
                      className="project-card"
                      key={p._id}
                      onClick={() => go(archived ? "settings" : "tasks", p._id)}
                    >
                      <span className="eyebrow">
                        {p.type === "text" ? "文本分类" : p.type === "ner" ? "文本实体标注" : "图像目标检测"}
                      </span>
                      <h3>{p.name}</h3>
                      <p>{p.labels.join(" / ")}</p>
                      <progress value={p.approved} max={p.total || 1} />
                      <small>
                        {p.approved} / {p.total} 条已通过{" "}
                        <span>进入项目 →</span>
                      </small>
                    </button>
                  ))}
                </div>
                {!projects.length && (
                  <div className="empty">
                    还没有项目。创建第一个项目，设置标签并导入数据。
                  </div>
                )}
              </>
            )}
            {view.tab !== "overview" && !project && (
              <div className="empty">请从左侧选择项目，或先创建一个项目。</div>
            )}
            {project && view.tab === "datasets" && (
              <>
                {owner && project.type === "image" && <ImageUpload project={project} onComplete={() => { api(`annotation/projects/${project._id}`).then(r => setProject(p => ({ ...r.data, samples: p.samples }))).catch(e => setError(e.message)); setVersion(v => v + 1); refresh(); }} />}
                <div className="toolbar">
                  <p>每批最多 500 条，支持 TXT / JSONL 导入、预览与去重。</p>
                  {owner && (
                    <button
                      className="primary"
                      onClick={() => setModal("import")}
                    >
                      导入数据
                    </button>
                  )}
                </div>
                <div className="project-grid">
                  {(project.datasets || []).map(
                    (d) => (
                      <article className="panel" key={d._id}>
                        <span className="eyebrow">DATASET</span>
                        <h2>{d.name}</h2>
                        <p>
                          {d.total}{" "}
                          条数据 ·{" "}
                          {project.type !== "image" ? "文本" : "图片"}
                        </p>
                        <button
                          onClick={() => {
                            setSearch(d.name);
                            go("tasks");
                          }}
                        >
                          查看任务 →
                        </button>
                      </article>
                    )
                  )}
                </div>
                {!project.datasets?.length && (
                  <div className="empty">数据集为空，请导入待标注内容。</div>
                )}
              </>
            )}
            {project && ["tasks", "quality"].includes(view.tab) && (
              <>
                <div className="toolbar">
                  <input
                    aria-label="搜索数据"
                    placeholder="搜索内容或数据集"
                    value={search}
                    onChange={(e) => changeFilter(setSearch, e.target.value)}
                  />
                  {view.tab === "tasks" && (
                    <select
                      aria-label="筛选状态"
                      value={filter}
                      onChange={(e) => changeFilter(setFilter, e.target.value)}
                    >
                      <option value="">全部状态</option>
                      {Object.entries(statuses).map(([k, v]) => (
                        <option value={k} key={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                  <select aria-label="筛选数据集" value={dataset} onChange={e => changeFilter(setDataset, e.target.value)}><option value="">全部数据集</option>{project.datasets?.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select>
                  <select aria-label="筛选标注员" value={assignee} onChange={e => changeFilter(setAssignee, e.target.value)}><option value="">全部人员</option><option value="me">我的任务</option><option value="unassigned">未分配</option></select>
                  <span>{total} 条任务 · 第 {page} 页</span>
                  {view.tab === "quality" && reviewer && <button onClick={() => { if (canLeave()) { dirty.current = false; setSelected(""); setQc(!qc); setPage(1); } }}>{qc ? "返回待审核" : "随机抽检已通过数据（20 条）"}</button>}
                  <button disabled={page <= 1} onClick={() => { if (canLeave()) { dirty.current = false; setSelected(""); setPage(p => p - 1); } }}>上一页</button>
                  <button disabled={page * 20 >= total} onClick={() => { if (canLeave()) { dirty.current = false; setSelected(""); setPage(p => p + 1); } }}>下一页</button>
                </div>
                {owner && <div className="toolbar bulk-toolbar"><label className="check"><input type="checkbox" checked={visible.length > 0 && visible.every(s => checked.includes(s.id))} onChange={e => setChecked(e.target.checked ? visible.map(s => s.id) : [])} />选择本页</label><span>已选 {visible.filter(s => checked.includes(s.id)).length} 条</span><select aria-label="批量分配人员" value={bulkAssignee} onChange={e => setBulkAssignee(e.target.value)}><option value="">回收为未分配</option><option value={project.ownerId}>负责人</option>{project.members.filter(m => m.role === "annotator").map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select><button disabled={busy || !checked.length} onClick={() => { if (!canLeave()) return; run(async () => { const r = await api(`annotation/projects/${project._id}/bulk`, { action: "assign", assignee: bulkAssignee, items: visible.filter(s => checked.includes(s.id)).map(s => ({ id: s.id, revision: s.revision })) }); setNotice(`成功 ${r.data.results.filter(r => r.ok).length} 条；${r.data.results.filter(r => !r.ok).map(r => r.message).join("；") || "无失败项"}`); dirty.current = false; setSelected(""); setChecked([]); setVersion(v => v + 1); }); }}>批量分配 / 回收</button></div>}
                <div className="task-layout">
                  <div className="task-list">
                    {visible.map((s) => (
                      <div className="task-row" key={s.id}>{owner && <input type="checkbox" aria-label={`选择任务 ${s.content.slice(0, 30)}`} checked={checked.includes(s.id)} onChange={e => setChecked(ids => e.target.checked ? [...ids, s.id] : ids.filter(id => id !== s.id))} />}<button
                        className={s.id === selected ? "selected" : ""}
                        onClick={() => {
                          choose(s.id);
                        }}
                      >
                        <small>{s.dataset}</small>
                        <b>{s.content}</b>
                        <span className={`status ${s.status}`}>
                          {statuses[s.status]}
                        </span>
                      </button></div>
                    ))}
                    {!visible.length && (
                      <div className="empty">没有符合条件的任务</div>
                    )}
                  </div>
                  <section className="panel task-detail">
                    {sample ? (
                      <>
                        <div className="toolbar">
                          <button disabled={busy || visible.findIndex(s => s.id === selected) <= 0} onClick={() => choose(visible[visible.findIndex(s => s.id === selected) - 1]?.id)}>上一条</button>
                          <button disabled={busy || visible.findIndex(s => s.id === selected) < 0 || visible.findIndex(s => s.id === selected) >= visible.length - 1} onClick={() => choose(visible[visible.findIndex(s => s.id === selected) + 1]?.id)}>下一条</button>
                          <span className={`status ${sample.status}`}>
                            {statuses[sample.status]}
                          </span>
                          {!sample.assignee && (owner || project.members.some(m => m.userId === user._id && m.role === "annotator")) && ["todo", "labeling", "rejected"].includes(sample.status) && <button disabled={busy} onClick={() => run(() => update({ action: "claim", sampleId: sample.id }))}>领取任务</button>}
                          {owner &&
                            ["todo", "labeling", "rejected"].includes(
                              sample.status
                            ) && (
                              <select
                                aria-label="分配标注员"
                                disabled={busy}
                                value={sample.assignee}
                                onChange={(e) =>
                                  run(() =>
                                    update({
                                      action: "assign",
                                      sampleId: sample.id,
                                      assignee: e.target.value,
                                    })
                                  )
                                }
                              >
                                <option value="" disabled>
                                  分配标注员
                                </option>
                                <option value={project.ownerId}>
                                  我（负责人）
                                </option>
                                {project.members
                                  .filter((m) => m.role === "annotator")
                                  .map((m) => (
                                    <option value={m.userId} key={m.userId}>
                                      {m.name}
                                    </option>
                                  ))}
                              </select>
                            )}
                        </div>
                        <Editor
                          key={`${project._id}-${sample.id}`}
                          sample={sample}
                          userId={user._id}
                          project={project}
                          editable={editable}
                          busy={busy}
                          onDirtyChange={markDirty}
                          onSave={async (action, annotation, dimensions = {}) => {
                            const next = visible[visible.findIndex(s => s.id === sample.id) + 1];
                            const result = await update({
                                action,
                                annotation,
                                sampleId: sample.id,
                                ...dimensions,
                            });
                            dirty.current = false;
                            if (action === "submit" && next) { setSelected(next.id); setFeedback(""); }
                            return result;
                          }}
                        />
                        {reviewer && sample.status === "review" && (
                          <div className="review">
                            <label>
                              修改意见
                              <textarea
                                value={feedback}
                                maxLength={1000}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="驳回时必填"
                              />
                            </label>
                            <button
                              disabled={busy || !feedback.trim()}
                              onClick={() =>
                                run(() =>
                                  update({
                                    action: "reject",
                                    sampleId: sample.id,
                                    feedback,
                                  })
                                )
                              }
                            >
                              驳回返工
                            </button>
                            <button
                              disabled={busy}
                              className="primary"
                              onClick={() =>
                                run(() =>
                                  update({
                                    action: "approve",
                                    sampleId: sample.id,
                                  })
                                )
                              }
                            >
                              审核通过
                            </button>
                          </div>
                        )}
                        {reviewer && sample.status === "approved" && <div className="review"><label>抽检问题<textarea value={feedback} maxLength={1000} onChange={e => setFeedback(e.target.value)} /></label><button disabled={busy || !feedback.trim()} onClick={() => run(() => update({ action: "reopen", sampleId: sample.id, feedback }))}>抽检不通过，退回返工</button></div>}
                      </>
                    ) : (
                      <div className="empty">选择一条任务开始工作</div>
                    )}
                  </section>
                </div>
                {owner && <AIJobsPanel project={project} sampleIds={visible.filter(s => checked.includes(s.id)).map(s => s.id)} onRefresh={() => { if (canLeave()) { dirty.current = false; setSelected(""); setVersion(v => v + 1); } }} />}
              </>
            )}
            {project && view.tab === "team" && (
              <section className="panel">
                <h2>项目成员</h2>
                <p>负责人可标注和审核；标注员只能编辑分配给自己的任务。</p>
                <div className="member">
                  <b>项目负责人</b>
                  <span>{project.ownerId}</span>
                </div>
                {project.members.map((m) => (
                  <div className="member" key={m.userId}>
                    <b>{m.name}</b>
                    <span>{m.role === "annotator" ? "标注员" : "审核员"}</span>
                    {owner && <button disabled={busy} onClick={() => { if (confirm(`移除 ${m.name}？如有未完成任务，请先回收。`)) run(() => update({ action: "removeMember", userId: m.userId })); }}>移除成员</button>}
                  </div>
                ))}
                <StatsPanel project={project} />
                {owner && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const b = Object.fromEntries(
                        new FormData(e.currentTarget)
                      );
                      run(() => update({ ...b, action: "member" }));
                    }}
                  >
                    <h3>添加或调整成员</h3>
                    <label>
                      已注册手机号
                      <input name="mobile" pattern="1[0-9]{10}" required />
                    </label>
                    <label>
                      角色
                      <select name="role">
                        <option value="annotator">标注员</option>
                        <option value="reviewer">审核员</option>
                      </select>
                    </label>
                    <button className="primary" disabled={busy}>
                      保存成员
                    </button>
                  </form>
                )}
              </section>
            )}
            {project && view.tab === "settings" && <ProjectSettings project={project} owner={owner} busy={busy} onSave={b => run(() => update(b))} onRestore={() => run(async () => { await update({ action: "restore" }); setArchived(false); go("overview", ""); })} />}
            {project && view.tab === "exports" && (
              <section className="panel">
                <ExportPanel project={project} owner={owner} />
                <AuditPanel project={project} />
                {owner && (
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          "归档后项目将从列表隐藏，数据仍保留。确认归档？"
                        )
                      )
                        run(async () => {
                          await update({ action: "archive" });
                          go("overview", "");
                        });
                    }}
                  >
                    归档项目
                  </button>
                )}
              </section>
            )}
          </>
        )}
        {modal && (
          <div className="modal-mask">
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={modal === "create" ? "新建项目" : "导入数据"}
            >
              <button
                className="close"
                disabled={busy}
                onClick={() => setModal("")}
              >
                关闭 ×
              </button>
              <h2>{modal === "create" ? "开启一个新项目" : "导入数据集"}</h2>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fields = Object.fromEntries(
                    new FormData(e.currentTarget)
                  );
                  run(async () => {
                    if (modal === "create") {
                      const r = await api("annotation/projects", {
                        ...fields,
                        labels: fields.labels
                          .split(/[,，\n]/)
                          .map((x) => x.trim())
                          .filter(Boolean),
                      });
                      await refresh();
                      go("datasets", r.data._id);
                    } else {
                      const payload = {
                        dataset: fields.dataset,
                        items: fields.content
                          .split("\n")
                          .filter((x) => x.trim())
                          .map((line) => {
                            if (fields.format === "jsonl") {
                              const row = JSON.parse(line);
                              if (typeof row.content !== "string")
                                throw new Error(
                                  "JSONL 每行须包含 content 字符串"
                                );
                              return row.content;
                            }
                            return line;
                          }),
                      };
                      const preview = (await api(`annotation/projects/${project._id}/import`, { ...payload, preview: true })).data;
                      const invalid = preview.results.filter(r => r.status !== "ready");
                      if (!confirm(`可导入 ${preview.ready} 条；跳过 ${invalid.length} 条。${invalid.slice(0, 5).map(r => `\n第 ${r.row} 行：${r.reason || "重复数据"}`).join("")}\n确认导入？`)) return;
                      const imported = (await api(`annotation/projects/${project._id}/import`, payload)).data;
                      setProject(p => ({ ...imported.project, samples: p.samples }));
                      setNotice(`成功导入 ${imported.inserted} 条；重复或无效行已跳过。`);
                      setVersion(v => v + 1);
                      await refresh();
                    }
                    setModal("");
                  });
                }}
              >
                {modal === "create" ? (
                  <>
                    <label>
                      项目名称
                      <input name="name" maxLength={80} required autoFocus />
                    </label>
                    <label>
                      标注类型
                      <select name="type">
                        <option value="text">文本 · 多标签分类</option>
                        <option value="image">图像 · 矩形框检测</option>
                        <option value="ner">文本 · 实体标注（NER）</option>
                      </select>
                    </label>
                    <label>
                      标签集
                      <textarea
                        name="labels"
                        required
                        placeholder="例如：正向，中性，负向（逗号分隔）"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      数据集名称
                      <input name="dataset" maxLength={80} required autoFocus />
                    </label>
                    <label>
                      导入格式
                      <select name="format">
                        <option value="txt">TXT（每行一条）</option>
                        <option value="jsonl">
                          JSONL（每行一个 content 字段）
                        </option>
                      </select>
                    </label>
                    <label>
                      选择文件
                      <input
                        type="file"
                        accept=".txt,.jsonl"
                        onChange={async (e) => {
                          const f = e.target.files[0];
                          const form = e.currentTarget.form;
                          if (!f) return;
                          if (f.size > 5 * 1024 * 1024) {
                            setError("文件不得超过 5 MB");
                            return;
                          }
                          try {
                            form.elements.content.value = await f.text();
                          } catch {
                            setError("文件读取失败");
                          }
                        }}
                      />
                    </label>
                    <label>
                      {project.type !== "image"
                        ? "文本内容"
                        : "图片 HTTP(S) 地址"}
                      <textarea name="content" required rows={8} />
                    </label>
                    <p>每批最多 500 条。提交前显示预览，同一数据集内自动去重。</p>
                  </>
                )}
                <button className="primary" disabled={busy}>
                  {busy ? "保存中…" : "确认保存"}
                </button>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
