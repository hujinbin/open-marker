const HISTORY_KEY = 'video-link-helper-history'

Page({
  data: { count: 0 },
  onShow() { this.setData({ count: (wx.getStorageSync(HISTORY_KEY) || []).length }) },
  clearHistory() {
    wx.showModal({ title: '清空本地记录', content: '此操作只会清空当前微信的本地记录。', success: ({ confirm }) => { if (confirm) { wx.removeStorageSync(HISTORY_KEY); this.setData({ count: 0 }); wx.showToast({ title: '已清空', icon: 'success' }) } } })
  }
})
