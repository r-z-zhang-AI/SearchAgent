const { callDeepSeekAPI } = require('./mockDeepSeekService');

// 简单的内存缓存
const reasonsCache = new Map();

// 解析用户意图
async function parseIntent(userInput, context = []) {
  try {
    const prompt = `请分析以下用户输入，判断用户意图并提取关键信息：

用户输入：${userInput}

${context.length > 0 ? `对话上下文：
${context.map((msg, i) => `${i % 2 === 0 ? '用户' : '系统'}：${msg}`).join('\n')}
` : ''}

请以JSON格式返回以下信息：
{
  "isProfessorMatching": true/false, // 是否是寻找教授进行科研合作的需求
  "isAchievementQuery": true/false, // 是否是查询科研成果的需求
  "isVague": true/false, // 需求是否模糊，需要进一步澄清。只有当完全无法判断用户的技术领域和合作类型时才设为true
  "techDomains": ["技术领域1", "技术领域2"], // 用户提到的技术领域，尽可能从用户输入中提取，即使只是暗示或间接提及的领域
  "cooperationType": "合作类型", // 用户希望的合作类型，尽可能从用户输入中提取，如果用户提到"找专家"或"咨询"等词语，可以判断为"技术咨询"
  "requirements": ["具体要求1", "具体要求2"], // 用户的具体要求
  "query": "查询内容", // 如果是查询类请求，这里填写查询的具体内容
  "professorName": "教授姓名", // 如果用户提到了特定教授，填写教授姓名
  "urgency": "紧急程度",
  "budget": "预算范围"
}

技术领域包括：人工智能、机器学习、计算机视觉、自然语言处理、数据科学、生物信息学、材料科学、化学工程、机械工程、电子工程、环境科学、医学、经济学、管理学等。

合作类型包括：技术咨询、联合研发、人才培养、成果转化、专利申请等。

请确保返回的是有效的JSON格式。`;

    // 调用原生 DeepSeek API，设置10秒超时
    const response = await callDeepSeekAPI([
      {
        role: 'system',
        content: '你是一个专业的科研需求分析助手，能够准确解析企业用户的科研合作需求。'
      },
      {
        role: 'user',
        content: prompt
      }
    ], 10000, {
      temperature: 0.3,
      max_tokens: 500
    });

    if (response.success && response.content) {
      // 处理可能包含Markdown代码块的情况
      let jsonStr = response.content;
      
      // 移除可能的Markdown代码块标记
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n|\n```/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n|\n```/g, '');
      }
      
      // 尝试找到JSON对象的开始和结束位置
      const startIdx = jsonStr.indexOf('{');
      const endIdx = jsonStr.lastIndexOf('}') + 1;
      
      if (startIdx >= 0 && endIdx > startIdx) {
        jsonStr = jsonStr.substring(startIdx, endIdx);
      }
      
      const parsed = JSON.parse(jsonStr);
      return {
        originalQuery: userInput,
        ...parsed
      };
    } else {
      throw new Error('DeepSeek API 返回异常');
    }

  } catch (error) {
    console.error('Intent parsing error:', error);
    
    // 如果是超时或网络错误，使用本地解析作为备选
    if (error.message && (error.message.includes('超时') || error.message.includes('timeout'))) {
      console.log('使用本地简化解析作为备选');
      return parseIntentLocally(userInput);
    }
    
    // 返回默认结构
    return {
      originalQuery: userInput,
      isProfessorMatching: false,
      isAchievementQuery: false,
      isVague: true,
      techDomains: [],
      cooperationType: 'general',
      requirements: [],
      urgency: 'normal',
      budget: 'unknown'
    };
  }
}
// 生成匹配理由
async function generateMatchReasons(intent, professor) {
  // 生成缓存键
  const cacheKey = `${intent.originalQuery}-${professor.id || professor.name}`;

  // 检查缓存
  if (reasonsCache.has(cacheKey)) {
    return reasonsCache.get(cacheKey);
  }

  try {
    const prompt = `请为以下匹配生成理由：

企业需求：${intent.originalQuery}
技术领域：${(intent.techDomains || []).join(', ') || '未指定'}
合作类型：${intent.cooperationType || '未指定'}

教授信息：
姓名：${professor.name}
院系：${professor.department}
研究方向：${(professor.research_areas || []).join(', ') || '未提供'}
代表性成果：${(professor.achievements || []).slice(0, 3).map(a => a.title).join(', ') || '未提供'}

要求：
1. 生成2-3条简洁的匹配理由
2. 每条理由不超过80字
3. 突出关键匹配点，避免冗余描述
4. 用中文回答，每条理由用分号分隔
5. 语言简洁明了，重点突出`;

    // 使用原生 DeepSeek API，设置8秒超时
    const response = await callDeepSeekAPI([
      {
        role: 'system',
        content: '你是一个专业的科研匹配助手。请生成简洁精准的匹配理由，每条理由不超过80字，重点突出关键匹配点，避免冗余表述。'
      },
      {
        role: 'user',
        content: prompt
      }
    ], 8000, {
      temperature: 0.3,
      max_tokens: 200
    });

    if (response.success && response.content) {
      const rawReasons = response.content.split(';').map(reason => reason.trim()).filter(reason => reason);
      
      // 确保每条理由不超过80字
      const reasons = rawReasons.map(reason => {
        if (reason.length > 80) {
          return reason.slice(0, 77) + '...';
        }
        return reason;
      });

      console.log('生成的匹配理由:', reasons);

      // 缓存结果
      reasonsCache.set(cacheKey, reasons);

      // 限制缓存大小，避免内存泄漏
      if (reasonsCache.size > 1000) {
        const firstKey = reasonsCache.keys().next().value;
        reasonsCache.delete(firstKey);
      }

      return reasons;
    } else {
      throw new Error('DeepSeek API 生成理由失败');
    }

  } catch (error) {
    console.error('Generate reasons error:', error);
    const fallbackReasons = [`${professor.name}教授的研究方向与您的需求相关`];

    // 也缓存失败的结果，避免重复请求
    reasonsCache.set(cacheKey, fallbackReasons);

    return fallbackReasons;
  }
}

