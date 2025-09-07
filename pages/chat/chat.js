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
    conversationTitle: '会话标题', // 默认会话标题
    conversationId: null, // 会话ID
    isFirstMessage: true, // 是否为第一条消息
    thinkingTime: 0, // 预计思考时间（秒）
    showThinkingTime: false, // 是否显示思考时间
    thinkingCountdown: 0 // 思考时间倒计时
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

    // 加载收藏状态
    this.loadFavoriteStatus();
  },

  // 通过ID加载会话
  loadConversationById(conversationId) {
    try {
      const conversations = wx.getStorageSync('conversations') || [];
      const conversation = conversations.find(c => c.id === conversationId);

      if (conversation) {
        this.setData({
          messages: conversation.messages || [],
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
        // 只恢复标题，不恢复消息内容，且只有在标题不是默认值时才恢复
        if (lastConversation.title && 
            lastConversation.title !== '会话标题' && 
            lastConversation.title !== '会话标题') {
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
    // 清理定时器
    this.stopThinkingCountdown();
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
    }
    
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

  // 计算预计思考时间（基于问题复杂度）- 真实AI思考时间
  calculateThinkingTime(message) {
    const baseTime = 8; // 基础AI思考时间8秒
    let additionalTime = 0;

    // 根据消息长度增加思考时间
    const messageLength = message.length;
    if (messageLength > 30) additionalTime += 3;
    if (messageLength > 80) additionalTime += 5;
    if (messageLength > 150) additionalTime += 8;

    // 根据关键词判断AI分析复杂度
    const complexKeywords = [
      '研究', '项目', '合作', '导师', '博士', '硕士', 
      '论文', '实验', '算法', '模型', '分析', '设计',
      '推荐', '匹配', '比较', '评估', '详细', '具体',
      '深入', '全面', '专业', '系统'
    ];
    
    const researchKeywords = [
      '人工智能', 'AI', '机器学习', '深度学习', '数据挖掘',
      '计算机视觉', '自然语言处理', '大数据', '云计算', '区块链',
      '生物医学', '材料科学', '化学工程', '物理学', '数学'
    ];

    let keywordCount = 0;
    complexKeywords.forEach(keyword => {
      if (message.includes(keyword)) keywordCount++;
    });
    
    researchKeywords.forEach(keyword => {
      if (message.includes(keyword)) keywordCount++;
    });

    // 每个关键词增加2秒AI思考时间
    additionalTime += keywordCount * 2;

    // 复杂查询需要更多AI分析时间
    const questionCount = (message.match(/[？?]/g) || []).length;
    additionalTime += questionCount * 3;

    // 多轮对话需要更多上下文分析时间
    if (this.data.messages.length > 2) {
      additionalTime += 3;
    }

    // AI思考时间范围：8-30秒
    const totalTime = Math.min(Math.max(baseTime + additionalTime, 8), 30);
    
    console.log(`AI预计思考时间：${totalTime}秒（真实AI分析）`);
    return totalTime;
  },

  // 开始思考倒计时
  startThinkingCountdown(initialTime) {
    this.setData({
      thinkingTime: initialTime,
      showThinkingTime: true,
      thinkingCountdown: initialTime
    });

    // 清除之前的倒计时
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
    }

    // 开始倒计时
    this.thinkingTimer = setInterval(() => {
      const currentCountdown = this.data.thinkingCountdown;
      if (currentCountdown <= 1) {
        // 倒计时结束
        this.stopThinkingCountdown();
      } else {
        this.setData({
          thinkingCountdown: currentCountdown - 1
        });
      }
    }, 1000);
  },

  // 停止思考倒计时
  stopThinkingCountdown() {
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null;
    }
    
    this.setData({
      showThinkingTime: false,
      thinkingCountdown: 0
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

    // 计算预计思考时间
    const thinkingTime = this.calculateThinkingTime(message);
    
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

    // 开始思考倒计时
    this.startThinkingCountdown(thinkingTime);

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

    // 停止思考倒计时
    this.stopThinkingCountdown();

    // 中断流式生成定时器
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }

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
        showActions: true,
        isStreaming: false,
        teacherCards: []
      };
      messages.push(newAIMessage);
    } else {
      // 为现有的AI消息添加操作按钮
      lastMessage.showActions = true;
      lastMessage.isStreaming = false; // 停止流式状态
      
      // 如果内容为空，添加提示文本
      if (!lastMessage.content || lastMessage.content.trim() === '') {
        lastMessage.content = '回答被中断...';
      }
    }

    this.setData({
      messages: messages
    });

    console.log('已为消息添加操作按钮:', lastMessage);
  },

  // 构建对话上下文 🆕
  buildConversationContext() {
    const messages = this.data.messages;
    const context = [];
    
    // 只保留最近的6轮对话（3个来回）
    const recentMessages = messages.slice(-6);
    
    recentMessages.forEach(msg => {
      if (msg.type === 'user') {
        context.push({
          role: 'user',
          content: msg.content,
          timestamp: msg.timestamp
        });
      } else if (msg.type === 'assistant' && msg.content) {
        const contextItem = {
          role: 'assistant',
          content: msg.content,
          timestamp: msg.timestamp
        };
        
        // 添加教授信息到上下文
        if (msg.teacherCards && msg.teacherCards.length > 0) {
          contextItem.professors = msg.teacherCards.map(teacher => ({
            name: teacher.name,
            research_areas: teacher.research,
            department: teacher.department
          }));
        }
        
        context.push(contextItem);
      }
    });
    
    console.log('构建的对话上下文:', context);
    return context;
  },

  // API请求方法
  async requestAPI(message) {
    console.log('发送API请求:', message);
    console.log('使用云函数调用模式:', app.globalData.useCloudFunction);

    try {
      // 先创建空的助手消息
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString(),
        showActions: false,
        teacherCards: [],
        isStreaming: true // 标记正在流式生成
      };

      // 添加空消息到界面
      const messages = [...this.data.messages, assistantMessage];
      this.setData({
        messages: messages
      });

      // 开始流式请求
      await this.streamingRequest(message, assistantMessage.id);

    } catch (err) {
      console.error('请求失败:', err);

      // 如果是用户主动中断，不显示错误提示
      if (this.userAborted) {
        console.log('用户主动中断请求，不显示错误');
        this.userAborted = false; // 重置标志
        return;
      }

      // 特殊处理超时错误
      if (err.message && (err.message.includes('超时') || err.message.includes('timeout'))) {
        this.handleAPIError('处理超时，请尝试简化您的问题描述后重试。');
      } else {
        // 真正的网络错误才显示提示
        this.handleAPIError('网络请求失败: ' + (err.message || '未知错误'));
      }
    }
  },

  // 流式请求处理
  async streamingRequest(message, messageId) {
    try {
      // 构建对话上下文
      const context = this.buildConversationContext();
      console.log('发送上下文:', context);

      // 先调用真实API获取完整响应
      const requestTask = app.request({
        url: '/chat/message',
        method: 'POST',
        data: {
          message: message,
          conversationId: this.data.conversationId || 'default',
          context: context // 🆕 发送对话上下文
        }
      });

      // 存储请求任务以便中断
      this.setData({
        currentRequestTask: requestTask
      });

      const res = await requestTask;
      console.log('API响应:', res);
      console.log('消息类型:', res.messageType);
      console.log('上下文实体:', res.contextEntities);

      if (res && (res.message || res.reply)) {
        // 获取真实的回答内容
        const fullResponse = res.message || res.reply || '抱歉，我暂时无法回答您的问题。';
        
        try {
          // 开始流式显示真实内容
          await this.displayStreamingContent(fullResponse, messageId);
          
          // 保存响应的额外信息 🆕
          this.saveResponseMetadata(messageId, res);
          
          // 处理教师推荐（如果有）
          if (res.professors && res.professors.length > 0) {
            await this.showTeacherRecommendations(res, messageId);
          }
        } catch (streamError) {
          console.log('流式显示被中断:', streamError);
          // 流式显示被中断时，addActionButtonsToLastMessage已经在stopGeneration中被调用
          // 这里不需要额外处理，只需要确保状态正确
        }
      } else {
        throw new Error('API响应格式错误');
      }
    } catch (error) {
      console.error('流式请求失败:', error);
      
      // 停止思考倒计时
      this.stopThinkingCountdown();
      
      if (this.userAborted) {
        this.userAborted = false;
        return;
      }
      
      // 显示错误信息
      if (error.message && (error.message.includes('超时') || error.message.includes('timeout'))) {
        this.updateStreamingMessage(messageId, '⏰ 处理超时，请尝试：\n1. 简化问题描述\n2. 分步骤提问\n3. 稍后重试');
      } else {
        this.updateStreamingMessage(messageId, '抱歉，服务器响应异常，请稍后重试。');
      }
      this.finishStreaming(messageId);
    }
  },

  // 保存响应元数据 🆕
  saveResponseMetadata(messageId, response) {
    const messages = [...this.data.messages];
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1) {
      // 保存响应的类型和上下文信息
      messages[messageIndex].messageType = response.messageType;
      messages[messageIndex].intent = response.intent;
      messages[messageIndex].contextEntities = response.contextEntities;
      messages[messageIndex].followupQuestions = response.followupQuestions;
      
      this.setData({
        messages: messages
      });
      
      console.log('已保存响应元数据:', {
        messageType: response.messageType,
        contextEntities: response.contextEntities
      });
    }
  },

  // 流式显示内容
  async displayStreamingContent(fullResponse, messageId) {
    // 开始流式显示时停止思考倒计时
    this.stopThinkingCountdown();
    
    return new Promise((resolve, reject) => {
      let currentIndex = 0;
      let streamInterval = null;

      // 存储定时器以便中断
      this.streamInterval = streamInterval = setInterval(() => {
        if (this.userAborted) {
          clearInterval(streamInterval);
          // 中断时不需要在这里处理UI，stopGeneration已经处理了
          reject(new Error('用户中断'));
          return;
        }

        if (currentIndex < fullResponse.length) {
          // 每次添加1-3个字符，模拟真实的打字效果
          const chunkSize = Math.min(Math.floor(Math.random() * 3) + 1, fullResponse.length - currentIndex);
          currentIndex += chunkSize;

          // 更新消息内容（使用真实的API响应）
          this.updateStreamingMessage(messageId, fullResponse.slice(0, currentIndex));

          // 滚动到底部
          this.scrollToBottom();
        } else {
          // 生成完成
          clearInterval(streamInterval);
          this.finishStreaming(messageId);
          resolve();
        }
      }, 50 + Math.random() * 100); // 50-150ms的随机间隔，模拟真实打字速度
    });
  },

  // 更新流式消息内容
  updateStreamingMessage(messageId, content) {
    const messages = [...this.data.messages];
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1) {
      messages[messageIndex].content = content;
      this.setData({
        messages: messages
      });
    }
  },

  // 完成流式生成
  finishStreaming(messageId) {
    const messages = [...this.data.messages];
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1) {
      messages[messageIndex].isStreaming = false;
      this.setData({
        messages: messages,
        loading: false,
        isGenerating: false,
        currentRequestTask: null
      });
      
      // 教授推荐已经在streamingRequest中处理，这里不需要额外处理
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
        // 计算预计思考时间
        const thinkingTime = this.calculateThinkingTime(userMessage.content);
        
        // 移除当前AI回答
        messages.splice(messageIndex, 1);
        this.setData({
          messages: messages,
          isGenerating: true,
          loading: true
        });

        // 开始思考倒计时
        this.startThinkingCountdown(thinkingTime);

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
      
      // 找到对应的用户问题
      let userMessage = null;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].type === 'user') {
          userMessage = messages[i];
          break;
        }
      }

      if (userMessage) {
        // 继续生成给一个较短的思考时间
        const continueThinkingTime = Math.min(this.calculateThinkingTime(userMessage.content) / 2, 5);
        
        // 隐藏操作按钮，标记为流式生成
        message.showActions = false;
        message.isStreaming = true;
        this.setData({
          messages: messages,
          isGenerating: true,
          loading: true
        });

        // 开始思考倒计时
        this.startThinkingCountdown(continueThinkingTime);

        // 开始流式继续生成
        this.streamingContinue(userMessage.content, message.content, messageId);
      }
    }
  },

  // 流式继续生成
  async streamingContinue(originalQuestion, currentContent, messageId) {
    try {
      // 调用真实API获取继续生成的内容
      const requestTask = app.request({
        url: '/chat/message',
        method: 'POST',
        data: {
          message: originalQuestion,
          conversationId: 'default',
          continueFrom: currentContent // 传递当前内容作为上下文
        }
      });

      // 存储请求任务以便中断
      this.setData({
        currentRequestTask: requestTask
      });

      const res = await requestTask;
      console.log('继续生成API响应:', res);

      if (res && (res.message || res.reply)) {
        // 获取真实的继续生成内容
        const continueResponse = '\n\n' + (res.message || res.reply);
        
        // 开始流式显示继续生成的内容
        await this.displayContinueContent(currentContent, continueResponse, messageId);
        
        // 处理教师推荐（如果有）
        if (res.professors && res.professors.length > 0) {
          await this.showTeacherRecommendations(res, messageId);
        }
      } else {
        throw new Error('继续生成API响应格式错误');
      }
    } catch (error) {
      console.error('流式继续生成失败:', error);
      
      // 停止思考倒计时
      this.stopThinkingCountdown();
      
      if (this.userAborted) {
        this.userAborted = false;
        return;
      }
      
      // 恢复操作按钮
      const messages = [...this.data.messages];
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex >= 0) {
        messages[messageIndex].showActions = true;
        messages[messageIndex].isStreaming = false;
      }
      
      this.setData({
        messages: messages,
        loading: false,
        isGenerating: false
      });

      wx.showToast({
        title: '继续生成失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 流式显示继续生成的内容
  async displayContinueContent(originalContent, continueResponse, messageId) {
    return new Promise((resolve, reject) => {
      let currentIndex = 0;
      let streamInterval = null;

      // 存储定时器以便中断
      this.streamInterval = streamInterval = setInterval(() => {
        if (this.userAborted) {
          clearInterval(streamInterval);
          reject(new Error('用户中断'));
          return;
        }

        if (currentIndex < continueResponse.length) {
          // 每次添加1-3个字符
          const chunkSize = Math.min(Math.floor(Math.random() * 3) + 1, continueResponse.length - currentIndex);
          currentIndex += chunkSize;

          // 更新消息内容（原内容 + 新生成的部分）
          this.updateStreamingMessage(messageId, originalContent + continueResponse.slice(0, currentIndex));

          // 滚动到底部
          this.scrollToBottom();
        } else {
          // 继续生成完成
          clearInterval(streamInterval);
          this.finishContinueStreaming(messageId);
          resolve();
        }
      }, 50 + Math.random() * 100);
    });
  },

  // 完成流式继续生成
  finishContinueStreaming(messageId) {
    const messages = [...this.data.messages];
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1) {
      messages[messageIndex].isStreaming = false;
      this.setData({
        messages: messages,
        loading: false,
        isGenerating: false
      });
    }
  },

  // 切换教授收藏状态
  toggleTeacherFavorite(e) {
    const teacherId = e.currentTarget.dataset.teacherId;
    console.log('切换教授收藏状态:', teacherId);
    
    // 找到对应的教授并更新收藏状态
    const messages = [...this.data.messages];
    let teacher = null;
    let messageIndex = -1;
    let teacherIndex = -1;

    // 在所有消息中查找教授
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].teacherCards) {
        const index = messages[i].teacherCards.findIndex(t => t.id === teacherId);
        if (index !== -1) {
          teacher = messages[i].teacherCards[index];
          messageIndex = i;
          teacherIndex = index;
          break;
        }
      }
    }

    if (teacher) {
      // 切换收藏状态
      teacher.isFavorited = !teacher.isFavorited;
      messages[messageIndex].teacherCards[teacherIndex] = teacher;
      
      this.setData({
        messages: messages
      });

      // 同步到本地存储
      this.saveFavoriteTeacher(teacher);

      // 显示提示
      wx.showToast({
        title: teacher.isFavorited ? '已收藏' : '已取消收藏',
        icon: 'success',
        duration: 1500
      });
    }
  },

  // 分享教授信息
  shareTeacher(e) {
    const teacherId = e.currentTarget.dataset.teacherId;
    console.log('分享教授信息:', teacherId);
    
    // 找到对应的教授
    const teacher = this.getAllTeacherCards().find(t => t.id === teacherId);
    
    if (teacher) {
      // 生成分享内容
      const shareContent = this.generateTeacherShareContent(teacher);
      
      // 显示分享选项
      wx.showActionSheet({
        itemList: ['复制到剪贴板', '生成分享图片', '发送给好友'],
        success: (res) => {
          switch (res.tapIndex) {
            case 0:
              this.copyTeacherToClipboard(shareContent);
              break;
            case 1:
              this.generateTeacherShareImage(teacher);
              break;
            case 2:
              this.shareTeacherToFriend(teacher);
              break;
          }
        }
      });
    }
  },

  // 保存收藏的教授到本地存储
  saveFavoriteTeacher(teacher) {
    try {
      const favorites = wx.getStorageSync('favoriteTeachers') || [];
      
      if (teacher.isFavorited) {
        // 添加到收藏
        const existingIndex = favorites.findIndex(t => t.id === teacher.id);
        if (existingIndex === -1) {
          favorites.push({
            ...teacher,
            favoritedAt: new Date().toISOString()
          });
        }
      } else {
        // 从收藏中移除
        const existingIndex = favorites.findIndex(t => t.id === teacher.id);
        if (existingIndex !== -1) {
          favorites.splice(existingIndex, 1);
        }
      }
      
      wx.setStorageSync('favoriteTeachers', favorites);
    } catch (error) {
      console.error('保存收藏失败:', error);
    }
  },

  // 生成教授分享内容
  generateTeacherShareContent(teacher) {
    return `📚 浙大教授推荐

👨‍🏫 ${teacher.name} (${teacher.title})
🏛️ ${teacher.department}
🔬 研究方向：${teacher.research}
📧 ${teacher.email}
📍 ${teacher.office}

${teacher.achievements && teacher.achievements.length > 0 ? 
  '🏆 主要成就：\n' + teacher.achievements.map(a => `• ${a}`).join('\n') : ''}

来自智能科研匹配助手的推荐`;
  },

  // 复制教授信息到剪贴板
  copyTeacherToClipboard(content) {
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success',
          duration: 1500
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },

  // 生成教授分享图片
  generateTeacherShareImage(teacher) {
    wx.showToast({
      title: '正在生成分享图片...',
      icon: 'loading',
      duration: 2000
    });

    // 这里可以实现生成分享图片的逻辑
    // 暂时用简单的提示替代
    setTimeout(() => {
      wx.showModal({
        title: '分享图片',
        content: '分享图片功能开发中，敬请期待！',
        showCancel: false
      });
    }, 2000);
  },

  // 分享教授给好友
  shareTeacherToFriend(teacher) {
    const shareContent = this.generateTeacherShareContent(teacher);
    
    wx.showModal({
      title: '发送给好友',
      content: '即将调用微信分享功能',
      success: (res) => {
        if (res.confirm) {
          // 这里可以实现微信分享功能
          wx.showToast({
            title: '分享功能开发中',
            icon: 'none',
            duration: 1500
          });
        }
      }
    });
  },

  // 从本地存储加载收藏状态
  loadFavoriteStatus() {
    try {
      const favorites = wx.getStorageSync('favoriteTeachers') || [];
      const favoriteIds = favorites.map(t => t.id);
      
      // 更新所有教授的收藏状态
      const messages = [...this.data.messages];
      let updated = false;
      
      messages.forEach(message => {
        if (message.teacherCards) {
          message.teacherCards.forEach(teacher => {
            const wasFavorited = teacher.isFavorited;
            teacher.isFavorited = favoriteIds.includes(teacher.id);
            if (wasFavorited !== teacher.isFavorited) {
              updated = true;
            }
          });
        }
      });
      
      if (updated) {
        this.setData({ messages });
      }
    } catch (error) {
      console.error('加载收藏状态失败:', error);
    }
  },

  // 检查教授是否被收藏
  isTeacherFavorited(teacherId) {
    try {
      const favorites = wx.getStorageSync('favoriteTeachers') || [];
      return favorites.some(t => t.id === teacherId);
    } catch (error) {
      console.error('检查收藏状态失败:', error);
      return false;
    }
  },

  // 显示教师推荐卡片
  async showTeacherRecommendations(apiResponse, messageId) {
    console.log('开始处理教师推荐数据:', apiResponse, '消息ID:', messageId);
    
    // 从API响应中解析教师推荐数据
    if (apiResponse && apiResponse.professors && apiResponse.professors.length > 0) {
      console.log('找到教授数据，数量:', apiResponse.professors.length);
      
      // 为每个教授调用简化服务
      const teachers = [];
      for (const prof of apiResponse.professors) {
        try {
          console.log('正在处理教授:', prof.name);
          let simplifiedInfo;
          let simplifiedResearch;
          
          try {
            // 尝试AI简化整个教授信息
            simplifiedInfo = await this.simplifyProfessorInfo(prof);
            console.log('AI简化成功:', prof.name, simplifiedInfo);
          } catch (error) {
            console.log('AI简化失败，使用备用方案:', prof.name, error);
            simplifiedInfo = this.fallbackSimplify(prof);
          }

          try {
            // 专门简化研究方向
            const researchAreas = prof.research_areas || prof.研究方向 || '';
            if (researchAreas) {
              simplifiedResearch = await this.simplifyResearchAreas(researchAreas);
              console.log('研究方向简化成功:', prof.name, simplifiedResearch);
            }
          } catch (error) {
            console.log('研究方向简化失败，使用默认值:', prof.name, error);
            simplifiedResearch = null;
          }
          
          const teacher = {
            id: prof.id || `teacher-${Date.now()}-${Math.random()}`,
            name: prof.name || prof.教师姓名 || '未知教师',
            title: simplifiedInfo.title || prof.title || prof.职称 || '教师',
            research: simplifiedResearch || simplifiedInfo.research || (Array.isArray(prof.research_areas) ? prof.research_areas.join('、') : prof.research_areas) || (Array.isArray(prof.研究方向) ? prof.研究方向.join('、') : prof.研究方向) || '暂无研究方向信息',
            department: prof.department || prof.院系 || '未知学院',
            email: prof.email || prof.邮箱 || '暂无邮箱',
            office: prof.office || prof.办公地址 || '暂无办公地址',
            education: simplifiedInfo.education || prof.education || prof.学历 || '暂无学历信息',
            bio: simplifiedInfo.bio || prof.bio || prof.个人简介 || '暂无个人简介',
            achievements: simplifiedInfo.achievements || this.extractBasicAchievements(prof.bio || prof.个人简介 || ''),
            isFavorited: this.isTeacherFavorited(prof.id || `teacher-${Date.now()}-${Math.random()}`)
          };
          
          teachers.push(teacher);
          console.log('教授处理完成:', teacher.name);
          
        } catch (error) {
          console.error('处理教授信息失败:', prof.name, error);
          // 即使处理失败也要添加基本信息
          const teacherId = prof.id || `teacher-${Date.now()}-${Math.random()}`;
          teachers.push({
            id: teacherId,
            name: prof.name || prof.教师姓名 || '未知教师',
            title: prof.title || prof.职称 || '教师',
            research: (Array.isArray(prof.research_areas) ? prof.research_areas.join('、') : prof.research_areas) || (Array.isArray(prof.研究方向) ? prof.研究方向.join('、') : prof.研究方向) || '暂无研究方向信息',
            department: prof.department || prof.院系 || '未知学院',
            email: prof.email || prof.邮箱 || '暂无邮箱',
            office: prof.office || prof.办公地址 || '暂无办公地址',
            education: prof.education || prof.学历 || '暂无学历信息',
            bio: prof.bio || prof.个人简介 || '暂无个人简介',
            achievements: ['专业领域研究学者'],
            isFavorited: this.isTeacherFavorited(teacherId)
          });
        }
      }

      console.log('所有教授处理完成，更新对应消息的教授卡片');
      
      // 找到对应的消息并更新其教授卡片
      const messages = [...this.data.messages];
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      
      if (messageIndex !== -1) {
        messages[messageIndex].teacherCards = teachers;
        this.setData({
          messages: messages
        });
        console.log('已将', teachers.length, '个教授卡片附加到消息:', messageId);
      } else {
        console.error('未找到对应的消息ID:', messageId);
      }
    } else {
      // 如果API没有返回教师数据，保持消息不变
      console.log('API响应中没有教师推荐数据，保持消息不变');
    }
  },

  // AI简化教授信息
  async simplifyProfessorInfo(prof) {
    try {
      console.log('开始简化教授信息:', prof.name);
      
      const res = await app.request({
        url: '/chat/simplify',
        method: 'POST',
        data: {
          professor: prof
        }
      });

      console.log('简化结果:', res);

      if (res && res.simplified) {
        return res.simplified;
      } else {
        console.log('AI简化失败，使用备用方案');
        return this.fallbackSimplify(prof);
      }
    } catch (error) {
      console.error('AI简化教授信息失败:', error);
      return this.fallbackSimplify(prof);
    }
  },

  // 简化研究方向
  async simplifyResearchAreas(researchAreas) {
    try {
      console.log('开始简化研究方向:', researchAreas);
      
      const res = await app.request({
        url: '/chat/simplify-research',
        method: 'POST',
        data: {
          researchAreas: researchAreas
        }
      });

      console.log('研究方向简化结果:', res);

      if (res && res.simplified) {
        return res.simplified;
      } else {
        console.log('AI研究方向简化失败，使用备用方案');
        return this.fallbackSimplifyResearch(researchAreas);
      }
    } catch (error) {
      console.error('AI简化研究方向失败:', error);
      return this.fallbackSimplifyResearch(researchAreas);
    }
  },

  // 备用研究方向简化方案
  fallbackSimplifyResearch(researchAreas) {
    if (!researchAreas) return '计算机科学相关研究';
    
    let researchText = '';
    if (Array.isArray(researchAreas)) {
      researchText = researchAreas.join('、');
    } else {
      researchText = researchAreas.toString();
    }
    
    // 如果已经足够简短，直接返回
    if (researchText.length <= 100) {
      return researchText;
    }
    
    // 按标点符号分割，保留前几个关键方向
    const parts = researchText.split(/[，,；;、\n]/);
    const keywords = [];
    
    for (const part of parts) {
      const cleanPart = part.trim()
        .replace(/等方面/, '')
        .replace(/相关研究/, '')
        .replace(/方面的/, '')
        .replace(/领域/, '')
        .replace(/研究$/, '');
      
      if (cleanPart.length > 0 && cleanPart.length <= 20) {
        keywords.push(cleanPart);
      }
      
      if (keywords.length >= 5) break;
    }
    
    let result = keywords.join('、');
    if (result.length > 100) {
      result = keywords.slice(0, 3).join('、') + '等';
    }
    
    return result || '计算机科学相关研究';
  },

  // 备用简化方案
  fallbackSimplify(prof) {
    console.log('使用前端备用简化方案:', prof.name || prof.教师姓名);
    
    // 处理职称
    const title = prof.title || prof.职称 || '教授';
    const simplifiedTitle = title.split('、')[0].split('|')[0];
    
    // 处理研究方向
    let research = prof.research_areas || prof.研究方向;
    if (Array.isArray(research)) {
      research = research.join('、');
    }
    const simplifiedResearch = research ? (research.length > 50 ? research.slice(0, 50) + '...' : research) : '学术研究';
    
    // 处理个人简介
    const bio = prof.bio || prof.个人简介 || '';
    const simplifiedBio = bio ? (bio.length > 80 ? bio.slice(0, 80) + '...' : bio) : '专业学者，在相关领域有深入研究。';
    
    // 处理学历
    const education = prof.education || prof.学历 || '博士学位';
    const simplifiedEducation = education.split('、')[0].split('|')[0];
    
    return {
      title: simplifiedTitle,
      research: simplifiedResearch,
      bio: simplifiedBio,
      education: simplifiedEducation,
      achievements: bio ? this.extractBasicAchievements(bio) : ['专业领域研究学者']
    };
  },

  // 基础成就提取
  extractBasicAchievements(bio) {
    const achievements = [];
    const text = bio.toLowerCase();
    
    if (text.includes('论文') || text.includes('发表')) {
      achievements.push('发表学术论文');
    }
    if (text.includes('项目') || text.includes('基金')) {
      achievements.push('主持科研项目');
    }
    if (text.includes('奖') && !text.includes('奖学金')) {
      achievements.push('获得学术奖项');
    }
    if (text.includes('专利')) {
      achievements.push('拥有发明专利');
    }
    
    if (achievements.length === 0) {
      achievements.push('专业领域研究学者');
    }
    
    return achievements.slice(0, 3);
  },
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

    return achievements.length > 0 ? achievements : ['专业领域研究经验'];
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
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
  },

  // 点击消息区域 - 用于取消选择模式
  onMessagesAreaTap(e) {
    // 如果当前在选择模式且点击的不是消息或选择框，则退出选择模式
    if (this.data.showActionBar) {
      const target = e.target;
      const currentTarget = e.currentTarget;
      
      // 检查是否点击的是消息内容或选择相关元素
      const isMessageContent = target.dataset.type === 'message' || 
                              target.dataset.type === 'teacher' ||
                              currentTarget.dataset.type === 'message' ||
                              currentTarget.dataset.type === 'teacher' ||
                              target.classList?.contains('selection-checkbox') ||
                              target.classList?.contains('checkbox-icon');

      // 如果不是点击消息相关内容，则退出选择模式
      if (!isMessageContent && target === currentTarget) {
        this.exitSelectionMode();
      }
    }
  },

  // 退出选择模式
  exitSelectionMode() {
    this.setData({
      showActionBar: false,
      selectedMessages: []
    });
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
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
  },

  // 获取所有教师卡片的辅助方法
  getAllTeacherCards() {
    const allTeachers = [];
    this.data.messages.forEach(message => {
      if (message.teacherCards && message.teacherCards.length > 0) {
        allTeachers.push(...message.teacherCards);
      }
    });
    return allTeachers;
  },

  // 复制选中内容
  copySelectedContent() {
    const selectedIds = this.data.selectedMessages;
    let content = '';

    selectedIds.forEach(id => {
      if (id.startsWith('teacher-')) {
        // 教师卡片
        const teacherId = id.replace('teacher-', '');
        const teacher = this.getAllTeacherCards().find(t => t.id === teacherId);
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
        const teacher = this.getAllTeacherCards().find(t => t.id === teacherId);
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

    // 复制到剪贴板方便分享
    wx.setClipboardData({
      data: shareContent,
      success: () => {
        wx.showModal({
          title: '分享内容已复制',
          content: '内容已复制到剪贴板，您可以在微信中粘贴分享给好友。\n\n您也可以点击右上角"..."按钮选择"转发"来直接分享小程序。',
          showCancel: true,
          cancelText: '知道了',
          confirmText: '去转发',
          success: (res) => {
            if (res.confirm) {
              // 调用系统分享菜单
              wx.showShareMenu({
                withShareTicket: true,
                menus: ['shareAppMessage']
              });
            }
            this.exitSelectionMode();
          }
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'error'
        });
      }
    });
  },

  // 页面分享配置
  onShareAppMessage() {
    return {
      title: '智能科研匹配助手',
      path: '/pages/chat/chat',
      imageUrl: '/images/share.svg'
    };
  },

  onShareTimeline() {
    return {
      title: '智能科研匹配助手',
      path: '/pages/chat/chat',
      imageUrl: '/images/share-cover.jpg' // 需要添加分享封面图
    };
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
        const teacher = this.getAllTeacherCards().find(t => t.id === teacherId);
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
    // 如果是默认标题，直接使用用户输入的前几个字作为标题
    const text = firstMessage.trim();
    let title = '';

    // 如果文本太长，截取前8个字符
    if (text.length > 8) {
      title = text.substring(0, 8);
    } else {
      title = text || '新会话';
    }

    this.setData({
      conversationTitle: title
    });

    // 保存到本地存储
    this.saveConversationTitle(title);
  },

  // 提取关键词 - 优化版本
  extractKeywords(text) {
    // 过滤常用词，提取有意义的关键词
    const stopWords = ['我', '想', '要', '找', '寻找', '需要', '希望', '可以', '能否', '请', '帮', '助', '的', '了', '吗', '呢', '吧', '有', '没有', '是', '不是', '一个', '这个', '那个'];
    
    // 清理标点符号并分词
    const words = text
      .replace(/[，。！？；：""''（）【】\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length >= 2 && 
        word.length <= 6 && 
        !stopWords.includes(word) &&
        !/^\d+$/.test(word) // 排除纯数字
      );

    return words.slice(0, 3); // 返回前3个关键词
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
            conversationTitle: '会话标题', // 使用默认标题
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
