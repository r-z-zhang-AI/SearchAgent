// 增强的多轮对话意图解析器
const { callDeepSeekAPI } = require('./mockDeepSeekService');

/**
 * 带上下文的消息分析
 * @param {string} message - 当前消息
 * @param {Array} context - 对话历史上下文
 * @returns {Object} 分析结果
 */
async function analyzeMessageWithContext(message, context = []) {
  try {
    console.log('开始分析带上下文的消息:', message);
    console.log('上下文长度:', context.length);

    // 提取上下文中的实体
    const contextEntities = extractContextEntities(context);
    console.log('上下文实体:', contextEntities);

    // 构建AI分析提示词
    const systemPrompt = `你是专业的对话意图分析专家。请分析用户消息的意图类型和具体内容。

对话意图类型：
1. professor_matching - 寻找/推荐教授
2. professor_deep_inquiry - 深入了解某个教授（研究方向、项目、经历等）
3. professor_comparison - 对比多个教授
4. academic_advice - 学术建议（申请、学习、研究建议）
5. research_discussion - 研究方向讨论
6. context_followup - 基于上文的追问（使用代词、指代等）
7. achievement_query - 查询成果
8. clarification_needed - 需要澄清
9. general_query - 一般问答

请返回JSON格式：
{
  "messageType": "意图类型",
  "intent": {
    "techDomains": ["技术领域"],
    "aspects": ["关注方面"],
    "userRole": "用户角色",
    "specificQuestions": ["具体问题"]
  },
  "contextReferences": {
    "usesPronoun": true/false,
    "referencedEntities": ["引用的实体"]
  }
}`;

    // 构建上下文摘要
    let contextSummary = '';
    if (context.length > 0) {
      contextSummary = '\n\n对话上下文:\n';
      const recentContext = context.slice(-3); // 只考虑最近3轮对话
      recentContext.forEach((item, index) => {
        if (item.role === 'user') {
          contextSummary += `用户${index + 1}: ${item.content}\n`;
        } else if (item.role === 'assistant') {
          contextSummary += `助手${index + 1}: ${item.content ? item.content.slice(0, 100) + '...' : '推荐了教授'}\n`;
          if (item.professors) {
            contextSummary += `  推荐教授: ${item.professors.map(p => p.name).join(', ')}\n`;
          }
        }
      });
    }

    const userMessage = `当前消息: ${message}${contextSummary}`;

    try {
      // 调用AI分析，设置5秒超时
      const aiResponse = await Promise.race([
        callDeepSeekAPI([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ], 3000),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI分析超时')), 5000)
        )
      ]);

      if (aiResponse && aiResponse.content) {
        const analysisResult = JSON.parse(aiResponse.content.trim());
        console.log('AI分析结果:', analysisResult);

        // 补充上下文实体信息
        analysisResult.contextEntities = contextEntities;

        return analysisResult;
      }
    } catch (aiError) {
      console.log('AI意图分析失败，使用规则分析:', aiError.message);
    }

    // AI失败时使用规则分析
    return analyzeWithRules(message, context, contextEntities);

  } catch (error) {
    console.error('消息意图分析失败:', error);
    return {
      messageType: 'general_query',
      intent: { techDomains: [], aspects: [], userRole: 'unknown' },
      contextEntities: { professors: [], topics: [] }
    };
  }
}

/**
 * 从上下文中提取实体信息
 * @param {Array} context - 对话历史
 * @returns {Object} 实体信息
 */
function extractContextEntities(context) {
  const entities = {
    professors: [],
    topics: [],
    techDomains: []
  };

  context.forEach(item => {
    // 提取提到的教授名字
    if (item.professors && Array.isArray(item.professors)) {
      item.professors.forEach(prof => {
        if (prof.name && !entities.professors.includes(prof.name)) {
          entities.professors.push(prof.name);
        }
      });
    }

    // 从消息内容中提取技术领域
    if (item.content) {
      const techKeywords = ['人工智能', 'AI', '机器学习', '深度学习', '计算机视觉', '自然语言处理', '数据挖掘', '大数据'];
      techKeywords.forEach(keyword => {
        if (item.content.includes(keyword) && !entities.techDomains.includes(keyword)) {
          entities.techDomains.push(keyword);
        }
      });
    }
  });

  return entities;
}

/**
 * 规则基础的意图分析（AI失败时的备用方案）
 * @param {string} message - 消息
 * @param {Array} context - 上下文
 * @param {Object} contextEntities - 上下文实体
 * @returns {Object} 分析结果
 */
