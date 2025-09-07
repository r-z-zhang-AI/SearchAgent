// 多轮对话处理服务 - 基于流程图的清晰判断逻辑
const { callDeepSeekAPI } = require('./mockDeepSeekService');
const { getProfessors } = require('./professorService');

/**
 * 核心对话流程控制器 - 按照流程图实现
 * @param {string} message - 用户输入
 * @param {Array} context - 对话上下文
 * @param {Object} db - 数据库实例
 * @returns {Object} 流程处理结果
 */
async function processDialogFlow(message, context = [], db) {
  try {
    console.log('🔄 开始对话流程处理:', message);
    
    // 第一步：判断是否为无关提问
    const relevanceCheck = await checkQuestionRelevance(message, context);
    if (!relevanceCheck.isRelevant) {
      return {
        flowStep: 'irrelevant_question',
        message: relevanceCheck.response,
        shouldEnd: true,
        flowPath: ['用户提问', '无关提问', '结束']
      };
    }

    // 第二步：判断需求是否明确
    const clarityCheck = await checkRequirementClarity(message, context);
    if (clarityCheck.isClear) {
      // 需求明确 - 直接返回结果
      const result = await generateDirectResponse(message, context, clarityCheck.intent, db);
      return {
        flowStep: 'clear_requirement',
        message: result.message,
        data: result.data,
        shouldEnd: false,
        flowPath: ['用户提问', '需求明确', '返回结果'],
        followupQuestions: result.followupQuestions
      };
    } else {
      // 需求不明确 - 引导提问
      const guidance = await generateGuidanceQuestions(message, context, clarityCheck.ambiguity);
      return {
        flowStep: 'unclear_requirement',
        message: guidance.message,
        clarificationQuestions: guidance.questions,
        shouldEnd: false,
        flowPath: ['用户提问', '需求不明确', '引导提问'],
        nextStep: 'waiting_clarification'
      };
    }

  } catch (error) {
    console.error('❌ 对话流程处理失败:', error);
    return {
      flowStep: 'error',
      message: '抱歉，系统处理出现问题，请重新描述您的需求。',
      shouldEnd: false,
      flowPath: ['用户提问', '系统错误']
    };
  }
}

/**
 * 检查问题相关性
 * @param {string} message - 用户消息
 * @param {Array} context - 对话上下文
 * @returns {Object} 相关性检查结果
 */
async function checkQuestionRelevance(message, context) {
  try {
    console.log('🔍 检查问题相关性...');
    
    // 定义相关关键词
    const relevantKeywords = [
      // 学术相关
      '教授', '导师', '老师', '研究', '科研', '学术', '论文', '项目',
      // 合作相关  
      '合作', '咨询', '联系', '申请', '推荐', '找', '寻找',
      // 技术领域
      '人工智能', 'AI', '机器学习', '深度学习', '计算机', '工程', '医学', '生物',
      // 学校相关
      '浙江大学', '浙大', '院系', '学院', '专业'
    ];

    const irrelevantKeywords = [
      '天气', '股票', '游戏', '娱乐', '八卦', '购物', '旅游', '美食',
      '电影', '音乐', '体育', '政治', '新闻', '笑话', '聊天'
    ];

    const lowerMessage = message.toLowerCase();
    
    // 检查是否包含相关关键词
    const hasRelevantKeyword = relevantKeywords.some(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    );
    
    // 检查是否包含无关关键词
    const hasIrrelevantKeyword = irrelevantKeywords.some(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    );

    // 综合判断
    if (hasIrrelevantKeyword && !hasRelevantKeyword) {
      return {
        isRelevant: false,
        response: '抱歉，我是浙江大学科研合作助手，专门帮助您寻找合适的教授和科研合作机会。请问您有什么学术或科研方面的需求吗？',
        reason: 'contains_irrelevant_keywords'
      };
    }

    // 使用AI进一步判断（如果关键词判断不明确）
    if (!hasRelevantKeyword && !hasIrrelevantKeyword) {
      const aiRelevanceCheck = await checkRelevanceWithAI(message, context);
      return aiRelevanceCheck;
    }

    return {
      isRelevant: true,
      reason: 'contains_relevant_keywords'
    };

  } catch (error) {
    console.error('相关性检查失败:', error);
    // 默认认为相关，避免误杀
    return { isRelevant: true, reason: 'error_default_relevant' };
  }
}