// 本地简化意图解析（备选方案）
function parseIntentLocally(userInput) {
  console.log('使用本地简化解析:', userInput);
  
  const input = userInput.toLowerCase();
  const result = {
    originalQuery: userInput,
    isProfessorMatching: false,
    isAchievementQuery: false,
    isVague: true,
    techDomains: [],
    cooperationType: 'general',
    requirements: [],
    urgency: 'normal',
    budget: 'unknown'
  };

  // 检测是否是教授匹配需求
  const professorKeywords = ['教授', '专家', '老师', '导师', '合作', '找人', '寻找', '推荐'];
  const hasProfessorKeyword = professorKeywords.some(keyword => input.includes(keyword));
  
  if (hasProfessorKeyword) {
    result.isProfessorMatching = true;
    result.isVague = false;
  }

  // 检测技术领域
  const techDomainMap = {
    '人工智能': ['ai', '人工智能', '机器学习', 'ml', '深度学习', 'deep learning'],
    '计算机视觉': ['计算机视觉', 'cv', '图像识别', '视觉', '图像处理'],
    '自然语言处理': ['nlp', '自然语言', '文本处理', '语言模型'],
    '数据科学': ['数据科学', '数据分析', '大数据', 'data'],
    '生物信息学': ['生物', '基因', '蛋白质', '生物信息'],
    '材料科学': ['材料', '化学', '物理'],
    '机械工程': ['机械', '制造', '工程'],
    '电子工程': ['电子', '电气', '通信', '芯片'],
    '环境科学': ['环境', '生态', '污染'],
    '医学': ['医学', '医疗', '健康', '临床'],
    '经济学': ['经济', '金融', '市场'],
    '管理学': ['管理', '商业', '营销']
  };

  for (const [domain, keywords] of Object.entries(techDomainMap)) {
    if (keywords.some(keyword => input.includes(keyword))) {
      result.techDomains.push(domain);
      result.isVague = false;
    }
  }

  // 检测合作类型
  if (input.includes('咨询') || input.includes('问') || input.includes('了解')) {
    result.cooperationType = '技术咨询';
  } else if (input.includes('合作') || input.includes('项目') || input.includes('开发')) {
    result.cooperationType = '联合研发';
  } else if (input.includes('培训') || input.includes('学习') || input.includes('指导')) {
    result.cooperationType = '人才培养';
  }

  // 检测成果查询
  const achievementKeywords = ['成果', '论文', '专利', '项目', '研究', '发表'];
  if (achievementKeywords.some(keyword => input.includes(keyword)) && !result.isProfessorMatching) {
    result.isAchievementQuery = true;
    result.query = userInput;
  }

  console.log('本地解析结果:', result);
  return result;
}

module.exports = {
  parseIntent,
  generateMatchReasons
};