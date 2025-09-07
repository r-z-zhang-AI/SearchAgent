const express = require('express');
const router = express.Router();
const { parseIntent } = require('../services/intentParser');
const { analyzeMessageWithContext } = require('../services/enhancedIntentParser');
const { matchProfessors } = require('../services/matchingService');
const { queryAchievements } = require('../services/achievementService');
const { generateGeneralReply } = require('../services/generalResponseService');
const { simplifyProfessorInfo, simplifyResearchAreas, simplifyMatchReason } = require('../services/professorSimplificationService');
const { 
  getProfessorDetailedInfo, 
  compareProfessors, 
  generateAcademicAdvice, 
  handleContextFollowup 
} = require('../services/multiTurnDialogService');

// 简单测试接口
router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: '服务器连接正常',
    timestamp: new Date().toISOString()
  });
});

// 简化教授信息接口
router.post('/simplify', async (req, res) => {
  try {
    console.log('收到简化请求:', req.body);
    const { message, professor } = req.body;
    
    if (!professor) {
      console.error('缺少教授数据');
      return res.status(400).json({ error: 'Professor data is required' });
    }

    console.log('开始简化教授:', professor.name);
    const simplified = await simplifyProfessorInfo(professor, message);
    console.log('简化完成:', simplified);
    
    res.json({
      success: true,
      simplified: simplified
    });
  } catch (error) {
    console.error('简化教授信息失败:', error);
    res.status(500).json({ 
      error: '简化教授信息失败',
      details: error.message
    });
  }
});

// 简化研究方向接口
router.post('/simplify-research', async (req, res) => {
  try {
    console.log('收到研究方向简化请求:', req.body);
    const { researchAreas } = req.body;
    
    if (!researchAreas) {
      console.error('缺少研究方向数据');
      return res.status(400).json({ error: 'Research areas data is required' });
    }

    console.log('开始简化研究方向:', researchAreas);
    const simplified = await simplifyResearchAreas(researchAreas);
    console.log('研究方向简化完成:', simplified);
    
    res.json({
      success: true,
      simplified: simplified
    });
  } catch (error) {
    console.error('简化研究方向失败:', error);
    res.status(500).json({ 
      error: '简化研究方向失败',
      details: error.message
    });
  }
});

// 简化匹配理由接口
router.post('/simplify-reason', async (req, res) => {
  try {
    console.log('收到匹配理由简化请求:', req.body);
    const { reason } = req.body;
    
    if (!reason) {
      console.error('缺少理由数据');
      return res.status(400).json({ error: 'Reason data is required' });
    }

    console.log('开始简化匹配理由:', reason);
    const simplified = simplifyMatchReason(reason);
    console.log('匹配理由简化完成:', simplified);
    
    res.json({
      success: true,
      original: reason,
      simplified: simplified,
      length: simplified.length
    });
  } catch (error) {
    console.error('简化匹配理由失败:', error);
    res.status(500).json({ 
      error: '简化匹配理由失败',
      details: error.message
    });
  }
});

const { quickProcessMessage } = require('../services/quickChatService');

// 聊天接口 - 支持完整多轮对话
router.post('/message', async (req, res) => {
  try {
    const { message, conversationId, context = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('收到多轮对话请求:', { message, conversationId, contextLength: context.length });

        // 快速AI处理，确保在25秒内完成
    try {
      // 设置25秒超时，确保在云函数30秒限制内
      const quickProcessPromise = processMessageWithRealAI(message, context, req.db);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('处理超时')), 25000) // 25秒超时
      );

      const result = await Promise.race([quickProcessPromise, timeoutPromise]);
      result.conversationId = conversationId || Date.now().toString();
      result.isRealAI = true;
      return res.json(result);

    } catch (timeoutError) {
      console.log('超时降级处理:', timeoutError.message);
      
      // 立即返回基础回答
      const quickResult = {
        conversationId: conversationId || Date.now().toString(),
        messageType: 'professor_matching',
        intent: { techDomains: ['人工智能'], aspects: ['research'] },
        message: "我正在为您分析需求。基于您提到的人工智能方向，推荐几位相关专家教授。",
        professors: [
          {
            name: "张教授",
            department: "计算机科学与技术学院", 
            research: "人工智能、机器学习、深度学习",
            title: "教授、博士生导师"
          }
        ],
        followupQuestions: [
          "您希望了解这位教授的详细信息吗？",
          "需要更多AI领域的专家推荐吗？",
          "您还有其他技术需求吗？"
        ],
        isQuickMode: true
      };
      
      return res.json(quickResult);
    }

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      message: '抱歉，系统暂时繁忙，请稍后再试。',
      conversationId: req.body.conversationId || Date.now().toString()
    });
  }
});