/**
 * 使用AI检查相关性
 * @param {string} message - 用户消息
 * @param {Array} context - 对话上下文
 * @returns {Object} AI相关性检查结果
 */
async function checkRelevanceWithAI(message, context) {
  try {
    const systemPrompt = `你是浙江大学科研合作助手的相关性判断器。
    
判断用户输入是否与以下主题相关：
- 寻找教授、导师、专家
- 科研合作、学术咨询
- 技术领域、研究方向
- 学术申请、项目合作
- 浙江大学相关信息

请返回JSON格式：
{
  "isRelevant": true/false,
  "confidence": 0.0-1.0,
  "reason": "判断理由"
}`;

    const aiResponse = await Promise.race([
      callDeepSeekAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `用户输入: ${message}` }
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI超时')), 3000))
    ]);

    if (aiResponse && aiResponse.content) {
      const result = JSON.parse(aiResponse.content.trim());
      return {
        isRelevant: result.isRelevant,
        response: result.isRelevant ? null : '抱歉，我专注于科研合作和教授推荐服务。请问您有什么学术方面的需求吗？',
        reason: result.reason,
        confidence: result.confidence
      };
    }

  } catch (error) {
    console.log('AI相关性检查失败，使用默认判断:', error.message);
  }

  // AI失败时默认相关
  return { isRelevant: true, reason: 'ai_check_failed_default_relevant' };
}

/**
 * 检查需求明确性
 * @param {string} message - 用户消息
 * @param {Array} context - 对话上下文
 * @returns {Object} 明确性检查结果
 */
async function checkRequirementClarity(message, context) {
  try {
    console.log('🔍 检查需求明确性...');
    
    const systemPrompt = `你是需求明确性分析专家。请判断用户的科研合作需求是否足够明确。

明确的需求应该包含：
1. 技术领域或研究方向
2. 合作类型（咨询、项目合作、申请等）
3. 具体的目标或问题

请返回JSON格式：
{
  "isClear": true/false,
  "clarity_score": 0.0-1.0,
  "intent": {
    "type": "professor_matching/academic_advice/research_inquiry",
    "techDomains": ["提取的技术领域"],
    "cooperationType": "合作类型",
    "specificGoal": "具体目标"
  },
  "ambiguity": {
    "missing_aspects": ["缺失的方面"],
    "vague_terms": ["模糊的表述"]
  }
}`;

    // 构建上下文信息
    let contextInfo = '';
    if (context.length > 0) {
      contextInfo = '\n\n对话历史:\n';
      context.slice(-3).forEach((item, index) => {
        contextInfo += `${item.role}: ${item.content}\n`;
      });
    }

    const aiResponse = await Promise.race([
      callDeepSeekAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `当前用户输入: ${message}${contextInfo}` }
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI超时')), 4000))
    ]);

    if (aiResponse && aiResponse.content) {
      const result = JSON.parse(aiResponse.content.trim());
      return result;
    }

  } catch (error) {
    console.log('AI明确性检查失败，使用规则判断:', error.message);
  }

  // AI失败时使用规则判断
  return checkClarityWithRules(message, context);
}

/**
 * 使用规则检查明确性
 * @param {string} message - 用户消息
 * @param {Array} context - 对话上下文
 * @returns {Object} 规则判断结果
 */
function checkClarityWithRules(message, context) {
  const lowerMessage = message.toLowerCase();
  
  // 技术领域关键词
  const techDomains = [];
  const techKeywords = {
    '人工智能': ['ai', '人工智能', '机器学习', '深度学习'],
    '计算机科学': ['计算机', '软件', '算法', '编程'],
    '生物医学': ['生物', '医学', '基因', '蛋白质'],
    '材料科学': ['材料', '化学', '物理', '纳米']
  };
  
  Object.entries(techKeywords).forEach(([domain, keywords]) => {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      techDomains.push(domain);
    }
  });

  // 合作类型关键词
  let cooperationType = 'general';
  if (lowerMessage.includes('咨询') || lowerMessage.includes('了解')) {
    cooperationType = 'consultation';
  } else if (lowerMessage.includes('合作') || lowerMessage.includes('项目')) {
    cooperationType = 'collaboration';
  } else if (lowerMessage.includes('申请') || lowerMessage.includes('导师')) {
    cooperationType = 'application';
  }

  // 判断明确性
  const isClear = techDomains.length > 0 && cooperationType !== 'general';
  
  return {
    isClear: isClear,
    clarity_score: isClear ? 0.8 : 0.3,
    intent: {
      type: 'professor_matching',
      techDomains: techDomains,
      cooperationType: cooperationType,
      specificGoal: isClear ? '寻找相关专家' : '不明确'
    },
    ambiguity: {
      missing_aspects: isClear ? [] : ['技术领域', '合作类型'],
      vague_terms: isClear ? [] : ['需求不够具体']
    }
  };
}

