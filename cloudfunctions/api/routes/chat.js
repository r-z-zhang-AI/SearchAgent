const express = require('express');
const router = express.Router();
const { parseIntent } = require('../services/intentParser');
const { matchProfessors } = require('../services/matchingService');
const { queryAchievements } = require('../services/achievementService');
const { generateGeneralReply } = require('../services/generalResponseService');

// 简单测试接口
router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: '服务器连接正常',
    timestamp: new Date().toISOString()
  });
});

// 聊天接口
router.post('/message', async (req, res) => {
  try {
    const { message, conversationId, context = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 分析消息类型和意图
    const { messageType, intent } = await analyzeMessage(message, context);

    let response = {
      conversationId: conversationId || Date.now().toString(),
      intent: intent,
      messageType: messageType,
      followupQuestions: []
    };

    // 根据消息类型处理
    switch (messageType) {
      case 'professor_matching': // 教授匹配需求
        // 匹配教授
        const matches = await matchProfessors(intent, req.db);
        response.message = generateMatchingResponse(intent, matches);
        response.matches = matches.slice(0, 5); // 只返回前5个匹配结果
        response.professors = matches.slice(0, 5).map(match => match.professor); // 为小程序提供教授数据
        response.followupQuestions = generateFollowupQuestions(intent, matches, 'matching');
        break;

      case 'achievement_query': // 科研成果查询
        const achievements = await queryAchievements(intent, req.db);
        response.message = generateAchievementResponse(intent, achievements);
        response.achievements = achievements;
        response.followupQuestions = generateFollowupQuestions(intent, achievements, 'achievement');
        break;

      case 'clarification_needed': // 需要澄清的模糊需求
        response.message = generateClarificationResponse(intent);
        response.needsClarification = true;
        response.clarificationOptions = generateClarificationOptions(intent);
        break;

      case 'general_query': // 一般性问题
        response.message = await generateGeneralResponse(message, context);
        response.followupQuestions = generateFollowupQuestions(intent, null, 'general');
        break;

      default:
        response.message = "抱歉，我没有理解您的需求。您是想寻找合适的教授进行科研合作，还是有其他问题？";
        response.followupQuestions = [
          "我需要找人工智能方面的专家",
          "浙江大学有哪些研究领域",
          "如何与教授取得联系"
        ];
    }

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// 分析消息类型和意图
async function analyzeMessage(message, context) {
  // 首先解析用户意图
  const intent = await parseIntent(message, context);

  // 分析消息类型
  let messageType = 'general_query'; // 默认为一般问题

  // 检查是否是教授匹配需求
  if (intent.isProfessorMatching) {
    // 检查需求是否模糊 - 更宽松的判断标准
    // 只有当完全没有技术领域且没有合作类型时才认为模糊
    if (intent.isVague &&
        (!intent.techDomains || intent.techDomains.length === 0) &&
        (!intent.cooperationType || intent.cooperationType === 'general')) {
      messageType = 'clarification_needed';
    } else {
      messageType = 'professor_matching';
    }
  }
  // 检查是否是科研成果查询
  else if (intent.isAchievementQuery) {
    messageType = 'achievement_query';
  }

  return { messageType, intent };
}

// 生成教授匹配回复
function generateMatchingResponse(intent, matches) {
  if (matches.length === 0) {
    return "抱歉，我没有找到完全匹配的教授。请尝试描述更具体的技术需求，或者告诉我您感兴趣的领域。";
  }

  const topMatch = matches[0];
  const response = `根据您的需求"${intent.originalQuery}"，我为您找到了${matches.length}位相关教授。

最匹配的是${topMatch.professor.name}教授（${topMatch.professor.department}），匹配理由：${topMatch.reasons.join('、')}

您可以在下方查看详细的教授信息和联系方式。如果需要更多信息，请告诉我。`;

  return response;
}

// 生成科研成果查询回复
async function generateAchievementResponse(intent, achievements) {
  if (!achievements || achievements.length === 0) {
    return `抱歉，我没有找到与"${intent.query || intent.originalQuery}"相关的科研成果。请尝试使用其他关键词，或者指定具体的研究领域。`;
  }

  const response = `关于"${intent.query || intent.originalQuery}"的科研成果查询，我找到了${achievements.length}项相关成果：

${achievements.map((achievement, index) =>
  `${index + 1}. ${achievement.title} (${achievement.year})
   作者: ${achievement.professor.name}
   类型: ${achievement.type}
   ${achievement.description ? '简介: ' + achievement.description : ''}`
).join('\n\n')}

您可以询问特定成果的更多详情，或者查看其他研究方向的成果。`;

  return response;
}

// 生成澄清需求的回复
function generateClarificationResponse(intent) {
  let response = `您的需求有些模糊，为了更好地帮助您，我需要了解更多信息：`;

  if (!intent.techDomains || intent.techDomains.length === 0) {
    response += `\n\n您对哪个技术领域或研究方向感兴趣？例如：人工智能、材料科学、生物医学等`;
  }

  if (!intent.cooperationType || intent.cooperationType === 'general') {
    response += `\n\n您希望进行哪种类型的合作？例如：技术咨询、联合研发、成果转化等`;
  }

  response += `\n\n请提供更多细节，这样我能为您找到最合适的教授。`;

  return response;
}

// 生成一般性问题的回复
async function generateGeneralResponse(message, context) {
  // 使用大语言模型生成通用回复
  const response = await generateGeneralReply(message, context);
  return response;
}

// 生成追问建议
function generateFollowupQuestions(intent, data, type) {
  const questions = [];

  if (type === 'matching' && data && data.length > 0) {
    // 教授匹配相关的追问
    const professor = data[0].professor;

    questions.push(`${professor.name}教授的主要研究成果有哪些？`);
    questions.push(`${professor.name}教授目前有哪些在研项目？`);

    if (intent.techDomains && intent.techDomains.length > 0) {
      questions.push(`${intent.techDomains[0]}领域还有哪些其他专家？`);
    }

    questions.push(`如何与${professor.name}教授取得联系？`);
    questions.push(`${professor.department}还有哪些其他教授？`);
  }
  else if (type === 'achievement' && data && data.length > 0) {
    // 科研成果相关的追问
    const achievement = data[0];

    questions.push(`这项成果的应用前景如何？`);
    questions.push(`${achievement.professor.name}教授还有哪些相关研究？`);
    questions.push(`这个领域的最新研究进展是什么？`);
    questions.push(`有没有类似方向的其他教授？`);
  }
  else {
    // 通用的追问
    questions.push(`浙江大学在人工智能领域有哪些优势？`);
    questions.push(`如何找到合适的科研合作伙伴？`);
    questions.push(`产学研合作的一般流程是什么？`);
    questions.push(`浙江大学有哪些重点研究领域？`);
  }

  // 随机选择3-5个问题
  return shuffleArray(questions).slice(0, Math.min(questions.length, 3));
}

// 生成澄清选项
function generateClarificationOptions(intent) {
  const options = {
    techDomains: [
      "人工智能",
      "材料科学",
      "生物医学",
      "电子信息",
      "机械工程",
      "环境科学",
      "计算机科学",
      "化学工程"
    ],
    cooperationTypes: [
      "技术咨询",
      "联合研发",
      "成果转化",
      "人才培养",
      "项目合作"
    ]
  };

  return options;
}

// 打乱数组顺序
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

module.exports = router;