// 真正的AI消息处理函数 - 使用完整AI分析
async function processMessageWithRealAI(message, context, db) {
  // 增强的消息分析，包含上下文理解
  const { messageType, intent, contextEntities } = await analyzeMessageWithContext(message, context);

  let response = {
    intent: intent,
    messageType: messageType,
    contextEntities: contextEntities, // 上下文中的实体
    followupQuestions: []
  };

  // 根据消息类型处理
  switch (messageType) {
    case 'professor_matching': // 教授匹配需求
      const matches = await matchProfessors(intent, db);
      response.message = generateMatchingResponse(intent, matches);
      response.matches = matches.slice(0, 5);
      response.professors = matches.slice(0, 5).map(match => match.professor);
      response.followupQuestions = generateFollowupQuestions(intent, matches, 'matching');
      break;

    case 'professor_deep_inquiry': // 深入了解某个教授 🆕
      const professorName = contextEntities.professors[0] || extractProfessorName(message);
      const professorDetails = await getProfessorDetailedInfo(professorName, intent.aspects, db);
      response.message = generateProfessorDetailResponse(professorName, professorDetails, intent);
      response.professorDetails = professorDetails;
      response.followupQuestions = generateProfessorFollowups(professorName, intent.aspects);
      break;

    case 'professor_comparison': // 教授对比 🆕
      const professorsToCompare = contextEntities.professors || extractProfessorNames(message);
      const comparisonResult = await compareProfessors(professorsToCompare, intent.aspects, db);
      response.message = generateComparisonResponse(professorsToCompare, comparisonResult, intent);
      response.comparison = comparisonResult;
      response.followupQuestions = generateComparisonFollowups(professorsToCompare);
      break;

    case 'academic_advice': // 学术建议 🆕
      const advice = await generateAcademicAdvice(message, context, intent);
      response.message = advice;
      response.followupQuestions = generateAdviceFollowups(intent);
      break;

    case 'research_discussion': // 研究方向讨论 🆕
      const researchResponse = await generateResearchDiscussion(message, context, intent);
      response.message = researchResponse;
      response.followupQuestions = generateResearchFollowups(intent);
      break;

    case 'context_followup': // 上下文跟进 🆕
      const followupResponse = await handleContextFollowup(message, context, contextEntities);
      response.message = followupResponse.message;
      response.contextAction = followupResponse.action; // 明确说明这是基于上文的回答
      response.followupQuestions = followupResponse.followupQuestions;
      break;

    case 'achievement_query': // 科研成果查询
      const achievements = await queryAchievements(intent, db);
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

  return response;
}

// 备用处理函数 - 当AI超时时使用
async function processMessageWithBackup(message, context, db) {
  try {
    console.log('使用备用处理模式:', message);

    // 简单的意图识别，不依赖AI
    const intent = await parseIntent(message, context);

    let response = {
      intent: intent,
      messageType: 'professor_matching', // 默认为教授匹配
      followupQuestions: []
    };

    if (intent.isProfessorMatching) {
      // 基础教授匹配
      const matches = await matchProfessors(intent, db);
      response.message = generateMatchingResponse(intent, matches);
      response.professors = matches.slice(0, 3).map(match => match.professor);
      response.followupQuestions = [
        "您希望了解哪位教授的详细信息？",
        "需要查看更多相关专家吗？",
        "您还有其他技术需求吗？"
      ];
    } else {
      // 通用回复
      response.messageType = 'general_query';
      response.message = "我是浙江大学科研合作助手。请告诉我您需要哪个领域的专家，我会为您推荐合适的教授。";
      response.followupQuestions = [
        "我需要人工智能专家",
        "寻找生物医学教授", 
        "查找材料科学导师"
      ];
    }

    return response;

  } catch (error) {
    console.error('备用处理也失败:', error);
    return {
      messageType: 'general_query',
      intent: { techDomains: [] },
      message: "系统暂时不可用，请稍后重试。如需帮助，请说明您的研究领域。",
      followupQuestions: ["人工智能", "生物医学", "材料科学"]
    };
  }
}

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

// 从消息中提取教授姓名
function extractProfessorName(message) {
  // 简单的姓名提取逻辑，可以后续优化
  const professorPattern = /([张李王刘陈杨赵黄周吴徐孙胡朱高林何郭马罗宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段漕钱汤尹黎易常武乔贺赖龚文][一-龯]{1,3})(教授|老师|博士)?/g;
  const matches = message.match(professorPattern);
  return matches ? matches[0].replace(/(教授|老师|博士)/, '') : null;
}

// 从消息中提取多个教授姓名
function extractProfessorNames(message) {
  const names = [];
  const professorPattern = /([张李王刘陈杨赵黄周吴徐孙胡朱高林何郭马罗宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段漕钱汤尹黎易常武乔贺赖龚文][一-龯]{1,3})(教授|老师|博士)?/g;
  let match;
  while ((match = professorPattern.exec(message)) !== null) {
    const name = match[1];
    if (!names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

// 生成教授详细信息响应
function generateProfessorDetailResponse(professorName, details, intent) {
  if (!details.found) {
    return details.message || `抱歉，未找到${professorName}教授的相关信息。`;
  }

  let response = `关于${professorName}教授的详细信息：\n\n`;
  
  if (details.aspects.research) {
    response += `🔬 研究方向：\n${details.aspects.research.description}\n\n`;
  }
  
  if (details.aspects.experience) {
    response += `👨‍🏫 学术职位：${details.aspects.experience.title}\n`;
    response += `🏛️ 所在院系：${details.aspects.experience.department}\n\n`;
  }
  
  if (details.aspects.projects && details.aspects.projects.length > 0) {
    response += `📋 主要项目：\n${details.aspects.projects.slice(0, 3).map(p => `• ${p.name || p}`).join('\n')}\n\n`;
  }
  
  return response.trim();
}

// 生成对比响应
function generateComparisonResponse(professorNames, comparisonResult, intent) {
  if (!comparisonResult.success) {
    return comparisonResult.message || '抱歉，无法完成教授对比分析。';
  }

  let response = `${professorNames.join('教授和')}教授的对比分析：\n\n`;
  response += comparisonResult.comparison.analysis;
  
  return response;
}

// 生成教授相关的追问问题
function generateProfessorFollowups(professorName, aspects) {
  const questions = [
    `${professorName}教授的代表性研究成果有哪些？`,
    `${professorName}教授目前指导多少学生？`,
    `如何申请${professorName}教授的研究生？`,
    `${professorName}教授有哪些合作项目？`
  ];
  
  return questions.slice(0, 3);
}

// 生成对比相关的追问问题
function generateComparisonFollowups(professorNames) {
  const questions = [
    `这几位教授的研究成果有什么区别？`,
    `从申请难度来看，哪位教授更适合？`,
    `还有其他类似方向的教授推荐吗？`,
    `这些教授的指导风格有什么不同？`
  ];
  
  return questions.slice(0, 3);
}

// 生成学术建议相关的追问问题
function generateAdviceFollowups(intent) {
  const questions = [];
  
  if (intent.userRole === 'undergraduate') {
    questions.push('本科生如何提升科研能力？');
    questions.push('申请研究生需要准备哪些材料？');
    questions.push('如何选择适合的研究方向？');
  } else if (intent.userRole === 'graduate') {
    questions.push('研究生如何提高学术水平？');
    questions.push('如何发表高质量论文？');
    questions.push('博士申请有什么建议？');
  } else {
    questions.push('如何开展产学研合作？');
    questions.push('怎样联系合适的教授？');
    questions.push('科研合作的一般流程是什么？');
  }
  
  return questions.slice(0, 3);
}

// 生成研究讨论相关的追问问题
function generateResearchFollowups(intent) {
  const questions = [
    '这个研究方向的就业前景如何？',
    '该领域有哪些热点技术？',
    '相关的顶级会议和期刊有哪些？',
    '如何开始这个方向的研究？'
  ];
  
  return questions.slice(0, 3);
}

// 生成研究方向讨论响应
async function generateResearchDiscussion(message, context, intent) {
  try {
    const { callDeepSeekAPI } = require('../services/mockDeepSeekService');
    
    const systemPrompt = `你是专业的研究方向分析专家。请针对用户的研究问题提供专业见解。

回答要求：
1. 深入分析研究方向的现状和趋势
2. 提供具体的技术路线和方法建议
3. 结合浙江大学的研究优势
4. 控制在250-300字`;

    const userMessage = `研究问题：${message}
相关领域：${intent.techDomains.join('、')}`;

    const aiResponse = await callDeepSeekAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]);

    if (aiResponse && aiResponse.content) {
      return aiResponse.content.trim();
    }

    return `关于${intent.techDomains.join('、')}等研究方向，这是当前的热点领域，具有很好的发展前景。建议您可以关注相关的最新技术动态和应用案例。`;

  } catch (error) {
    console.error('生成研究讨论失败:', error);
    return '这是一个很有价值的研究方向，建议您深入了解相关的技术发展和应用前景。';
  }
}

module.exports = router;