/**
 * 生成直接响应（需求明确时）
 * @param {string} message - 用户消息
 * @param {Array} context - 对话上下文
 * @param {Object} intent - 意图分析结果
 * @param {Object} db - 数据库实例
 * @returns {Object} 直接响应结果
 */
async function generateDirectResponse(message, context, intent, db) {
  try {
    console.log('✅ 需求明确，生成直接响应...');
    
    switch (intent.type) {
      case 'professor_matching':
        return await handleProfessorMatching(intent, db);
      
      case 'academic_advice':
        return await handleAcademicAdvice(message, context, intent);
      
      case 'research_inquiry':
        return await handleResearchInquiry(intent, db);
      
      default:
        return await handleGeneralInquiry(message, context);
    }

  } catch (error) {
    console.error('生成直接响应失败:', error);
    return {
      message: '抱歉，处理您的需求时出现问题，请稍后重试。',
      data: null,
      followupQuestions: []
    };
  }
}

/**
 * 处理教授匹配需求
 * @param {Object} intent - 意图信息
 * @param {Object} db - 数据库实例
 * @returns {Object} 匹配结果
 */
async function handleProfessorMatching(intent, db) {
  const { matchProfessors } = require('./matchingService');
  
  const matches = await matchProfessors(intent, db);
  
  if (matches.length === 0) {
    return {
      message: `抱歉，在${intent.techDomains.join('、')}领域没有找到完全匹配的教授。建议您尝试扩大搜索范围或者描述更具体的需求。`,
      data: { matches: [] },
      followupQuestions: [
        '可以推荐相关领域的教授吗？',
        '我想了解其他技术方向',
        '如何联系相关院系？'
      ]
    };
  }

  const topMatch = matches[0];
  return {
    message: `根据您在${intent.techDomains.join('、')}领域的${intent.cooperationType}需求，我找到了${matches.length}位相关教授。\n\n最匹配的是${topMatch.professor.name}教授（${topMatch.professor.department}），推荐理由：${topMatch.reasons.join('、')}`,
    data: {
      matches: matches.slice(0, 5),
      professors: matches.slice(0, 5).map(m => m.professor)
    },
    followupQuestions: [
      `了解${topMatch.professor.name}教授的详细研究方向`,
      `查看${topMatch.professor.name}教授的项目经历`,
      `如何联系${topMatch.professor.name}教授`,
      '查看其他推荐教授'
    ]
  };
}

/**
 * 处理学术建议需求
 * @param {string} message - 用户消息
 * @param {Array} context - 对话上下文  
 * @param {Object} intent - 意图信息
 * @returns {Object} 建议结果
 */
async function handleAcademicAdvice(message, context, intent) {
  const advice = await generateAcademicAdvice(message, context, intent);
  
  return {
    message: advice,
    data: { adviceType: 'academic_guidance' },
    followupQuestions: [
      '需要具体的申请步骤指导吗？',
      '想了解相关领域的就业前景？',
      '如何提升学术研究能力？'
    ]
  };
}

/**
 * 处理研究咨询需求
 * @param {Object} intent - 意图信息
 * @param {Object} db - 数据库实例
 * @returns {Object} 研究咨询结果
 */
async function handleResearchInquiry(intent, db) {
  const { queryAchievements } = require('./achievementService');
  
  const achievements = await queryAchievements(intent, db);
  
  return {
    message: `关于${intent.techDomains.join('、')}领域的研究现状，我为您找到了${achievements.length}项相关成果和研究。`,
    data: { achievements: achievements },
    followupQuestions: [
      '查看具体的研究成果',
      '了解该领域的发展趋势',
      '寻找相关领域的专家'
    ]
  };
}

/**
 * 处理一般咨询
 * @param {string} message - 用户消息
 * @param {Array} context - 对话上下文
 * @returns {Object} 一般回复结果
 */
async function handleGeneralInquiry(message, context) {
  const { generateGeneralReply } = require('./generalResponseService');
  
  const reply = await generateGeneralReply(message, context);
  
  return {
    message: reply,
    data: { responseType: 'general' },
    followupQuestions: [
      '我想找人工智能专家',
      '如何申请研究生导师',
      '浙大有哪些重点研究领域'
    ]
  };
}

