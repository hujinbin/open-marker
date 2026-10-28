import { useEffect, useState } from "react";
import { api } from "./api";
const titles = { save: "保存草稿", submit: "提交审核", approve: "审核通过", reject: "驳回返工", reopen: "抽检返工", assign: "分配/回收", claim: "领取任务", import: "导入数据", upload: "上传图片", member: "更新成员", removeMember: "移除成员", settings: "项目设置", export: "导出快照", archive: "归档", restore: "恢复", migrate: "迁移" };
export function AuditPanel({ project }) {
  const [page, setPage] = useState(1), [data, setData] = useState({ items: [], total: 0 }), [error, setError] = useState("");
  useEffect(() => { let active = true; api(`annotation/projects/${project._id}/audit?page=${page}`).then(r => { if (active) setData(r.data); }).catch(e => setError(e.message)); return () => { active = false; }; }, [project._id, page]);
  return <><h3>操作记录</h3>{error && <p className="error">{error}</p>}{data.items.map(e => <div className="member" key={e._id}><span>{titles[e.action] || e.action} · {e.userId}<br /><small>{e.sampleId ? `样本 ${e.sampleId.slice(0, 12)}` : "项目操作"} {e.detail?.feedback}</small></span><small>{new Date(e.time).toLocaleString()}</small></div>)}<div className="toolbar"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>较新记录</button><span>第 {page} 页 / {data.total} 条</span><button disabled={page * 30 >= data.total} onClick={() => setPage(p => p + 1)}>更早记录</button></div></>;
}
export function StatsPanel({ project }) {
  const [data, setData] = useState(null), [error, setError] = useState("");
  useEffect(() => { let active = true; api(`annotation/projects/${project._id}/stats`).then(r => { if (active) setData(r.data); }).catch(e => setError(e.message)); return () => { active = false; }; }, [project._id, project.revision]);
  const name = id => id === project.ownerId ? "负责人" : project.members.find(m => m.userId === id)?.name || `历史成员 ${id.slice(-6)}`;
  return <><h3>人员工作量</h3><p>当前样本归属与审核操作次数；通过数量不代表标注准确率。</p>{error && <p className="error">{error}</p>}{data?.annotators.map(u => <div className="member" key={u._id}><b>{name(u._id)}</b><span>标注 {u.total} · 已通过 {u.approved} · 当前驳回 {u.rejected}</span></div>)}{data?.reviewers.map(u => <div className="member" key={u._id}><b>{name(u._id)}</b><span>审核操作 {u.total} · 驳回操作 {u.rejected}</span></div>)}</>;
}
