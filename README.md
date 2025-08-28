# 浙江大学智能科研匹配Agent

一个基于大语言模型的智能科研合作匹配平台，帮助企业快速找到最合适的浙江大学教授进行科研合作。

## 功能特点

- 🤖 **智能对话**：通过自然语言描述需求，AI自动解析意图
- 🎯 **精准匹配**：基于研究方向、成果、项目经历多维度匹配
- 📊 **详细展示**：提供教授详细信息、匹配理由和联系方式
- 💬 **交互友好**：类似ChatGPT的对话界面，操作简单

## 技术栈

### 小程序前端
- 微信小程序原生开发
- WXML + WXSS + JavaScript
- 微信小程序API

### 后端
- Node.js + Express
- SQLite数据库
- DeepSeek大语言模型API

## 快速开始

### 1. 安装后端依赖

```bash
# 安装后端依赖
npm install
```

### 2. 配置环境变量

配置 `config.env` 文件中的API密钥：

```bash
# DeepSeek API配置
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

### 3. 启动后端服务器

```bash
# 启动后端服务器
npm run server
```

### 4. 开发小程序

1. 下载并安装微信开发者工具
2. 导入项目（选择项目根目录）
3. 配置小程序AppID（在project.config.json中）
4. 在开发者工具中预览和调试

## 项目结构

```
├── server/                 # 后端代码
│   ├── index.js           # 服务器入口
│   ├── routes/            # API路由
│   ├── services/          # 业务逻辑服务
│   └── data/              # 数据库文件
├── pages/                 # 小程序页面
│   ├── chat/              # 聊天页面
│   └── professor/         # 教授列表页面
├── images/                # 小程序图标资源
├── app.js                 # 小程序入口文件
├── app.json               # 小程序配置文件
├── app.wxss               # 小程序全局样式
├── project.config.json    # 微信开发者工具配置
├── prd.md                 # 产品需求文档
└── package.json           # 项目配置
```

## API接口

### 聊天接口
- `POST /api/chat/message` - 发送消息并获取匹配结果

### 教授信息接口
- `GET /api/professors` - 获取教授列表
- `GET /api/professors/:id` - 获取教授详情
- `GET /api/professors/search/:query` - 搜索教授

### 匹配接口
- `POST /api/matching/match` - 直接匹配教授

## 使用示例

1. **描述需求**：在聊天界面输入您的科研合作需求
   ```
   例如：我需要人工智能方面的专家进行技术合作
   ```

2. **AI解析**：系统自动解析您的技术领域和合作类型

3. **智能匹配**：基于解析结果匹配相关教授

4. **查看结果**：获得匹配的教授列表和详细理由

5. **进一步沟通**：获取联系方式进行合作洽谈

## 开发计划

### MVP版本（当前）
- ✅ 基础聊天界面
- ✅ 意图解析功能
- ✅ 简单匹配算法
- ✅ 教授信息展示

### 完整版本（计划中）
- 🔄 用户管理系统
- 🔄 高级匹配算法
- 🔄 数据管理后台
- 🔄 统计分析功能

### 高级版本（未来）
- 📋 多语言支持
- 📋 小程序功能增强
- 📋 API开放平台
- 📋 个性化推荐

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 联系方式

如有问题或建议，请通过以下方式联系：

- 项目Issues：[GitHub Issues](https://github.com/your-repo/issues)
- 邮箱：your-email@example.com

---

*本项目为浙江大学智能科研匹配Agent，旨在促进产学研合作。*