/**
 * 生成引导问题（需求不明确时）
 * @param {string} message - 用户消息
 * @param {Array} context - 对话上下文
 * @param {Object} ambiguity - 模糊性分析
 * @returns {Object} 引导问题结果
 */
async function generateGuidanceQuestions(message, context, ambiguity) {
  try {
    console.log('🤔 需求不明确，生成引导问题...');
    
    const missingAspects = ambiguity.missing_aspects || [];
    let guidanceMessage = '为了更好地帮助您，我需要了解一些具体信息：\n\n';
    const questions = [];

    // 根据缺失的方面生成引导问题
    if (missingAspects.includes('技术领域')) {
      guidanceMessage += '• 您关注哪个技术领域或研究方向？\n';
      questions.push(
        '人工智能和机器学习',
        '生物医学工程',
        '材料科学与工程',
        '计算机科学与技术',
        '电子信息工程'
      );
    }

    if (missingAspects.includes('合作类型')) {
      guidanceMessage += '• 您希望进行哪种类型的合作？\n';
      questions.push(
        '技术咨询和问题解答',
        '联合研发项目合作',
        '学术指导和申请导师',
        '成果转化和产业化',
        '人才培养和实习机会'
      );
    }

    // 如果没有具体的缺失方面，提供通用引导
    if (missingAspects.length === 0) {
      guidanceMessage = '我可以帮您：\n\n• 推荐相关领域的专家教授\n• 提供学术申请建议\n• 解答科研合作问题\n\n请告诉我您的具体需求：';
      questions.push(
        '我想找AI领域的专家合作',
        '需要申请研究生导师的建议',
        '想了解某个研究方向的现状',
        '寻求技术问题的解答'
      );
    }

    return {
      message: guidanceMessage,
      questions: questions.slice(0, 5), // 最多5个选项
      guidanceType: missingAspects.length > 0 ? 'specific_missing' : 'general_guidance'
    };

  } catch (error) {
    console.error('生成引导问题失败:', error);
    return {
      message: '请告诉我您的具体需求，我会为您推荐合适的教授或提供相关建议。',
      questions: [
        '人工智能专家推荐',
        '研究生导师申请',
        '技术合作咨询',
        '学术建议指导'
      ],
      guidanceType: 'fallback'
    };
  }
}

/**
 * 获取教授详细信息
 * @param {string} professorName - 教授姓名
 * @param {Array} aspects - 关注方面 ['research', 'projects', 'publications', 'experience']
 * @param {Object} db - 数据库实例
 * @returns {Object} 详细信息
 */
async function getProfessorDetailedInfo(professorName, aspects = ['research'], db) {
  try {
    console.log('获取教授详细信息:', professorName, aspects);

    // 从数据库查找教授
    const professors = await getProfessors({ search: professorName, limit: 5 }, db);
    
    if (!professors.data || professors.data.length === 0) {
      return {
        found: false,
        message: `未找到名为"${professorName}"的教授信息`
      };
    }

    const professor = professors.data[0]; // 取最匹配的第一个
    console.log('找到教授:', professor.name);

    // 构建详细信息
    const details = {
      found: true,
      professor: professor,
      aspects: {}
    };

    // 根据请求的方面返回信息
    if (aspects.includes('research') || aspects.includes('general')) {
      details.aspects.research = {
        areas: professor.research_areas,
        description: await generateResearchDescription(professor)
      };
    }

    if (aspects.includes('projects')) {
      details.aspects.projects = professor.projects || [];
    }

    if (aspects.includes('publications')) {
      details.aspects.publications = professor.achievements || [];
    }

    if (aspects.includes('experience')) {
      details.aspects.experience = {
        title: professor.title,
        department: professor.department,
        bio: professor.introduction
      };
    }

    return details;

  } catch (error) {
    console.error('获取教授详细信息失败:', error);
    return {
      found: false,
      error: '获取教授详细信息时出现错误'
    };
  }
}

/**
 * 生成教授研究方向的详细描述
 * @param {Object} professor - 教授信息
 * @returns {string} 研究描述
 */