function analyzeWithRules(message, context, contextEntities) {
  const lowerMessage = message.toLowerCase();

  // 检查是否使用代词或指代
  const pronouns = ['他', '她', '这个', '那个', '前面', '上面', '刚才'];
  const usesPronoun = pronouns.some(pronoun => message.includes(pronoun));

  // 深入了解某个教授
  if (message.includes('详细') || message.includes('具体') || message.includes('深入') || 
      message.includes('研究方向') || message.includes('项目') || message.includes('经历')) {
    if (contextEntities.professors.length > 0 || usesPronoun) {
      return {
        messageType: 'professor_deep_inquiry',
        intent: {
          techDomains: contextEntities.techDomains,
          aspects: extractAspects(message),
          userRole: 'student'
        },
        contextEntities,
        contextReferences: {
          usesPronoun,
          referencedEntities: contextEntities.professors
        }
      };
    }
  }

  // 对比分析
  if (message.includes('对比') || message.includes('比较') || message.includes('区别') || 
      message.includes('差异') || message.includes('和') && message.includes('哪个')) {
    return {
      messageType: 'professor_comparison',
      intent: {
        techDomains: contextEntities.techDomains,
        aspects: extractAspects(message),
        userRole: 'student'
      },
      contextEntities
    };
  }

  // 学术建议
  if (message.includes('申请') || message.includes('建议') || message.includes('如何') || 
      message.includes('怎么') || message.includes('需要') || message.includes('条件')) {
    return {
      messageType: 'academic_advice',
      intent: {
        techDomains: contextEntities.techDomains,
        aspects: extractAspects(message),
        userRole: detectUserRole(message)
      },
      contextEntities
    };
  }

  // 上下文跟进
  if (usesPronoun && contextEntities.professors.length > 0) {
    return {
      messageType: 'context_followup',
      intent: {
        techDomains: contextEntities.techDomains,
        aspects: extractAspects(message),
        userRole: 'student'
      },
      contextEntities,
      contextReferences: {
        usesPronoun: true,
        referencedEntities: contextEntities.professors
      }
    };
  }

  // 教授推荐
  if (message.includes('推荐') || message.includes('找') || message.includes('导师') || 
      message.includes('教授') || message.includes('老师')) {
    return {
      messageType: 'professor_matching',
      intent: {
        techDomains: extractTechDomains(message),
        aspects: extractAspects(message),
        userRole: detectUserRole(message)
      },
      contextEntities
    };
  }

  // 默认为一般问答
  return {
    messageType: 'general_query',
    intent: {
      techDomains: extractTechDomains(message),
      aspects: extractAspects(message),
      userRole: detectUserRole(message)
    },
    contextEntities
  };
}

/**
 * 提取用户关注的方面
 */
function extractAspects(message) {
  const aspects = [];
  
  if (message.includes('研究方向') || message.includes('研究')) aspects.push('research');
  if (message.includes('项目') || message.includes('课题')) aspects.push('projects');
  if (message.includes('论文') || message.includes('发表') || message.includes('成果')) aspects.push('publications');
  if (message.includes('经历') || message.includes('背景') || message.includes('简历')) aspects.push('experience');
  if (message.includes('申请') || message.includes('条件') || message.includes('要求')) aspects.push('application');
  if (message.includes('合作') || message.includes('项目合作')) aspects.push('collaboration');
  
  return aspects.length > 0 ? aspects : ['general'];
}

/**
 * 提取技术领域
 */
function extractTechDomains(message) {
  const domains = [];
  const techKeywords = [
    '人工智能', 'AI', '机器学习', '深度学习', '计算机视觉', 
    '自然语言处理', '数据挖掘', '大数据', '云计算', '区块链'
  ];
  
  techKeywords.forEach(keyword => {
    if (message.includes(keyword)) {
      domains.push(keyword);
    }
  });
  
  return domains;
}

/**
 * 检测用户角色
 */
function detectUserRole(message) {
  if (message.includes('本科') || message.includes('大学生')) return 'undergraduate';
  if (message.includes('研究生') || message.includes('硕士')) return 'graduate';
  if (message.includes('博士')) return 'phd';
  if (message.includes('企业') || message.includes('公司') || message.includes('工业界')) return 'industry';
  return 'student';
}

module.exports = {
  analyzeMessageWithContext,
  extractContextEntities,
  analyzeWithRules
};
