// pages/chat/chat.js
const app = getApp();

Page({
  data: {
    messages: [],
    inputValue: '',
    loading: false,
    scrollIntoView: '',
    isGenerating: false, // AI是否正在生成回答
    currentRequestTask: null, // 当前请求任务，用于中断
    selectedMessages: [], // 选中的消息
    showActionBar: false, // 是否显示底部操作栏
    teacherCards: [], // 教师卡片数据
    conversationTitle: '会话标题', // 会话标题
    conversationId: null, // 会话ID
    isFirstMessage: true // 是否为第一条消息
  },

  onLoad(options) {
    // 强制更新为云服务地址
    const cloudApiBase = 'https://cloud1-6g8dk2rk74e3d4e9.service.tcloudbase.com/api';
    if (app.globalData.apiBase !== cloudApiBase) {
      app.globalData.apiBase = cloudApiBase;
      app.globalData.apiBaseOptions = [cloudApiBase];
    }

    console.log('聊天页面加载');
    console.log('当前API地址:', app.globalData.apiBase);
    console.log('所有可用API地址:', app.globalData.apiBaseOptions);

    // 获取网络类型
    wx.getNetworkType({
      success: (res) => {
        console.log('网络类型:', res.networkType);
      }
    });

    // 如果有传入会话ID，加载指定会话
    if (options.conversationId) {
      this.loadConversationById(options.conversationId);
    } else {
      // 尝试恢复最近的会话标题
      this.tryRestoreLastConversation();
    }
  },

  // 通过ID加载会话
  loadConversationById(conversationId) {
    try {
      const conversations = wx.getStorageSync('conversations') || [];
      const conversation = conversations.find(c => c.id === conversationId);

      if (conversation) {
        this.setData({
          messages: conversation.messages || [],
          teacherCards: conversation.teacherCards || [],
          conversationTitle: conversation.title,
          conversationId: conversation.id,
          isFirstMessage: false
        });

        this.scrollToBottom();
      }
    } catch (error) {
      console.error('加载指定会话失败:', error);
    }
  },

  // 尝试恢复最近的会话
  tryRestoreLastConversation() {
    try {
      const conversations = wx.getStorageSync('conversations') || [];
      if (conversations.length > 0) {
        const lastConversation = conversations[0];
        // 只恢复标题，不恢复消息内容
        if (lastConversation.title && lastConversation.title !== '会话标题') {
          this.setData({
            conversationTitle: lastConversation.title,
            conversationId: lastConversation.id,
            isFirstMessage: false
          });
        }
      }
    } catch (error) {
      console.error('恢复会话失败:', error);
    }
  },

  onShow() {
    console.log('聊天页面显示');
  },

  onReady() {
    console.log('聊天页面渲染完成');
  },

  onUnload() {
    // 页面卸载时保存当前会话
    this.saveCurrentConversation();
  },

  onHide() {
    // 页面隐藏时保存当前会话
    this.saveCurrentConversation();
  },

  // 输入框内容变化
  onInputChange(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  // 发送消息或暂停生成
  sendMessage() {
    // 如果正在生成，则暂停
    if (this.data.isGenerating) {
      this.stopGeneration();
      return;
    }

    const message = this.data.inputValue.trim();
    if (!message) return;

    // 重置中断标志
    this.userAborted = false;

    // 添加用户消息
    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date().toLocaleTimeString()
    };

    // 更新界面
    this.setData({
      messages: [...this.data.messages, userMessage],
      inputValue: '',
      loading: true,
      isGenerating: true
    });

    // 滚动到底部
    this.scrollToBottom();

    // 如果是第一条消息，生成会话标题
    if (this.data.isFirstMessage) {
      this.generateConversationTitle(message);
      this.setData({
        isFirstMessage: false
      });
    }

    // 发送请求到后端
    this.requestAPI(message);
  },

  // 停止AI生成
  stopGeneration() {
    console.log('用户中断AI生成');

    // 标记为用户主动中断
    this.userAborted = true;

    // 中断当前请求
    if (this.data.currentRequestTask) {
      this.data.currentRequestTask.abort();
    }

    // 更新状态
    this.setData({
      isGenerating: false,
      loading: false,
      currentRequestTask: null
    });

    // 在最后一条AI消息添加重来和继续按钮
    this.addActionButtonsToLastMessage();
  },

  // 为最后一条AI消息添加操作按钮
  addActionButtonsToLastMessage() {
    const messages = [...this.data.messages];
    let lastMessage = messages[messages.length - 1];

    // 如果最后一条不是AI消息，创建一个新的AI消息
    if (!lastMessage || lastMessage.type !== 'assistant') {
      const newAIMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '回答被中断...',
        timestamp: new Date().toLocaleTimeString(),
        showActions: true
      };
      messages.push(newAIMessage);
    } else {
      lastMessage.showActions = true;
      lastMessage.content = lastMessage.content || '回答被中断...';
    }

    this.setData({
      messages: messages
    });
  },

  // API请求方法
  async requestAPI(message) {
    console.log('发送API请求:', message);
    console.log('使用云函数调用模式:', app.globalData.useCloudFunction);

    try {
      // 使用app.request方法（支持云函数调用）
      const res = await app.request({
        url: '/chat/message',
        method: 'POST',
        data: {
          message: message,
          conversationId: 'default'
        }
      });

      console.log('API响应:', res);

      if (res && (res.message || res.reply)) {
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: res.message || res.reply || '抱歉，我暂时无法回答您的问题。',
          timestamp: new Date().toLocaleTimeString(),
          showActions: false // 正常完成的回答不显示操作按钮
        };

        this.setData({
          messages: [...this.data.messages, assistantMessage],
          loading: false,
          isGenerating: false,
          currentRequestTask: null
        });

        // 显示真实的教师推荐卡片
        this.showTeacherRecommendations(res);

        this.scrollToBottom();
      } else {
        console.error('API响应错误:', res);
        this.handleAPIError('服务器响应异常');
      }
    } catch (err) {
      console.error('请求失败:', err);

      // 如果是用户主动中断，不显示错误提示
      if (this.userAborted) {
        console.log('用户主动中断请求，不显示错误');
        this.userAborted = false; // 重置标志
        return;
      }

      // 真正的网络错误才显示提示
      this.handleAPIError('网络请求失败: ' + (err.message || '未知错误'));
    }
  },

  // 处理API错误
  handleAPIError(message) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 3000
    });

    // 添加错误消息到聊天记录
    const errorMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: `抱歉，${message}。请稍后重试。`
    };

    this.setData({
      messages: [...this.data.messages, errorMessage],
      loading: false,
      isGenerating: false,
      currentRequestTask: null
    });

    this.scrollToBottom();
  },

  // 滚动到底部
  scrollToBottom() {
    this.setData({
      scrollIntoView: 'messagesEndRef'
    });
  },

  // 重新生成回答
  regenerateAnswer(e) {
    const messageId = e.currentTarget.dataset.id;
    const messages = [...this.data.messages];
    const messageIndex = messages.findIndex(msg => msg.id === messageId);

    if (messageIndex > 0) {
      // 找到对应的用户消息
      const userMessage = messages[messageIndex - 1];
      if (userMessage && userMessage.type === 'user') {
        // 移除当前AI回答
        messages.splice(messageIndex, 1);
        this.setData({
          messages: messages,
          isGenerating: true,
          loading: true
        });

        // 重新发送请求
        this.requestAPI(userMessage.content);
      }
    }
  },

  // 继续生成回答
  continueAnswer(e) {
    const messageId = e.currentTarget.dataset.id;
    const messages = [...this.data.messages];
    const messageIndex = messages.findIndex(msg => msg.id === messageId);

    if (messageIndex >= 0) {
      const message = messages[messageIndex];
      // 隐藏操作按钮，继续生成
      message.showActions = false;
      this.setData({
        messages: messages,
        isGenerating: true,
        loading: true
      });

      // 这里可以实现继续生成的逻辑
      // 暂时模拟继续生成
      setTimeout(() => {
        message.content += '\n\n[继续生成的内容...]';
        this.setData({
          messages: messages,
          isGenerating: false,
          loading: false
        });
      }, 1000);
    }
  },

  // 显示教师推荐卡片
  showTeacherRecommendations(apiResponse) {
    // 从API响应中解析教师推荐数据
    if (apiResponse && apiResponse.professors && apiResponse.professors.length > 0) {
      const teachers = apiResponse.professors.map(prof => ({
        id: prof.id || `teacher-${Date.now()}-${Math.random()}`,
        name: prof.name || '未知教师',
        title: prof.title || '教师',
        research: prof.research_areas || '暂无研究方向信息',
        department: prof.department || '未知学院',
        email: prof.email || '暂无邮箱',
        office: prof.office || '暂无办公地址',
        education: prof.education || '暂无学历信息',
        bio: prof.bio || '暂无个人简介',
        achievements: this.parseAchievements(prof.bio) // 从简介中提取成就
      }));

      this.setData({
        teacherCards: teachers
      });
    } else {
      // 如果API没有返回教师数据，显示提示
      console.log('API响应中没有教师推荐数据');
      this.setData({
        teacherCards: []
      });
    }
  },

  // 从个人简介中提取主要成就
  parseAchievements(bio) {
    if (!bio) return [];

    const achievements = [];
    const text = bio.toLowerCase();

    // 简单的关键词匹配来提取成就
    if (text.includes('sci') || text.includes('论文')) {
      achievements.push('发表高质量学术论文');
    }
    if (text.includes('基金') || text.includes('项目')) {
      achievements.push('主持重要科研项目');
    }
    if (text.includes('奖') || text.includes('获得')) {
      achievements.push('获得重要学术奖项');
    }
    if (text.includes('专利')) {
      achievements.push('拥有发明专利');
    }

    return achievements.length > 0 ? achievements : ['在相关领域有丰富研究经验'];
  },

  // 长按消息或卡片
  onMessageLongPress(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type;

    console.log('长按选择:', id, type);

    // 进入选择模式，只选中当前长按的项
    this.setData({
      showActionBar: true,
      selectedMessages: [id] // 默认只选中当前长按的项
    });

    wx.vibrateShort(); // 震动反馈

    // 阻止事件冒泡
    e.stopPropagation();
  },

  // 切换消息选择状态
  toggleMessageSelection(e) {
    const id = e.currentTarget.dataset.id;
    let selectedMessages = [...this.data.selectedMessages];

    const index = selectedMessages.indexOf(id);
    if (index > -1) {
      selectedMessages.splice(index, 1);
    } else {
      selectedMessages.push(id);
    }

    this.setData({
      selectedMessages: selectedMessages,
      showActionBar: selectedMessages.length > 0
    });

    // 阻止事件冒泡
    e.stopPropagation();
  },

  // 复制选中内容
  copySelectedContent() {
    const selectedIds = this.data.selectedMessages;
    let content = '';

    selectedIds.forEach(id => {
      if (id.startsWith('teacher-')) {
        // 教师卡片
        const teacherId = id.replace('teacher-', '');
        const teacher = this.data.teacherCards.find(t => t.id === teacherId);
        if (teacher) {
          content += `教师：${teacher.name}\n研究方向：${teacher.research}\n`;
        }
      } else {
        // 消息
        const message = this.data.messages.find(m => m.id === id);
        if (message) {
          content += `${message.type === 'user' ? '用户' : 'AI'}：${message.content}\n`;
        }
      }
      content += '\n';
    });

    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        });
        this.exitSelectionMode();
      }
    });
  },

  // 微信分享
  shareToWeChat() {
    const selectedIds = this.data.selectedMessages;
    if (selectedIds.length === 0) {
      wx.showToast({
        title: '请先选择内容',
        icon: 'none'
      });
      return;
    }

    // 生成分享内容
    let shareContent = '来自智能科研匹配的推荐：\n\n';

    selectedIds.forEach(id => {
      if (id.startsWith('teacher-')) {
        const teacherId = id.replace('teacher-', '');
        const teacher = this.data.teacherCards.find(t => t.id === teacherId);
        if (teacher) {
          shareContent += `👨‍🏫 ${teacher.name} (${teacher.title})\n`;
          shareContent += `🔬 ${teacher.research}\n`;
          shareContent += `🏫 ${teacher.department}\n\n`;
        }
      } else {
        const message = this.data.messages.find(m => m.id === id);
        if (message && message.type === 'assistant') {
          shareContent += `💡 AI推荐：${message.content.substring(0, 100)}...\n\n`;
        }
      }
    });

    shareContent += '📱 来自浙大智能科研匹配小程序';

    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    // 设置分享内容
    wx.onShareAppMessage(() => {
      return {
        title: '智能科研匹配推荐',
        path: '/pages/chat/chat',
        imageUrl: '/images/share-cover.jpg' // 需要添加分享封面图
      };
    });

    wx.showToast({
      title: '请点击右上角分享',
      icon: 'none'
    });
  },

  // 生成分享长图
  generateShareImage() {
    const selectedIds = this.data.selectedMessages;
    if (selectedIds.length === 0) {
      wx.showToast({
        title: '请先选择内容',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '生成长图中...',
      mask: true
    });

    // 创建Canvas上下文
    const query = wx.createSelectorQuery();
    query.select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          this.drawShareImage(res[0].node, selectedIds);
        } else {
          // 如果Canvas不存在，先添加到页面
          this.addCanvasToPage();
        }
      });
  },

  // 添加Canvas到页面
  addCanvasToPage() {
    // 这里需要在WXML中添加隐藏的Canvas元素
    wx.hideLoading();
    wx.showModal({
      title: '功能提示',
      content: '长图生成功能需要Canvas支持，请确保页面已正确配置',
      showCancel: false
    });
  },

  // 绘制分享图片
  drawShareImage(canvas, selectedIds) {
    const ctx = canvas.getContext('2d');
    const dpr = wx.getSystemInfoSync().pixelRatio;

    // 设置Canvas尺寸
    const canvasWidth = 750;
    const canvasHeight = 1200;

    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    // 绘制背景
    ctx.fillStyle = '#f8f9ff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 绘制标题
    ctx.fillStyle = '#333';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('智能科研匹配推荐', canvasWidth / 2, 80);

    let currentY = 150;

    // 绘制选中的内容
    selectedIds.forEach((id) => {
      if (id.startsWith('teacher-')) {
        const teacherId = id.replace('teacher-', '');
        const teacher = this.data.teacherCards.find(t => t.id === teacherId);
        if (teacher) {
          currentY = this.drawTeacherCard(ctx, teacher, currentY, canvasWidth);
        }
      } else {
        const message = this.data.messages.find(m => m.id === id);
        if (message) {
          currentY = this.drawMessageCard(ctx, message, currentY, canvasWidth);
        }
      }
      currentY += 40; // 间距
    });

    // 绘制底部广告区域
    this.drawAdvertisement(ctx, canvasWidth, canvasHeight);

    // 保存图片
    wx.canvasToTempFilePath({
      canvas: canvas,
      success: (res) => {
        wx.hideLoading();
        this.showShareImagePreview(res.tempFilePath);
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('生成图片失败:', err);
        wx.showToast({
          title: '生成失败',
          icon: 'error'
        });
      }
    });
  },

  // 绘制教师卡片
  drawTeacherCard(ctx, teacher, startY, canvasWidth) {
    const cardHeight = 200;
    const padding = 30;

    // 绘制卡片背景
    ctx.fillStyle = 'white';
    ctx.fillRect(padding, startY, canvasWidth - padding * 2, cardHeight);

    // 绘制边框
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, startY, canvasWidth - padding * 2, cardHeight);

    // 绘制教师信息
    ctx.fillStyle = '#333';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(teacher.name, padding + 20, startY + 40);

    ctx.fillStyle = '#666';
    ctx.font = '20px sans-serif';
    ctx.fillText(teacher.title, padding + 20, startY + 70);
    ctx.fillText(`研究方向: ${teacher.research}`, padding + 20, startY + 100);
    ctx.fillText(`所属学院: ${teacher.department}`, padding + 20, startY + 130);

    return startY + cardHeight;
  },

  // 绘制消息卡片
  drawMessageCard(ctx, message, startY, canvasWidth) {
    const padding = 30;
    const maxWidth = canvasWidth - padding * 2 - 40;

    // 计算文本高度
    ctx.font = '24px sans-serif';
    const lines = this.wrapText(ctx, message.content, maxWidth);
    const lineHeight = 35;
    const cardHeight = lines.length * lineHeight + 60;

    // 绘制卡片背景
    ctx.fillStyle = message.type === 'user' ? '#007aff' : '#f0f0f0';
    ctx.fillRect(padding, startY, canvasWidth - padding * 2, cardHeight);

    // 绘制文本
    ctx.fillStyle = message.type === 'user' ? 'white' : '#333';
    ctx.textAlign = 'left';

    lines.forEach((line, index) => {
      ctx.fillText(line, padding + 20, startY + 35 + index * lineHeight);
    });

    return startY + cardHeight;
  },

  // 文本换行处理
  wrapText(ctx, text, maxWidth) {
    const words = text.split('');
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine + words[i];
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    return lines;
  },

  // 绘制广告区域
  drawAdvertisement(ctx, canvasWidth, canvasHeight) {
    const adHeight = 150;
    const adY = canvasHeight - adHeight;

    // 绘制广告背景
    ctx.fillStyle = '#f0f4ff';
    ctx.fillRect(0, adY, canvasWidth, adHeight);

    // 绘制分割线
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, adY);
    ctx.lineTo(canvasWidth, adY);
    ctx.stroke();

    // 绘制二维码占位符
    const qrSize = 80;
    const qrX = canvasWidth - qrSize - 30;
    const qrY = adY + 35;

    ctx.fillStyle = '#ddd';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);

    // 绘制广告文字
    ctx.fillStyle = '#666';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('扫码体验浙大智能科研匹配', 30, adY + 50);
    ctx.fillText('具体与奇迹没想好，等运营方案', 30, adY + 80);

    // 绘制二维码标识
    ctx.fillStyle = '#333';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('二维码', qrX + qrSize/2, qrY + qrSize + 20);
  },

  // 显示分享图片预览
  showShareImagePreview(imagePath) {
    wx.previewImage({
      urls: [imagePath],
      success: () => {
        this.exitSelectionMode();
      }
    });
  },

  // 退出选择模式
  exitSelectionMode() {
    this.setData({
      showActionBar: false,
      selectedMessages: []
    });
  },

  // 生成会话标题
  generateConversationTitle(firstMessage) {
    // 提取关键词生成标题
    const keywords = this.extractKeywords(firstMessage);
    let title = '';

    if (keywords.length > 0) {
      // 根据关键词生成标题
      if (keywords.includes('教授') || keywords.includes('老师') || keywords.includes('导师')) {
        title = `寻找${keywords.filter(k => !['教授', '老师', '导师', '找', '寻找'].includes(k)).slice(0, 2).join('、')}教授`;
      } else if (keywords.includes('合作') || keywords.includes('项目')) {
        title = `${keywords.slice(0, 2).join('、')}合作咨询`;
      } else if (keywords.includes('研究') || keywords.includes('科研')) {
        title = `${keywords.slice(0, 2).join('、')}研究咨询`;
      } else {
        title = `${keywords.slice(0, 3).join('、')}咨询`;
      }
    } else {
      // 如果没有关键词，使用默认标题
      title = `科研咨询 ${new Date().toLocaleDateString()}`;
    }

    // 限制标题长度
    if (title.length > 15) {
      title = title.substring(0, 15) + '...';
    }

    this.setData({
      conversationTitle: title
    });

    // 保存到本地存储
    this.saveConversationTitle(title);
  },

  // 提取关键词
  extractKeywords(text) {
    // 简单的关键词提取
    const commonWords = ['我', '想', '要', '找', '寻找', '需要', '希望', '可以', '能否', '请', '帮', '助', '的', '了', '吗', '呢', '吧'];
    const words = text.replace(/[，。！？；：""''（）【】]/g, ' ').split(/\s+/).filter(word =>
      word.length > 1 && !commonWords.includes(word)
    );

    return words.slice(0, 5); // 返回前5个关键词
  },

  // 保存会话标题
  saveConversationTitle(title) {
    try {
      const conversationId = this.data.conversationId || Date.now().toString();
      const conversations = wx.getStorageSync('conversations') || [];

      // 查找现有会话或创建新会话
      let conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) {
        conversation = {
          id: conversationId,
          title: title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        conversations.unshift(conversation);
      } else {
        conversation.title = title;
        conversation.updatedAt = new Date().toISOString();
      }

      // 只保留最近50个会话
      if (conversations.length > 50) {
        conversations.splice(50);
      }

      wx.setStorageSync('conversations', conversations);
      this.setData({
        conversationId: conversationId
      });
    } catch (error) {
      console.error('保存会话标题失败:', error);
    }
  },

  // 点击消息区域
  onMessagesAreaTap(e) {
    // 如果在选择模式下点击空白区域，退出选择模式
    if (this.data.showActionBar && e.target === e.currentTarget) {
      this.exitSelectionMode();
    }
  },

  // 开始新会话
  startNewConversation() {
    wx.showModal({
      title: '新建会话',
      content: '确定要开始新的会话吗？当前会话内容将被保存。',
      success: (res) => {
        if (res.confirm) {
          // 保存当前会话
          this.saveCurrentConversation();

          // 重置页面状态
          this.setData({
            messages: [],
            teacherCards: [],
            conversationTitle: '会话标题',
            conversationId: null,
            isFirstMessage: true,
            selectedMessages: [],
            showActionBar: false,
            isGenerating: false,
            loading: false
          });

          wx.showToast({
            title: '新会话已创建',
            icon: 'success'
          });
        }
      }
    });
  },

  // 显示会话历史
  showConversationHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },

  // 保存当前会话
  saveCurrentConversation() {
    if (this.data.messages.length === 0) return;

    try {
      const conversationId = this.data.conversationId || Date.now().toString();
      const conversations = wx.getStorageSync('conversations') || [];

      const conversationData = {
        id: conversationId,
        title: this.data.conversationTitle,
        messages: this.data.messages,
        teacherCards: this.data.teacherCards,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 查找现有会话或添加新会话
      const existingIndex = conversations.findIndex(c => c.id === conversationId);
      if (existingIndex >= 0) {
        conversations[existingIndex] = conversationData;
      } else {
        conversations.unshift(conversationData);
      }

      // 只保留最近50个会话
      if (conversations.length > 50) {
        conversations.splice(50);
      }

      wx.setStorageSync('conversations', conversations);
    } catch (error) {
      console.error('保存会话失败:', error);
    }
  },

  // 加载会话
  loadConversation(conversation) {
    wx.showModal({
      title: '加载会话',
      content: `确定要加载会话"${conversation.title}"吗？当前会话内容将被保存。`,
      success: (res) => {
        if (res.confirm) {
          // 保存当前会话
          this.saveCurrentConversation();

          // 加载选中的会话
          this.setData({
            messages: conversation.messages || [],
            teacherCards: conversation.teacherCards || [],
            conversationTitle: conversation.title,
            conversationId: conversation.id,
            isFirstMessage: false,
            selectedMessages: [],
            showActionBar: false,
            isGenerating: false,
            loading: false
          });

          this.scrollToBottom();

          wx.showToast({
            title: '会话已加载',
            icon: 'success'
          });
        }
      }
    });
  },

  // 测试网络连接（调试用）
  testNetworkConnection() {
    console.log('🔧 手动测试网络连接...');

    wx.showLoading({
      title: '测试连接中...',
      mask: true
    });

    let successCount = 0;
    let totalCount = app.globalData.apiBaseOptions.length;

    app.globalData.apiBaseOptions.forEach((apiUrl, index) => {
      console.log(`测试地址 ${index + 1}/${totalCount}: ${apiUrl}`);

      wx.request({
        url: apiUrl + '/health',
        method: 'GET',
        timeout: 8000,
        success: (res) => {
          successCount++;
          console.log(`✅ ${apiUrl} - 连接成功:`, res);

          if (index === totalCount - 1) {
            wx.hideLoading();
            wx.showModal({
              title: '连接测试完成',
              content: `成功: ${successCount}/${totalCount}\n可用地址: ${apiUrl}`,
              showCancel: false
            });
          }
        },
        fail: (err) => {
          console.log(`❌ ${apiUrl} - 连接失败:`, err);
          console.log(`错误详情: errno=${err.errno}, errMsg=${err.errMsg}`);

          if (index === totalCount - 1) {
            wx.hideLoading();
            if (successCount === 0) {
              wx.showModal({
                title: '连接测试失败',
                content: '所有地址都无法连接\n可能原因:\n1. 后端服务未启动\n2. 网络代理设置问题\n3. 防火墙阻止\n4. 不在同一网络',
                showCancel: false
              });
            }
          }
        }
      });
    });
  }
});