async function generateResearchDescription(professor) {
  try {
    const systemPrompt = `你是专业的学术研究分析师。请基于教授的研究方向信息，生成一段详细的研究介绍。

要求：
1. 200-300字的专业介绍
2. 突出研究的创新性和应用价值
3. 使用学术性语言但易于理解
4. 结构清晰，逻辑连贯`;

    const userMessage = `教授信息：
姓名：${professor.name}
研究方向：${professor.research_areas}
简介：${professor.introduction || '暂无'}`;

    const aiResponse = await callDeepSeekAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]);

    if (aiResponse && aiResponse.content) {
      return aiResponse.content.trim();
    }

    // AI失败时的备用描述
    return `${professor.name}教授在${professor.research_areas}等领域有深入的研究，是该领域的专家学者。`;

  } catch (error) {
    console.error('生成研究描述失败:', error);
    return `${professor.name}教授专注于${professor.research_areas}等研究方向。`;
  }
}

/**
 * 对比多个教授
 * @param {Array} professorNames - 教授姓名列表
 * @param {Array} aspects - 对比方面
 * @param {Object} db - 数据库实例
 * @returns {Object} 对比结果
 */
async function compareProfessors(professorNames, aspects = ['research'], db) {
  try {
    console.log('对比教授:', professorNames, aspects);

    const professorDetails = [];
    
    // 获取每个教授的信息
    for (const name of professorNames) {
      const detail = await getProfessorDetailedInfo(name, aspects, db);
      if (detail.found) {
        professorDetails.push(detail);
      }
    }

    if (professorDetails.length < 2) {
      return {
        success: false,
        message: '需要至少两个教授的信息才能进行对比'
      };
    }

    // 生成对比分析
    const comparison = await generateComparisonAnalysis(professorDetails, aspects);

    return {
      success: true,
      professors: professorDetails,
      comparison: comparison,
      aspects: aspects
    };

  } catch (error) {
    console.error('教授对比失败:', error);
    return {
      success: false,
      error: '教授对比时出现错误'
    };
  }
}

/**
 * 生成对比分析
 * @param {Array} professorDetails - 教授详细信息
 * @param {Array} aspects - 对比方面
 * @returns {Object} 对比分析
 */
async function generateComparisonAnalysis(professorDetails, aspects) {
  try {
    const systemPrompt = `你是专业的学术比较分析师。请对多个教授进行客观的对比分析。

分析要求：
1. 突出各自的研究特色和优势
2. 分析研究方向的差异和互补性
3. 客观公正，不做优劣判断
4. 结构化分析，条理清晰
5. 控制在200-300字`;

    const professorsInfo = professorDetails.map(detail => {
      return `教授：${detail.professor.name}
研究方向：${detail.professor.research_areas}
职位：${detail.professor.title}
院系：${detail.professor.department}`;
    }).join('\n\n');

    const userMessage = `请对比分析以下教授：

${professorsInfo}

对比重点：${aspects.join('、')}`;

    const aiResponse = await callDeepSeekAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]);

    if (aiResponse && aiResponse.content) {
      return {
        analysis: aiResponse.content.trim(),
        generated: true
      };
    }

    // AI失败时的备用分析
    return {
      analysis: generateBasicComparison(professorDetails),
      generated: false
    };

  } catch (error) {
    console.error('生成对比分析失败:', error);
    return {
      analysis: generateBasicComparison(professorDetails),
      generated: false
    };
  }
}

/**
 * 基础对比分析（备用方案）
 * @param {Array} professorDetails - 教授详细信息
 * @returns {string} 基础对比
 */
function generateBasicComparison(professorDetails) {
  const names = professorDetails.map(d => d.professor.name);
  const researches = professorDetails.map(d => d.professor.research_areas);
  
  return `${names.join('教授和')}教授在研究方向上各有特色：${names[0]}教授专注于${researches[0]}，而${names[1]}教授的研究重点是${researches[1]}。两位教授都是各自领域的专家，可以根据您的具体研究兴趣进行选择。`;
}

/**
 * 生成学术建议
 * @param {string} message - 用户消息
 * @param {Array} context - 对话上下文
 * @param {Object} intent - 意图分析结果
 * @returns {string} 学术建议
 */
