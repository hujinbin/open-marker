import { useCallback, useEffect, useState } from "react";
import { api, download } from "./api";
import Auth from "./Auth";
import Editor from "./Editor";
import "./App.css";

const tabs = {
  overview: "项目总览",
  datasets: "数据集",
  tasks: "标注任务",
  quality: "审核质检",
  team: "项目成员",
  exports: "数据导出",
};
const statuses = {
  todo: "待标注",
  labeling: "标注中",
  review: "待审核",
  approved: "已通过",
  rejected: "已驳回",
};
const actions = {
  import: "导入数据",
  assign: "分配任务",
  save: "保存草稿",
  submit: "提交审核",
  approve: "审核通过",
  reject: "驳回返工",
  member: "更新成员",
  archive: "归档项目",
};
const route = () => {
  const [tab, id] = location.hash.slice(1).split("/");
  return { tab: tabs[tab] ? tab : "overview", id: id || "" };
};
export default function App() {
  const [user, setUser] = useState(null),
    [checking, setChecking] = useState(true);
  const [view, setView] = useState(route),
    [projects, setProjects] = useState([]),
    [project, setProject] = useState(null);
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
      setView(route());
      setSelected("");
      setError("");
      setFilter("");
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const refresh = useCallback(async () => {
    const r = await api("annotation/projects");
    setProjects(r.data);
  }, []);
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
    api(`annotation/projects/${view.id}`)
      .then((r) => {
        if (active) setProject(r.data);
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
  }, [view.id, user]);
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
    const r = await api(`annotation/projects/${project._id}`, {
      ...body,
      revision: project.revision,
    });
    if (route().id === r.data._id) setProject(r.data);
    await refresh();
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
        total: project.samples.length,
        approved: project.samples.filter((s) => s.status === "approved").length,
        pending: project.samples.filter((s) => s.status === "review").length,
      }
    : projects.reduce(
        (a, p) => ({
          total: a.total + p.total,
          approved: a.approved + p.approved,
          pending: a.pending + p.pending,
        }),
        { total: 0, approved: 0, pending: 0 }
      );
  const visible = (project?.samples || []).filter(
    (s) =>
      (view.tab !== "quality" || s.status === "review") &&
      (!filter || s.status === filter) &&
      `${s.content} ${s.dataset}`.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="workspace">
      <aside className="sidebar">
        <a href="#overview" className="brand">
          ✳ OPEN MARKER
        </a>
        <p className="sidebar-caption">数据标注工作区</p>
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
          <small>惊觉账号 · 已登录</small>
          <button
            onClick={() => {
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
                  await refresh();
                  if (view.id)
                    setProject(
                      (await api(`annotation/projects/${view.id}`)).data
                    );
                })
              }
            >
              重新加载
            </button>
          </div>
        )}
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
                <div className="project-grid">
                  {projects.map((p) => (
                    <button
                      className="project-card"
                      key={p._id}
                      onClick={() => go("tasks", p._id)}
                    >
                      <span className="eyebrow">
                        {p.type === "text" ? "文本分类" : "图像目标检测"}
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
                <div className="toolbar">
                  <p>每个项目最多 500 条，支持 TXT / JSONL 导入。</p>
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
                  {[...new Set(project.samples.map((s) => s.dataset))].map(
                    (name) => (
                      <article className="panel" key={name}>
                        <span className="eyebrow">DATASET</span>
                        <h2>{name}</h2>
                        <p>
                          {
                            project.samples.filter((s) => s.dataset === name)
                              .length
                          }{" "}
                          条数据 ·{" "}
                          {project.type === "text" ? "文本" : "图片地址"}
                        </p>
                        <button
                          onClick={() => {
                            setSearch(name);
                            go("tasks");
                          }}
                        >
                          查看任务 →
                        </button>
                      </article>
                    )
                  )}
                </div>
                {!project.samples.length && (
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
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {view.tab === "tasks" && (
                    <select
                      aria-label="筛选状态"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="">全部状态</option>
                      {Object.entries(statuses).map(([k, v]) => (
                        <option value={k} key={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                  <span>{visible.length} 条任务</span>
                </div>
                <div className="task-layout">
                  <div className="task-list">
                    {visible.map((s) => (
                      <button
                        key={s.id}
                        className={s.id === selected ? "selected" : ""}
                        onClick={() => {
                          setSelected(s.id);
                          setFeedback("");
                        }}
                      >
                        <small>{s.dataset}</small>
                        <b>{s.content}</b>
                        <span className={`status ${s.status}`}>
                          {statuses[s.status]}
                        </span>
                      </button>
                    ))}
                    {!visible.length && (
                      <div className="empty">没有符合条件的任务</div>
                    )}
                  </div>
                  <section className="panel task-detail">
                    {sample ? (
                      <>
                        <div className="toolbar">
                          <span className={`status ${sample.status}`}>
                            {statuses[sample.status]}
                          </span>
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
                          key={`${sample.id}-${project.revision}`}
                          sample={sample}
                          project={project}
                          editable={editable}
                          busy={busy}
                          onSave={(action, annotation) =>
                            run(() =>
                              update({
                                action,
                                annotation,
                                sampleId: sample.id,
                              })
                            )
                          }
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
                      </>
                    ) : (
                      <div className="empty">选择一条任务开始工作</div>
                    )}
                  </section>
                </div>
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
                  </div>
                ))}
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
            {project && view.tab === "exports" && (
              <section className="panel">
                <span className="eyebrow">READY FOR TRAINING</span>
                <h2>交付已审核的数据</h2>
                <p>
                  当前可导出 {counts.approved} 条。JSONL
                  包含原始内容、标签和标注结果。图片框使用 0–1 归一化坐标。
                </p>
                <button
                  className="primary"
                  disabled={!owner || busy || !counts.approved}
                  onClick={() =>
                    run(async () =>
                      download(
                        (await api(`annotation/projects/${project._id}/export`))
                          .data,
                        project.name
                      )
                    )
                  }
                >
                  导出 JSONL ↓
                </button>
                {!owner && <p>仅项目负责人可以导出。</p>}
                <h3>最近操作</h3>
                {project.events
                  .slice(-15)
                  .reverse()
                  .map((e, i) => (
                    <div className="member" key={i}>
                      <span>
                        {actions[e.action]} · {e.userId}
                      </span>
                      <small>{new Date(e.time).toLocaleString()}</small>
                    </div>
                  ))}
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
                      await update({
                        action: "import",
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
                      });
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
                      {project.type === "text"
                        ? "文本内容"
                        : "图片 HTTP(S) 地址"}
                      <textarea name="content" required rows={8} />
                    </label>
                    <p>本次导入与现有数据合计不能超过 500 条。</p>
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
