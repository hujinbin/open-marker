import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'video-link-helper-history'

const initialFaqs = [
  ['可以解析哪些链接？', '仅识别你拥有或已获授权的公开媒体直链，例如 .mp4、.webm、.mov 文件。'],
  ['为什么有些链接无法使用？', '部分平台链接需要登录、受版权或访问权限保护，纯前端页面无法也不会绕过这些限制。'],
  ['记录会上传吗？', '不会。解析记录只保存在当前浏览器的本地存储中。'],
]

function isDirectMediaUrl(value) {
  try {
    const url = new URL(value)
    return /^https?:$/.test(url.protocol) && /\.(mp4|webm|mov|m4v)(?:$|[?#])/i.test(url.href)
  } catch {
    return false
  }
}

function getPlatform(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return '未识别来源'
  }
}

function Icon({ name }) {
  const icons = { home: '⌂', user: '◯', paste: '⌘', tag: '◇', send: '↗', clock: '◷', bulb: '◉', check: '✓', close: '×', link: '↗' }
  return <span className={`icon icon-${name}`} aria-hidden="true">{icons[name] || '•'}</span>
}

function Modal({ title, children, onClose }) {
  return <div className="modal-mask" role="presentation" onClick={onClose}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
      <div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><Icon name="close" /></button></div>
      {children}
    </section>
  </div>
}

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [link, setLink] = useState('')
  const [result, setResult] = useState(null)
  const [notice, setNotice] = useState('永久免费，记录仅保存在本机浏览器')
  const [modal, setModal] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
    } catch {
      setHistory([])
    }
  }, [])

  const canExtract = useMemo(() => link.trim().length > 0, [link])

  function saveHistory(item) {
    const next = [item, ...history.filter(entry => entry.url !== item.url)].slice(0, 20)
    setHistory(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function handleExtract(value = link) {
    const url = value.trim()
    if (!url) {
      setNotice('请先粘贴一个媒体链接')
      return
    }
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      setResult({ status: 'error', message: '链接格式不正确，请粘贴完整的 http 或 https 地址。' })
      return
    }
    const item = { url: parsed.href, host: getPlatform(parsed.href), time: new Date().toLocaleString('zh-CN', { hour12: false }), direct: isDirectMediaUrl(parsed.href) }
    saveHistory(item)
    setResult(item.direct ? { status: 'ready', ...item } : { status: 'limited', ...item })
    setActiveTab('home')
  }

  async function pasteLink() {
    try {
      const value = await navigator.clipboard.readText()
      setLink(value)
      setNotice(value ? '已从剪贴板粘贴链接' : '剪贴板里没有可用链接')
    } catch {
      setNotice('请手动粘贴链接，浏览器未授予剪贴板权限')
    }
  }

  async function copyInvite() {
    const text = '视频链接助手：本地识别已授权的公开媒体直链。'
    try {
      await navigator.clipboard.writeText(text)
      setNotice('邀请文案已复制')
    } catch {
      setNotice('复制失败，请手动分享页面地址')
    }
  }

  function clearHistory() {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
    setNotice('本地记录已清空')
  }

  return <main className="app-shell">
    <header className="app-header"><span className="app-title">视频链接助手</span><div className="mini-controls"><i></i><i></i><i></i></div></header>
    {activeTab === 'home' ? <>
      <div className="notice"><span className="notice-mark">⌁</span>{notice}</div>
      <section className="extract-card" aria-label="链接识别">
        <input value={link} onChange={event => setLink(event.target.value)} onKeyDown={event => event.key === 'Enter' && handleExtract()} placeholder="粘贴已授权的公开媒体直链" inputMode="url" />
        <button className="primary" disabled={!canExtract} onClick={() => handleExtract()}>开始识别</button>
        <button className="paste" onClick={pasteLink}>粘贴</button>
      </section>
      <p className="rights-note">仅处理用户拥有或获授权的公开媒体链接，不保存视频内容。</p>
      {result && <section className={`result-card ${result.status}`}>
        {result.status === 'ready' && <><span className="result-ok"><Icon name="check" /></span><div><b>识别到公开媒体直链</b><p>{result.host}</p></div><a href={result.url} target="_blank" rel="noreferrer">打开媒体 <Icon name="link" /></a></>}
        {result.status === 'limited' && <><span className="result-warn">!</span><div><b>链接已记录，但不是公开媒体直链</b><p>来源：{result.host}。请确认你有访问和使用权限。</p></div></>}
        {result.status === 'error' && <><span className="result-warn">!</span><div><b>无法识别</b><p>{result.message}</p></div></>}
      </section>}
      <section className="feature-grid">
        <button onClick={() => setModal('guide')}><Icon name="tag" /><b>使用教程</b></button>
        <button onClick={copyInvite}><Icon name="send" /><b>邀请好友</b></button>
        <button onClick={() => setModal('history')}><Icon name="clock" /><b>历史记录</b></button>
        <button onClick={() => setModal('faq')}><Icon name="bulb" /><b>常见问题</b></button>
      </section>
    </> : <section className="profile-page">
      <div className="avatar">视</div><h1>本地工具模式</h1><p>没有账号，不上传链接或媒体文件。</p>
      <div className="profile-card"><div><span>本地识别记录</span><b>{history.length} 条</b></div><button onClick={() => setModal('history')}>查看</button></div>
      <div className="profile-card"><div><span>数据存储位置</span><b>当前浏览器</b></div><button onClick={clearHistory}>清空</button></div>
    </section>}
    <nav className="tabbar"><button className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}><Icon name="home" />首页</button><button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}><Icon name="user" />我的</button></nav>
    {modal === 'guide' && <Modal title="使用教程" onClose={() => setModal(null)}><ol className="steps"><li>确认你拥有媒体内容，或已获得内容使用授权。</li><li>复制公开的媒体直链，例如以 `.mp4` 或 `.webm` 结尾的地址。</li><li>粘贴后点击“开始识别”，直链会在新页面打开。</li></ol></Modal>}
    {modal === 'faq' && <Modal title="常见问题" onClose={() => setModal(null)}><div className="faq-list">{initialFaqs.map(([question, answer]) => <article key={question}><b>{question}</b><p>{answer}</p></article>)}</div></Modal>}
    {modal === 'history' && <Modal title="历史记录" onClose={() => setModal(null)}><div className="history-list">{history.length ? history.map(item => <button key={item.url} onClick={() => { setLink(item.url); setModal(null); handleExtract(item.url) }}><span><b>{item.host}</b><small>{item.time}</small></span><Icon name="link" /></button>) : <p className="empty">还没有本地识别记录。</p>}</div>{history.length > 0 && <button className="text-danger" onClick={clearHistory}>清空全部记录</button>}</Modal>}
  </main>
}

export default App