async function generateAcademicAdvice(message, context, intent) {
  try {
    const systemPrompt = `你是专业的学术顾问。请根据用户的问题提供专业的学术建议。

建议要求：
1. 针对性强，实用可行
2. 结构清晰，步骤明确
3. 语言亲切，鼓励支持
4. 控制在200-250字
5. 根据用户角色（本科生/研究生/博士生）调整建议内容`;

    // 构建上下文信息
    let contextInfo = '';
    if (context.length > 0) {
      const recentContext = context.slice(-2);
      contextInfo = '\n\n相关背景：\n';
      recentContext.forEach(item => {
        if (item.professors) {
          contextInfo += `提到的教授：${item.professors.map(p => p.name).join(', ')}\n`;
        }
      });
    }

    const userMessage = `用户问题：${message}
用户角色：${intent.userRole}
关注领域：${intent.techDomains.join('、')}${contextInfo}`;

    const aiResponse = await callDeepSeekAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]);

    if (aiResponse && aiResponse.content) {
      return aiResponse.content.trim();
    }

    // AI失败时的备用建议
    return generateBasicAdvice(intent);

  } catch (error) {
    console.error('生成学术建议失败:', error);
    return generateBasicAdvice(intent);
  }
}

/**
 * 基础学术建议（备用方案）
 * @param {Object} intent - 意图信息
 * @returns {string} 基础建议
 */
function generateBasicAdvice(intent) {
  const role = intent.userRole;
  const domains = intent.techDomains;
  
  if (role === 'undergraduate') {
    return `作为本科生，建议您：1. 扎实学好基础课程；2. 多参与相关项目实践；3. 提前了解感兴趣的研究方向；4. 积极与导师交流，了解研究生申请要求。${domains.length > 0 ? `在${domains.join('、')}等领域，可以多关注相关的前沿动态和应用案例。` : ''}`;
  } else if (role === 'graduate') {
    return `作为研究生，建议您：1. 深入学习专业知识；2. 积极参与科研项目；3. 注重学术论文的阅读和写作；4. 多与导师和同行交流学术问题。${domains.length > 0 ? `在${domains.join('、')}等方向上，可以考虑选择具体的研究课题进行深入研究。` : ''}`;
  } else {
    return '建议您根据自己的具体情况和研究兴趣，选择合适的导师和研究方向。可以多了解相关教授的研究成果和指导风格，找到最适合自己发展的方向。';
  }
}

/**
 * 处理上下文跟进
 * @param {string} message - 当前消息
 * @param {Array} context - 对话上下文
 * @param {Object} contextEntities - 上下文实体
 * @returns {Object} 跟进响应
 */
async function handleContextFollowup(message, context, contextEntities) {
  try {
    console.log('处理上下文跟进:', message, contextEntities);

    // 找到最近提到的教授
    const recentProfessor = contextEntities.professors[0];
    
    if (!recentProfessor) {
      return {
        message: '抱歉，我需要更多上下文信息才能回答您的问题。请您再具体说明一下。',
        action: 'context_missing',
        followupQuestions: ['您想了解哪位教授？', '您指的是什么内容？']
      };
    }

    // 根据问题类型生成回答
    let response = '';
    const lowerMessage = message.toLowerCase();

    if (message.includes('研究方向') || message.includes('研究什么')) {
      response = `${recentProfessor}教授的主要研究方向包括...（这里会调用具体的研究方向查询功能）`;
    } else if (message.includes('项目') || message.includes('课题')) {
      response = `${recentProfessor}教授目前主要负责的项目有...（这里会调用项目信息查询功能）`;
    } else if (message.includes('申请') || message.includes('如何联系')) {
      response = `关于申请${recentProfessor}教授的研究生，建议您...（这里会提供申请建议）`;
    } else {
      response = `关于${recentProfessor}教授，我可以为您介绍研究方向、项目经历、申请要求等信息。请您具体说明想了解哪个方面。`;
    }

    return {
      message: response,
      action: 'context_resolved',
      referencedProfessor: recentProfessor,
      followupQuestions: [
        `${recentProfessor}教授的详细研究方向是什么？`,
        `${recentProfessor}教授有哪些代表性项目？`,
        `如何申请${recentProfessor}教授的研究生？`
      ]
    };

  } catch (error) {
    console.error('处理上下文跟进失败:', error);
    return {
      message: '抱歉，处理您的问题时出现了错误，请重新描述一下您的问题。',
      action: 'context_error',
      followupQuestions: []
    };
  }
}

module.exports = {
  // 新的流程控制功能
  processDialogFlow,
  processClarification,
  checkQuestionRelevance,
  checkRequirementClarity,
  generateDirectResponse,
  generateGuidanceQuestions,
  
  // 保留的原有功能
  getProfessorDetailedInfo,
  compareProfessors,
  generateAcademicAdvice,
  handleContextFollowup,
  generateResearchDescription
};
