Page({
  data: {
    conversations: []
  },

  onLoad() {
    this.loadConversations();
  },

  // 加载会话历史
  loadConversations() {
    try {
      const conversations = wx.getStorageSync('conversations') || [];
      this.setData({
        conversations: conversations
      });
    } catch (error) {
      console.error('加载会话历史失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    }
  },

  // 选择会话
  selectConversation(e) {
    const conversationId = e.currentTarget.dataset.id;
    const conversation = this.data.conversations.find(c => c.id === conversationId);

    if (conversation) {
      // 返回聊天页面并传递会话数据
      const pages = getCurrentPages();
      const chatPage = pages[pages.length - 2]; // 上一个页面应该是聊天页面

      if (chatPage && chatPage.loadConversation) {
        chatPage.loadConversation(conversation);
        wx.navigateBack();
      } else {
        // 如果没有聊天页面，直接跳转并传递参数
        wx.redirectTo({
          url: `/pages/chat/chat?conversationId=${conversationId}`
        });
      }
    }
  },

  // 删除会话
  deleteConversation(e) {
    const conversationId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '删除会话',
      content: '确定要删除这个会话吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          try {
            let conversations = wx.getStorageSync('conversations') || [];
            conversations = conversations.filter(c => c.id !== conversationId);
            wx.setStorageSync('conversations', conversations);
            
            this.setData({
              conversations: conversations
            });
            
            wx.showToast({
              title: '已删除',
              icon: 'success'
            });
          } catch (error) {
            console.error('删除会话失败:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            });
          }
        }
      }
    });
  },

  // 清空所有会话
  clearAllConversations() {
    wx.showModal({
      title: '清空历史',
      content: '确定要清空所有会话历史吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.removeStorageSync('conversations');
            this.setData({
              conversations: []
            });
            
            wx.showToast({
              title: '已清空',
              icon: 'success'
            });
          } catch (error) {
            console.error('清空会话失败:', error);
            wx.showToast({
              title: '清空失败',
              icon: 'error'
            });
          }
        }
      }
    });
  },

  // 返回聊天页面
  goBack() {
    wx.navigateBack();
  }
});
