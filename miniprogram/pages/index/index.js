const HISTORY_KEY = 'video-link-helper-history'

function isDirectMediaUrl(value) {
  return /^https?:\/\/.+\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(value)
}

function getHost(value) {
  const matched = value.match(/^https?:\/\/([^/?#]+)/i)
  return matched ? matched[1].replace(/^www\./, '') : '未识别来源'
}

Page({
  data: {
    link: '',
    notice: '永久免费，记录仅保存在本机',
    result: null,
    panel: '',
    history: []
  },

  onShow() {
    this.loadHistory()
  },

  onInput(event) {
    this.setData({ link: event.detail.value })
  },

  loadHistory() {
    this.setData({ history: wx.getStorageSync(HISTORY_KEY) || [] })
  },

  pasteLink() {
    wx.getClipboardData({
      success: ({ data }) => this.setData({ link: data || '', notice: data ? '已从剪贴板粘贴链接' : '剪贴板里没有可用链接' }),
      fail: () => this.setData({ notice: '读取剪贴板失败，请手动粘贴链接' })
    })
  },

  extract() {
    const url = this.data.link.trim()
    if (!url) {
      this.setData({ notice: '请先粘贴一个媒体链接' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      this.setData({ result: { status: 'error', message: '链接格式不正确，请粘贴完整的 http 或 https 地址。' } })
      return
    }
    const item = { url, host: getHost(url), time: new Date().toLocaleString('zh-CN', { hour12: false }), direct: isDirectMediaUrl(url) }
    const history = [item, ...this.data.history.filter(entry => entry.url !== item.url)].slice(0, 20)
    wx.setStorageSync(HISTORY_KEY, history)
    this.setData({ history, result: item.direct ? { status: 'ready', ...item } : { status: 'limited', ...item } })
  },

  copyResult() {
    wx.setClipboardData({ data: this.data.result.url, success: () => wx.showToast({ title: '链接已复制', icon: 'success' }) })
  },

  openPanel(event) {
    const panel = event.currentTarget.dataset.panel
    this.setData({ panel })
  },

  closePanel() {
    this.setData({ panel: '' })
  },

  reuseHistory(event) {
    const url = event.currentTarget.dataset.url
    this.setData({ link: url, panel: '' })
    this.extract()
  },

  invite() {
    wx.setClipboardData({ data: '视频链接助手：本地识别已授权的公开媒体直链。', success: () => wx.showToast({ title: '邀请文案已复制', icon: 'success' }) })
  },

  clearHistory() {
    wx.removeStorageSync(HISTORY_KEY)
    this.setData({ history: [], panel: '', notice: '本地记录已清空' })
  }
})
