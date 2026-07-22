import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './App.css';

const groups = [
  ['工作区', [['overview', '◈', '项目总览'], ['datasets', '▦', '数据集'], ['tasks', '✓', '任务中心']]],
  ['生产与质检', [['labeling', '⌘', '标注工作台'], ['quality', '◎', '审核质检'], ['ai', '✦', 'AI 辅助标注']]],
  ['平台管理', [['team', '♧', '团队与权限'], ['exports', '↗', '导出与集成'], ['settings', '⚙', '平台设置']]],
];
const projects = [
  ['城市道路 · 智能驾驶', '图像 / 目标检测', 76, '进行中', 'coral'],
  ['客服对话意图识别', '文本 / 多标签分类', 48, '进行中', 'teal'],
  ['工厂安全行为采集', '视频 / 行为标注', 100, '已完成', 'violet'],
];
const metrics = [['活跃项目', '12', '+3 本周', 'orange'], ['待处理任务', '1,284', '较昨日 -8.4%', 'blue'], ['平均准确率', '96.8%', '+1.2% 本周', 'green'], ['本月产出', '48.6 万', '+16.5% 环比', 'purple']];

function App() {
  const initialSection = window.location.pathname.replace(/^\\//, '') || 'overview';
  const [section, setSection] = useState(initialSection);
  const signedIn = Boolean(localStorage.getItem('token'));
  const switchSection = key => { setSection(key); window.history.replaceState({}, '', key === 'overview' ? '/' : `/${key}`); };
  const labels = { datasets: '数据集管理', tasks: '任务中心', labeling: '标注工作台', quality: '审核质检', ai: 'AI 辅助标注', team: '团队与权限', exports: '导出与集成', settings: '平台设置' };
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span>✳</span><div><strong>标注台</strong><small>OPEN MARKER</small></div></div>
      <div className="workspace"><b>Jue Studio</b><small>个人工作区</small><span>⌄</span></div>
      <nav>{groups.map(([title, items]) => <div className="nav-group" key={title}><label>{title}</label>{items.map(([key, icon, text]) => <button className={section === key ? 'active' : ''} onClick={() => switchSection(key)} key={key}><i>{icon}</i>{text}{key === 'tasks' && <em>12</em>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help"><span>?</span><div><b>需要帮助？</b><small>查看产品使用指南</small></div></div><a href="/">← 返回惊觉社区</a></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="mobile-brand">标注台</div><div className="search">⌕ <span>搜索项目、数据集或任务</span><kbd>⌘ K</kbd></div><div className="top-actions"><button>♧</button><button>◔<i></i></button>{signedIn ? <div className="profile"><span>J</span><div><b>Jue</b><small>项目负责人</small></div>⌄</div> : <div className="auth"><a href="/login">登录</a><a className="primary-auth" href="/register">注册</a></div>}</div></header>
      <div className="content"><div className="heading"><div><label>JUE STUDIO / {section.toUpperCase()}</label><h1>{section === 'overview' ? <>早上好，Jue <span>✦</span></> : labels[section]}</h1></div>{section === 'overview' && <button className="create" onClick={() => switchSection('datasets')}>＋ 新建项目</button>}</div>
        {section === 'overview' ? <Overview metrics={metrics} projects={projects} /> : <Placeholder title={labels[section]} />}
      </div>
    </main>
  </div>;
}

function Overview({ metrics, projects }) { return <>
  <section className="hero"><div><label>DATA OPERATIONS / 2026.07</label><h2>让每一条数据，<em>都值得训练。</em></h2><p>从原始数据到高质量数据集，把标注、审核与模型迭代放在一个清晰的工作流里。</p></div><div className="orbit">ANNOTATE<b>+</b></div></section>
  <section className="metrics">{metrics.map(([label, value, change, tone]) => <div className="metric" key={label}><label>{label}</label><strong>{value}</strong><small className={tone}>↗ {change}</small></div>)}</section>
  <section className="grid"><div className="card projects"><div className="card-head"><div><label>PROJECT PULSE</label><h2>项目进度</h2></div><button>查看全部 →</button></div>{projects.map(([name, type, progress, status, color]) => <div className="project" key={name}><span className={`dot ${color}`}></span><div className="project-info"><b>{name}</b><small>{type}</small></div><div className="progress"><span><i style={{ width: `${progress}%` }}></i></span><b>{progress}%</b></div><label className={progress === 100 ? 'done' : ''}>{status}</label></div>)}</div>
    <div className="card activity"><div className="card-head"><div><label>LIVE FEED</label><h2>实时动态</h2></div><small className="live">● LIVE</small></div>{[['林', '林晓', '城市道路', '128 条标注', '刚刚'], ['周', '周予安', '安全行为采集', '驳回 6 条数据', '12 分钟前'], ['AI', 'AI 预标注', '客服意图识别', '生成 2,340 条建议', '1 小时前']].map(([avatar, who, subject, action, time]) => <div className="feed" key={who}><span>{avatar}</span><p><b>{who}</b> {action}<strong>{subject}</strong><small>{time}</small></p></div>)}</div>
  </section>
</>; }

function Placeholder({ title }) { return <section className="placeholder"><label>MODULE PREVIEW</label><h2>{title}</h2><p>模块框架已就位，下一步可接入数据集、任务和审核接口。</p><div><b>下一步</b><span>定义页面数据结构</span><span>接入鉴权与业务接口</span></div></section>; }

export default App;
