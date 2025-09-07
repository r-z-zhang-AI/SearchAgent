const tcb = require('@cloudbase/node-sdk');
const serverless = require('serverless-http');
const express = require('express');

// 1. 初始化
const app = tcb.init();
const db = app.database();
const server = express();
server.use(express.json());

// 2. 挂载数据库实例
// 创建一个中间件，将 db 实例挂载到 req 对象上，方便后续的路由和服务使用
server.use((req, res, next) => {
  req.db = db;
  next();
});

// 3. 引入并使用路由
// 注意：这里的路径是相对于当前文件的
const chatRouter = require('./routes/chat');
const matchingRouter = require('./routes/matching');
const professorsRouter = require('./routes/professors');

server.use('/chat', chatRouter);
server.use('/matching', matchingRouter);
server.use('/professors', professorsRouter);

// 健康检查
server.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'ZJU Research Matching Agent is running' });
});

// 错误处理中间件
server.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 4. 云函数主入口 - 支持直接调用和HTTP调用
exports.main = async (event, context) => {
  console.log('云函数被调用:', event);

  // 如果是小程序直接调用云函数
  if (event.httpMethod && event.path) {
    try {
      // 直接处理聊天请求
      if (event.path === '/chat/message' && event.httpMethod === 'POST') {
        // 设置总体超时
        const mainTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('云函数总体超时')), 25000); // 25秒总超时
        });

        const processRequest = async () => {
          const { parseIntent } = require('./services/intentParser');
          const { matchProfessors } = require('./services/matchingService');
          const { queryAchievements } = require('./services/achievementService');
          const { generateGeneralReply } = require('./services/generalResponseService');

          const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
          const { message, conversationId, context = [] } = body;

          if (!message) {
            return { error: 'Message is required' };
          }

          console.log('开始处理消息:', message);
          const startTime = Date.now();

          // 分析消息类型和意图
          const { messageType, intent } = await analyzeMessage(message, context);
          console.log('意图分析耗时:', Date.now() - startTime, 'ms');

          let response = {
            conversationId: conversationId || Date.now().toString(),
            intent: intent,
            messageType: messageType,
            followupQuestions: []
          };

          // 根据消息类型处理
          switch (messageType) {
            case 'professor_matching':
              console.log('开始匹配教授，意图:', JSON.stringify(intent, null, 2));
              const matchStart = Date.now();
              const matches = await matchProfessors(intent, db);
              console.log('匹配耗时:', Date.now() - matchStart, 'ms');
              console.log('匹配结果数量:', matches.length);
              if (matches.length > 0) {
                console.log('第一个匹配结果:', JSON.stringify(matches[0], null, 2));
              }
              response.message = generateMatchingResponse(intent, matches);
              response.matches = matches.slice(0, 5);
              response.professors = matches.slice(0, 5).map(match => match.professor);
              break;

            case 'achievement_query':
              const achievements = await queryAchievements(intent, db);
              response.message = generateAchievementResponse(intent, achievements);
              response.achievements = achievements;
              break;

            case 'general_query':
              const generalStart = Date.now();
              response.message = await generateGeneralReply(message, context);
              console.log('通用回复耗时:', Date.now() - generalStart, 'ms');
              break;

            default:
              response.message = "抱歉，我没有理解您的需求。您是想寻找合适的教授进行科研合作，还是有其他问题？";
          }

          console.log('总处理耗时:', Date.now() - startTime, 'ms');
          return response;
        };

        return await Promise.race([processRequest(), mainTimeout]);
      }

      // 健康检查
      if (event.path === '/health') {
        return { status: 'OK', message: 'ZJU Research Matching Agent is running' };
      }

      return { error: 'Not found', path: event.path };
    } catch (error) {
      console.error('云函数处理错误:', error);
      
      // 如果是超时错误，返回友好的错误信息
      if (error.message.includes('超时')) {
        return { 
          error: 'Request timeout', 
          message: '处理请求超时，请稍后重试。如果问题持续存在，请简化您的问题描述。',
          timeout: true
        };
      }
      
      return { error: 'Internal server error', message: error.message };
    }
  }

  // 如果是HTTP访问（通过serverless-http）
  const serverlessHandler = serverless(server);
  return await serverlessHandler(event, context);
};

// 分析消息类型和意图
async function analyzeMessage(message, context) {
  const { parseIntent } = require('./services/intentParser');
  const intent = await parseIntent(message, context);

  console.log('意图解析完成，结果:', JSON.stringify(intent, null, 2));

  let messageType = 'general_query';

  if (intent.isProfessorMatching) {
    console.log('检测到教授匹配需求');
    console.log('isVague:', intent.isVague);
    console.log('techDomains:', intent.techDomains);
    console.log('cooperationType:', intent.cooperationType);

    if (intent.isVague &&
        (!intent.techDomains || intent.techDomains.length === 0) &&
        (!intent.cooperationType || intent.cooperationType === 'general')) {
      console.log('判断为需要澄清');
      messageType = 'clarification_needed';
    } else {
      console.log('判断为教授匹配');
      messageType = 'professor_matching';
    }
  } else if (intent.isAchievementQuery) {
    messageType = 'achievement_query';
  }

  console.log('最终消息类型:', messageType);
  return { messageType, intent };
}

// 生成匹配回复
function generateMatchingResponse(intent, matches) {
  if (matches.length === 0) {
    return "抱歉，我没有找到完全匹配的教授。请尝试描述更具体的技术需求，或者告诉我您感兴趣的领域。";
  }

  const topMatch = matches[0];
  return `根据您的需求"${intent.originalQuery}"，我为您找到了${matches.length}位相关教授。最匹配的是${topMatch.professor.name}教授（${topMatch.professor.department}），匹配理由：${topMatch.reasons.join('、')}`;
}

// 生成成果查询回复
function generateAchievementResponse(intent, achievements) {
  if (!achievements || achievements.length === 0) {
    return `抱歉，我没有找到与"${intent.query || intent.originalQuery}"相关的科研成果。请尝试使用其他关键词，或者指定具体的研究领域。`;
  }

  return `关于"${intent.query || intent.originalQuery}"的科研成果查询，我找到了${achievements.length}项相关成果：\n\n${achievements.slice(0, 3).map((achievement, index) =>
    `${index + 1}. ${achievement.title} (${achievement.year})\n   作者: ${achievement.professor.name}\n   类型: ${achievement.type}`
  ).join('\n\n')}`;
}