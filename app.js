// app.js
App({
  globalData: {
    // 云开发环境ID
    envId: 'cloud1-6g8dk2rk74e3d4e9',
    // 使用云函数调用模式
    useCloudFunction: true,
    // 后端API地址 - 备用HTTP方式（需要会员）
    apiBase: 'https://cloud1-6g8dk2rk74e3d4e9.service.tcloudbase.com/api',
    // 用户信息
    userInfo: null,
    // 对话ID
    conversationId: null
  },

  onLaunch() {
    console.log('小程序启动');

    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: this.globalData.envId,
        traceUser: true,
      });
    }

    // 生成对话ID
    this.globalData.conversationId = Date.now().toString();

    // 检查网络状态
    this.checkNetworkStatus();

    // 测试后端连接
    this.testBackendConnection();

    // 获取用户信息
    this.getUserInfo();
  },

  onShow() {
    console.log('小程序显示');
  },

  onHide() {
    console.log('小程序隐藏');
  },

  onError(msg) {
    console.error('小程序错误:', msg);
  },

  // 检查网络状态
  checkNetworkStatus() {
    wx.getNetworkType({
      success: (res) => {
        console.log('网络类型:', res.networkType);
        if (res.networkType === 'none') {
          wx.showToast({
            title: '网络连接失败',
            icon: 'none'
          });
        }
      }
    });
  },

  // 获取用户信息
  getUserInfo() {
    if (wx.getUserProfile) {
      // 新版本获取用户信息方式
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          this.globalData.userInfo = res.userInfo;
        },
        fail: (err) => {
          console.log('获取用户信息失败:', err);
        }
      });
    }
  },

  // 通用API请求方法
  request(options) {
    if (this.globalData.useCloudFunction) {
      // 使用云函数调用
      return this.callCloudFunction(options);
    } else {
      // 使用HTTP请求（需要会员）
      return this.callHTTP(options);
    }
  },

  // 云函数调用方法
  callCloudFunction(options) {
    return new Promise((resolve, reject) => {
      const requestData = {
        httpMethod: options.method || 'GET',
        path: options.url,
        headers: options.header || {}
      };

      // 如果有数据，将其转换为JSON字符串
      if (options.data && Object.keys(options.data).length > 0) {
        requestData.body = JSON.stringify(options.data);
      }

      console.log('云函数调用参数:', requestData);

      wx.cloud.callFunction({
        name: 'api',
        data: requestData,
        success: (res) => {
          console.log('云函数调用成功:', res);
          if (res.result) {
            resolve(res.result);
          } else {
            reject(new Error('云函数返回数据为空'));
          }
        },
        fail: (err) => {
          console.error('云函数调用失败:', err);
          wx.showToast({
            title: '服务调用失败',
            icon: 'none'
          });
          reject(err);
        }
      });
    });
  },

  // HTTP请求方法（备用）
  callHTTP(options) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.apiBase + options.url,
        method: options.method || 'GET',
        data: options.data || {},
        header: {
          'Content-Type': 'application/json',
          ...options.header
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          console.error('API请求失败:', err);
          wx.showToast({
            title: '网络请求失败',
            icon: 'none'
          });
          reject(err);
        }
      });
    });
  },

  // 发送聊天消息
  sendChatMessage(message, context = []) {
    return this.request({
      url: '/chat/message',
      method: 'POST',
      data: {
        message: message,
        conversationId: this.globalData.conversationId,
        context: context
      }
    });
  },

  // 获取教授列表
  getProfessors(options = {}) {
    const params = new URLSearchParams(options).toString();
    return this.request({
      url: `/professors${params ? '?' + params : ''}`
    });
  },

  // 测试后端连接
  testBackendConnection() {
    console.log('测试后端连接...');
    this.tryConnectToBackend(0);
  },

  // 尝试连接到后端（递归尝试所有地址）
  tryConnectToBackend(index) {
    if (index >= this.globalData.apiBaseOptions.length) {
      // 所有地址都尝试失败
      console.error('所有后端地址都连接失败');
      wx.showModal({
        title: '网络连接失败',
        content: '无法连接到后端服务器，请检查：\n1. 后端服务是否启动 (npm start)\n2. 开发者工具是否开启"不校验合法域名"\n3. 手机和电脑是否在同一WiFi网络\n4. 防火墙是否阻止了5000端口\n5. 尝试重启后端服务',
        showCancel: true,
        cancelText: '取消',
        confirmText: '重试',
        success: (res) => {
          if (res.confirm) {
            // 用户点击重试，重新开始连接测试
            this.tryConnectToBackend(0);
          }
        }
      });
      return;
    }

    const apiUrl = this.globalData.apiBaseOptions[index];
    console.log(`尝试连接 ${index + 1}/${this.globalData.apiBaseOptions.length}: ${apiUrl}`);

    wx.request({
      url: apiUrl + '/health',
      method: 'GET',
      timeout: 10000, // 增加到10秒
      success: (res) => {
        console.log(`✅ 连接成功: ${apiUrl}`, res);
        if (res.statusCode === 200) {
          // 连接成功，更新API地址
          this.globalData.apiBase = apiUrl;
          console.log(`🎯 已设置API地址为: ${apiUrl}`);

          wx.showToast({
            title: index === 0 ? '后端连接正常' : `已切换到地址${index + 1}`,
            icon: 'success',
            duration: 2000
          });
          return;
        }

        // 状态码不是200，尝试下一个地址
        console.log(`❌ 状态码错误: ${res.statusCode}, 尝试下一个地址`);
        this.tryConnectToBackend(index + 1);
      },
      fail: (err) => {
        console.error(`❌ 连接失败: ${apiUrl}`, err);
        console.log(`错误详情: errno=${err.errno}, errMsg=${err.errMsg}`);

        // 尝试下一个地址
        setTimeout(() => {
          this.tryConnectToBackend(index + 1);
        }, 500); // 添加500ms延迟，避免过快请求
      }
    });
  }
});
